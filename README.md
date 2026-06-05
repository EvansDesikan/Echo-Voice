# ECHO Voice

> *Give your loved ones a voice that stays with them — forever.*

ECHO Voice is an AI memorial companion system built to extend danach.de's existing ECHO product. It allows clients to create an AI agent that sounds like them and responds like them — so their family can still have a conversation, even after they've passed.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ECHO VOICE SYSTEM                           │
│                                                                     │
│  ┌──────────────────────────────┐  ┌────────────────────────────┐  │
│  │     CLIENT ONBOARDING        │  │     FAMILY INTERACTION     │  │
│  │  (before death — private)    │  │  (after death — family)    │  │
│  │                              │  │                            │  │
│  │  1. Consent (GDPR gate)      │  │  Browser UI                │  │
│  │  2. Voice Enrollment         │  │       ↓                    │  │
│  │  3. Personality Quiz (OCEAN) │  │  Microphone → Whisper STT  │  │
│  │  4. Phrase Bank              │  │       ↓                    │  │
│  │  5. Memory Upload            │  │  Claude + RAG              │  │
│  └──────────┬───────────────────┘  │  (personality engine)      │  │
│             ↓                      │       ↓                    │  │
│  ┌──────────────────────────────┐  │  ElevenLabs TTS            │  │
│  │       PROFILE STORE          │  │  (cloned voice)            │  │
│  │  PostgreSQL | ChromaDB       │──┘       ↓                    │  │
│  │  ElevenLabs Voice ID         │  Audio → Family's Speaker     │  │
│  │  MinIO Audio Files           │                               │  │
│  └──────────────────────────────┘                               │  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- Python 3.11+
- Docker + Docker Compose
- NVIDIA GPU (recommended for Whisper `large-v3`; CPU fallback available)
- ElevenLabs account (Professional Voice Cloning tier for best quality)
- Anthropic API key

---

## Quick Start (Demo)

```bash
# 1. Clone and configure
git clone <repo>
cd echo-voice
cp .env.example .env
# Edit .env — add your ELEVENLABS_API_KEY and ANTHROPIC_API_KEY

# 2. Start all services
docker compose up -d

# 3. Verify
curl http://localhost:8000/health
# → {"status": "ok", "version": "0.1.0"}

# 4. Open the frontend
open http://localhost:3000
```

---

## Client Onboarding Flow (API)

```bash
# Step 1 — Consent
curl -X POST http://localhost:8000/onboard/consent \
  -H "Content-Type: application/json" \
  -d '{"client_name": "Maria Müller", "email": "maria@example.de", "language": "de", "consented": true}'
# → {"client_id": "uuid...", "message": "Consent recorded."}

# Step 2 — Submit questionnaire answers (60 questions, 1-5 scale)
curl -X POST http://localhost:8000/onboard/questionnaire \
  -H "Content-Type: application/json" \
  -d '{"client_id": "uuid...", "answers": {"O1": 4, "O2": 5, "E1": 3, ...}}'

# Step 3 — Submit personal phrases
curl -X POST http://localhost:8000/onboard/phrases \
  -H "Content-Type: application/json" \
  -d '{"client_id": "uuid...", "phrases": ["Na, wie läuft'\''s?", "Das schaffen wir schon.", "Pass auf dich auf."]}'

# Step 4 — Add memories
curl -X POST http://localhost:8000/onboard/memories \
  -H "Content-Type: application/json" \
  -d '{"client_id": "uuid...", "memories": [{"text": "Unser Familienurlaub 1998 auf Rügen war mein liebster Urlaub.", "source": "client", "memory_type": "event"}]}'

# Step 5 — Build personality prompt
curl -X POST "http://localhost:8000/onboard/build-personality?client_id=uuid..."
```

---

## Family Interaction (API)

```bash
# Start a session
curl -X POST http://localhost:8000/session/start \
  -H "Content-Type: application/json" \
  -d '{"client_id": "uuid...", "family_member_name": "Lena"}'
# → {"session_id": "session-uuid...", "message": "Session started."}

# Text chat (for testing)
curl -X POST http://localhost:8000/session/text-chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "session-uuid...", "message": "Mama, ich vermisse dich so sehr."}'
# → {"response": "Ich weiß, mein Schatz. Ich bin so stolz auf dich..."}

# Voice: connect via WebSocket at ws://localhost:8000/session/voice/{session_id}
# Send: {"audio": "<base64 webm audio>"}
# Receive: {"audio": "<base64 mp3 response>", "type": "audio_response"}
```

---

## Running Tests

```bash
pip install -r requirements.txt
pytest tests/ -v
```

---

## Project Structure

```
echo-voice/
├── src/
│   ├── api/           ← FastAPI app (main.py, routes)
│   ├── agent/         ← Conversation pipeline (STT, LLM, TTS, RAG)
│   ├── questionnaire/ ← Questions + OCEAN scorer
│   ├── voice/         ← Voice enrollment + MinIO pipeline
│   └── data/          ← Database models (PostgreSQL + ChromaDB)
├── tests/
│   ├── unit/          ← Questionnaire + personality unit tests
│   └── integration/   ← API + pipeline integration tests
├── docs/
│   ├── pitch/         ← Pitch deck for danach.de
│   ├── reports/       ← Role-specific technical reports
│   └── meeting_minutes/
├── config/            ← Settings (pydantic-settings)
├── docker/            ← Dockerfiles
└── docker-compose.yml
```

---

## Ethical Statement

ECHO Voice was designed consent-first. The system collects no data without explicit, GDPR-compliant consent from the person being cloned. Families are always informed they are speaking with an AI. Psychological safety guardrails protect grieving users. See `docs/reports/safety_compliance_report.md` for the full compliance framework.

---

## Built By

Evans Elias Desikan — M.Sc. Electronics Engineering, Hochschule Bremen
AI / ML / Robotics Specialist
123evansruth@gmail.com
