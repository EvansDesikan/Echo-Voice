"""
ECHO Voice — Configuration
All sensitive values must be set in .env (never committed).
"""
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # App
    APP_NAME: str = "ECHO Voice"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # API Keys
    ELEVENLABS_API_KEY: str
    ANTHROPIC_API_KEY: str
    OPENAI_API_KEY: str = ""  # optional, used if Whisper API fallback needed

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://echovoice:echovoice@localhost:5432/echovoice"
    CHROMA_PERSIST_DIR: str = "./data/chroma"

    # MinIO / Object Storage
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "echo-voice-audio"

    # Voice
    WHISPER_MODEL: str = "large-v3"
    WHISPER_DEVICE: str = "cuda"  # or "cpu"
    MIN_VOICE_MINUTES: float = 3.0   # ElevenLabs minimum for Pro clone
    TARGET_VOICE_MINUTES: float = 15.0

    # Claude
    CLAUDE_MODEL: str = "claude-haiku-4-5-20251001"  # cost-efficient for testing; switch to claude-sonnet-4-6 for production
    CLAUDE_MAX_TOKENS: int = 256  # keep responses concise during testing

    # ElevenLabs
    ELEVENLABS_MODEL: str = "eleven_turbo_v2_5"  # fastest, lowest latency

    # Security
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    ADMIN_SECRET_KEY: str = "change-me-admin-key"  # Set in Railway env vars

    # Paths
    BASE_DIR: Path = Path(__file__).parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    AUDIO_DIR: Path = DATA_DIR / "audio"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
