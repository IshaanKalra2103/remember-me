"""
Memories API - Records and transcribes conversations using AssemblyAI + TitaNet.

Uses AssemblyAI for speech-to-text with speaker diarization, then TitaNet
to identify which speaker is the patient based on their stored voice embedding.
"""

import uuid
import base64
from pathlib import Path

import assemblyai as aai
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import ASSEMBLYAI_API_KEY, SUPABASE_URL
from app.gemini_service import (
    PersonContext,
    evaluate_importance,
    generate_memory_image_data_uri,
    summarize_transcript,
    update_profile_bio,
)
from app.supabase_client import supabase
from app.titanet import embedding_from_pgvector, identify_speakers

router = APIRouter(tags=["memories"])

MEMORY_AUDIO_BUCKET = "memory-audio"
MEMORY_IMAGE_PREFIX = "memory-images"

# Configure AssemblyAI
if ASSEMBLYAI_API_KEY:
    aai.settings.api_key = ASSEMBLYAI_API_KEY


def _normalize_supabase_url(url: str) -> str:
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if SUPABASE_URL is None:
        return url
    if url.startswith("/"):
        return f"{SUPABASE_URL}{url}"
    return f"{SUPABASE_URL}/{url}"


def _resolve_storage_url(bucket: str, storage_path: str) -> str:
    """Get a signed/public URL for a storage object."""
    try:
        signed = supabase.storage.from_(bucket).create_signed_url(
            storage_path,
            60 * 60 * 24,  # 24 hours
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

    public_url = supabase.storage.from_(bucket).get_public_url(storage_path)
    if isinstance(public_url, str):
        return public_url

    if isinstance(public_url, dict):
        for key in ("publicURL", "publicUrl"):
            if isinstance(public_url.get(key), str):
                return _normalize_supabase_url(public_url[key])
        data = public_url.get("data")
        if isinstance(data, dict):
            for key in ("publicURL", "publicUrl"):
                if isinstance(data.get(key), str):
                    return _normalize_supabase_url(data[key])

    raise HTTPException(status_code=502, detail="Failed to resolve storage URL")


def _resolve_audio_url(storage_path: str) -> str:
    """Get a signed/public URL for memory audio in storage."""
    return _resolve_storage_url(MEMORY_AUDIO_BUCKET, storage_path)


def _upload_audio(patient_id: uuid.UUID, audio_bytes: bytes, filename: str, mime_type: str) -> str:
    """Upload audio to Supabase storage and return the URL."""
    extension = Path(filename).suffix or ".m4a"
    storage_path = f"{patient_id}/{uuid.uuid4()}{extension}"

    try:
        supabase.storage.from_(MEMORY_AUDIO_BUCKET).upload(
            storage_path,
            audio_bytes,
            {"content-type": mime_type},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to upload memory audio: {exc}",
        ) from exc

    return _resolve_audio_url(storage_path)


def _custom_image_storage_path(memory_id: str) -> str:
    return f"{MEMORY_IMAGE_PREFIX}/{memory_id}/latest"


def _decode_data_uri(data_uri: str) -> tuple[str, bytes]:
    if not data_uri.startswith("data:"):
        raise ValueError("Invalid data URI")
    header, encoded = data_uri.split(",", 1)
    mime_type = "application/octet-stream"
    if ";" in header:
        mime_type = header[5:].split(";", 1)[0] or mime_type
    if ";base64" not in header:
        raise ValueError("Data URI must be base64-encoded")
    return mime_type, base64.b64decode(encoded)


def _upload_custom_memory_image(memory_id: str, data_uri: str) -> str:
    mime_type, image_bytes = _decode_data_uri(data_uri)
    storage_path = _custom_image_storage_path(memory_id)

    try:
        supabase.storage.from_(MEMORY_AUDIO_BUCKET).upload(
            storage_path,
            image_bytes,
            {"content-type": mime_type},
        )
    except Exception as exc:
        error_text = str(exc)
        if "Duplicate" in error_text or "already exists" in error_text:
            try:
                supabase.storage.from_(MEMORY_AUDIO_BUCKET).remove([storage_path])
                supabase.storage.from_(MEMORY_AUDIO_BUCKET).upload(
                    storage_path,
                    image_bytes,
                    {"content-type": mime_type},
                )
            except Exception as retry_exc:
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to persist custom memory image after retry: {retry_exc}",
                ) from retry_exc
        else:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to persist custom memory image: {exc}",
            ) from exc

    return _resolve_storage_url(MEMORY_AUDIO_BUCKET, storage_path)


