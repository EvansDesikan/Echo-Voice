"""
AI/ML Engineer — Conversation Agent (core pipeline)
Orchestrates the full turn cycle:
  Family speaks → Whisper STT → Claude (personality + RAG) → ElevenLabs TTS → audio bytes

Also manages conversation history for multi-turn coherence.
Memory write-back: at session end, extracts new facts from the transcript and
stores them in ChromaDB as source="family" — the compounding memory system.
"""
import json
import time
from dataclasses import dataclass, field
from typing import List, Optional

from anthropic import AsyncAnthropic
from loguru import logger

from config.settings import settings
from src.agent.memory_rag import MemoryStore
from src.agent.stt import WhisperSTT
from src.agent.voice_clone import VoiceCloneManager


MAX_HISTORY_TURNS = 10  # keep last 10 turns; reduces token cost ~50% vs 20


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
        # Retrieve relevant memories (3 results keep context tight)
        memories = self._memory.retrieve(user_input, n_results=3)
        memory_context = self._memory.format_for_context(memories)

        # Build system prompt (personality + memories + brevity instruction)
        system = self.profile.personality_prompt
        if memory_context:
            system += memory_context
        system += (
            "\n\nIMPORTANT: Keep every response to 1–2 short, warm sentences. "
            "Concise and personal — do not ramble."
        )

        # Build messages for Claude (sliding window)
        messages = self._build_messages(user_input)

        # Call Claude with prompt caching on the system prompt.
        # Cache saves ~60% on input tokens for the (large) system prompt after the first call.
        response = await self._anthropic.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=settings.CLAUDE_MAX_TOKENS,
            system=[
                {
                    "type": "text",
                    "text": system,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
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

    async def extract_and_store_memories(self) -> int:
        """
        Mine the conversation transcript for new facts the family member revealed
        and write them to ChromaDB as source="family" memories.

        Only runs when there are at least 3 full turns (6 history items).
        Called as a background asyncio task — never blocks session teardown.
        Returns the count of memories stored.
        """
        if len(self.history) < 6:
            logger.debug(f"Memory extraction skipped for {self.profile.client_id}: too few turns")
            return 0

        transcript_lines = []
        for turn in self.history:
            speaker = "Family member" if turn.role == "user" else self.profile.client_name
            transcript_lines.append(f"{speaker}: {turn.content}")
        transcript = "\n".join(transcript_lines)

        extraction_prompt = f"""You are reviewing a conversation between a family member and an AI memorial of {self.profile.client_name}.

Extract NEW facts, memories, relationships, or personal details that the FAMILY MEMBER mentioned — things that enrich what the memorial knows about its relationships, shared history, and the people who love it.

Do NOT extract:
- Things the AI (acting as {self.profile.client_name}) said — those are already encoded in the persona
- Generic pleasantries with no specific information
- Anything obviously already known (birth facts, common family knowledge)

Return a JSON array. Each element: {{"text": "<fact as a short, first-person-adjacent statement>", "memory_type": "<event|relationship|value|phrase>"}}

If nothing meaningful was revealed, return [].

Transcript:
{transcript}

Return ONLY the JSON array, no other text."""

        try:
            response = await self._anthropic.messages.create(
                model=settings.CLAUDE_MODEL,
                max_tokens=800,
                messages=[{"role": "user", "content": extraction_prompt}],
            )
            raw = response.content[0].text.strip()
            extracted = json.loads(raw)
            if not isinstance(extracted, list):
                return 0

            count = 0
            for item in extracted:
                if isinstance(item, dict) and "text" in item and item["text"].strip():
                    self._memory.add_memory(
                        text=item["text"].strip(),
                        source="family",
                        memory_type=item.get("memory_type", "event"),
                    )
                    count += 1

            logger.info(f"Memory extraction: {count} new memories stored for client {self.profile.client_id}")
            return count

        except Exception as e:
            logger.warning(f"Memory extraction failed for {self.profile.client_id}: {e}")
            return 0
