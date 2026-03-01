"""
TitaNet speaker embedding module using NVIDIA NeMo.

Generates 192-dimensional speaker embeddings for voice identification.
Uses pgvector in Supabase for storage and similarity search.
"""

import io
import json
import os
import tempfile
from typing import Optional

import numpy as np
from pydub import AudioSegment

# Lazy load NeMo to avoid slow startup
_speaker_model = None


def _get_speaker_model():
    """Lazy load the TitaNet model."""
    global _speaker_model
    if _speaker_model is None:
        from nemo.collections.asr.models import EncDecSpeakerLabelModel
        _speaker_model = EncDecSpeakerLabelModel.from_pretrained(
            "nvidia/speakerverification_en_titanet_large"
        )
    return _speaker_model


def convert_to_wav_16k(audio_bytes: bytes, source_format: str = "m4a") -> str:
    """
    Convert audio bytes to 16kHz mono WAV file (required by TitaNet).

    Returns path to temporary WAV file (caller must delete).
    """
    audio_io = io.BytesIO(audio_bytes)

    try:
        if source_format.lower() in ("m4a", "mp4", "aac"):
            audio = AudioSegment.from_file(audio_io, format="m4a")
        elif source_format.lower() == "mp3":
            audio = AudioSegment.from_mp3(audio_io)
        elif source_format.lower() == "wav":
            audio = AudioSegment.from_wav(audio_io)
        elif source_format.lower() == "ogg":
            audio = AudioSegment.from_ogg(audio_io)
        else:
            audio = AudioSegment.from_file(audio_io)
    except Exception:
        # Try generic loading
        audio_io.seek(0)
        audio = AudioSegment.from_file(audio_io)

    # Convert to 16kHz mono
    audio = audio.set_frame_rate(16000).set_channels(1)

    # Export to temp WAV file
    temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    audio.export(temp_file.name, format="wav")
    temp_file.close()

    return temp_file.name


def generate_embedding(audio_bytes: bytes, source_format: str = "m4a") -> list[float]:
    """
    Generate a 192-dimensional TitaNet speaker embedding from audio.

    Args:
        audio_bytes: Raw audio file bytes
        source_format: Audio format (m4a, mp3, wav, etc.)

    Returns:
        List of 192 floats representing the speaker embedding
    """
    wav_path = None
    try:
        # Convert to 16kHz mono WAV
        wav_path = convert_to_wav_16k(audio_bytes, source_format)

        # Get embedding from TitaNet
        model = _get_speaker_model()
        embedding = model.get_embedding(wav_path)

        # Convert to list
        if hasattr(embedding, 'cpu'):
            embedding = embedding.cpu().numpy()
        if isinstance(embedding, np.ndarray):
            embedding = embedding.flatten().tolist()

        return embedding

    finally:
        if wav_path and os.path.exists(wav_path):
            os.unlink(wav_path)


def generate_embedding_from_segment(
    audio_bytes: bytes,
    start_ms: int,
    end_ms: int,
    source_format: str = "m4a"
) -> Optional[list[float]]:
    """
    Generate embedding from a specific time segment of audio.

    Args:
        audio_bytes: Raw audio file bytes
        start_ms: Start time in milliseconds
        end_ms: End time in milliseconds
        source_format: Audio format

    Returns:
        List of 192 floats, or None if segment too short
    """
    audio_io = io.BytesIO(audio_bytes)

    try:
        if source_format.lower() in ("m4a", "mp4", "aac"):
            audio = AudioSegment.from_file(audio_io, format="m4a")
        elif source_format.lower() == "mp3":
            audio = AudioSegment.from_mp3(audio_io)
        elif source_format.lower() == "wav":
            audio = AudioSegment.from_wav(audio_io)
        else:
            audio = AudioSegment.from_file(audio_io)
    except Exception:
        audio_io.seek(0)
        audio = AudioSegment.from_file(audio_io)

    # Extract segment
    segment = audio[start_ms:end_ms]

    # Need at least 1 second for reliable embedding
    if len(segment) < 1000:
        return None

    # Convert segment to bytes
    segment_io = io.BytesIO()
    segment.export(segment_io, format="wav")
    segment_bytes = segment_io.getvalue()

    return generate_embedding(segment_bytes, source_format="wav")


def cosine_similarity(embedding1: list[float], embedding2: list[float]) -> float:
    """
    Compute cosine similarity between two embeddings.

    Returns:
        Similarity score between -1 and 1 (higher = more similar)
    """
    a = np.array(embedding1)
    b = np.array(embedding2)

    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(dot_product / (norm_a * norm_b))


def identify_speakers(
    audio_bytes: bytes,
    utterances: list[dict],
    patient_embedding: list[float],
    source_format: str = "m4a",
    threshold: float = 0.7
) -> dict[str, str]:
    """
    Identify which speaker in the audio is the patient.

    Args:
        audio_bytes: Raw audio file bytes
        utterances: List of utterances with 'speaker', 'start', 'end' (in ms)
        patient_embedding: The patient's stored TitaNet embedding
        source_format: Audio format
        threshold: Minimum similarity to identify as patient

    Returns:
        Dict mapping speaker labels (A, B, etc.) to names (Patient/Visitor)
    """
    if not utterances or not patient_embedding:
        return {}

    # Group utterances by speaker
    speaker_utterances: dict[str, list[tuple[int, int]]] = {}
    for utt in utterances:
        speaker = utt.get("speaker", "")
        start = utt.get("start", 0)
        end = utt.get("end", 0)
        if speaker not in speaker_utterances:
            speaker_utterances[speaker] = []
        speaker_utterances[speaker].append((start, end))

    if not speaker_utterances:
        return {}

    # Generate embedding for each speaker using their longest utterance
    speaker_similarities: dict[str, float] = {}

    for speaker, time_ranges in speaker_utterances.items():
        # Find longest utterance (at least 2 seconds preferred)
        sorted_ranges = sorted(time_ranges, key=lambda x: x[1] - x[0], reverse=True)

        embedding = None
        for start, end in sorted_ranges:
            if end - start >= 2000:  # At least 2 seconds
                embedding = generate_embedding_from_segment(
                    audio_bytes, start, end, source_format
                )
                if embedding:
                    break

        # Fallback to longest available
        if not embedding and sorted_ranges:
            start, end = sorted_ranges[0]
            if end - start >= 1000:
                embedding = generate_embedding_from_segment(
                    audio_bytes, start, end, source_format
                )

        if embedding:
            similarity = cosine_similarity(embedding, patient_embedding)
            speaker_similarities[speaker] = similarity

    if not speaker_similarities:
        return {}

    # Find speaker most similar to patient
    best_speaker = max(speaker_similarities, key=lambda s: speaker_similarities[s])
    best_similarity = speaker_similarities[best_speaker]

    # Assign labels
    labels: dict[str, str] = {}
    for speaker in speaker_utterances:
        if speaker == best_speaker and best_similarity >= threshold:
            labels[speaker] = "Patient"
        else:
            labels[speaker] = "Visitor"

    return labels


def embedding_to_pgvector(embedding: list[float]) -> str:
    """Format embedding for pgvector insertion."""
    return "[" + ",".join(str(x) for x in embedding) + "]"


def embedding_from_pgvector(pgvector_str: str) -> Optional[list[float]]:
    """Parse embedding from pgvector format."""
    try:
        # pgvector format: [0.1,0.2,0.3,...]
        cleaned = pgvector_str.strip("[]")
        return [float(x) for x in cleaned.split(",")]
    except (ValueError, AttributeError):
        return None
