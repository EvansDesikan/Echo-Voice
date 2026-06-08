"""
Backend Engineer — FastAPI Application Entry Point
Wires together all routes and starts the async application.
"""
import base64
import traceback
import uuid
from contextlib import asynccontextmanager
from typing import Dict, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger
from pydantic import BaseModel

from config.settings import settings
from src.agent.conversation import ConversationAgent, ClientProfile
from src.agent.personality import render_system_prompt
from src.agent.voice_clone import VoiceCloneManager
from src.data.database import init_db, get_db, Client, QuestionnaireResponse, VoiceRecording
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
    return {
        "recordings": [
            {
                "index": i,
                "object_key": r.minio_object_key,
                "duration_seconds": r.duration_seconds,
                "recording_type": r.recording_type,
                "label": r.label or f"Recording {i + 1} ({r.recording_type})",
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

@app.post("/session/start")
async def start_session(
    req: StartSessionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create a new conversation session for a family member."""
    result = await db.execute(select(Client).where(Client.id == uuid.UUID(req.client_id)))
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if not client.onboarding_complete:
        raise HTTPException(status_code=400, detail="Client onboarding is not complete")
    if not client.elevenlabs_voice_id:
        raise HTTPException(status_code=400, detail="Voice clone not yet created")

    profile = ClientProfile(
        client_id=str(client.id),
        client_name=client.full_name,
        elevenlabs_voice_id=client.elevenlabs_voice_id,
        personality_prompt=client.personality_prompt,
        language=client.language,
    )

    session_id = str(uuid.uuid4())
    active_sessions[session_id] = ConversationAgent(profile)

    logger.info(f"Session {session_id} started for client {client.id}")
    return {
        "session_id": session_id,
        "client_name": client.full_name,
        "message": f"Session started. You are now connected to {client.full_name}.",
    }


@app.post("/session/text-chat")
async def text_chat(req: TextChatRequest):
    """Text-only chat (no audio). Useful for testing and accessibility."""
    agent = active_sessions.get(req.session_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    response = await agent.generate_text_response(req.message)
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
        await websocket.send_json({"error": "Session not found"})
        await websocket.close()
        return

    logger.info(f"WebSocket voice session opened: {session_id}")

    try:
        while True:
            data = await websocket.receive_json()
            audio_b64 = data.get("audio")

            if not audio_b64:
                continue

            audio_bytes = base64.b64decode(audio_b64)
            response_audio = await agent.process_audio_turn(audio_bytes)

            if response_audio:
                await websocket.send_json({
                    "audio": base64.b64encode(response_audio).decode(),
                    "type": "audio_response",
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket session {session_id} disconnected")
        active_sessions.pop(session_id, None)


@app.delete("/session/{session_id}")
async def end_session(session_id: str):
    """Cleanly end a session."""
    active_sessions.pop(session_id, None)
    return {"status": "session ended"}


# ─── Admin routes ─────────────────────────────────────────────────────────────

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
    return {"status": "ok", "version": settings.APP_VERSION}
