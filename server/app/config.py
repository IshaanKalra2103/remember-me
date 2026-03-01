import os

from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL: str | None = os.environ.get("SUPABASE_URL")
# Use service role key for backend operations (bypasses RLS)
# Falls back to SUPABASE_KEY for compatibility
SUPABASE_KEY: str | None = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY")
ASSEMBLYAI_API_KEY: str | None = os.getenv("ASSEMBLYAI_API_KEY")
ELEVENLABS_API_KEY: str | None = os.getenv("ELEVENLABS_API_KEY")
# Default ElevenLabs voice ID used when ELEVENLABS_VOICE_ID is unset.
ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "XrExE9yKIg1WjnnlVkGX")
ELEVENLABS_MODEL_ID: str = os.getenv("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5")
ELEVENLABS_AGENT_ID: str = os.getenv(
    "ELEVENLABS_AGENT_ID", "agent_9801kjjt1x3ferhvtf6xb7nwh0a3"
)
GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
GEMINI_FALLBACK_MODELS: list[str] = [
    m.strip()
    for m in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-2.5-flash").split(",")
    if m.strip()
]
GEMINI_IMAGE_MODEL: str = os.getenv("GEMINI_IMAGE_MODEL", "imagen-4.0-generate-001")
