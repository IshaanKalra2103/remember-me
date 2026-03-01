from dotenv import load_dotenv
import os

load_dotenv()

GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
ELEVEN_LABS_API_KEY: str = os.getenv("ELEVEN_LABS_API_KEY", "")  # stored, not used yet
PROFILES_PATH: str = os.getenv("PROFILES_PATH", "data/profiles.json")
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")


def validate_config() -> None:
    """Called at startup. Raises ValueError if critical keys are missing."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY must be set in .env")
