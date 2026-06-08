"""
AI/ML Engineer — Voice Clone Module
Handles ElevenLabs Professional Voice Cloning:
  - Upload audio files and create a voice clone during enrollment
  - Synthesize speech from text using the client's cloned voice
"""
import asyncio
import io
from pathlib import Path
from typing import List, Optional

import httpx
from elevenlabs import ElevenLabs, VoiceSettings
from elevenlabs.client import AsyncElevenLabs
from loguru import logger

from config.settings import settings


class VoiceCloneManager:
    """Wraps ElevenLabs API for voice cloning operations."""

    def __init__(self):
        self._client = AsyncElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
        self._sync_client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)

    async def create_voice_clone(
        self,
        client_name: str,
        audio_file_paths: List[Path],
        description: str = "",
    ) -> str:
        """
        Creates a Professional Voice Clone on ElevenLabs.
        Requires at least 3 minutes of clean audio (15+ recommended).
        Returns the ElevenLabs voice_id string.
        """
        logger.info(f"Creating voice clone for '{client_name}' with {len(audio_file_paths)} files")

        # ElevenLabs SDK expects file paths (str/PathLike), not open file handles
        voice = self._sync_client.clone(
            name=f"ECHO_{client_name}",
            description=description or f"Memorial voice for {client_name} — ECHO Voice",
            files=[str(p) for p in audio_file_paths],
        )
        logger.success(f"Voice clone created: {voice.voice_id}")
        return voice.voice_id

    async def synthesize(
        self,
        text: str,
        voice_id: str,
        stability: float = 0.60,
        similarity_boost: float = 0.85,
        style: float = 0.35,
    ) -> bytes:
        """
        Converts text to speech using the client's cloned voice.
        Returns raw MP3 bytes.

        Tuning:
          - stability: higher = more consistent/monotone; lower = more expressive
          - similarity_boost: how closely it matches the original voice
          - style: expressiveness amplifier (0 = neutral, 1 = very expressive)
        """
        logger.debug(f"Synthesizing {len(text)} chars with voice {voice_id}")

        audio_stream = self._sync_client.text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id=settings.ELEVENLABS_MODEL,
            voice_settings=VoiceSettings(
                stability=stability,
                similarity_boost=similarity_boost,
                style=style,
                use_speaker_boost=True,
            ),
        )

        # Collect stream into bytes
        audio_bytes = b"".join(audio_stream)
        logger.debug(f"Synthesized {len(audio_bytes)} bytes of audio")
        return audio_bytes

    async def delete_voice(self, voice_id: str) -> bool:
        """Delete a voice clone (e.g., on client data deletion request — GDPR right to erasure)."""
        try:
            self._sync_client.voices.delete(voice_id)
            logger.info(f"Voice {voice_id} deleted from ElevenLabs")
            return True
        except Exception as e:
            logger.error(f"Failed to delete voice {voice_id}: {e}")
            return False

    async def list_voices(self) -> List[dict]:
        """List all cloned voices in the account (for admin dashboard)."""
        response = self._sync_client.voices.get_all()
        return [
            {"voice_id": v.voice_id, "name": v.name}
            for v in response.voices
        ]
