from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


# ── Auth ──────────────────────────────────────────────────────────────


class AuthStartRequest(CamelModel):
    email: str


class AuthVerifyRequest(CamelModel):
    email: str
    code: str


class AuthVerifyResponse(CamelModel):
    token: str
    caregiver: CaregiverOut


class CaregiverOut(CamelModel):
    id: uuid.UUID
    email: str
    created_at: datetime


# ── Patient ───────────────────────────────────────────────────────────


class PatientCreate(CamelModel):
    name: str
    language: str = "en"


class PatientUpdate(CamelModel):
    name: Optional[str] = None
    language: Optional[str] = None
    avatar_url: Optional[str] = None
    supervision_mode: Optional[bool] = None
    auto_play_audio: Optional[bool] = None


class PatientOut(CamelModel):
    id: uuid.UUID
    caregiver_id: uuid.UUID
    name: str
    language: str
    avatar_url: Optional[str] = None
    supervision_mode: bool
    auto_play_audio: bool
    has_voice_sample: bool = False
    created_at: datetime


class PatientPublicOut(CamelModel):
    id: uuid.UUID
    caregiver_id: uuid.UUID
    name: str
    language: str
    avatar_url: Optional[str] = None
    supervision_mode: bool
    auto_play_audio: bool
    has_voice_sample: bool = False
    created_at: datetime


class VoiceSampleResponse(CamelModel):
    success: bool
    message: str


# ── Preferences ───────────────────────────────────────────────────────


class RecognitionPreferencesOut(CamelModel):
    patient_id: uuid.UUID
    auto_play_announcement: bool
    prefer_voice_message: bool
    allow_auto_repeat: bool
    confirm_behavior: str
    show_large_name: bool
    show_relationship: bool
    calming_chime: bool


class RecognitionPreferencesUpdate(CamelModel):
    auto_play_announcement: Optional[bool] = None
    prefer_voice_message: Optional[bool] = None
    allow_auto_repeat: Optional[bool] = None
    confirm_behavior: Optional[str] = None
    show_large_name: Optional[bool] = None
    show_relationship: Optional[bool] = None
    calming_chime: Optional[bool] = None


# ── Person ────────────────────────────────────────────────────────────


class PersonCreate(CamelModel):
    name: str
    relationship: Optional[str] = None
    nickname: Optional[str] = None


class PersonUpdate(CamelModel):
    name: Optional[str] = None
    relationship: Optional[str] = None
    nickname: Optional[str] = None


class PersonOut(CamelModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    name: str
    relationship: Optional[str] = None
    nickname: Optional[str] = None
    has_voice_message: bool
    has_announcement: bool
    photos: list[PhotoOut] = []
    created_at: datetime


class PhotoOut(CamelModel):
    id: uuid.UUID
    person_id: uuid.UUID
    storage_path: str
    url: str
    created_at: datetime


# ── Recognition ───────────────────────────────────────────────────────


class SessionOut(CamelModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    created_at: datetime


class RecognitionCandidate(CamelModel):
    person_id: uuid.UUID
    name: str
    confidence: float


class BoundingBox(CamelModel):
    x: int
    y: int
    w: int
    h: int


class RecognitionResult(CamelModel):
    event_id: uuid.UUID
    status: str
    confidence_score: Optional[float] = None
    confidence_band: Optional[str] = None
    winner_person_id: Optional[uuid.UUID] = None
    recognized_name: Optional[str] = None
    primary_bbox: Optional[BoundingBox] = None
    candidates: list[RecognitionCandidate] = []
    needs_tie_break: bool = False


class TiebreakRequest(CamelModel):
    selected_person_id: uuid.UUID


class RecognitionEventOut(CamelModel):
    id: uuid.UUID
    session_id: uuid.UUID
    status: str
    confidence_score: Optional[float] = None
    confidence_band: Optional[str] = None
    winner_person_id: Optional[uuid.UUID] = None
    candidates: list[dict] = []
    needs_tie_break: bool
    created_at: datetime


# ── Audio ─────────────────────────────────────────────────────────────


class AnnouncementAudioResponse(CamelModel):
    url: str
    cached: bool


# ── Logs ──────────────────────────────────────────────────────────────


class ActivityLogCreate(CamelModel):
    type: str
    person_name: Optional[str] = None
    confidence: Optional[float] = None
    note: Optional[str] = None


class ActivityLogOut(CamelModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    type: str
    person_name: Optional[str] = None
    confidence: Optional[float] = None
    note: Optional[str] = None
    timestamp: datetime
