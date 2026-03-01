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

import asyncio
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import SUPABASE_URL
from app.gemini_service import (
    MemoryEntry,
    generate_memory_image_data_uri,
    recall_memory,
    search_memories,
)
from app.supabase_client import supabase
from app.tts_service import text_to_speech

router = APIRouter(tags=["recall"])

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "..", "output.txt")
OUTPUT_AUDIO = os.path.join(os.path.dirname(__file__), "..", "..", "..", "output.mp3")
ANNOUNCEMENT_BUCKET = "announcement-audio"


class RecallRequest(BaseModel):
    query: str = Field(..., description="Natural language query about a memory")
    person_id: str | None = Field(None, description="Optional: limit search to a specific person")


class RecallResponse(BaseModel):
    query: str
    response_text: str
    matched_memories: list[dict]
    audio_generated: bool
    audio_url: str | None = None


def _normalize_supabase_url(url: str) -> str:
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if not SUPABASE_URL:
        return url
    if url.startswith("/"):
        return f"{SUPABASE_URL}{url}"
    return f"{SUPABASE_URL}/{url}"


def _resolve_audio_url(storage_path: str) -> str:
    try:
        signed = supabase.storage.from_(ANNOUNCEMENT_BUCKET).create_signed_url(
            storage_path, 3600
        )
        for key in ("signedURL", "signedUrl"):
            if isinstance(signed, dict) and isinstance(signed.get(key), str):
                return _normalize_supabase_url(signed[key])
        data = signed.get("data") if isinstance(signed, dict) else None
        if isinstance(data, dict):
            for key in ("signedURL", "signedUrl"):
                if isinstance(data.get(key), str):
                    return _normalize_supabase_url(data[key])
    except Exception:
        pass

    public_url = supabase.storage.from_(ANNOUNCEMENT_BUCKET).get_public_url(storage_path)
    if isinstance(public_url, str):
        return public_url

    if isinstance(public_url, dict):
        for key in ("publicURL", "publicUrl"):
            if isinstance(public_url.get(key), str):
                return _normalize_supabase_url(public_url[key])
        data = public_url.get("data")
        if isinstance(data, dict):
            for key in ("publicURL", "publicUrl"):
                if isinstance(data.get(key), str):
                    return _normalize_supabase_url(data[key])

    raise HTTPException(status_code=502, detail="Failed to resolve recall audio URL")


def _upload_audio(storage_path: str, audio_bytes: bytes) -> None:
    try:
        supabase.storage.from_(ANNOUNCEMENT_BUCKET).upload(
            storage_path,
            audio_bytes,
            {"content-type": "audio/mpeg"},
        )
    except Exception as exc:
        error_text = str(exc)
        if "Duplicate" in error_text or "already exists" in error_text:
            try:
                supabase.storage.from_(ANNOUNCEMENT_BUCKET).remove([storage_path])
                supabase.storage.from_(ANNOUNCEMENT_BUCKET).upload(
                    storage_path,
                    audio_bytes,
                    {"content-type": "audio/mpeg"},
                )
                return
            except Exception as retry_exc:
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to store recall audio after retry: {retry_exc}",
                ) from retry_exc
        raise HTTPException(
            status_code=502,
            detail=f"Failed to store recall audio: {exc}",
        ) from exc


def _synthesize_and_store_recall_audio(
    patient_id: uuid.UUID, response_text: str
) -> tuple[bool, str | None]:
    audio_bytes = text_to_speech(response_text)
    if not audio_bytes:
        return False, None

    with open(OUTPUT_AUDIO, "wb") as f:
        f.write(audio_bytes)

    storage_path = f"recall/{patient_id}/latest.mp3"
    _upload_audio(storage_path, audio_bytes)
    return True, _resolve_audio_url(storage_path)


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
        response_text = (
            "I don't have any memories stored yet. Conversations will be saved as you have them."
        )
        audio_generated, audio_url = _synthesize_and_store_recall_audio(
            patient_id, response_text
        )
        return RecallResponse(
            query=body.query,
            response_text=response_text,
            matched_memories=[],
            audio_generated=audio_generated,
            audio_url=audio_url,
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
        audio_generated, audio_url = _synthesize_and_store_recall_audio(
            patient_id, response_text
        )
        return RecallResponse(
            query=body.query,
            response_text=response_text,
            matched_memories=[],
            audio_generated=audio_generated,
            audio_url=audio_url,
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

    # Step 4: Convert to ElevenLabs audio and publish a signed URL
    audio_generated, audio_url = _synthesize_and_store_recall_audio(
        patient_id, response_text
    )
    if audio_generated:
        print("[RECALL TTS] Audio written to output.mp3 and uploaded")

    # Build matched memory details for the response
    image_results = await asyncio.gather(
        *[
            generate_memory_image_data_uri(
                summary=m.summary or m.transcription or "",
                person_name=m.person_name,
                date=m.date,
                is_important=m.is_important,
            )
            for m in matched
        ],
        return_exceptions=True,
    )

    matched_details = []
    for m, image_result in zip(matched, image_results):
        image_url = image_result if isinstance(image_result, str) else None
        matched_details.append(
            {
                "person_name": m.person_name,
                "date": m.date,
                "summary": m.summary,
                "is_important": m.is_important,
                "image_url": image_url,
            }
        )

    return RecallResponse(
        query=body.query,
        response_text=response_text,
        matched_memories=matched_details,
        audio_generated=audio_generated,
        audio_url=audio_url,
    )
