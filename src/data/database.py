"""
Data Engineer — Database layer
PostgreSQL (async SQLAlchemy) + ChromaDB for vector memory store.
"""
import uuid
from datetime import datetime
from typing import Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from sqlalchemy import (
    Column, String, Float, Boolean, DateTime, Text, JSON,
    ForeignKey, Integer
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship

from config.settings import settings


# ─── PostgreSQL ORM ─────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


class Client(Base):
    """A person who signs up with danach.de and creates their voice profile."""
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    date_of_birth = Column(DateTime, nullable=True)
    language = Column(String(10), default="de")  # "de" or "en"
    consent_given = Column(Boolean, default=False)
    consent_timestamp = Column(DateTime, nullable=True)
    consent_ip = Column(String(45), nullable=True)  # GDPR audit trail

    elevenlabs_voice_id = Column(String(255), nullable=True)  # set after voice clone
    personality_scores = Column(JSON, nullable=True)          # OCEAN scores
    personality_prompt = Column(Text, nullable=True)           # rendered system prompt
    phrase_bank = Column(JSON, nullable=True)                  # list of personal phrases

    family_access_code = Column(String(20), unique=True, nullable=True)  # shared with family for session access
    onboarding_complete = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    recordings = relationship("VoiceRecording", back_populates="client", cascade="all, delete")
    questionnaire = relationship("QuestionnaireResponse", back_populates="client", uselist=False, cascade="all, delete")
    sessions = relationship("ConversationSession", back_populates="client", cascade="all, delete")


class VoiceRecording(Base):
    """Individual audio file uploaded during enrollment."""
    __tablename__ = "voice_recordings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    minio_object_key = Column(String(512), nullable=False)
    duration_seconds = Column(Float, nullable=False)
    recording_type = Column(String(50))  # "scripted" | "spontaneous" | "phrase"
    label = Column(String(512), nullable=True)   # prompt text shown to client
    transcription = Column(Text, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="recordings")


class QuestionnaireResponse(Base):
    """Stores raw questionnaire answers and derived OCEAN scores."""
    __tablename__ = "questionnaire_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), unique=True, nullable=False)
    answers = Column(JSON, nullable=False)        # {question_id: score (1-5)}
    ocean_scores = Column(JSON, nullable=True)    # {O, C, E, A, N} each 0.0–1.0
    behavioral_tags = Column(JSON, nullable=True) # derived tags: ["uses_humour", "formal_speech", ...]
    completed_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="questionnaire")


class ConversationSession(Base):
    """Log of each family interaction session — required for GDPR audit."""
    __tablename__ = "conversation_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    family_member_name = Column(String(255), nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    turn_count = Column(Integer, default=0)
    language = Column(String(10), default="de")

    client = relationship("Client", back_populates="sessions")


class EmailVerification(Base):
    """One-time OTP codes sent to verify client email ownership before consent."""
    __tablename__ = "email_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, index=True)
    code = Column(String(6), nullable=False)       # 6-digit numeric OTP
    expires_at = Column(DateTime, nullable=False)  # 15 minutes from creation
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ─── Async engine & session factory ─────────────────────────────────────────

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
AsyncSessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with AsyncSessionFactory() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Additive column migrations — safe to run on every startup (IF NOT EXISTS)
        await conn.execute(
            __import__('sqlalchemy').text(
                "ALTER TABLE voice_recordings ADD COLUMN IF NOT EXISTS label VARCHAR(512)"
            )
        )
        await conn.execute(
            __import__('sqlalchemy').text(
                "ALTER TABLE clients ADD COLUMN IF NOT EXISTS family_access_code VARCHAR(20) UNIQUE"
            )
        )
        await conn.execute(
            __import__('sqlalchemy').text(
                "ALTER TABLE clients ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE"
            )
        )


# ─── ChromaDB client ─────────────────────────────────────────────────────────

def get_chroma_client() -> chromadb.Client:
    return chromadb.PersistentClient(
        path=settings.CHROMA_PERSIST_DIR,
        settings=ChromaSettings(anonymized_telemetry=False),
    )


def get_memory_collection(client_id: str) -> chromadb.Collection:
    """Returns (or creates) the memory collection for a specific client."""
    chroma = get_chroma_client()
    return chroma.get_or_create_collection(
        name=f"memories_{client_id.replace('-', '_')}",
        metadata={"hnsw:space": "cosine"},
    )