def _get_patient_embedding(patient_id: uuid.UUID) -> list[float] | None:
    """Get the patient's TitaNet embedding from pgvector."""
    result = (
        supabase.table("patients")
        .select("voice_embedding_vector")
        .eq("id", str(patient_id))
        .maybe_single()
        .execute()
    )
    if result.data and result.data.get("voice_embedding_vector"):
        return embedding_from_pgvector(result.data["voice_embedding_vector"])
    return None


def _transcribe_with_assemblyai(
    audio_url: str,
    audio_bytes: bytes,
    patient_id: uuid.UUID,
    source_format: str = "m4a"
) -> str | None:
    """
    Transcribe audio using AssemblyAI with speaker diarization,
    then identify the patient using TitaNet embeddings.

    Args:
        audio_url: Public URL to the audio file
        audio_bytes: Raw audio bytes for TitaNet processing
        patient_id: Patient ID to look up their voice embedding
        source_format: Audio format (m4a, mp3, wav, etc.)

    Returns:
        Formatted transcript with Patient/Visitor labels
    """
    if not ASSEMBLYAI_API_KEY:
        return None

    try:
        # Configure transcription with speaker diarization
        config = aai.TranscriptionConfig(
            speaker_labels=True,
            speakers_expected=2,  # Usually patient + visitor
            language_detection=True,
            # Required by the current AssemblyAI API when language_detection is enabled.
            speech_models=["universal-2"],
        )

        # Transcribe the audio
        transcriber = aai.Transcriber(config=config)
        transcript = transcriber.transcribe(audio_url)

        if transcript.status == aai.TranscriptStatus.error:
            print(f"[memories] AssemblyAI transcription failed: {transcript.error}")
            return None

        # If no utterances, return plain text
        if not transcript.utterances:
            return transcript.text

        # Get patient's TitaNet embedding for speaker identification
        patient_embedding = _get_patient_embedding(patient_id)

        # Default speaker labels (A, B, etc. -> Speaker A, Speaker B)
        speaker_labels: dict[str, str] = {}

        # If patient has a voice embedding, use TitaNet to identify them
        if patient_embedding:
            try:
                # Convert utterances to format expected by identify_speakers
                utterance_data = [
                    {
                        "speaker": utt.speaker,
                        "start": utt.start,
                        "end": utt.end,
                    }
                    for utt in transcript.utterances
                ]

                speaker_labels = identify_speakers(
                    audio_bytes=audio_bytes,
                    utterances=utterance_data,
                    patient_embedding=patient_embedding,
                    source_format=source_format,
                    threshold=0.6,  # Lower threshold for real-world audio
                )
                print(f"[memories] TitaNet identified speakers: {speaker_labels}")

            except Exception as e:
                print(f"[memories] TitaNet identification failed: {e}")
                # Fall back to generic labels

        # Format the transcript with identified speaker labels
        formatted_parts = []
        for utterance in transcript.utterances:
            # Use TitaNet label if available, otherwise generic
            if utterance.speaker in speaker_labels:
                label = speaker_labels[utterance.speaker]
            else:
                label = f"Speaker {utterance.speaker}"

            formatted_parts.append(f"[{label}]: {utterance.text}")

        return "\n\n".join(formatted_parts)

    except Exception as exc:
        print(f"[memories] AssemblyAI error: {exc}")
        return None


