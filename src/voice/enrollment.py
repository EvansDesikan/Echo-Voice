"""
Backend Engineer — Voice Enrollment Module
Guides the client through recording sessions and uploads audio to MinIO.
Two types of recordings:
  1. Scripted — client reads provided prompts (ensures phoneme coverage)
  2. Spontaneous — client speaks freely about memories/topics (natural speech)
"""
import asyncio
import hashlib
import io
import tempfile
from pathlib import Path
from typing import List, Tuple

from loguru import logger
from minio import Minio
from minio.error import S3Error

from config.settings import settings


SCRIPTED_PROMPTS_DE = [
    "Guten Morgen! Wie geht es dir heute? Ich hoffe, du hast gut geschlafen.",
    "Stell dir vor, wir sitzen zusammen am Küchentisch und trinken Kaffee.",
    "Ich erinnere mich noch genau an den Tag, als wir das erste Mal... Es war wunderschön.",
    "Mach dir keine Sorgen. Alles wird gut werden. Ich bin immer für dich da.",
    "Weißt du noch, damals als wir zusammen gelacht haben? Das waren die besten Momente.",
    "Das Wichtigste im Leben sind die Menschen, die man liebt.",
    "Manchmal denke ich darüber nach, wie schnell die Zeit vergeht.",
    "Ich bin stolz auf dich. Ich war es immer und werde es immer sein.",
    "Heute ist ein guter Tag. Lass uns ihn gemeinsam genießen.",
    "Du bist nicht allein. Vergiss das niemals.",
]

SCRIPTED_PROMPTS_EN = [
    "Good morning! How are you today? I hope you slept well.",
    "Imagine we're sitting together at the kitchen table having coffee.",
    "I still clearly remember the day when... It was beautiful.",
    "Don't worry. Everything will be okay. I'm always here for you.",
    "Remember that time we laughed together? Those were the best moments.",
    "The most important things in life are the people you love.",
    "Sometimes I think about how quickly time passes.",
    "I'm proud of you. I always was and always will be.",
    "Today is a good day. Let's enjoy it together.",
    "You are not alone. Never forget that.",
]

SPONTANEOUS_TOPICS_DE = [
    "Erzähle frei über einen deiner schönsten Urlaube oder Reisen.",
    "Was liebst du am meisten an deiner Familie oder deinen engsten Freunden?",
    "Beschreibe, wie ein typischer Sonntag für dich aussieht.",
    "Was war dein größter Erfolg im Leben, auf den du stolz bist?",
    "Erzähle eine lustige Geschichte aus deiner Kindheit oder Jugend.",
]

SPONTANEOUS_TOPICS_EN = [
    "Talk freely about one of your happiest holidays or trips.",
    "What do you love most about your family or closest friends?",
    "Describe what a typical Sunday looks like for you.",
    "What's your greatest achievement in life that you're proud of?",
    "Tell a funny story from your childhood or youth.",
]


class VoiceEnrollmentManager:
    """Manages the upload pipeline for voice recordings to Cloudflare R2 via MinIO SDK."""

    def __init__(self):
        self._minio = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=True,  # Cloudflare R2 requires HTTPS
        )

    async def _ensure_bucket(self) -> None:
        """Check bucket exists; create if not. Runs in thread to avoid blocking event loop."""
        loop = asyncio.get_event_loop()
        exists = await loop.run_in_executor(
            None, lambda: self._minio.bucket_exists(settings.MINIO_BUCKET)
        )
        if not exists:
            await loop.run_in_executor(
                None, lambda: self._minio.make_bucket(settings.MINIO_BUCKET)
            )
            logger.info(f"Created R2 bucket: {settings.MINIO_BUCKET}")

    async def upload_recording(
        self,
        client_id: str,
        audio_bytes: bytes,
        recording_type: str,  # "scripted" | "spontaneous" | "phrase"
        index: int = 0,
    ) -> Tuple[str, float]:
        """
        Upload a recording to Cloudflare R2.
        All MinIO SDK calls run in a thread executor to avoid blocking the async event loop.
        Returns (object_key, duration_seconds).
        """
        await self._ensure_bucket()

        checksum = hashlib.md5(audio_bytes).hexdigest()[:8]
        object_key = f"{client_id}/{recording_type}/{index:03d}_{checksum}.webm"
        length = len(audio_bytes)

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self._minio.put_object(
                settings.MINIO_BUCKET,
                object_key,
                data=io.BytesIO(audio_bytes),
                length=length,
                content_type="audio/webm",
            ),
        )

        # Rough duration estimate: WebM/Opus at ~40KB/s
        est_duration = length / (40 * 1024)
        logger.info(f"Uploaded {object_key} ({length} bytes, ~{est_duration:.1f}s)")
        return object_key, est_duration

    def get_download_url(self, object_key: str, expires_hours: int = 1) -> str:
        """Generate a pre-signed URL for temporary download (e.g. to send to ElevenLabs)."""
        from datetime import timedelta
        url = self._minio.presigned_get_object(
            settings.MINIO_BUCKET,
            object_key,
            expires=timedelta(hours=expires_hours),
        )
        return url

    async def download_to_tempfile(self, object_key: str) -> Path:
        """Download a recording to a temp file. Runs in thread to avoid blocking event loop."""
        loop = asyncio.get_event_loop()

        def _download() -> Path:
            response = self._minio.get_object(settings.MINIO_BUCKET, object_key)
            suffix = Path(object_key).suffix
            tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
            for chunk in response.stream(32 * 1024):
                tmp.write(chunk)
            tmp.close()
            response.close()
            return Path(tmp.name)

        return await loop.run_in_executor(None, _download)

    def get_scripted_prompts(self, language: str = "de") -> List[str]:
        return SCRIPTED_PROMPTS_DE if language == "de" else SCRIPTED_PROMPTS_EN

    def get_spontaneous_topics(self, language: str = "de") -> List[str]:
        return SPONTANEOUS_TOPICS_DE if language == "de" else SPONTANEOUS_TOPICS_EN
