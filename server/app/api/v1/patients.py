import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.auth_utils import get_current_caregiver, hash_pin, verify_pin
from app.models import (
    PatientCreate,
    PatientOut,
    PatientUpdate,
    PinSetRequest,
    PinVerifyRequest,
    PinVerifyResponse,
    RecognitionPreferencesOut,
    RecognitionPreferencesUpdate,
    SessionOut,
)
from app.supabase_client import supabase

router = APIRouter(prefix="/patients", tags=["patients"])


def _verify_ownership(patient_id: str, caregiver_id: str):
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


@router.get("", response_model=list[PatientOut])
async def list_patients(caregiver=Depends(get_current_caregiver)):
    result = (
        supabase.table("patients")
        .select("*")
        .eq("caregiver_id", caregiver["id"])
        .execute()
    )
    return [PatientOut(**p) for p in result.data]


@router.post("", response_model=PatientOut, status_code=201)
async def create_patient(body: PatientCreate, caregiver=Depends(get_current_caregiver)):
    patient = (
        supabase.table("patients")
        .insert(
            {
                "caregiver_id": caregiver["id"],
                "name": body.name,
                "language": body.language,
            }
        )
        .execute()
    )

    # Create default preferences row
    supabase.table("recognition_prefs").insert(
        {"patient_id": patient.data[0]["id"]}
    ).execute()

    return PatientOut(**patient.data[0])


@router.get("/{patient_id}", response_model=PatientOut)
async def get_patient(patient_id: uuid.UUID, caregiver=Depends(get_current_caregiver)):
    _verify_ownership(str(patient_id), caregiver["id"])
    result = (
        supabase.table("patients")
        .select("*")
        .eq("id", str(patient_id))
        .single()
        .execute()
    )
    return PatientOut(**result.data)


@router.patch("/{patient_id}", response_model=PatientOut)
async def update_patient(
    patient_id: uuid.UUID, body: PatientUpdate, caregiver=Depends(get_current_caregiver)
):
    _verify_ownership(str(patient_id), caregiver["id"])
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        supabase.table("patients")
        .update(updates)
        .eq("id", str(patient_id))
        .execute()
    )
    return PatientOut(**result.data[0])


@router.post("/{patient_id}/pin")
async def set_pin(
    patient_id: uuid.UUID, body: PinSetRequest, caregiver=Depends(get_current_caregiver)
):
    _verify_ownership(str(patient_id), caregiver["id"])
    supabase.table("patients").update(
        {"pin_hash": hash_pin(body.pin)}
    ).eq("id", str(patient_id)).execute()
    return {"message": "PIN set"}


@router.post("/{patient_id}/pin/verify", response_model=PinVerifyResponse)
async def verify_patient_pin(patient_id: uuid.UUID, body: PinVerifyRequest):
    """No auth required – used in patient mode."""
    result = (
        supabase.table("patients")
        .select("pin_hash")
        .eq("id", str(patient_id))
        .maybe_single()
        .execute()
    )
    if not result.data or not result.data["pin_hash"]:
        raise HTTPException(status_code=404, detail="Patient not found or PIN not set")

    return PinVerifyResponse(valid=verify_pin(body.pin, result.data["pin_hash"]))


@router.get("/{patient_id}/preferences", response_model=RecognitionPreferencesOut)
async def get_preferences(patient_id: uuid.UUID, caregiver=Depends(get_current_caregiver)):
    _verify_ownership(str(patient_id), caregiver["id"])
    result = (
        supabase.table("recognition_prefs")
        .select("*")
        .eq("patient_id", str(patient_id))
        .single()
        .execute()
    )
    return RecognitionPreferencesOut(**result.data)


@router.patch("/{patient_id}/preferences", response_model=RecognitionPreferencesOut)
async def update_preferences(
    patient_id: uuid.UUID,
    body: RecognitionPreferencesUpdate,
    caregiver=Depends(get_current_caregiver),
):
    _verify_ownership(str(patient_id), caregiver["id"])
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        supabase.table("recognition_prefs")
        .update(updates)
        .eq("patient_id", str(patient_id))
        .execute()
    )
    return RecognitionPreferencesOut(**result.data[0])


@router.post("/{patient_id}/sessions", response_model=SessionOut, status_code=201)
async def create_session(patient_id: uuid.UUID, caregiver=Depends(get_current_caregiver)):
    _verify_ownership(str(patient_id), caregiver["id"])
    result = (
        supabase.table("sessions")
        .insert({"patient_id": str(patient_id)})
        .execute()
    )
    return SessionOut(**result.data[0])