@router.post("/patient-mode/patients/{patient_id}/memories", status_code=201)
async def create_memory(  # noqa: RUF029 — async needed for Gemini awaits
    patient_id: uuid.UUID,
    audio: UploadFile = File(...),
    person_id: str = Form(...),
    person_name: str = Form(...),
):
    """
    Create a new memory from a recorded conversation.

    Uploads the audio, transcribes it using AssemblyAI with speaker diarization,
    and stores the memory in the database.
    """
    # Verify patient exists
    patient = (
        supabase.table("patients")
        .select("id, name")
        .eq("id", str(patient_id))
        .maybe_single()
        .execute()
    )
    if not patient.data:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient_name = patient.data.get("name")

    # Read audio data
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio upload was empty")

    # Validate person_name
    person_name = person_name.strip()
    if not person_name:
        raise HTTPException(status_code=400, detail="person_name is required")

    # Validate person_id
    try:
        parsed_person_id = uuid.UUID(person_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid person_id") from exc

    # Verify person belongs to patient
    person = (
        supabase.table("people")
        .select("id")
        .eq("id", str(parsed_person_id))
        .eq("patient_id", str(patient_id))
        .maybe_single()
        .execute()
    )
    if not person.data:
        raise HTTPException(status_code=404, detail="Person not found for patient")

    # Upload audio
    mime_type = audio.content_type or "audio/m4a"
    filename = audio.filename or "memory.m4a"
    audio_url = _upload_audio(patient_id, audio_bytes, filename, mime_type)

    # Determine audio format for TitaNet
    source_format = "m4a"
    if filename and "." in filename:
        source_format = filename.rsplit(".", 1)[-1].lower()

    # Transcribe with AssemblyAI + TitaNet speaker identification
    transcription = _transcribe_with_assemblyai(
        audio_url=audio_url,
        audio_bytes=audio_bytes,
        patient_id=patient_id,
        source_format=source_format,
    )

    # Gemini smart memory pipeline
    summary: str | None = None
    is_important: bool = False

    if transcription:
        try:
            person_full = (
                supabase.table("people")
                .select("name, relationship, bio, topics_to_avoid")
                .eq("id", str(parsed_person_id))
                .maybe_single()
                .execute()
            )
            if person_full.data:
                avoid = person_full.data.get("topics_to_avoid") or []
                person_ctx = PersonContext(
                    name=person_full.data.get("name") or person_name,
                    relationship=person_full.data.get("relationship") or "visitor",
                    bio=person_full.data.get("bio") or "",
                    topics_to_avoid=avoid if isinstance(avoid, list) else [],
                )
                current_bio = person_full.data.get("bio") or ""

                summary = await summarize_transcript(transcription, person_ctx)
                is_important = await evaluate_importance(transcription, summary, person_ctx)

                if is_important:
                    new_bio = await update_profile_bio(current_bio, summary, person_ctx)
                    if new_bio != current_bio:
                        try:
                            (
                                supabase.table("people")
                                .update({"bio": new_bio})
                                .eq("id", str(parsed_person_id))
                                .select("id")
                                .maybe_single()
                                .execute()
                            )
                            print(f"[MEMORY] Bio updated for {person_name}")
                        except Exception as bio_update_error:
                            # Some PostgREST client versions throw on 204/no-body updates.
                            if "Missing response" in str(bio_update_error):
                                print(
                                    "[MEMORY] Bio update returned no content; continuing"
                                )
                            else:
                                raise

                print(f"[MEMORY] Summary: {summary}")
                print(f"[MEMORY] Important: {is_important}")
        except Exception as e:
            print(f"[MEMORY] Gemini pipeline error: {e}")

    # Save memory to database
    insert_payload = {
        "patient_id": str(patient_id),
        "person_id": str(parsed_person_id),
        "person_name": person_name,
        "transcription": transcription,
        "audio_url": audio_url,
        "summary": summary,
        "is_important": is_important,
    }

    result = supabase.table("memories").insert(insert_payload).execute()
    return result.data[0]


@router.get("/patient-mode/patients/{patient_id}/memories")
async def list_memories(patient_id: uuid.UUID, limit: int = 20, offset: int = 0):
    """List memories for a patient."""
    result = (
        supabase.table("memories")
        .select("*")
        .eq("patient_id", str(patient_id))
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    rows = result.data or []
    for row in rows:
        memory_id = row.get("id")
        if not memory_id:
            row["custom_image_url"] = None
            continue
        try:
            row["custom_image_url"] = _resolve_storage_url(
                MEMORY_AUDIO_BUCKET,
                _custom_image_storage_path(str(memory_id)),
            )
        except Exception:
            row["custom_image_url"] = None
    return rows


@router.get("/patient-mode/memories/{memory_id}")
async def get_memory(memory_id: uuid.UUID):
    """Get a specific memory."""
    result = (
        supabase.table("memories")
        .select("*")
        .eq("id", str(memory_id))
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Memory not found")
    return result.data


@router.post("/patient-mode/memories/{memory_id}/custom-image")
async def generate_memory_custom_image(memory_id: uuid.UUID):
    """Generate a custom contextual image for a memory (on-demand)."""
    result = (
        supabase.table("memories")
        .select("id, person_name, summary, transcription, created_at, is_important")
        .eq("id", str(memory_id))
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Memory not found")

    memory = result.data
    date_value = str(memory.get("created_at") or "")[:10] or "unknown-date"
    summary = memory.get("summary") or memory.get("transcription") or "A meaningful memory."

    data_uri = await generate_memory_image_data_uri(
        summary=summary,
        person_name=memory.get("person_name") or "someone",
        date=date_value,
        is_important=bool(memory.get("is_important")),
    )
    image_url = _upload_custom_memory_image(str(memory_id), data_uri)
    return {
        "memory_id": str(memory_id),
        "image_url": image_url,
    }
