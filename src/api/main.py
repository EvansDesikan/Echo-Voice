"""
Backend Engineer — FastAPI Application Entry Point
Wires together all routes and starts the async application.
"""
import asyncio
import base64
import secrets
import traceback
import uuid
from contextlib import asynccontextmanager
from typing import Dict, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger
from pydantic import BaseModel

from config.settings import settings
from src.agent.conversation import ConversationAgent, ClientProfile
from src.agent.personality import render_system_prompt
from src.agent.stt import WhisperSTT
from src.agent.voice_clone import VoiceCloneManager
from src.data.database import init_db, get_db, AsyncSessionFactory, Client, QuestionnaireResponse, VoiceRecording, ConversationSession
from src.questionnaire.scorer import process_questionnaire
from src.voice.enrollment import VoiceEnrollmentManager

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError


# ─── Active sessions (in-memory, keyed by session_id) ───────────────────────
active_sessions: Dict[str, ConversationAgent] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ECHO Voice API starting...")
    await init_db()
    logger.success("Database initialised")
    yield
    logger.info("ECHO Voice API shutting down")


app = FastAPI(
    title="ECHO Voice API",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "https://echo-voice-liard.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request / Response models ────────────────────────────────────────────────

class ConsentRequest(BaseModel):
    client_name: str
    email: str
    language: str = "de"
    consented: bool

class QuestionnaireSubmission(BaseModel):
    client_id: str
    answers: Dict[str, int]   # {question_id: 1-5}

class PhraseSubmission(BaseModel):
    client_id: str
    phrases: list[str]

class MemorySubmission(BaseModel):
    client_id: str
    memories: list[dict]      # [{text, source, memory_type}]

class StartSessionRequest(BaseModel):
    client_id: str
    family_member_name: Optional[str] = None

class StartSessionByEmailRequest(BaseModel):
    email: str
    family_member_name: Optional[str] = None

class StartSessionByCodeRequest(BaseModel):
    access_code: str
    family_member_name: Optional[str] = None

class TextChatRequest(BaseModel):
    session_id: str
    message: str


# ─── Onboarding routes ────────────────────────────────────────────────────────

@app.post("/onboard/consent", status_code=status.HTTP_201_CREATED)
async def register_client_with_consent(
    req: ConsentRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Step 1 of onboarding: record consent and create client record.
    GDPR: consent is mandatory — no data is collected without this.
    """
    if not req.consented:
        raise HTTPException(status_code=400, detail="Consent is required to proceed.")

    from datetime import datetime
    client = Client(
        full_name=req.client_name,
        email=req.email,
        language=req.language,
        consent_given=True,
        consent_timestamp=datetime.utcnow(),
    )
    db.add(client)
    try:
        await db.commit()
        await db.refresh(client)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="An account with this email address already exists.",
        )

    logger.info(f"New client registered: {client.id} ({client.full_name})")
    return {"client_id": str(client.id), "message": "Consent recorded. Welcome to ECHO Voice."}


@app.post("/onboard/questionnaire")
async def submit_questionnaire(
    req: QuestionnaireSubmission,
    db: AsyncSession = Depends(get_db),
):
    """Step 2: process personality questionnaire and store OCEAN scores."""
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(req.client_id)))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    personality = process_questionnaire(req.answers)

    q = QuestionnaireResponse(
        client_id=client.id,
        answers=req.answers,
        ocean_scores=personality["ocean_scores"],
        behavioral_tags=personality["behavioral_tags"],
    )
    db.add(q)

    client.personality_scores = personality
    await db.commit()

    logger.info(f"Questionnaire stored for {client.id}. OCEAN: {personality['ocean_scores']}")
    return {
        "status": "ok",
        "ocean_scores": personality["ocean_scores"],
        "behavioral_tags": personality["behavioral_tags"],
    }


@app.post("/onboard/phrases")
async def submit_phrases(
    req: PhraseSubmission,
    db: AsyncSession = Depends(get_db),
):
    """Step 3: store the client's personal phrase bank."""
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(req.client_id)))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client.phrase_bank = req.phrases
    await db.commit()
    logger.info(f"Phrase bank saved for {client.id}: {len(req.phrases)} phrases")
    return {"status": "ok", "phrase_count": len(req.phrases)}


