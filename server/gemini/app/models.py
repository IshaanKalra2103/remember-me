from pydantic import BaseModel, Field
from typing import Optional, List, Union


# --- Register ---

class RegisterRequest(BaseModel):
    photo: str = Field(..., description="Base64-encoded image of the person's face")
    name: str = Field(..., min_length=1, max_length=100)
    relationship: str = Field(..., min_length=1, max_length=100)
    memories: List[str] = Field(default_factory=list, max_length=20)
    topics_to_avoid: List[str] = Field(default_factory=list, max_length=10)


class RegisterResponse(BaseModel):
    success: bool
    profile_id: str


# --- Recognize ---

class RecognizeRequest(BaseModel):
    frame: str = Field(..., description="Base64-encoded video frame")


class RecognizeResponse(BaseModel):
    matched: bool
    confidence: Optional[float] = None   # None when matched=False
    whisper: str
    profile_id: Optional[str] = None     # None when matched=False


# --- Internal profile shape (used by profile_store.py) ---

class Profile(BaseModel):
    profile_id: str
    name: str
    relationship: str
    memories: List[str]
    topics_to_avoid: List[str]
    face_embedding: List[float]          # 128-dim numpy array serialized as float list


# --- Session: Start ---

class SessionStartRequest(BaseModel):
    profile_id: Optional[str] = Field(
        default=None,
        description="Known person's profile ID, or null for a stranger",
    )
    is_stranger: bool = Field(
        default=False,
        description="True when the visitor is unrecognized",
    )
    stranger_photo: Optional[str] = Field(
        default=None,
        description="Base64-encoded photo of the stranger, required when is_stranger=True",
    )


class SessionStartResponse(BaseModel):
    session_id: str


# --- Session: End ---

class SessionEndRequest(BaseModel):
    session_id: str = Field(..., description="UUID returned from /session/start")
    audio: str = Field(..., description="Base64-encoded audio recording of the conversation")
    audio_mime_type: str = Field(
        default="audio/mp4",
        description="MIME type of the audio from expo-av (audio/mp4 or audio/m4a)",
    )


class SessionEndKnownResponse(BaseModel):
    type: str = Field(default="known")
    summary: str
    memories_updated: bool


class NotificationPayload(BaseModel):
    title: str
    body: str


class SessionEndStrangerResponse(BaseModel):
    type: str = Field(default="stranger")
    summary: str
    stranger_photo: str
    session_id: str
    notification: NotificationPayload


# --- Stranger: Save ---

class StrangerSaveRequest(BaseModel):
    session_id: str
    name: Optional[str] = Field(
        default=None,
        description="Name for the person. If omitted, auto-generated e.g. Visitor_Feb28_1",
    )
    relationship: Optional[str] = Field(
        default=None,
        description="Relationship to patient. If omitted, defaults to 'Unknown'",
    )
    topics_to_avoid: List[str] = Field(default_factory=list, max_length=10)


class StrangerSaveResponse(BaseModel):
    success: bool
    profile_id: str


# --- Session: Delete ---

class SessionDeleteResponse(BaseModel):
    success: bool
