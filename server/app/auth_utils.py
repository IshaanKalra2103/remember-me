import secrets

from fastapi import Header, HTTPException

from app.supabase_client import supabase

def generate_token() -> str:
    return secrets.token_urlsafe(32)


async def get_optional_caregiver(authorization: str | None = Header(default=None)):
    """Return the caregiver dict if a valid token is present, otherwise None."""
    if not authorization:
        return None
    try:
        return await get_current_caregiver(authorization=authorization)
    except HTTPException:
        return None


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