@app.post("/onboard/memories")
async def add_memories(req: MemorySubmission):
    """Step 4: add personal memories to the vector store."""
    from src.agent.memory_rag import MemoryStore
    store = MemoryStore(req.client_id)
    ids = store.add_memories_bulk(req.memories)
    logger.info(f"Added {len(ids)} memories for client {req.client_id}")
    return {"status": "ok", "memories_added": len(ids)}


@app.post("/onboard/phrase-recording", status_code=status.HTTP_201_CREATED)
async def upload_phrase_recording(
    client_id: str = Form(...),
    phrase_text: str = Form(...),
    duration_seconds: float = Form(0),
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload an audio recording of the client speaking a specific phrase.
    Runs Whisper STT and returns the transcription for client review/correction.
    Audio is saved as recording_type="phrase" to enrich the voice clone bank.
    """
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(client_id)))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    audio_bytes = await audio.read()

    # STT — detect what the client actually said
    stt = WhisperSTT.get_instance()
    transcription = await stt.transcribe_bytes(audio_bytes, language=client.language or None)

    # Upload to R2 — use phrase index based on existing phrase recording count
    recs_result = await db.execute(
        select(VoiceRecording).where(
            VoiceRecording.client_id == client.id,
            VoiceRecording.recording_type == "phrase",
        )
    )
    phrase_count = len(recs_result.scalars().all())

    enrollment = VoiceEnrollmentManager()
    object_key, duration = await enrollment.upload_recording(
        client_id=client_id,
        audio_bytes=audio_bytes,
        recording_type="phrase",
        index=phrase_count,
        duration_seconds=duration_seconds,
    )

    # Persist metadata
    recording = VoiceRecording(
        client_id=client.id,
        minio_object_key=object_key,
        duration_seconds=duration,
        recording_type="phrase",
        label=phrase_text[:512],
        transcription=transcription,
    )
    db.add(recording)
    await db.commit()

    logger.info(f"Phrase recording saved: '{phrase_text[:40]}' → {object_key}, stt='{transcription[:60]}'")
    return {
        "transcription": transcription,
        "object_key": object_key,
        "duration_seconds": duration,
    }


@app.post("/onboard/memory-voice")
async def transcribe_memory_voice(
    client_id: str = Form(...),
    duration_seconds: float = Form(0),
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Transcribe a spoken memory and return the text to the client for review/editing.
    Also saves the audio as a spontaneous recording (enriches the voice clone bank silently).
    The transcription is returned immediately; the R2 upload runs as a background task.
    """
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(client_id)))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    audio_bytes = await audio.read()

    # STT — primary purpose, must complete before we return
    stt = WhisperSTT.get_instance()
    transcription = await stt.transcribe_bytes(audio_bytes, language=client.language or None)

    # Count existing spontaneous recordings to get next index (offset by 100 to avoid collision)
    recs_result = await db.execute(
        select(VoiceRecording).where(
            VoiceRecording.client_id == client.id,
            VoiceRecording.recording_type == "spontaneous",
        )
    )
    spontaneous_count = len(recs_result.scalars().all())
    next_index = 100 + spontaneous_count
    client_id_str = str(client.id)
    transcription_label = transcription[:80]

    async def _upload_to_r2():
        """Background task: upload audio to R2 and persist DB record."""
        try:
            enrollment = VoiceEnrollmentManager()
            object_key, dur = await enrollment.upload_recording(
                client_id=client_id_str,
                audio_bytes=audio_bytes,
                recording_type="spontaneous",
                index=next_index,
                duration_seconds=duration_seconds,
            )
            async with AsyncSessionFactory() as bg_db:
                rec = VoiceRecording(
                    client_id=client.id,
                    minio_object_key=object_key,
                    duration_seconds=dur,
                    recording_type="spontaneous",
                    label=f"Memory voice: {transcription_label}",
                    transcription=transcription,
                )
                bg_db.add(rec)
                await bg_db.commit()
            logger.info(f"Memory voice recording saved to R2: {object_key}")
        except Exception as e:
            logger.warning(f"Memory voice background upload failed for {client_id_str}: {e}")

    asyncio.create_task(_upload_to_r2())

    logger.info(f"Memory voice transcribed for client {client_id}: '{transcription[:80]}'")
    return {"transcription": transcription}


