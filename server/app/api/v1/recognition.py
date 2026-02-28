import hashlib
import uuid
from math import sqrt

from fastapi import APIRouter, HTTPException, UploadFile

from app.models import (
    RecognitionCandidate,
    RecognitionEventOut,
    RecognitionResult,
    TiebreakRequest,
)
from app.supabase_client import supabase

router = APIRouter(prefix="/sessions", tags=["recognition"])

VECTOR_SIZE = 24


def _normalize(vector: list[float]) -> list[float]:
    magnitude = sqrt(sum(value * value for value in vector))
    if not magnitude:
        return [0.0 for _ in vector]
    return [value / magnitude for value in vector]


def _vector_from_bytes(payload: bytes, salt: str) -> list[float]:
    digest = hashlib.sha256(payload + salt.encode("utf-8")).digest()
    cursor = digest
    values: list[float] = []

    while len(values) < VECTOR_SIZE:
        cursor = hashlib.sha256(cursor + salt.encode("utf-8")).digest()
        for byte in cursor:
            values.append((byte / 255.0) * 2 - 1)
            if len(values) == VECTOR_SIZE:
                break

    return _normalize(values)


def _vector_from_text(seed: str, salt: str) -> list[float]:
    return _vector_from_bytes(seed.encode("utf-8"), salt)


def _average(vectors: list[list[float]]) -> list[float]:
    if not vectors:
        return []

    total = [0.0] * len(vectors[0])
    for vector in vectors:
        for index, value in enumerate(vector):
            total[index] += value

    return _normalize([value / len(vectors) for value in total])


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    return sum(left[index] * right[index] for index in range(min(len(left), len(right))))


def _score_similarity(left: list[float], right: list[float]) -> float:
    raw_score = _cosine_similarity(left, right)
    return round(max(0.0, min(0.99, (raw_score + 1) / 2)), 2)


@router.post("/{session_id}/frame", response_model=RecognitionResult)
async def submit_frame(session_id: uuid.UUID, file: UploadFile):
    """Deterministic placeholder for recognition until a real embedding model is added."""
    # Verify session exists and get patient_id
    session = (
        supabase.table("sessions")
        .select("*")
        .eq("id", str(session_id))
        .maybe_single()
        .execute()
    )
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    patient_id = session.data["patient_id"]
    frame_bytes = await file.read()
    if not frame_bytes:
        raise HTTPException(status_code=400, detail="Empty frame upload")

    # Get enrolled people for this patient
    people = (
        supabase.table("people")
        .select("id, name")
        .eq("patient_id", patient_id)
        .execute()
    )

    if not people.data:
        # No enrolled people — return not_sure
        event = (
            supabase.table("recognition_events")
            .insert(
                {
                    "session_id": str(session_id),
                    "status": "not_sure",
                    "confidence_score": 0.0,
                    "confidence_band": "low",
                    "candidates": [],
                    "needs_tie_break": False,
                }
            )
            .execute()
        )
        return RecognitionResult(
            event_id=event.data[0]["id"],
            status="not_sure",
            confidence_score=0.0,
            confidence_band="low",
            candidates=[],
            needs_tie_break=False,
        )

    frame_embedding = _vector_from_bytes(frame_bytes, f"frame:{patient_id}")

    # Placeholder pipeline: build stable per-person centroids from enrolled photo paths.
    candidates = []
    for person in people.data:
        photos = (
            supabase.table("photos")
            .select("id, storage_path, url")
            .eq("person_id", person["id"])
            .execute()
        )
        if not photos.data:
            continue

        centroid = _average(
            [
                _vector_from_text(
                    photo["storage_path"] or photo["url"] or photo["id"],
                    f"person:{person['id']}",
                )
                for photo in photos.data
            ]
        )
        confidence_score = _score_similarity(frame_embedding, centroid)
        candidates.append(
            RecognitionCandidate(
                person_id=person["id"],
                name=person["name"],
                confidence=confidence_score,
            )
        )

    if not candidates:
        event = (
            supabase.table("recognition_events")
            .insert(
                {
                    "session_id": str(session_id),
                    "status": "not_sure",
                    "confidence_score": 0.0,
                    "confidence_band": "low",
                    "candidates": [],
                    "needs_tie_break": False,
                }
            )
            .execute()
        )
        return RecognitionResult(
            event_id=event.data[0]["id"],
            status="not_sure",
            confidence_score=0.0,
            confidence_band="low",
            candidates=[],
            needs_tie_break=False,
        )

    candidates.sort(key=lambda c: c.confidence, reverse=True)
    top = candidates[0]
    runner_up = candidates[1] if len(candidates) > 1 else None
    score_gap = round(top.confidence - runner_up.confidence, 2) if runner_up else top.confidence

    # Determine status based on confidence and separation.
    if top.confidence >= 0.85 and score_gap >= 0.08:
        status = "identified"
        band = "high"
        needs_tie_break = False
    elif top.confidence >= 0.6:
        status = "unsure"
        band = "medium"
        needs_tie_break = len(candidates) > 1
    else:
        status = "not_sure"
        band = "low"
        needs_tie_break = False

    winner_id = str(top.person_id) if status == "identified" else None

    event = (
        supabase.table("recognition_events")
        .insert(
            {
                "session_id": str(session_id),
                "status": status,
                "confidence_score": top.confidence,
                "confidence_band": band,
                "winner_person_id": winner_id,
                "candidates": [c.model_dump(mode="json") for c in candidates],
                "needs_tie_break": needs_tie_break,
            }
        )
        .execute()
    )

    return RecognitionResult(
        event_id=event.data[0]["id"],
        status=status,
        confidence_score=top.confidence,
        confidence_band=band,
        winner_person_id=winner_id,
        candidates=candidates,
        needs_tie_break=needs_tie_break,
    )


@router.post("/{session_id}/tiebreak", response_model=RecognitionResult)
async def tiebreak(session_id: uuid.UUID, body: TiebreakRequest):
    # Find the latest event for this session that needs a tiebreak
    event = (
        supabase.table("recognition_events")
        .select("*")
        .eq("session_id", str(session_id))
        .eq("needs_tie_break", True)
        .order("created_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )
    if not event.data:
        raise HTTPException(status_code=404, detail="No tiebreak event found")

    # Update the event
    updated = (
        supabase.table("recognition_events")
        .update(
            {
                "status": "identified",
                "winner_person_id": str(body.selected_person_id),
                "needs_tie_break": False,
                "confidence_band": "high",
            }
        )
        .eq("id", event.data["id"])
        .execute()
    )

    return RecognitionResult(
        event_id=updated.data[0]["id"],
        status="identified",
        confidence_score=updated.data[0]["confidence_score"],
        confidence_band="high",
        winner_person_id=body.selected_person_id,
        candidates=[
            RecognitionCandidate(**c) for c in updated.data[0]["candidates"]
        ],
        needs_tie_break=False,
    )


@router.get("/{session_id}/result/{event_id}", response_model=RecognitionEventOut)
async def get_result(session_id: uuid.UUID, event_id: uuid.UUID):
    result = (
        supabase.table("recognition_events")
        .select("*")
        .eq("id", str(event_id))
        .eq("session_id", str(session_id))
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    return RecognitionEventOut(**result.data)
