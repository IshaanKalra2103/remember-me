import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.auth_utils import get_current_caregiver
from app.models import PersonCreate, PersonOut, PersonUpdate, PhotoOut
from app.supabase_client import supabase

router = APIRouter(tags=["people"])


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


def _build_person_out(person: dict) -> PersonOut:
    photos_result = (
        supabase.table("photos")
        .select("*")
        .eq("person_id", person["id"])
        .execute()
    )
    photos = [PhotoOut(**p) for p in photos_result.data]
    return PersonOut(**person, photos=photos)


@router.get("/patients/{patient_id}/people", response_model=list[PersonOut])
async def list_people(patient_id: uuid.UUID, caregiver=Depends(get_current_caregiver)):
    _verify_patient_ownership(str(patient_id), caregiver["id"])
    result = (
        supabase.table("people")
        .select("*")
        .eq("patient_id", str(patient_id))
        .execute()
    )
    return [_build_person_out(p) for p in result.data]


@router.post("/patients/{patient_id}/people", response_model=PersonOut, status_code=201)
async def create_person(
    patient_id: uuid.UUID, body: PersonCreate, caregiver=Depends(get_current_caregiver)
):
    _verify_patient_ownership(str(patient_id), caregiver["id"])
    result = (
        supabase.table("people")
        .insert(
            {
                "patient_id": str(patient_id),
                "name": body.name,
                "relationship": body.relationship,
                "nickname": body.nickname,
            }
        )
        .execute()
    )
    return _build_person_out(result.data[0])


@router.get("/people/{person_id}", response_model=PersonOut)
async def get_person(person_id: uuid.UUID, caregiver=Depends(get_current_caregiver)):
    result = (
        supabase.table("people")
        .select("*")
        .eq("id", str(person_id))
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Person not found")
    return _build_person_out(result.data)


@router.patch("/people/{person_id}", response_model=PersonOut)
async def update_person(
    person_id: uuid.UUID, body: PersonUpdate, caregiver=Depends(get_current_caregiver)
):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        supabase.table("people")
        .update(updates)
        .eq("id", str(person_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Person not found")
    return _build_person_out(result.data[0])


@router.delete("/people/{person_id}", status_code=204)
async def delete_person(person_id: uuid.UUID, caregiver=Depends(get_current_caregiver)):
    # Delete photos from storage
    photos = (
        supabase.table("photos")
        .select("storage_path")
        .eq("person_id", str(person_id))
        .execute()
    )
    for photo in photos.data:
        supabase.storage.from_("photos").remove([photo["storage_path"]])

    # Delete voice clip from storage
    supabase.storage.from_("voice-clips").remove([f"{person_id}/voice"])

    # Delete person (cascades to photos, recognition_events via person_id)
    supabase.table("people").delete().eq("id", str(person_id)).execute()


@router.post("/people/{person_id}/photos", response_model=PhotoOut, status_code=201)
async def upload_photo(
    person_id: uuid.UUID, file: UploadFile, caregiver=Depends(get_current_caregiver)
):
    person = (
        supabase.table("people")
        .select("id")
        .eq("id", str(person_id))
        .maybe_single()
        .execute()
    )
    if not person.data:
        raise HTTPException(status_code=404, detail="Person not found")

    file_bytes = await file.read()
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    photo_id = str(uuid.uuid4())
    storage_path = f"{person_id}/{photo_id}.{ext}"

    supabase.storage.from_("photos").upload(
        storage_path,
        file_bytes,
        {"content-type": file.content_type or "image/jpeg"},
    )

    public_url = supabase.storage.from_("photos").get_public_url(storage_path)

    result = (
        supabase.table("photos")
        .insert(
            {
                "id": photo_id,
                "person_id": str(person_id),
                "storage_path": storage_path,
                "url": public_url,
            }
        )
        .execute()
    )
    return PhotoOut(**result.data[0])


@router.delete("/people/{person_id}/photos/{photo_id}", status_code=204)
async def delete_photo(
    person_id: uuid.UUID, photo_id: uuid.UUID, caregiver=Depends(get_current_caregiver)
):
    photo = (
        supabase.table("photos")
        .select("*")
        .eq("id", str(photo_id))
        .eq("person_id", str(person_id))
        .maybe_single()
        .execute()
    )
    if not photo.data:
        raise HTTPException(status_code=404, detail="Photo not found")

    supabase.storage.from_("photos").remove([photo.data["storage_path"]])
    supabase.table("photos").delete().eq("id", str(photo_id)).execute()


@router.post("/people/{person_id}/voice", status_code=201)
async def upload_voice(
    person_id: uuid.UUID, file: UploadFile, caregiver=Depends(get_current_caregiver)
):
    person = (
        supabase.table("people")
        .select("id")
        .eq("id", str(person_id))
        .maybe_single()
        .execute()
    )
    if not person.data:
        raise HTTPException(status_code=404, detail="Person not found")

    file_bytes = await file.read()
    storage_path = f"{person_id}/voice"

    # Remove existing voice clip if present
    supabase.storage.from_("voice-clips").remove([storage_path])

    supabase.storage.from_("voice-clips").upload(
        storage_path,
        file_bytes,
        {"content-type": file.content_type or "audio/mpeg"},
    )

    # Mark person as having a voice message
    supabase.table("people").update(
        {"has_voice_message": True}
    ).eq("id", str(person_id)).execute()

    public_url = supabase.storage.from_("voice-clips").get_public_url(storage_path)
    return {"url": public_url}
