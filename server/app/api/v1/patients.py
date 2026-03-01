import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.auth_utils import get_current_caregiver, get_optional_caregiver
from app.models import (
    PatientCreate,
    PatientOut,
    PatientUpdate,
    RecognitionPreferencesOut,
    RecognitionPreferencesUpdate,
    SessionOut,
    VoiceSampleResponse,
)
from app.supabase_client import supabase
from app.titanet import embedding_to_pgvector, generate_embedding

router = APIRouter(prefix="/patients", tags=["patients"])


def _build_patient_out(patient: dict) -> PatientOut:
    """Build PatientOut with has_voice_sample derived from voice_embedding."""
    has_voice = bool(patient.get("voice_embedding"))
    return PatientOut(
        id=patient["id"],
        caregiver_id=patient["caregiver_id"],
        name=patient["name"],
        language=patient["language"],
        avatar_url=patient.get("avatar_url"),
        supervision_mode=patient["supervision_mode"],
        auto_play_audio=patient["auto_play_audio"],
        has_voice_sample=has_voice,
        created_at=patient["created_at"],
    )


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
    return [_build_patient_out(p) for p in result.data]


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

    return _build_patient_out(patient.data[0])


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
    return _build_patient_out(result.data)


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
    return _build_patient_out(result.data[0])


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
async def create_session(patient_id: uuid.UUID):
    """Patient-mode route: session creation is allowed without caregiver auth."""
    result = (
        supabase.table("sessions")
        .insert({"patient_id": str(patient_id)})
        .execute()
    )
    return SessionOut(**result.data[0])


@router.post("/{patient_id}/voice-sample", response_model=VoiceSampleResponse, status_code=201)
async def upload_voice_sample(
    patient_id: uuid.UUID, file: UploadFile, caregiver=Depends(get_optional_caregiver)
):
    """
    Upload a voice sample for the patient and generate TitaNet embedding.

    The 192-dimensional TitaNet embedding is stored in pgvector for
    speaker identification during conversation transcription.
    """
    if caregiver:
        _verify_ownership(str(patient_id), caregiver["id"])

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Determine audio format
    ext = "m4a"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()

    storage_path = f"{patient_id}/voice-sample"

    # Remove existing voice sample if present
    try:
        supabase.storage.from_("memory-audio").remove([storage_path])
    except Exception:
        pass  # Ignore if file doesn't exist

    # Upload to memory-audio bucket
    try:
        supabase.storage.from_("memory-audio").upload(
            storage_path,
            file_bytes,
            {"content-type": file.content_type or "audio/mpeg"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to upload voice sample: {str(e)}",
        )

    # Generate TitaNet embedding
    try:
        embedding = generate_embedding(file_bytes, source_format=ext)
        pgvector_str = embedding_to_pgvector(embedding)

        # Store embedding in pgvector column
        supabase.table("patients").update({
            "voice_embedding": "titanet",
            "voice_embedding_vector": pgvector_str,
        }).eq("id", str(patient_id)).execute()

        return VoiceSampleResponse(
            success=True,
            message="Voice sample uploaded and TitaNet embedding generated",
        )

    except Exception as e:
        # Still mark as uploaded even if embedding fails
        supabase.table("patients").update(
            {"voice_embedding": "uploaded_no_embedding"}
        ).eq("id", str(patient_id)).execute()

        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate TitaNet embedding: {str(e)}",
        )
