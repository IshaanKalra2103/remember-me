"""
memory_agent.py — ElevenLabs memory-agent helper endpoints.

Inspired by the standalone `11-lab` bridge in `origin/saurav`, but integrated
into the main FastAPI backend so the client can fetch:
1) a session config (agent id + signed websocket URL + memory context), and
2) lightweight name-bridge state for contextual updates.
"""

from __future__ import annotations

import json
import re
import threading
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.config import ELEVENLABS_AGENT_ID, ELEVENLABS_API_KEY
from app.models import (
    MemoryAgentConfigResponse,
    NameBridgeCommandRequest,
    NameBridgeCommandResponse,
    NameBridgeSetRequest,
    NameBridgeState,
    NameBridgeValue,
)
from app.supabase_client import supabase

router = APIRouter(prefix="/patient-mode", tags=["memory-agent"])

NAME_PATTERN = re.compile(r"^[A-Za-z][A-Za-z .'-]{1,79}$")
_name_state_lock = threading.Lock()
_name_state: dict[str, str | None] = {"name": None, "updated_at": None}


def _normalize_name(value: str) -> str:
    return " ".join(value.strip().split())


def _is_valid_name(value: str) -> bool:
    normalized = _normalize_name(value)
    if not normalized:
        return False
    lowered = normalized.lower()
    if "http://" in lowered or "https://" in lowered:
        return False
    if lowered.startswith("curl "):
        return False
    return bool(NAME_PATTERN.fullmatch(normalized))


def _set_name(value: str) -> NameBridgeState:
    normalized = _normalize_name(value)
    with _name_state_lock:
        _name_state["name"] = normalized or None
        _name_state["updated_at"] = datetime.now(timezone.utc).isoformat()
        return NameBridgeState(**_name_state)


def _get_name_state() -> NameBridgeState:
    with _name_state_lock:
        return NameBridgeState(**_name_state)


def _build_memory_context(
    patient_id: uuid.UUID,
    person_id: uuid.UUID | None,
    max_memories: int,
) -> tuple[str, int, str | None]:
    query = (
        supabase.table("memories")
        .select("person_name, summary, transcription, created_at, is_important")
        .eq("patient_id", str(patient_id))
        .order("created_at", desc=True)
        .limit(max_memories)
    )
    if person_id:
        query = query.eq("person_id", str(person_id))

    rows = query.execute().data or []
    if not rows:
        return (
            "No stored memory snippets yet. Have a gentle introductory conversation.",
            0,
            None,
        )

    lines: list[str] = []
    person_name: str | None = None
    for row in rows:
        p_name = row.get("person_name") or "someone"
        if not person_name and isinstance(p_name, str):
            person_name = p_name

        created_at = (row.get("created_at") or "")[:10] or "unknown-date"
        summary = (row.get("summary") or row.get("transcription") or "").strip()
        summary = summary.replace("\n", " ")
        if len(summary) > 220:
            summary = summary[:220].rstrip() + "..."
        importance = " [important]" if row.get("is_important") else ""
        lines.append(f"- {created_at} with {p_name}{importance}: {summary or '(no summary)'}")

    context = (
        "Memory context for this patient. Use this context naturally in conversation.\n"
        "Do not invent facts; if uncertain, ask a gentle follow-up.\n"
        + "\n".join(lines)
    )
    return context, len(rows), person_name


