import json
import os
import re
import threading
from typing import List, Optional

from app.models import Profile
from app.config import PROFILES_PATH

_lock = threading.Lock()


class ProfileStore:

    @staticmethod
    def ensure_database_exists() -> None:
        """Create data/ directory and empty profiles.json if they don't exist."""
        os.makedirs(os.path.dirname(PROFILES_PATH), exist_ok=True)
        if not os.path.exists(PROFILES_PATH):
            with open(PROFILES_PATH, "w") as f:
                json.dump([], f)

    @staticmethod
    def _load_raw() -> List[dict]:
        with open(PROFILES_PATH, "r") as f:
            return json.load(f)

    @staticmethod
    def _save_raw(data: List[dict]) -> None:
        with open(PROFILES_PATH, "w") as f:
            json.dump(data, f, indent=2)

    @staticmethod
    def load_all_profiles() -> List[Profile]:
        """Load and parse all profiles from JSON into Profile objects."""
        with _lock:
            raw = ProfileStore._load_raw()
        return [Profile(**entry) for entry in raw]

    @staticmethod
    def save_profile(profile: Profile) -> None:
        """Upsert a profile in the JSON database (update if profile_id exists, append if new)."""
        with _lock:
            raw = ProfileStore._load_raw()
            existing_ids = [entry["profile_id"] for entry in raw]
            entry_dict = profile.model_dump()
            if profile.profile_id in existing_ids:
                idx = existing_ids.index(profile.profile_id)
                raw[idx] = entry_dict
            else:
                raw.append(entry_dict)
            ProfileStore._save_raw(raw)

    @staticmethod
    def generate_profile_id(name: str) -> str:
        """Generate a URL-safe profile ID from a name.
        Example: "Sarah Chen" -> "sarah_chen_001"
        Appends an incrementing suffix to avoid collisions.
        """
        slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
        with _lock:
            raw = ProfileStore._load_raw()
        existing = [e["profile_id"] for e in raw if e["profile_id"].startswith(slug)]
        return f"{slug}_{str(len(existing) + 1).zfill(3)}"

    @staticmethod
    def get_profile_by_id(profile_id: str) -> Optional[Profile]:
        """Look up a single profile by its ID. Returns None if not found."""
        profiles = ProfileStore.load_all_profiles()
        for p in profiles:
            if p.profile_id == profile_id:
                return p
        return None
