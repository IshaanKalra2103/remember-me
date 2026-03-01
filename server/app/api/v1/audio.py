import hashlib
import json
import urllib.error
import urllib.request
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth_utils import get_current_caregiver
from app.config import (
    ELEVENLABS_API_KEY,
    ELEVENLABS_MODEL_ID,
    ELEVENLABS_VOICE_ID,
    SUPABASE_URL,
)
from app.models import AnnouncementAudioResponse
from app.supabase_client import supabase

router = APIRouter(tags=["audio"])


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
        # Handle response shapes across client versions.
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


def _upload_audio(storage_path: str, audio_bytes: bytes, regenerate: bool) -> None:
    if regenerate:
        # Regeneration uses the same deterministic hash path. Remove old object first.
        try:
            supabase.storage.from_("announcement-audio").remove([storage_path])
        except Exception:
            pass

    try:
        supabase.storage.from_("announcement-audio").upload(
            storage_path,
            audio_bytes,
            {"content-type": "audio/mpeg"},
        )
    except Exception as exc:
        # Handle stale/parallel duplicate writes by replacing and retrying once.
        error_text = str(exc)
        if "Duplicate" in error_text or "already exists" in error_text:
            try:
                supabase.storage.from_("announcement-audio").remove([storage_path])
                supabase.storage.from_("announcement-audio").upload(
                    storage_path,
                    audio_bytes,
                    {"content-type": "audio/mpeg"},
                )
                return
            except Exception as retry_exc:
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to store generated audio after retry: {retry_exc}",
                ) from retry_exc
        raise HTTPException(
            status_code=502,
            detail=f"Failed to store generated audio: {exc}",
        ) from exc


def _generate_announcement_audio(text: str) -> bytes:
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


@router.post("/people/{person_id}/announcement-audio", response_model=AnnouncementAudioResponse)
async def generate_announcement_audio(
    person_id: uuid.UUID,
    regenerate: bool = Query(default=False),
    caregiver=Depends(get_current_caregiver),
):
    """Generate and cache announcement audio using ElevenLabs TTS."""
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
    # Include voice/model in the cache key so changing TTS voice invalidates old clips.
    cache_key = f"{text}|voice={ELEVENLABS_VOICE_ID}|model={ELEVENLABS_MODEL_ID}"
    text_hash = hashlib.sha256(cache_key.encode()).hexdigest()[:16]

    storage_path = f"{person_id}/{text_hash}.mp3"

    # Check if cached version exists, unless caller requests regeneration.
    if not regenerate:
        try:
            existing = supabase.storage.from_("announcement-audio").list(str(person_id))
            for f in existing:
                if f["name"] == f"{text_hash}.mp3":
                    return AnnouncementAudioResponse(
                        url=_resolve_audio_url(storage_path), cached=True
                    )
        except Exception:
            pass

    audio_bytes = _generate_announcement_audio(text)

    _upload_audio(storage_path, audio_bytes, regenerate=regenerate)

    url = _resolve_audio_url(storage_path)

    # Mark person as having an announcement
    supabase.table("people").update(
        {"has_announcement": True}
    ).eq("id", str(person_id)).execute()

    return AnnouncementAudioResponse(url=url, cached=False)
