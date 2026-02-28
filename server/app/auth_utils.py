import hashlib
import secrets

from fastapi import Header, HTTPException

from app.supabase_client import supabase


def hash_pin(pin: str) -> str:
    return hashlib.sha256(pin.encode()).hexdigest()


def verify_pin(pin: str, pin_hash: str) -> bool:
    return hash_pin(pin) == pin_hash


def generate_token() -> str:
    return secrets.token_urlsafe(32)


async def get_current_caregiver(authorization: str = Header()):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.removeprefix("Bearer ")

    result = (
        supabase.table("auth_tokens")
        .select("caregiver_id, caregivers(*)")
        .eq("token", token)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return result.data["caregivers"]