@app.post("/onboard/voice-upload", status_code=status.HTTP_201_CREATED)
async def upload_voice_recording(
    client_id: str = Form(...),
    recording_type: str = Form(...),
    index: int = Form(0),
    duration_seconds: float = Form(0),
    label: str = Form(""),
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload a voice recording blob to Cloudflare R2 and persist metadata to Postgres."""
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(client_id)))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    audio_bytes = await audio.read()
    logger.info(f"voice-upload: client={client_id} type={recording_type} index={index} size={len(audio_bytes)}b")

    try:
        enrollment = VoiceEnrollmentManager()
        object_key, duration = await enrollment.upload_recording(
            client_id=client_id,
            audio_bytes=audio_bytes,
            recording_type=recording_type,
            index=index,
            duration_seconds=duration_seconds,
        )
    except Exception as e:
        logger.error(f"R2 upload failed for client {client_id} recording {index}:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Audio upload to storage failed: {e}")

    try:
        recording = VoiceRecording(
            client_id=client.id,
            minio_object_key=object_key,
            duration_seconds=duration,
            recording_type=recording_type,
            label=label or None,
        )
        db.add(recording)
        await db.commit()
    except Exception as e:
        logger.error(f"DB insert failed for {object_key}:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Database write failed: {e}")

    logger.info(f"Voice recording saved: {object_key} ({duration:.1f}s) for client {client_id}")
    return {"object_key": object_key, "duration_seconds": duration}


@app.get("/onboard/voice-recordings/{client_id}")
async def get_voice_recordings(
    client_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Return all voice recordings for this client, with presigned R2 URLs for playback."""
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(client_id)))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    recs_result = await db.execute(
        select(VoiceRecording).where(VoiceRecording.client_id == client.id)
    )
    recs = recs_result.scalars().all()
    enrollment = VoiceEnrollmentManager()

    # For recordings with no stored label (uploaded before the label column was added),
    # reconstruct the prompt text from the ordered position within each recording type.
    lang = client.language or "de"
    scripted_prompts = enrollment.get_scripted_prompts(lang)
    spontaneous_topics = enrollment.get_spontaneous_topics(lang)
    scripted_counter = 0
    spontaneous_counter = 0

    def resolve_label(r: VoiceRecording) -> str:
        nonlocal scripted_counter, spontaneous_counter
        if r.label:
            return r.label
        if r.recording_type == "scripted":
            idx = scripted_counter
            scripted_counter += 1
            return scripted_prompts[idx][:80] if idx < len(scripted_prompts) else f"Scripted {idx + 1}"
        else:
            idx = spontaneous_counter
            spontaneous_counter += 1
            return spontaneous_topics[idx][:80] if idx < len(spontaneous_topics) else f"Spontaneous {idx + 1}"

    return {
        "recordings": [
            {
                "index": i,
                "object_key": r.minio_object_key,
                "duration_seconds": r.duration_seconds,
                "recording_type": r.recording_type,
                "label": resolve_label(r),
                "uploaded_at": r.uploaded_at.isoformat(),
                "playback_url": enrollment.get_download_url(r.minio_object_key, expires_hours=1),
            }
            for i, r in enumerate(recs)
        ],
        "total_duration": sum(r.duration_seconds for r in recs),
    }


