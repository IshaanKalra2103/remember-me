import random
import uuid

from fastapi import APIRouter, HTTPException, UploadFile

from app.models import (
    RecognitionCandidate,
    RecognitionEventOut,
    RecognitionResult,
    TiebreakRequest,
)
from app.supabase_client import supabase

router = APIRouter(prefix="/sessions", tags=["recognition"])


@router.post("/{session_id}/frame", response_model=RecognitionResult)
async def submit_frame(session_id: uuid.UUID, file: UploadFile):
    """Stub: randomly pick an enrolled person and assign random confidence."""
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

    # Consume file (not used in stub)
    await file.read()

    # Stub: generate random candidates with confidence scores
    candidates = []
    for person in people.data:
        candidates.append(
            RecognitionCandidate(
                person_id=person["id"],
                name=person["name"],
                confidence=round(random.uniform(0.3, 0.99), 2),
            )
        )

    candidates.sort(key=lambda c: c.confidence, reverse=True)
    top = candidates[0]

    # Determine status based on confidence
    if top.confidence >= 0.85:
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
