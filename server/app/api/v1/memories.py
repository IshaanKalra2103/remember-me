"""
Memories API - Records and transcribes conversations using AssemblyAI + TitaNet.

Uses AssemblyAI for speech-to-text with speaker diarization, then TitaNet
to identify which speaker is the patient based on their stored voice embedding.
"""

import uuid
from pathlib import Path

import assemblyai as aai
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import ASSEMBLYAI_API_KEY, SUPABASE_URL
from app.supabase_client import supabase
from app.titanet import embedding_from_pgvector, identify_speakers

router = APIRouter(tags=["memories"])

MEMORY_AUDIO_BUCKET = "memory-audio"

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


def _resolve_audio_url(storage_path: str) -> str:
    """Get a signed URL for the audio file."""
    try:
        signed = supabase.storage.from_(MEMORY_AUDIO_BUCKET).create_signed_url(
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

    public_url = supabase.storage.from_(MEMORY_AUDIO_BUCKET).get_public_url(storage_path)
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

    raise HTTPException(status_code=502, detail="Failed to resolve memory audio URL")


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
async def create_memory(
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

    # Save memory to database
    insert_payload = {
        "patient_id": str(patient_id),
        "person_id": str(parsed_person_id),
        "person_name": person_name,
        "transcription": transcription,
        "audio_url": audio_url,
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
    return result.data


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
