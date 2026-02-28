import google.generativeai as genai

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
