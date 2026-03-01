import os

from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_KEY: str = os.environ["SUPABASE_KEY"]
ELEVENLABS_API_KEY: str | None = os.getenv("ELEVENLABS_API_KEY")
# Default ElevenLabs voice ID used when ELEVENLABS_VOICE_ID is unset.
ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "XrExE9yKIg1WjnnlVkGX")
ELEVENLABS_MODEL_ID: str = os.getenv("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5")