def _get_signed_conversation_url(agent_id: str) -> tuple[str | None, str | None]:
    if not ELEVENLABS_API_KEY:
        return (
            None,
            "ELEVENLABS_API_KEY is not configured; using unsigned websocket URL.",
        )

    endpoints = (
        "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url",
        "https://api.elevenlabs.io/v1/convai/conversation/get_signed_url",
    )
    last_error: str | None = None

    for endpoint in endpoints:
        url = f"{endpoint}?agent_id={urllib.parse.quote_plus(agent_id)}"
        req = urllib.request.Request(
            url=url,
            method="GET",
            headers={
                "xi-api-key": ELEVENLABS_API_KEY,
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                payload = json.loads(response.read().decode("utf-8"))
                signed_url = payload.get("signed_url") or payload.get("signedUrl")
                if isinstance(signed_url, str) and signed_url:
                    return signed_url, None
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore").strip()
            snippet = body[:200] if body else ""
            last_error = (
                f"{exc.code} {exc.reason}"
                + (f" ({snippet})" if snippet else "")
            )
        except Exception as exc:
            last_error = str(exc)

    if last_error:
        return (
            None,
            "Failed to fetch ElevenLabs signed URL; falling back to unsigned websocket URL. "
            f"Detail: {last_error}",
        )
    return None, None


def _get_conversation_token(agent_id: str) -> tuple[str | None, str | None]:
    if not ELEVENLABS_API_KEY:
        return (
            None,
            "ELEVENLABS_API_KEY is not configured; cannot mint conversation token.",
        )

    url = (
        "https://api.elevenlabs.io/v1/convai/conversation/token"
        f"?agent_id={urllib.parse.quote_plus(agent_id)}"
    )
    req = urllib.request.Request(
        url=url,
        method="GET",
        headers={
            "xi-api-key": ELEVENLABS_API_KEY,
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
            token = payload.get("token")
            if isinstance(token, str) and token:
                return token, None
            return None, "Conversation token response did not include a token."
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore").strip()
        snippet = body[:200] if body else ""
        return (
            None,
            "Failed to fetch ElevenLabs conversation token. "
            f"Detail: {exc.code} {exc.reason}" + (f" ({snippet})" if snippet else ""),
        )
    except Exception as exc:
        return (
            None,
            f"Failed to fetch ElevenLabs conversation token. Detail: {exc}",
        )


@router.get("/agent/health")
async def memory_agent_health():
    return {
        "status": "ok",
        "agent_id": ELEVENLABS_AGENT_ID,
        "has_elevenlabs_key": bool(ELEVENLABS_API_KEY),
    }


@router.get("/agent/person-name", response_model=NameBridgeState)
async def get_person_name_state():
    return _get_name_state()


@router.get("/agent/person-name/value", response_model=NameBridgeValue)
async def get_person_name_value():
    state = _get_name_state()
    return NameBridgeValue(name=state.name)


@router.post("/agent/person-name", response_model=NameBridgeState)
async def set_person_name(body: NameBridgeSetRequest):
    if not _is_valid_name(body.name):
        raise HTTPException(status_code=422, detail="invalid_name")
    return _set_name(body.name)


@router.post("/agent/command", response_model=NameBridgeCommandResponse)
async def name_bridge_command(body: NameBridgeCommandRequest):
    command = body.command.strip().lower()
    if command != "set_name":
        return NameBridgeCommandResponse(
            accepted=False,
            reason="ignored_non_name_command",
        )

    if not body.name or not _is_valid_name(body.name):
        raise HTTPException(status_code=422, detail="invalid_name")

    state = _set_name(body.name)
    return NameBridgeCommandResponse(
        accepted=True,
        name=state.name,
        updated_at=state.updated_at,
    )


@router.get(
    "/patients/{patient_id}/memory-agent/config",
    response_model=MemoryAgentConfigResponse,
)
async def get_memory_agent_config(
    patient_id: uuid.UUID,
    person_id: uuid.UUID | None = Query(default=None),
    max_memories: int = Query(default=5, ge=1, le=10),
    agent_id: str | None = Query(default=None),
    include_signed_url: bool = Query(default=False),
    include_conversation_token: bool = Query(default=False),
):
    patient = (
        supabase.table("patients")
        .select("id")
        .eq("id", str(patient_id))
        .maybe_single()
        .execute()
    )
    if not patient.data:
        raise HTTPException(status_code=404, detail="Patient not found")

    selected_agent_id = (agent_id or ELEVENLABS_AGENT_ID or "").strip()
    if not selected_agent_id:
        raise HTTPException(status_code=500, detail="ELEVENLABS_AGENT_ID is not configured")

    context_text, memories_count, person_name = _build_memory_context(
        patient_id=patient_id,
        person_id=person_id,
        max_memories=max_memories,
    )
    warnings: list[str] = []
    signed_url: str | None = None
    conversation_token: str | None = None

    if include_signed_url:
        signed_url, signed_url_warning = _get_signed_conversation_url(selected_agent_id)
        if signed_url_warning:
            warnings.append(signed_url_warning)

    if include_conversation_token:
        conversation_token, token_warning = _get_conversation_token(selected_agent_id)
        if token_warning:
            warnings.append(token_warning)

    websocket_url = signed_url or (
        "wss://api.elevenlabs.io/v1/convai/conversation"
        f"?agent_id={urllib.parse.quote_plus(selected_agent_id)}"
    )

    return MemoryAgentConfigResponse(
        patient_id=patient_id,
        agent_id=selected_agent_id,
        websocket_url=websocket_url,
        signed_url=signed_url,
        conversation_token=conversation_token,
        warnings=warnings or None,
        person_name=person_name,
        context_text=context_text,
        memories_count=memories_count,
    )
