import base64
from typing import Optional

import google.generativeai as genai
import google.ai.generativelanguage as glm  # bundled in google-generativeai

from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.models import Profile

# Configure the SDK once at module import time
genai.configure(api_key=GEMINI_API_KEY)
_model = genai.GenerativeModel(GEMINI_MODEL)


# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

_MATCHED_SYSTEM_CONTEXT = """You are a gentle voice assistant helping someone who has memory difficulties.
Your job is to whisper a brief, warm reminder about a person who has just entered the room.

Rules you must follow:
- Write exactly 2-3 natural spoken sentences. No more.
- Use a warm, familiar tone — like a close friend gently reminding you of something.
- Never use clinical language. Never mention memory loss, dementia, or forgetting.
- Never mention topics from the avoid list.
- Ground the message in specific memories — make it feel personal and real.
- Write as if speaking directly to the patient. Use "your" not "the patient's".
- Do not use the word "remember". Use phrases like "you two talked about" or "she was telling you".
- End with one natural conversational hook — something they can say back.
- Output ONLY the whisper text. No preamble, no labels, no quotation marks."""

_UNKNOWN_SYSTEM_CONTEXT = """You are a gentle voice assistant helping someone who has memory difficulties.
Someone has entered the room who you don't recognize.

Rules you must follow:
- Write exactly 1-2 natural spoken sentences.
- Be calm, non-alarming, and warm.
- Do not say you "failed to recognize" anyone. Just note someone new has arrived.
- Suggest they may be a visitor, caregiver, or someone stopping by.
- Do not create anxiety. Keep it light and open.
- Output ONLY the whisper text. No preamble, no labels, no quotation marks."""


def _build_matched_prompt(profile: Profile) -> str:
    memories_text = "\n".join(f"- {m}" for m in profile.memories)
    avoid_text = ", ".join(profile.topics_to_avoid) if profile.topics_to_avoid else "none"
    return (
        f"Name: {profile.name}\n"
        f"Relationship to patient: {profile.relationship}\n"
        f"Things they share or have talked about:\n{memories_text}\n\n"
        f"Topics to NEVER mention: {avoid_text}\n\n"
        "Generate the whisper now."
    )


def _build_unknown_prompt() -> str:
    return "Someone has entered the room. Generate the whisper now."


# ---------------------------------------------------------------------------
# Fallback whispers (pure Python, no I/O — always succeed)
# ---------------------------------------------------------------------------

def _fallback_whisper_matched(profile: Profile) -> str:
    return (
        f"This is {profile.name}, your {profile.relationship}. "
        f"It's lovely to see them again."
    )


def _fallback_whisper_unknown() -> str:
    return "Someone is here to visit you. Take your time."


# ---------------------------------------------------------------------------
# Public async functions
# ---------------------------------------------------------------------------

async def generate_whisper_for_match(profile: Profile) -> str:
    """Generate a warm, personalized whisper for a recognized face.

    Calls Gemini with a carefully engineered prompt built from the profile's
    memories and relationship. Falls back to a static message if the API fails.

    Args:
        profile: The matched Profile from the database.

    Returns:
        A 2-3 sentence spoken whisper string.
    """
    full_prompt = _MATCHED_SYSTEM_CONTEXT + "\n\n" + _build_matched_prompt(profile)
    try:
        response = await _model.generate_content_async(
            contents=full_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,        # Warm but not erratic
                max_output_tokens=150,  # Hard cap — keeps whisper short
                top_p=0.9,
            ),
        )
        return response.text.strip()
    except Exception:
        return _fallback_whisper_matched(profile)


async def generate_whisper_for_unknown() -> str:
    """Generate a calm, non-alarming whisper for an unrecognized visitor.

    Returns:
        A 1-2 sentence spoken whisper string.
    """
    full_prompt = _UNKNOWN_SYSTEM_CONTEXT + "\n\n" + _build_unknown_prompt()
    try:
        response = await _model.generate_content_async(
            contents=full_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.5,
                max_output_tokens=80,
            ),
        )
        return response.text.strip()
    except Exception:
        return _fallback_whisper_unknown()


