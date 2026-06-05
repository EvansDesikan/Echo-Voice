"""
AI/ML Engineer — Memory RAG Pipeline
Stores and retrieves personal memories from ChromaDB.
Memories are added during client onboarding (and by family post-death).
Retrieved memories are injected into the Claude conversation context.
"""
import uuid
from typing import List, Optional

import chromadb
from anthropic import Anthropic

from config.settings import settings
from src.data.database import get_memory_collection


class MemoryStore:
    """
    Interface for a single client's memory collection.
    Uses ChromaDB with sentence-level embeddings for semantic retrieval.
    """

    def __init__(self, client_id: str):
        self.client_id = client_id
        self.collection = get_memory_collection(client_id)

    def add_memory(
        self,
        text: str,
        source: str = "client",  # "client" | "family" | "transcript"
        memory_type: str = "event",  # "event" | "phrase" | "value" | "relationship"
    ) -> str:
        """Add a single memory. Returns the generated memory ID."""
        memory_id = str(uuid.uuid4())
        self.collection.add(
            documents=[text],
            ids=[memory_id],
            metadatas=[{
                "source": source,
                "memory_type": memory_type,
                "client_id": self.client_id,
            }],
        )
        return memory_id

    def add_memories_bulk(self, memories: List[dict]) -> List[str]:
        """
        Add multiple memories at once.
        Each dict: {"text": str, "source": str, "memory_type": str}
        """
        ids, docs, metas = [], [], []
        for m in memories:
            mem_id = str(uuid.uuid4())
            ids.append(mem_id)
            docs.append(m["text"])
            metas.append({
                "source": m.get("source", "client"),
                "memory_type": m.get("memory_type", "event"),
                "client_id": self.client_id,
            })
        self.collection.add(documents=docs, ids=ids, metadatas=metas)
        return ids

    def retrieve(self, query: str, n_results: int = 5) -> List[str]:
        """
        Retrieve the top-n most semantically relevant memories for a query.
        Returns list of memory text strings.
        """
        if self.collection.count() == 0:
            return []
        results = self.collection.query(
            query_texts=[query],
            n_results=min(n_results, self.collection.count()),
        )
        return results["documents"][0] if results["documents"] else []

    def format_for_context(self, memories: List[str]) -> str:
        """Format retrieved memories as a context block for the Claude prompt."""
        if not memories:
            return ""
        lines = "\n".join(f"  • {m}" for m in memories)
        return f"\n═══ RELEVANT MEMORIES ═══\n{lines}\n"

    def count(self) -> int:
        return self.collection.count()
