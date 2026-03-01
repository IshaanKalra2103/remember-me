"""
recall.py — Memory recall endpoint.

The user (patient or caregiver) asks a question like:
  "What did Ishaan tell me last week?"
  "Tell me about the time someone got a new job"
  "What happened on February 25th?"

The system searches all stored memories, uses Gemini to find the best match,
generates a natural spoken response, and converts it to audio via ElevenLabs.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.gemini_service import MemoryEntry, recall_memory, search_memories
from app.supabase_client import supabase
from app.tts_service import text_to_speech

router = APIRouter(tags=["recall"])

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "..", "output.txt")
OUTPUT_AUDIO = os.path.join(os.path.dirname(__file__), "..", "..", "..", "output.mp3")


class RecallRequest(BaseModel):
    query: str = Field(..., description="Natural language query about a memory")
    person_id: str | None = Field(None, description="Optional: limit search to a specific person")


class RecallResponse(BaseModel):
    query: str
    response_text: str
    matched_memories: list[dict]
    audio_generated: bool


@router.post("/patients/{patient_id}/recall", response_model=RecallResponse)
async def recall(patient_id: uuid.UUID, body: RecallRequest):
    """Search the patient's memories and return a natural spoken answer.

    Optionally filters by person_id. The response text is also written to
    output.txt and converted to output.mp3 for playback.
    """
    pid = str(patient_id)

    # Verify patient exists
    patient = (
        supabase.table("patients")
        .select("id")
        .eq("id", pid)
        .maybe_single()
        .execute()
    )
    if not patient.data:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Fetch all memories for this patient
    query = (
        supabase.table("memories")
        .select("*")
        .eq("patient_id", pid)
        .order("created_at", desc=True)
    )
    if body.person_id:
        query = query.eq("person_id", body.person_id)

    result = query.execute()

    if not result.data:
        return RecallResponse(
            query=body.query,
            response_text="I don't have any memories stored yet. Conversations will be saved as you have them.",
            matched_memories=[],
            audio_generated=False,
        )

    # Build MemoryEntry list for Gemini
    entries = []
    for i, m in enumerate(result.data):
        entries.append(MemoryEntry(
            index=i,
            person_name=m.get("person_name", "someone"),
            date=m.get("created_at", "")[:10] if m.get("created_at") else "unknown",
            summary=m.get("summary") or "",
            is_important=m.get("is_important", False),
            transcription=m.get("transcription") or "",
        ))

    # Step 1: Gemini finds matching memories
    matched_indices = await search_memories(body.query, entries)

    if not matched_indices:
        response_text = (
            "I couldn't find a specific memory matching that. "
            "Could you try describing it a different way?"
        )
        return RecallResponse(
            query=body.query,
            response_text=response_text,
            matched_memories=[],
            audio_generated=False,
        )

    matched = [entries[i] for i in matched_indices]
    person_name = matched[0].person_name if matched else None

    # Step 2: Gemini generates a natural spoken response
    response_text = await recall_memory(body.query, matched, person_name)

    # Step 3: Write to output.txt
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(OUTPUT_FILE, "w") as f:
        f.write(f"[{timestamp}] {response_text}\n")
    print(f"[RECALL] {response_text}")

    # Step 4: Convert to audio
    audio_generated = False
    audio_bytes = text_to_speech(response_text)
    if audio_bytes:
        with open(OUTPUT_AUDIO, "wb") as f:
            f.write(audio_bytes)
        audio_generated = True
        print(f"[RECALL TTS] Audio written to output.mp3 ({len(audio_bytes)} bytes)")

    # Build matched memory details for the response
    matched_details = [
        {
            "person_name": m.person_name,
            "date": m.date,
            "summary": m.summary,
            "is_important": m.is_important,
        }
        for m in matched
    ]

    return RecallResponse(
        query=body.query,
        response_text=response_text,
        matched_memories=matched_details,
        audio_generated=audio_generated,
    )