@app.post("/onboard/create-voice-clone")
async def create_voice_clone(
    client_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Download all client recordings from R2, create ElevenLabs voice clone, store voice_id."""
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(client_id)))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    recordings_result = await db.execute(
        select(VoiceRecording).where(VoiceRecording.client_id == client.id)
    )
    recordings = recordings_result.scalars().all()
    if not recordings:
        raise HTTPException(status_code=400, detail="No recordings found for this client")

    enrollment = VoiceEnrollmentManager()
    temp_paths = []
    try:
        for rec in recordings:
            path = await enrollment.download_to_tempfile(rec.minio_object_key)
            temp_paths.append(path)

        voice_manager = VoiceCloneManager()
        voice_id = await voice_manager.create_voice_clone(
            client_name=client.full_name,
            audio_file_paths=temp_paths,
        )
    finally:
        for p in temp_paths:
            try:
                p.unlink()
            except Exception:
                pass

    client.elevenlabs_voice_id = voice_id
    await db.commit()

    logger.success(f"Voice clone created for {client.id}: {voice_id}")
    return {"voice_id": voice_id}


@app.post("/onboard/build-personality")
async def build_personality_prompt(
    client_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Final step: render and store the personality system prompt from all collected data."""
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(client_id)))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if not client.personality_scores:
        raise HTTPException(status_code=400, detail="Questionnaire not yet completed")

    prompt = render_system_prompt(
        client_name=client.full_name,
        ocean_scores=client.personality_scores["ocean_scores"],
        behavioral_tags=client.personality_scores["behavioral_tags"],
        phrase_bank=client.phrase_bank or [],
        language=client.language,
    )
    client.personality_prompt = prompt
    client.onboarding_complete = True
    await db.commit()

    logger.success(f"Personality prompt built for {client.id}")
    return {"status": "ok", "prompt_length": len(prompt)}


# ─── Auth routes ─────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str

@app.post("/auth/login")
async def login(
    req: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Look up an existing client by email and return their profile state."""
    result = await db.execute(select(Client).where(Client.email == req.email))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="No account found with this email address.")

    recs_result = await db.execute(
        select(VoiceRecording).where(VoiceRecording.client_id == client.id)
    )
    recording_count = len(recs_result.scalars().all())

    # Auto-generate access code for complete clients who don't have one yet
    if client.onboarding_complete and not client.family_access_code:
        client.family_access_code = await _generate_unique_code(db)
        await db.commit()

    logger.info(f"Login: {client.id} ({client.email}), {recording_count} recordings")
    return {
        "client_id": str(client.id),
        "client_name": client.full_name,
        "onboarding_complete": client.onboarding_complete,
        "has_voice_clone": bool(client.elevenlabs_voice_id),
        "has_personality": bool(client.personality_scores),
        "has_phrases": bool(client.phrase_bank),
        "voice_recording_count": recording_count,
    }


# ─── Interaction routes ───────────────────────────────────────────────────────

# Maps session_id → DB ConversationSession UUID (for turn count updates)
_session_db_ids: Dict[str, uuid.UUID] = {}


async def _build_session(client: Client, family_member_name: Optional[str], db: AsyncSession) -> dict:
    """Shared logic: validate client, create agent + DB session record."""
    if not client.onboarding_complete:
        raise HTTPException(status_code=400, detail="This memorial has not been set up yet. Please check back later.")
    if not client.elevenlabs_voice_id:
        raise HTTPException(status_code=400, detail="Voice profile is not ready yet.")

    profile = ClientProfile(
        client_id=str(client.id),
        client_name=client.full_name,
        elevenlabs_voice_id=client.elevenlabs_voice_id,
        personality_prompt=client.personality_prompt,
        language=client.language,
    )

    session_id = str(uuid.uuid4())
    active_sessions[session_id] = ConversationAgent(profile)

    # Persist session to DB for audit + admin visibility
    db_session = ConversationSession(
        client_id=client.id,
        family_member_name=family_member_name or None,
        language=client.language,
    )
    db.add(db_session)
    await db.commit()
    await db.refresh(db_session)
    _session_db_ids[session_id] = db_session.id

    logger.info(f"Session {session_id} started for client {client.id} by '{family_member_name or 'anonymous'}'")
    return {
        "session_id": session_id,
        "client_name": client.full_name,
        "language": client.language,
    }


@app.post("/session/start")
async def start_session(
    req: StartSessionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create a new conversation session by client UUID (internal use)."""
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(req.client_id)))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return await _build_session(client, req.family_member_name, db)


