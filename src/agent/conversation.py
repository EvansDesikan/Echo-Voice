"""
AI/ML Engineer — Conversation Agent (core pipeline)
Orchestrates the full turn cycle:
  Family speaks → Whisper STT → Claude (personality + RAG) → ElevenLabs TTS → audio bytes

Also manages conversation history for multi-turn coherence.
"""
import time
from dataclasses import dataclass, field
from typing import List, Optional

from anthropic import AsyncAnthropic
from loguru import logger

from config.settings import settings
from src.agent.memory_rag import MemoryStore
from src.agent.stt import WhisperSTT
from src.agent.voice_clone import VoiceCloneManager


MAX_HISTORY_TURNS = 20  # keep last 20 turns in context


@dataclass
class ConversationTurn:
    role: str      # "user" | "assistant"
    content: str
    timestamp: float = field(default_factory=time.time)


@dataclass
class ClientProfile:
    client_id: str
    client_name: str
    elevenlabs_voice_id: str
    personality_prompt: str       # rendered system prompt from personality.py
    language: str = "de"


class ConversationAgent:
    """
    One instance per active conversation session.
    Holds conversation history for coherent multi-turn dialogue.
    """

    def __init__(self, profile: ClientProfile):
        self.profile = profile
        self.history: List[ConversationTurn] = []
        self._anthropic = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self._voice = VoiceCloneManager()
        self._stt = WhisperSTT.get_instance()
        self._memory = MemoryStore(profile.client_id)

        logger.info(f"ConversationAgent ready for client '{profile.client_name}'")

    async def process_audio_turn(self, audio_bytes: bytes) -> bytes:
        """
        Full pipeline: audio in → transcribe → generate response → synthesize → audio out.
        Returns MP3 bytes of the agent's spoken response.
        """
        # 1. STT
        user_text = await self._stt.transcribe_bytes(audio_bytes, language=self.profile.language)
        if not user_text:
            logger.warning("STT returned empty transcript — skipping turn")
            return b""

        logger.info(f"[USER] {user_text}")

        # 2. Generate text response
        response_text = await self.generate_text_response(user_text)
        logger.info(f"[AGENT] {response_text}")

        # 3. TTS
        audio_out = await self._voice.synthesize(response_text, self.profile.elevenlabs_voice_id)
        return audio_out

    async def generate_text_response(self, user_input: str) -> str:
        """
        Text-only interface (useful for testing and text-chat mode).
        Retrieves relevant memories and calls Claude.
        """
        # Retrieve relevant memories
        memories = self._memory.retrieve(user_input, n_results=5)
        memory_context = self._memory.format_for_context(memories)

        # Build system prompt (personality + memories)
        system = self.profile.personality_prompt
        if memory_context:
            system += memory_context

        # Build messages for Claude (sliding window)
        messages = self._build_messages(user_input)

        # Call Claude
        response = await self._anthropic.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=settings.CLAUDE_MAX_TOKENS,
            system=system,
            messages=messages,
        )

        response_text = response.content[0].text.strip()

        # Store in history
        self.history.append(ConversationTurn(role="user", content=user_input))
        self.history.append(ConversationTurn(role="assistant", content=response_text))

        return response_text

    def _build_messages(self, current_input: str) -> List[dict]:
        """Build the messages list for Claude, respecting the sliding window."""
        recent = self.history[-(MAX_HISTORY_TURNS * 2):]
        messages = [{"role": t.role, "content": t.content} for t in recent]
        messages.append({"role": "user", "content": current_input})
        return messages

    def reset_history(self):
        """Clear conversation history (new session)."""
        self.history.clear()
