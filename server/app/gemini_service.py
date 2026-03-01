"""
gemini_service.py — Gemini-powered whisper generation and smart memory pipeline.

Uses the google-genai SDK (Client-based, NOT the old google-generativeai SDK).
All functions are async and have try/except with static fallback strings so the
server never crashes if Gemini is down or the API key is missing.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from google import genai
from google.genai import types as genai_types

from app.config import GEMINI_API_KEY, GEMINI_MODEL

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


@dataclass
class PersonContext:
    name: str
    relationship: str
    bio: str = ""
    recent_memories: list[str] = field(default_factory=list)
    topics_to_avoid: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

async def _generate(prompt: str, temperature: float = 0.5) -> str:
    """Call Gemini and return text. Raises on failure (callers handle fallback)."""
    client = _get_client()
    response = await client.aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            temperature=temperature,
        ),
    )
    text = response.text
    if not text:
        # Thinking models can return None for response.text — extract from parts
        try:
            text = "".join(
                p.text for p in response.candidates[0].content.parts if p.text
            )
        except Exception:
            pass
    if not text:
        raise ValueError("Gemini returned an empty response")
    return text.strip()


# ---------------------------------------------------------------------------
# Prompt templates — copied verbatim from server/gemini/app/services/gemini_service.py
# ---------------------------------------------------------------------------

_MATCHED_SYSTEM_CONTEXT = (
    "You are a gentle voice assistant helping someone who has memory difficulties.\n"
    "Your job is to whisper a brief, warm reminder about a person who has just entered the room.\n\n"
    "Rules you must follow:\n"
    "- Write exactly 2-3 natural spoken sentences. No more.\n"
    "- Use a warm, familiar tone — like a close friend gently reminding you of something.\n"
    "- Never use clinical language. Never mention memory loss, dementia, or forgetting.\n"
    "- Never mention topics from the avoid list.\n"
    "- Ground the message in the bio and recent interactions — make it feel personal and real.\n"
    "- Write as if speaking directly to the patient. Use \"your\" not \"the patient's\".\n"
    "- Do not use the word \"remember\". Use phrases like \"you two talked about\" or \"she was telling you\".\n"
    "- End with one natural conversational hook — something they can say back.\n"
    "- Output ONLY the whisper text. No preamble, no labels, no quotation marks."
)

_UNKNOWN_SYSTEM_CONTEXT = (
    "You are a gentle voice assistant helping someone who has memory difficulties.\n"
    "Someone has entered the room who you don't recognize.\n\n"
    "Rules you must follow:\n"
    "- Write exactly 1-2 natural spoken sentences.\n"
    "- Be calm, non-alarming, and warm.\n"
    "- Do not say you \"failed to recognize\" anyone. Just note someone new has arrived.\n"
    "- Suggest they may be a visitor, caregiver, or someone stopping by.\n"
    "- Do not create anxiety. Keep it light and open.\n"
    "- Output ONLY the whisper text. No preamble, no labels, no quotation marks."
)

_IMPORTANCE_PROMPT_TEMPLATE = (
    "You are a memory assistant. Given a conversation summary between a patient "
    "and {name} ({relationship}), decide if this contains IMPORTANT life information "
    "worth remembering long-term.\n\n"
    "IMPORTANT means: life events, health updates, family news, significant plans, "
    "emotional milestones, new hobbies, meaningful shared experiences.\n"
    "NOT IMPORTANT means: weather chat, generic greetings, brief hellos/goodbyes, "
    "small talk, routine check-ins with no new information.\n\n"
    "Note: If the transcript is speaker-labeled, first-person statements belong to "
    "whoever is labeled — not automatically the patient.\n\n"
    "Summary: {summary}\n"
    "Transcript excerpt: {transcript_excerpt}\n\n"
    "Output ONLY the word: IMPORTANT or NOT_IMPORTANT"
)

_SUMMARY_PROMPT_TEMPLATE = (
    "You are a memory assistant for someone with memory difficulties.\n"
    "A visitor named {name} ({relationship}) just had a conversation with the patient.\n\n"
    "IMPORTANT: Any first-person statements (\"I\", \"my\", \"me\") in the transcript "
    "are {name} talking about THEMSELVES, NOT the patient, unless speaker labels say otherwise.\n"
    "Topics to never mention: {avoid}\n\n"
    "Conversation transcript:\n{transcript}\n\n"
    "Write a single sentence (maximum 25 words) summarizing what {name} shared, "
    "in the past tense, as a warm personal memory. "
    "Attribute events to {name} — e.g. \"{name} got accepted to...\" not \"we celebrated my...\".\n"
    "Do not mention memory loss or dementia. "
    "Output only the summary sentence, no preamble."
)

_BIO_UPDATE_PROMPT_TEMPLATE = (
    "You are a memory assistant maintaining a personal profile summary about {name} "
    "for someone with memory difficulties.\n\n"
    "Current bio: {current_bio}\n"
    "New important information about {name}: {new_summary}\n"
    "Person: {name} ({relationship})\n"
    "Topics to NEVER include: {avoid}\n\n"
    "Update the bio to incorporate the new information about {name}. Keep it under 3 sentences.\n"
    "Write in third person about {name} (\"{name} is...\", \"{name} recently...\").\n"
    "Everything in the bio should be about {name}, not about the patient.\n"
    "If the current bio is empty, create a new one from the new information.\n"
    "Output ONLY the updated bio text, no labels or preamble."
)


# ---------------------------------------------------------------------------
# Whisper generation
# ---------------------------------------------------------------------------

async def generate_whisper_for_match(person: PersonContext) -> str:
    """Generate a warm, personalized 2-3 sentence whisper for a recognized face."""
    bio_text = person.bio if person.bio else "No detailed information available yet."

    if person.recent_memories:
        recent_text = "\n".join(f"- {m}" for m in person.recent_memories[-3:])
    else:
        recent_text = "- No recent interactions recorded"

    avoid_text = ", ".join(person.topics_to_avoid) if person.topics_to_avoid else "none"

    prompt = (
        f"{_MATCHED_SYSTEM_CONTEXT}\n\n"
        f"Name: {person.name}\n"
        f"Relationship to patient: {person.relationship}\n"
        f"About them: {bio_text}\n\n"
        f"Recent interactions:\n{recent_text}\n\n"
        f"Topics to NEVER mention: {avoid_text}\n\n"
        "Generate the whisper now."
    )
    try:
        return await _generate(prompt, temperature=0.7)
    except Exception:
        return f"This is {person.name}, your {person.relationship}. It's lovely to see them again."


async def generate_whisper_for_unknown() -> str:
    """Generate a calm, non-alarming 1-2 sentence whisper for an unrecognized visitor."""
    prompt = f"{_UNKNOWN_SYSTEM_CONTEXT}\n\nSomeone has entered the room. Generate the whisper now."
    try:
        return await _generate(prompt, temperature=0.5)
    except Exception:
        return "Someone is here to visit you. Take your time."


# ---------------------------------------------------------------------------
# Smart memory: summarization, importance, bio update
# ---------------------------------------------------------------------------

async def summarize_transcript(transcript: str, person: PersonContext) -> str:
    """One-sentence summary of a conversation transcript from the visitor's perspective."""
    avoid_text = ", ".join(person.topics_to_avoid) if person.topics_to_avoid else "none"
    prompt = _SUMMARY_PROMPT_TEMPLATE.format(
        name=person.name,
        relationship=person.relationship,
        transcript=transcript,
        avoid=avoid_text,
    )
    try:
        return await _generate(prompt, temperature=0.4)
    except Exception:
        return f"Had a pleasant visit with {person.name}."