@app.post("/session/start-by-email")
async def start_session_by_email(
    req: StartSessionByEmailRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new conversation session by the client's email address.
    This is the primary family access endpoint — family members enter the
    email of their deceased loved one to connect with their memorial.
    """
    result = await db.execute(select(Client).where(Client.email == req.email.strip().lower()))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="No memorial found for that email address.")
    return await _build_session(client, req.family_member_name, db)


# Charset for access codes: uppercase, no ambiguous chars (0/O/1/I/L)
_CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'


async def _generate_unique_code(db: AsyncSession) -> str:
    """Generate a unique 8-char access code, checking DB for collisions."""
    for _ in range(20):
        code = ''.join(secrets.choice(_CODE_CHARSET) for _ in range(8))
        result = await db.execute(select(Client).where(Client.family_access_code == code))
        if not result.scalar_one_or_none():
            return code
    raise HTTPException(status_code=500, detail="Could not generate a unique access code — please try again.")


@app.post("/session/start-by-code")
async def start_session_by_code(
    req: StartSessionByCodeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new conversation session using the client's family access code.
    This is the primary family access endpoint — family members enter the code
    shared by their loved one to connect with their memorial.
    """
    code = req.access_code.strip().upper().replace('-', '')
    result = await db.execute(select(Client).where(Client.family_access_code == code))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="No memorial found for that access code.")
    return await _build_session(client, req.family_member_name, db)


@app.post("/client/{client_id}/generate-access-code")
async def generate_access_code(
    client_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Generate and store a unique family access code for the client."""
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(client_id)))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Reuse existing code if already generated
    if client.family_access_code:
        return {"access_code": client.family_access_code}

    code = await _generate_unique_code(db)
    client.family_access_code = code
    await db.commit()

    logger.info(f"Access code generated for client {client_id}: {code}")
    return {"access_code": code}


@app.get("/client/{client_id}/access-code")
async def get_access_code(
    client_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Return the current family access code for the client."""
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(client_id)))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"access_code": client.family_access_code}


