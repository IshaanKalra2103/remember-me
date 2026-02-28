from typing import Literal

from pydantic import BaseModel, Field


Confidence = Literal["high", "medium", "low"]
Method = Literal["embedding", "tiebreak", "none"]


class PersonCreate(BaseModel):
  name: str
  relationship: str


class PersonOut(BaseModel):
  id: str
  patient_id: str
  name: str
  relationship: str
  photo_count: int = 0
  centroid_ready: bool = False


class EnrollmentPhotoOut(BaseModel):
  photo_id: str
  filename: str
  embedding_created: bool


class EnrollmentResponse(BaseModel):
  person_id: str
  processed_photos: list[EnrollmentPhotoOut]
  embedding_count: int
  centroid_ready: bool


class RecognitionSessionOut(BaseModel):
  id: str
  patient_id: str


class RecognitionCandidateOut(BaseModel):
  person_id: str
  name: str
  similarity: float = Field(ge=0, le=1)
  confidence: Confidence


class RecognitionResultOut(BaseModel):
  session_id: str
  patient_id: str
  winner_person_id: str | None
  confidence: Confidence
  method: Method
  needs_tie_break: bool
  not_sure: bool
  candidates: list[RecognitionCandidateOut]
  metadata: dict = Field(default_factory=dict)