async def evaluate_importance(
    transcript: str,
    summary: str,
    person: PersonContext,
) -> bool:
    """Return True if the conversation contains important life information worth storing."""
    prompt = _IMPORTANCE_PROMPT_TEMPLATE.format(
        name=person.name,
        relationship=person.relationship,
        summary=summary,
        transcript_excerpt=transcript[:500],
    )
    try:
        result = await _generate(prompt, temperature=0.0)
        is_important = "IMPORTANT" in result.upper() and "NOT_IMPORTANT" not in result.upper()
        print(f"[IMPORTANCE] {person.name}: {result.strip()} → {'IMPORTANT' if is_important else 'NOT IMPORTANT'}")
        return is_important
    except Exception as e:
        print(f"[IMPORTANCE] Gemini error for {person.name}, defaulting to NOT IMPORTANT: {e}")
        return False


async def update_profile_bio(
    current_bio: str,
    new_summary: str,
    person: PersonContext,
) -> str:
    """Update the rolling 3-sentence bio for a person. Returns current_bio on any error."""
    avoid_text = ", ".join(person.topics_to_avoid) if person.topics_to_avoid else "none"
    prompt = _BIO_UPDATE_PROMPT_TEMPLATE.format(
        current_bio=current_bio if current_bio else "No bio yet.",
        new_summary=new_summary,
        name=person.name,
        relationship=person.relationship,
        avoid=avoid_text,
    )
    try:
        new_bio = await _generate(prompt, temperature=0.3)
        if not new_bio:
            raise ValueError("empty bio response")
        print(f"[BIO UPDATE] {person.name}: {new_bio}")
        return new_bio
    except Exception as e:
        print(f"[BIO UPDATE] Gemini error for {person.name}, keeping current bio: {e}")
        return current_bio


