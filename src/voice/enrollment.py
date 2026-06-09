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
    "Mach dir keine Sorgen. Alles wird gut werden. Ich bin immer für dich da.",
    "Weißt du noch, damals als wir zusammen gelacht haben? Das waren die besten Momente.",
    "Ich bin stolz auf dich. Ich war es immer und werde es immer sein.",
    "Das Wichtigste im Leben sind die Menschen, die man liebt — und du bist einer davon.",
    "Heute ist ein guter Tag. Lass uns ihn zusammen genießen, auch wenn wir weit voneinander entfernt sind.",
    "Du bist nicht allein. Ich bin immer bei dir — auch wenn du mich gerade nicht sehen kannst.",
    "Ich denke oft an die schönen Abende, die wir zusammen verbracht haben. Diese Erinnerungen halte ich fest im Herzen.",
    "Ich liebe dich. Das weißt du, oder? Das hat sich nie geändert und wird sich nie ändern.",
    "Ruf mich an, wann immer du möchtest. Ich bin immer da für dich, egal was passiert.",
    "Manchmal denke ich, wie schnell die Zeit vergeht. Genieße jeden Augenblick — er ist kostbarer als du denkst.",
]

SCRIPTED_PROMPTS_EN = [
    "Good morning! How are you today? I hope you slept well.",
    "Imagine we're sitting together at the kitchen table having coffee.",
    "Don't worry. Everything will be alright. I'm always here for you.",
    "Do you remember when we laughed together? Those were the best moments.",
    "I'm proud of you. I always have been and always will be.",
    "The most important things in life are the people you love — and you are one of them.",
    "Today is a good day. Let's enjoy it together, even when we're far apart.",
    "You are not alone. I am always with you — even when you can't see me.",
    "I often think of the lovely evenings we spent together. I hold those memories close to my heart.",
    "I love you. You know that, don't you? That has never changed and never will.",
    "Call me whenever you like. I am always here for you, no matter what happens.",
    "Sometimes I think about how quickly time passes. Enjoy every moment — it's more precious than you know.",
]

SPONTANEOUS_TOPICS_DE = [
    "Erzählen Sie frei über einen Ihrer schönsten Urlaube oder Reisen.",
    "Was lieben Sie am meisten an Ihrer Familie oder Ihren engsten Freunden?",
    "Beschreiben Sie, wie ein typischer Sonntag für Sie aussieht.",
    "Was war Ihr größter Erfolg im Leben, auf den Sie besonders stolz sind?",
    "Erzählen Sie eine lustige oder besondere Geschichte aus Ihrer Kindheit oder Jugend.",
    "Was sind Ihre liebsten Traditionen oder Rituale — in der Familie oder im Alltag?",
    "Welchen Rat würden Sie Ihren Kindern oder Enkeln für das Leben mitgeben?",
    "Beschreiben Sie einen Menschen, der Ihr Leben besonders geprägt hat — und warum.",
]

SPONTANEOUS_TOPICS_EN = [
    "Talk freely about one of your favourite holidays or trips.",
    "What do you love most about your family or your closest friends?",
    "Describe what a typical Sunday looks like for you.",
    "What is your greatest achievement in life that you are especially proud of?",
    "Tell a funny or special story from your childhood or youth.",
    "What are your favourite traditions or rituals — in the family or in everyday life?",
    "What advice would you give your children or grandchildren for life?",
    "Describe a person who has had a particularly big influence on your life — and why.",
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
        duration_seconds: float = 0,
    ) -> Tuple[str, float]:
        """
        Upload a recording to Cloudflare R2.
        All MinIO SDK calls run in a thread executor to avoid blocking the async event loop.
        Returns (object_key, duration_seconds).
        duration_seconds should be supplied by the frontend (real elapsed time).
        Falls back to a file-size estimate only when not provided.
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

        if duration_seconds <= 0:
            duration_seconds = length / (40 * 1024)  # fallback estimate

        logger.info(f"Uploaded {object_key} ({length} bytes, {duration_seconds:.1f}s)")
        return object_key, duration_seconds

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

    async def delete_recording(self, object_key: str) -> None:
        """Delete a recording from R2. Runs in thread to avoid blocking event loop."""
        loop = asyncio.get_event_loop()

        def _delete():
            self._minio.remove_object(settings.MINIO_BUCKET, object_key)

        await loop.run_in_executor(None, _delete)

    def get_scripted_prompts(self, language: str = "de") -> List[str]:
        return SCRIPTED_PROMPTS_DE if language == "de" else SCRIPTED_PROMPTS_EN

    def get_spontaneous_topics(self, language: str = "de") -> List[str]:
        return SPONTANEOUS_TOPICS_DE if language == "de" else SPONTANEOUS_TOPICS_EN
