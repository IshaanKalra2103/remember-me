import mimetypes
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from dotenv import load_dotenv
from app.supabase_client import supabase

load_dotenv(ROOT / ".env")
KNOWN_DIR = ROOT / "known_people"
PATIENT_ID = os.getenv("EXPO_PUBLIC_PATIENT_ID") or os.getenv("PATIENT_ID")


def _person_name_from_stem(stem: str) -> str:
    if "__" in stem:
        return stem.split("__", 1)[0]
    return stem


def main() -> None:
    if not PATIENT_ID:
        raise RuntimeError("Set EXPO_PUBLIC_PATIENT_ID or PATIENT_ID before seeding.")
    if not KNOWN_DIR.exists():
        raise RuntimeError(f"Known people folder not found: {KNOWN_DIR}")

    existing = (
        supabase.table("people")
        .select("id, name")
        .eq("patient_id", PATIENT_ID)
        .execute()
    )
    existing_by_name = {row["name"].lower(): row["id"] for row in existing.data}

    for image_path in sorted(KNOWN_DIR.iterdir()):
        if image_path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue

        person_name = _person_name_from_stem(image_path.stem)
        person_id = existing_by_name.get(person_name.lower())

        if not person_id:
            created = (
                supabase.table("people")
                .insert(
                    {
                        "patient_id": PATIENT_ID,
                        "name": person_name,
                        "relationship": "friend",
                    }
                )
                .execute()
            )
            person_id = created.data[0]["id"]
            existing_by_name[person_name.lower()] = person_id

        file_bytes = image_path.read_bytes()
        ext = image_path.suffix.lower().lstrip(".")
        storage_path = f"{person_id}/{image_path.stem}.{ext}"
        content_type = mimetypes.types_map.get(image_path.suffix.lower(), "image/jpeg")

        supabase.storage.from_("photos").upload(
            storage_path,
            file_bytes,
            {"content-type": content_type},
        )
        public_url = supabase.storage.from_("photos").get_public_url(storage_path)

        supabase.table("photos").insert(
            {
                "person_id": str(person_id),
                "storage_path": storage_path,
                "url": public_url,
            }
        ).execute()

        print(f"Seeded {image_path.name} -> {person_name}")


if __name__ == "__main__":
    main()
