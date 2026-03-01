import hashlib
import json
import urllib.error
import urllib.request
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.config import (
    ELEVENLABS_API_KEY,
    ELEVENLABS_MODEL_ID,
    ELEVENLABS_VOICE_ID,
    SUPABASE_URL,
)
from app.models import (
    ActivityLogCreate,
    ActivityLogOut,
    AnnouncementAudioResponse,
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


def _normalize_supabase_url(url: str) -> str:
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("/"):
        return f"{SUPABASE_URL}{url}"
    return f"{SUPABASE_URL}/{url}"


def _resolve_audio_url(storage_path: str) -> str:
    try:
        signed = supabase.storage.from_("announcement-audio").create_signed_url(
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
    return supabase.storage.from_("announcement-audio").get_public_url(storage_path)


def _generate_tts_audio(text: str) -> bytes:
    """Generate audio using ElevenLabs TTS."""
    if not ELEVENLABS_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="ELEVENLABS_API_KEY is not configured",
        )

    url = (
        "https://api.elevenlabs.io/v1/text-to-speech/"
        f"{ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128"
    )

    payload = {
        "text": text,
        "model_id": ELEVENLABS_MODEL_ID,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
        },
    }

    req = urllib.request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
            "xi-api-key": ELEVENLABS_API_KEY,
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            audio_bytes = response.read()
    except urllib.error.HTTPError as exc:
        response_body = exc.read().decode("utf-8", errors="ignore")
        detail = response_body[:300] if response_body else str(exc.reason)
        raise HTTPException(
            status_code=502,
            detail=f"ElevenLabs TTS request failed: {detail}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Failed to connect to ElevenLabs TTS",
        ) from exc

    if not audio_bytes:
        raise HTTPException(status_code=502, detail="ElevenLabs returned empty audio")

    return audio_bytes


def _upload_audio(storage_path: str, audio_bytes: bytes) -> None:
    """Upload audio to Supabase storage, replacing if exists."""
    try:
        supabase.storage.from_("announcement-audio").upload(
            storage_path,
            audio_bytes,
            {"content-type": "audio/mpeg"},
        )
    except Exception as exc:
        error_text = str(exc)
        if "Duplicate" in error_text or "already exists" in error_text:
            try:
                supabase.storage.from_("announcement-audio").remove([storage_path])
                supabase.storage.from_("announcement-audio").upload(
                    storage_path,
                    audio_bytes,
                    {"content-type": "audio/mpeg"},
                )
            except Exception:
                pass


@router.get("/people/{person_id}/announcement-audio", response_model=AnnouncementAudioResponse)
async def get_announcement_audio(person_id: uuid.UUID):
    """Get or generate announcement audio using ElevenLabs TTS (no auth required)."""
    person = (
        supabase.table("people")
        .select("id, name, relationship")
        .eq("id", str(person_id))
        .maybe_single()
        .execute()
    )
    if not person.data:
        raise HTTPException(status_code=404, detail="Person not found")

    name = person.data["name"]
    relationship = person.data.get("relationship") or "someone you know"
    text = f"This is {name}, your {relationship}"

    cache_key = f"{text}|voice={ELEVENLABS_VOICE_ID}|model={ELEVENLABS_MODEL_ID}"
    text_hash = hashlib.sha256(cache_key.encode()).hexdigest()[:16]
    storage_path = f"{person_id}/{text_hash}.mp3"

    # Check for cached audio first
    try:
        existing = supabase.storage.from_("announcement-audio").list(str(person_id))
        for f in existing:
            if f["name"] == f"{text_hash}.mp3":
                return AnnouncementAudioResponse(
                    url=_resolve_audio_url(storage_path), cached=True
                )
    except Exception:
        pass

    # Generate new audio with ElevenLabs TTS
    audio_bytes = _generate_tts_audio(text)

    # Cache the generated audio
    _upload_audio(storage_path, audio_bytes)

    return AnnouncementAudioResponse(url=_resolve_audio_url(storage_path), cached=False)


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
