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