# ---------------------------------------------------------------------------
# Memory recall: search + natural spoken response
# ---------------------------------------------------------------------------

_MEMORY_SEARCH_PROMPT = (
    "You are a memory assistant. The user wants to recall a specific memory.\n\n"
    "User's query: \"{query}\"\n\n"
    "Here are all the memories we have stored:\n{memories_text}\n\n"
    "Select the memory (or memories) that best match the user's query. "
    "The user might reference:\n"
    "- A date or time frame (\"last Tuesday\", \"two weeks ago\", \"in January\")\n"
    "- A topic or keyword (\"medical school\", \"new job\", \"birthday\")\n"
    "- A person's name (\"what did Ishaan say\")\n"
    "- A general context (\"something about a graduation\")\n\n"
    "Return ONLY the indices (0-based, comma-separated) of the matching memories. "
    "If nothing matches, return: NONE\n"
    "Example output: 0,3,5"
)

_MEMORY_RECALL_PROMPT = (
    "You are a gentle voice assistant helping someone with memory difficulties.\n"
    "The user asked: \"{query}\"\n\n"
    "Here are the matching memories:\n{matching_memories}\n\n"
    "Rules:\n"
    "- Speak directly to the user in a warm, natural tone.\n"
    "- Tell them about the memory as if gently reminding them.\n"
    "- Use phrases like \"you and {person_name} talked about...\" or \"{person_name} was telling you...\"\n"
    "- Do not use the word \"remember\". Do not mention memory loss.\n"
    "- Keep it to 2-4 natural spoken sentences.\n"
    "- If there are multiple memories, weave them together naturally.\n"
    "- Output ONLY the spoken text. No preamble, no labels, no quotation marks."
)


@dataclass
class MemoryEntry:
    index: int
    person_name: str
    date: str
    summary: str
    is_important: bool
    transcription: str | None = None


async def search_memories(query: str, memories: list[MemoryEntry]) -> list[int]:
    """Use Gemini to find which memories match the user's query. Returns indices."""
    if not memories:
        return []

    memories_text = "\n".join(
        f"[{m.index}] {m.date} — {m.person_name}: "
        f"{m.summary or m.transcription or '(no summary)'}"
        f"{' [IMPORTANT]' if m.is_important else ''}"
        for m in memories
    )

    prompt = _MEMORY_SEARCH_PROMPT.format(query=query, memories_text=memories_text)
    try:
        result = await _generate(prompt, temperature=0.0)
        result = result.strip()
        if result.upper() == "NONE":
            return []
        indices = [int(i.strip()) for i in result.split(",") if i.strip().isdigit()]
        valid = [i for i in indices if 0 <= i < len(memories)]
        return valid
    except Exception as e:
        print(f"[MEMORY SEARCH] Gemini error: {e}")
        return []


async def recall_memory(
    query: str,
    matching_memories: list[MemoryEntry],
    person_name: str | None = None,
) -> str:
    """Generate a warm, natural spoken response about the matching memories."""
    if not matching_memories:
        return "I don't have a specific memory about that, but that's okay."

    mem_text = "\n".join(
        f"- {m.date} with {m.person_name}: {m.summary or m.transcription or '(no details)'}"
        for m in matching_memories
    )

    name_for_prompt = person_name or matching_memories[0].person_name

    prompt = _MEMORY_RECALL_PROMPT.format(
        query=query,
        matching_memories=mem_text,
        person_name=name_for_prompt,
    )
    try:
        return await _generate(prompt, temperature=0.7)
    except Exception:
        m = matching_memories[0]
        return f"You and {m.person_name} had a conversation on {m.date}. {m.summary or ''}"