@app.post("/session/text-chat")
async def text_chat(req: TextChatRequest, db: AsyncSession = Depends(get_db)):
    """Text-only chat (no audio). Useful for testing and accessibility."""
    agent = active_sessions.get(req.session_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Session not found or expired. Please start a new session.")

    response = await agent.generate_text_response(req.message)

    # Increment turn count in DB
    db_id = _session_db_ids.get(req.session_id)
    if db_id:
        result = await db.execute(select(ConversationSession).where(ConversationSession.id == db_id))
        db_sess = result.scalar_one_or_none()
        if db_sess:
            db_sess.turn_count = (db_sess.turn_count or 0) + 1
            await db.commit()

    return {"response": response}


@app.websocket("/session/voice/{session_id}")
async def voice_session(websocket: WebSocket, session_id: str):
    """
    WebSocket voice session.
    Client sends: base64-encoded audio chunks (WebM/Opus from browser microphone)
    Server sends: base64-encoded MP3 audio (agent's voice response)
    """
    await websocket.accept()
    agent = active_sessions.get(session_id)

    if not agent:
        await websocket.send_json({"error": "Session not found or expired. Please start a new session."})
        await websocket.close()
        return

    logger.info(f"WebSocket voice session opened: {session_id}")
    turn_count = 0

    try:
        while True:
            data = await websocket.receive_json()
            audio_b64 = data.get("audio")
            if not audio_b64:
                continue

            audio_bytes = base64.b64decode(audio_b64)
            response_audio = await agent.process_audio_turn(audio_bytes)

            if response_audio:
                turn_count += 1
                await websocket.send_json({
                    "audio": base64.b64encode(response_audio).decode(),
                    "type": "audio_response",
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket session {session_id} disconnected after {turn_count} turns")
        # Persist final turn count to DB
        db_id = _session_db_ids.pop(session_id, None)
        if db_id:
            async with AsyncSessionFactory() as db:
                result = await db.execute(select(ConversationSession).where(ConversationSession.id == db_id))
                db_sess = result.scalar_one_or_none()
                if db_sess:
                    db_sess.turn_count = (db_sess.turn_count or 0) + turn_count
                    db_sess.ended_at = __import__('datetime').datetime.utcnow()
                    await db.commit()
        # Fire memory extraction as background task — non-blocking
        if agent and turn_count >= 3:
            asyncio.create_task(agent.extract_and_store_memories())
        active_sessions.pop(session_id, None)


@app.delete("/session/{session_id}")
async def end_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Cleanly end a session and mark it ended in the DB."""
    db_id = _session_db_ids.pop(session_id, None)
    if db_id:
        result = await db.execute(select(ConversationSession).where(ConversationSession.id == db_id))
        db_sess = result.scalar_one_or_none()
        if db_sess:
            db_sess.ended_at = __import__('datetime').datetime.utcnow()
            await db.commit()
    agent = active_sessions.pop(session_id, None)
    # Fire memory extraction as background task — non-blocking
    if agent and len(agent.history) >= 6:
        asyncio.create_task(agent.extract_and_store_memories())
    return {"status": "session ended"}


# ─── Admin routes ─────────────────────────────────────────────────────────────

async def verify_admin_key(x_admin_key: str = Header(...)):
    """Dependency: reject requests that don't carry the correct admin secret."""
    if x_admin_key != settings.ADMIN_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid admin key")


@app.get("/admin/stats")
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_admin_key),
):
    """System-wide counts for the dashboard header."""
    from sqlalchemy import func
    clients_result = await db.execute(select(func.count()).select_from(Client))
    total_clients = clients_result.scalar()

    clones_result = await db.execute(
        select(func.count()).select_from(Client).where(Client.elevenlabs_voice_id.isnot(None))
    )
    total_clones = clones_result.scalar()

    complete_result = await db.execute(
        select(func.count()).select_from(Client).where(Client.onboarding_complete == True)
    )
    total_complete = complete_result.scalar()

    duration_result = await db.execute(select(func.sum(VoiceRecording.duration_seconds)))
    total_duration = duration_result.scalar() or 0.0

    recordings_result = await db.execute(select(func.count()).select_from(VoiceRecording))
    total_recordings = recordings_result.scalar()

    return {
        "total_clients": total_clients,
        "total_clones": total_clones,
        "total_complete": total_complete,
        "total_recordings": total_recordings,
        "total_duration_seconds": round(total_duration, 1),
        "avg_duration_per_client": round(total_duration / total_clients, 1) if total_clients else 0,
    }


@app.get("/admin/clients")
async def list_clients(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_admin_key),
):
    from sqlalchemy import func
    result = await db.execute(select(Client))
    clients = result.scalars().all()

    rows = []
    for c in clients:
        recs = await db.execute(
            select(func.count(), func.sum(VoiceRecording.duration_seconds))
            .where(VoiceRecording.client_id == c.id)
        )
        rec_count, rec_duration = recs.one()
        rows.append({
            "id": str(c.id),
            "name": c.full_name,
            "email": c.email,
            "language": c.language,
            "onboarding_complete": c.onboarding_complete,
            "has_voice_clone": bool(c.elevenlabs_voice_id),
            "has_personality": bool(c.personality_scores),
            "has_phrases": bool(c.phrase_bank),
            "phrase_count": len(c.phrase_bank) if c.phrase_bank else 0,
            "recording_count": rec_count or 0,
            "total_duration_seconds": round(rec_duration or 0.0, 1),
            "created_at": c.created_at.isoformat(),
            "family_access_code": c.family_access_code,
        })
    return rows


@app.get("/admin/clients/{client_id}")
async def admin_client_detail(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_admin_key),
):
    """Full client detail for the admin detail view."""
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(client_id)))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    recs_result = await db.execute(
        select(VoiceRecording).where(VoiceRecording.client_id == client.id)
    )
    recs = recs_result.scalars().all()

    sessions_result = await db.execute(
        select(ConversationSession).where(ConversationSession.client_id == client.id)
    )
    sessions = sessions_result.scalars().all()

    from src.data.database import QuestionnaireResponse as QR
    q_result = await db.execute(select(QR).where(QR.client_id == client.id))
    questionnaire = q_result.scalar_one_or_none()

    return {
        "id": str(client.id),
        "name": client.full_name,
        "email": client.email,
        "language": client.language,
        "consent_given": client.consent_given,
        "consent_timestamp": client.consent_timestamp.isoformat() if client.consent_timestamp else None,
        "created_at": client.created_at.isoformat(),
        "onboarding_complete": client.onboarding_complete,
        "elevenlabs_voice_id": client.elevenlabs_voice_id,
        "family_access_code": client.family_access_code,
        "phrase_bank": client.phrase_bank or [],
        "ocean_scores": questionnaire.ocean_scores if questionnaire else None,
        "behavioral_tags": questionnaire.behavioral_tags if questionnaire else None,
        "recordings": [
            {
                "id": str(r.id),
                "label": r.label or f"{r.recording_type} {i+1}",
                "recording_type": r.recording_type,
                "duration_seconds": r.duration_seconds,
                "uploaded_at": r.uploaded_at.isoformat(),
            }
            for i, r in enumerate(recs)
        ],
        "sessions": [
            {
                "id": str(s.id),
                "family_member_name": s.family_member_name,
                "started_at": s.started_at.isoformat(),
                "ended_at": s.ended_at.isoformat() if s.ended_at else None,
                "turn_count": s.turn_count,
            }
            for s in sessions
        ],
    }


