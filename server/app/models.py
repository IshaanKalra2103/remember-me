from pydantic import BaseModel, Field
from typing import Optional, List


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
