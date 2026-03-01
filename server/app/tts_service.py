"""
tts_service.py — ElevenLabs text-to-speech conversion.

Converts whisper text into spoken audio (MP3). Used by the recognition pipeline
to automatically generate audio output when a face is identified.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request

from app.config import ELEVENLABS_API_KEY, ELEVENLABS_MODEL_ID, ELEVENLABS_VOICE_ID


def text_to_speech(text: str) -> bytes | None:
    """Convert text to MP3 audio via ElevenLabs TTS. Returns None on failure."""
    if not ELEVENLABS_API_KEY:
        print("[TTS] ELEVENLABS_API_KEY not configured — skipping audio generation")
        return None

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
        body = exc.read().decode("utf-8", errors="ignore")[:300]
        print(f"[TTS] ElevenLabs error: {body}")
        return None
    except Exception as exc:
        print(f"[TTS] Connection error: {exc}")
        return None

    if not audio_bytes:
        print("[TTS] ElevenLabs returned empty audio")
        return None

    return audio_bytes
