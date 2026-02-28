import hashlib
import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.auth_utils import get_current_caregiver
from app.models import AnnouncementAudioResponse
from app.supabase_client import supabase

router = APIRouter(tags=["audio"])


@router.post("/people/{person_id}/announcement-audio", response_model=AnnouncementAudioResponse)
async def generate_announcement_audio(
    person_id: uuid.UUID, caregiver=Depends(get_current_caregiver)
):
    """Stub: generate placeholder announcement audio URL."""
    person = (
        supabase.table("people")
        .select("name, relationship")
        .eq("id", str(person_id))
        .maybe_single()
        .execute()
    )
    if not person.data:
        raise HTTPException(status_code=404, detail="Person not found")

    name = person.data["name"]
    relationship = person.data["relationship"] or "someone you know"
    text = f"This is {name}, your {relationship}"
    text_hash = hashlib.sha256(text.encode()).hexdigest()[:16]

    storage_path = f"{person_id}/{text_hash}.mp3"

    # Check if cached version exists
    try:
        existing = supabase.storage.from_("announcement-audio").list(str(person_id))
        for f in existing:
            if f["name"] == f"{text_hash}.mp3":
                url = supabase.storage.from_("announcement-audio").get_public_url(
                    storage_path
                )
                return AnnouncementAudioResponse(url=url, cached=True)
    except Exception:
        pass

    # Stub: upload a placeholder (empty bytes) — real impl would call TTS
    placeholder = b""
    supabase.storage.from_("announcement-audio").upload(
        storage_path,
        placeholder,
        {"content-type": "audio/mpeg"},
    )

    url = supabase.storage.from_("announcement-audio").get_public_url(storage_path)

    # Mark person as having an announcement
    supabase.table("people").update(
        {"has_announcement": True}
    ).eq("id", str(person_id)).execute()

    return AnnouncementAudioResponse(url=url, cached=False)
