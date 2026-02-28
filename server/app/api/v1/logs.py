import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth_utils import get_current_caregiver
from app.models import ActivityLogCreate, ActivityLogOut
from app.supabase_client import supabase

router = APIRouter(tags=["logs"])


def _verify_patient_ownership(patient_id: str, caregiver_id: str):
    row = (
        supabase.table("patients")
        .select("id")
        .eq("id", patient_id)
        .eq("caregiver_id", caregiver_id)
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Patient not found")


@router.get("/patients/{patient_id}/logs", response_model=list[ActivityLogOut])
async def list_logs(
    patient_id: uuid.UUID,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    type: Optional[str] = Query(default=None),
    caregiver=Depends(get_current_caregiver),
):
    _verify_patient_ownership(str(patient_id), caregiver["id"])

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
async def create_log(
    patient_id: uuid.UUID,
    body: ActivityLogCreate,
    caregiver=Depends(get_current_caregiver),
):
    _verify_patient_ownership(str(patient_id), caregiver["id"])

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
