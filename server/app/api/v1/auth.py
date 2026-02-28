from fastapi import APIRouter, Depends, HTTPException

from app.auth_utils import generate_token, get_current_caregiver
from app.models import (
    AuthStartRequest,
    AuthVerifyRequest,
    AuthVerifyResponse,
    CaregiverOut,
)
from app.supabase_client import supabase

router = APIRouter(prefix="/auth", tags=["auth"])

MOCK_CODE = "1234"


@router.post("/start")
async def auth_start(body: AuthStartRequest):
    # Upsert caregiver
    supabase.table("caregivers").upsert(
        {"email": body.email}, on_conflict="email"
    ).execute()

    # Store mock auth code
    supabase.table("auth_codes").upsert(
        {"email": body.email, "code": MOCK_CODE}, on_conflict="email"
    ).execute()

    return {"message": "Code sent", "email": body.email}


@router.post("/verify", response_model=AuthVerifyResponse)
async def auth_verify(body: AuthVerifyRequest):
    # Check code
    code_row = (
        supabase.table("auth_codes")
        .select("*")
        .eq("email", body.email)
        .maybe_single()
        .execute()
    )

    if not code_row.data or code_row.data["code"] != body.code:
        raise HTTPException(status_code=401, detail="Invalid code")

    # Get caregiver
    caregiver = (
        supabase.table("caregivers")
        .select("*")
        .eq("email", body.email)
        .single()
        .execute()
    )

    # Generate token
    token = generate_token()
    supabase.table("auth_tokens").insert(
        {"token": token, "caregiver_id": caregiver.data["id"]}
    ).execute()

    # Clean up used code
    supabase.table("auth_codes").delete().eq("email", body.email).execute()

    return AuthVerifyResponse(
        token=token,
        caregiver=CaregiverOut(**caregiver.data),
    )


@router.get("/me", response_model=CaregiverOut)
async def auth_me(caregiver=Depends(get_current_caregiver)):
    return CaregiverOut(**caregiver)