@app.delete("/admin/clients/{client_id}/recordings")
async def delete_all_recordings(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_admin_key),
):
    """Delete all voice recordings for a client from R2 and Postgres."""
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(client_id)))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    recs_result = await db.execute(
        select(VoiceRecording).where(VoiceRecording.client_id == client.id)
    )
    recs = recs_result.scalars().all()

    enrollment = VoiceEnrollmentManager()
    deleted_count = 0
    for rec in recs:
        try:
            await enrollment.delete_recording(rec.minio_object_key)
        except Exception:
            pass
        await db.delete(rec)
        deleted_count += 1

    await db.commit()
    logger.info(f"Admin: deleted {deleted_count} recordings for client {client_id}")
    return {"status": "ok", "deleted_count": deleted_count}


@app.delete("/admin/clients/{client_id}")
async def delete_client(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_admin_key),
):
    """Full client deletion: ElevenLabs clone + all R2 recordings + Postgres cascade."""
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(client_id)))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Delete ElevenLabs clone if it exists
    if client.elevenlabs_voice_id:
        try:
            voice_manager = VoiceCloneManager()
            await voice_manager.delete_voice(client.elevenlabs_voice_id)
        except Exception:
            pass

    # Delete all R2 recordings
    recs_result = await db.execute(
        select(VoiceRecording).where(VoiceRecording.client_id == client.id)
    )
    enrollment = VoiceEnrollmentManager()
    for rec in recs_result.scalars().all():
        try:
            await enrollment.delete_recording(rec.minio_object_key)
        except Exception:
            pass

    # Cascade delete via SQLAlchemy (recordings, questionnaire, sessions)
    await db.delete(client)
    await db.commit()

    logger.info(f"Admin: full delete of client {client_id} ({client.full_name})")
    return {"status": "deleted", "client_id": client_id, "name": client.full_name}


@app.delete("/admin/clients/{client_id}/voice-clone")
async def delete_voice_clone(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_admin_key),
):
    """
    Admin: delete the ElevenLabs voice clone for a client and clear voice_id from DB.
    Use this to reset a poor-quality clone so the client can re-run create-voice-clone.
    """
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(client_id)))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if not client.elevenlabs_voice_id:
        raise HTTPException(status_code=400, detail="No voice clone exists for this client")

    voice_manager = VoiceCloneManager()
    deleted = await voice_manager.delete_voice(client.elevenlabs_voice_id)
    old_voice_id = client.elevenlabs_voice_id
    client.elevenlabs_voice_id = None
    client.onboarding_complete = False
    await db.commit()

    logger.info(f"Admin: deleted voice clone {old_voice_id} for client {client_id}")
    return {"status": "deleted", "voice_id": old_voice_id, "elevenlabs_deleted": deleted}


@app.get("/admin/clients")
async def list_clients(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client))
    clients = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "name": c.full_name,
            "onboarding_complete": c.onboarding_complete,
            "has_voice_clone": bool(c.elevenlabs_voice_id),
        }
        for c in clients
    ]


@app.get("/health")
async def health():
    import os
    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        # first 6 chars only — enough to diagnose without exposing the key
        "admin_key_prefix": settings.ADMIN_SECRET_KEY[:6],
        "admin_key_from_env": os.environ.get("ADMIN_SECRET_KEY", "NOT_SET")[:6],
    }