# ---------------------------------------------------------------------------
# Conversation transcription + summarization (Gemini multimodal)
# ---------------------------------------------------------------------------

_TRANSCRIBE_PROMPT = (
    "Please transcribe this audio recording of a conversation accurately. "
    "Output only the raw transcript with no timestamps, speaker labels, or formatting. "
    "If the audio is silent or unintelligible, output the single word: EMPTY."
)

_SUMMARY_KNOWN_PROMPT_TEMPLATE = (
    "You are a gentle memory assistant helping someone with memory difficulties. "
    "A visitor named {name} ({relationship}) just had a conversation with the patient.\n\n"
    "Conversation transcript:\n{transcript}\n\n"
    "Topics to never mention: {avoid}\n\n"
    "Write a single sentence (maximum 25 words) summarizing what was discussed, "
    "in the past tense, as a warm personal memory. "
    "Do not mention memory loss or dementia. "
    "Output only the summary sentence, no preamble."
)

_SUMMARY_STRANGER_PROMPT = (
    "You are a gentle memory assistant. "
    "An unknown visitor had the following conversation:\n\n"
    "{transcript}\n\n"
    "Write a single sentence (maximum 25 words) summarizing what was discussed. "
    "Do not speculate about identity. "
    "Output only the summary sentence, no preamble."
)


def _fallback_transcript() -> str:
    return "EMPTY"


def _fallback_summary_known(profile: Profile) -> str:
    return f"Had a pleasant visit with {profile.name}."


def _fallback_summary_stranger() -> str:
    return "An unknown visitor stopped by for a conversation."


async def transcribe_and_summarize(
    audio_b64: str,
    mime_type: str,
    profile: Optional[Profile],
) -> tuple[str, str]:
    """Transcribe audio and generate a memory summary using Gemini multimodal.

    Args:
        audio_b64:  Base64-encoded audio bytes (audio/mp4 or audio/m4a from expo-av).
        mime_type:  MIME type string passed to Gemini as inline_data.mime_type.
        profile:    The matched Profile, or None if this is a stranger session.

    Returns:
        A tuple of (transcript, summary). Both are guaranteed non-empty strings.
        Fallbacks are always returned on exception — the caller never handles None.
    """
    # --- Step 1: Transcribe via Gemini multimodal ---
    try:
        audio_bytes = base64.b64decode(audio_b64)
        audio_part = glm.Part(
            inline_data=glm.Blob(
                mime_type=mime_type,
                data=audio_bytes,
            )
        )
        transcription_response = await _model.generate_content_async(
            contents=[audio_part, _TRANSCRIBE_PROMPT],
            generation_config=genai.types.GenerationConfig(
                temperature=0.0,          # deterministic — transcription is factual
                max_output_tokens=1000,   # long enough for a multi-minute conversation
            ),
        )
        transcript = transcription_response.text.strip()
        if not transcript or transcript == "EMPTY":
            transcript = _fallback_transcript()
    except Exception:
        transcript = _fallback_transcript()

    # --- Step 2: Summarize the transcript ---
    try:
        if profile is not None:
            avoid_text = ", ".join(profile.topics_to_avoid) if profile.topics_to_avoid else "none"
            summary_prompt = _SUMMARY_KNOWN_PROMPT_TEMPLATE.format(
                name=profile.name,
                relationship=profile.relationship,
                transcript=transcript,
                avoid=avoid_text,
            )
        else:
            summary_prompt = _SUMMARY_STRANGER_PROMPT.format(transcript=transcript)

        summary_response = await _model.generate_content_async(
            contents=summary_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.4,
                max_output_tokens=60,   # hard cap — single sentence
            ),
        )
        summary = summary_response.text.strip()
        if not summary:
            raise ValueError("empty summary")
    except Exception:
        if profile is not None:
            summary = _fallback_summary_known(profile)
        else:
            summary = _fallback_summary_stranger()

    return transcript, summary
