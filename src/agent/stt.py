"""
AI/ML Engineer — Speech-to-Text (Whisper, local)
Transcribes audio from the family member's microphone.
Runs entirely locally — voice data never leaves the system.
Supports German and English auto-detection.
"""
import asyncio
import tempfile
from pathlib import Path
from typing import Optional

import whisper
import numpy as np
from loguru import logger

from config.settings import settings


class WhisperSTT:
    """Singleton wrapper around OpenAI Whisper (local)."""

    _instance: Optional["WhisperSTT"] = None
    _model = None

    @classmethod
    def get_instance(cls) -> "WhisperSTT":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        logger.info(f"Loading Whisper model '{settings.WHISPER_MODEL}' on {settings.WHISPER_DEVICE}")
        self._model = whisper.load_model(
            settings.WHISPER_MODEL,
            device=settings.WHISPER_DEVICE,
        )
        logger.success("Whisper model loaded")

    async def transcribe_bytes(
        self,
        audio_bytes: bytes,
        language: Optional[str] = None,  # None = auto-detect
    ) -> str:
        """
        Transcribe raw audio bytes (WAV/MP3/WEBM).
        Runs in executor to avoid blocking the async event loop.
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._transcribe_sync,
            audio_bytes,
            language,
        )

    def _transcribe_sync(self, audio_bytes: bytes, language: Optional[str]) -> str:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=True) as tmp:
            tmp.write(audio_bytes)
            tmp.flush()
            options = {
                "fp16": settings.WHISPER_DEVICE == "cuda",
                "task": "transcribe",
            }
            if language:
                options["language"] = language
            result = self._model.transcribe(tmp.name, **options)
        text = result["text"].strip()
        logger.debug(f"Transcribed: '{text[:80]}...'")
        return text

    async def transcribe_file(self, file_path: Path, language: Optional[str] = None) -> str:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: self._model.transcribe(
                str(file_path),
                fp16=(settings.WHISPER_DEVICE == "cuda"),
                language=language,
            ),
        )
        return result["text"].strip()
