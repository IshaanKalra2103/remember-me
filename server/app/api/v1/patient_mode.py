import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.models import (
    ActivityLogCreate,
    ActivityLogOut,
    PatientPublicOut,
    PersonOut,
    PhotoOut,
    RecognitionPreferencesOut,
)
from app.supabase_client import supabase

router = APIRouter(prefix="/patient-mode", tags=["patient-mode"])


def _build_person_out(person: dict) -> PersonOut:
    photos_result = (
        supabase.table("photos")
        .select("*")
        .eq("person_id", person["id"])
        .execute()
    )
    photos = [PhotoOut(**p) for p in photos_result.data]
    return PersonOut(**person, photos=photos)


@router.get("/patients/{patient_id}", response_model=PatientPublicOut)
async def get_patient(patient_id: uuid.UUID):
    result = (
        supabase.table("patients")
        .select("*")
        .eq("id", str(patient_id))
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Patient not found")
    return PatientPublicOut(**result.data)


@router.get("/patients/{patient_id}/people", response_model=list[PersonOut])
async def list_people(patient_id: uuid.UUID):
    result = (
        supabase.table("people")
        .select("*")
        .eq("patient_id", str(patient_id))
        .execute()
    )
    return [_build_person_out(p) for p in result.data]


@router.get(
    "/patients/{patient_id}/preferences", response_model=RecognitionPreferencesOut
)
async def get_preferences(patient_id: uuid.UUID):
    result = (
        supabase.table("recognition_prefs")
        .select("*")
        .eq("patient_id", str(patient_id))
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Preferences not found")
    return RecognitionPreferencesOut(**result.data)


@router.get("/patients/{patient_id}/logs", response_model=list[ActivityLogOut])
async def list_logs(
    patient_id: uuid.UUID,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    type: Optional[str] = Query(default=None),
):
    query = (
        supabase.table("activity_logs")
        .select("*")
        .eq("patient_id", str(patient_id))
        .order("timestamp", desc=True)
    )

    if type:
        query = query.eq("type", type)

    result = query.range(offset, offset + limit - 1).execute()
    return [ActivityLogOut(**log) for log in result.data]


@router.post("/patients/{patient_id}/logs", response_model=ActivityLogOut, status_code=201)
async def create_log(patient_id: uuid.UUID, body: ActivityLogCreate):
    result = (
        supabase.table("activity_logs")
        .insert(
            {
                "patient_id": str(patient_id),
                "type": body.type,
                "person_name": body.person_name,
                "confidence": body.confidence,
                "note": body.note,
            }
        )
        .execute()
    )
    return ActivityLogOut(**result.data[0])
