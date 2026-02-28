from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from .schemas import (
  EnrollmentPhotoOut,
  EnrollmentResponse,
  PersonCreate,
  PersonOut,
  RecognitionCandidateOut,
  RecognitionResultOut,
  RecognitionSessionOut,
)
from .services.pipeline import (
  confidence_from_score,
  detect_face,
  embedding_from_bytes,
  similarity,
  update_centroid,
)
from .store import new_id, store


router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
  return {"status": "ok", "mode": "placeholder"}


@router.post(
  "/patients/{patient_id}/people",
  response_model=PersonOut,
  status_code=status.HTTP_201_CREATED,
)
def create_person(patient_id: str, payload: PersonCreate) -> PersonOut:
  person = store.create_person(
    patient_id=patient_id,
    name=payload.name,
    relationship=payload.relationship,
  )
  return PersonOut(
    id=person.id,
    patient_id=person.patient_id,
    name=person.name,
    relationship=person.relationship,
    photo_count=len(person.photos),
    centroid_ready=person.centroid is not None,
  )


@router.get("/patients/{patient_id}/people", response_model=list[PersonOut])
def list_people(patient_id: str) -> list[PersonOut]:
  return [
    PersonOut(
      id=person.id,
      patient_id=person.patient_id,
      name=person.name,
      relationship=person.relationship,
      photo_count=len(person.photos),
      centroid_ready=person.centroid is not None,
    )
    for person in store.list_people(patient_id)
  ]


@router.post(
  "/people/{person_id}/photos",
  response_model=EnrollmentResponse,
  status_code=status.HTTP_201_CREATED,
)
async def upload_person_photos(
  person_id: str,
  photos: list[UploadFile] = File(...),
) -> EnrollmentResponse:
  person = store.get_person(person_id)
  if not person:
    raise HTTPException(status_code=404, detail="Person not found")

  processed_photos: list[EnrollmentPhotoOut] = []
  for photo in photos:
    content = await photo.read()
    if not content:
      continue

    photo_id = new_id("photo")
    has_face = detect_face(content)
    if has_face:
      embedding = embedding_from_bytes(content, f"{person.id}:{photo_id}")
      person.embeddings.append(embedding)
      update_centroid(person)

    person.photos.append(
      {
        "id": photo_id,
        "filename": photo.filename or "photo.bin",
      }
    )
    processed_photos.append(
      EnrollmentPhotoOut(
        photo_id=photo_id,
        filename=photo.filename or "photo.bin",
        embedding_created=has_face,
      )
    )

  return EnrollmentResponse(
    person_id=person.id,
    processed_photos=processed_photos,
    embedding_count=len(person.embeddings),
    centroid_ready=person.centroid is not None,
  )


@router.post(
  "/patients/{patient_id}/sessions",
  response_model=RecognitionSessionOut,
  status_code=status.HTTP_201_CREATED,
)
def create_session(patient_id: str) -> RecognitionSessionOut:
  session = store.create_session(patient_id)
  return RecognitionSessionOut(**session)


@router.post("/sessions/{session_id}/frame", response_model=RecognitionResultOut)
async def recognize_frame(
  session_id: str,
  frame: UploadFile = File(...),
) -> RecognitionResultOut:
  session = store.get_session(session_id)
  if not session:
    raise HTTPException(status_code=404, detail="Session not found")

  content = await frame.read()
  if not content:
    raise HTTPException(status_code=400, detail="Empty frame")

  if not detect_face(content):
    result = RecognitionResultOut(
      session_id=session_id,
      patient_id=session["patient_id"],
      winner_person_id=None,
      confidence="low",
      method="none",
      needs_tie_break=False,
      not_sure=True,
      candidates=[],
      metadata={"reason": "no_face_detected"},
    )
    store.add_event(result.model_dump())
    return result

  people = [person for person in store.list_people(session["patient_id"]) if person.centroid]
  if not people:
    result = RecognitionResultOut(
      session_id=session_id,
      patient_id=session["patient_id"],
      winner_person_id=None,
      confidence="low",
      method="none",
      needs_tie_break=False,
      not_sure=True,
      candidates=[],
      metadata={"reason": "no_enrolled_people"},
    )
    store.add_event(result.model_dump())
    return result

  frame_embedding = embedding_from_bytes(content, f"frame:{session['patient_id']}")
  ranked = []
  for person in people:
    score = max(0.0, min(0.99, similarity(frame_embedding, person.centroid or [])))
    ranked.append(
      {
        "person": person,
        "score": round(score, 3),
      }
    )

  ranked.sort(key=lambda item: item["score"], reverse=True)
  top = ranked[0]
  runner_up = ranked[1] if len(ranked) > 1 else None
  candidates = [
    RecognitionCandidateOut(
      person_id=item["person"].id,
      name=item["person"].name,
      similarity=item["score"],
      confidence=confidence_from_score(item["score"]),
    )
    for item in ranked[:3]
  ]

  if top["score"] < 0.84:
    result = RecognitionResultOut(
      session_id=session_id,
      patient_id=session["patient_id"],
      winner_person_id=None,
      confidence="low",
      method="embedding",
      needs_tie_break=False,
      not_sure=True,
      candidates=candidates,
      metadata={"reason": "below_threshold"},
    )
    store.add_event(result.model_dump())
    return result

  gap = top["score"] - runner_up["score"] if runner_up else top["score"]
  if top["score"] < 0.94 or gap < 0.045:
    result = RecognitionResultOut(
      session_id=session_id,
      patient_id=session["patient_id"],
      winner_person_id=None,
      confidence="medium",
      method="embedding",
      needs_tie_break=True,
      not_sure=False,
      candidates=candidates,
      metadata={"reason": "close_scores", "top_gap": round(gap, 3)},
    )
    store.add_event(result.model_dump())
    return result

  result = RecognitionResultOut(
    session_id=session_id,
    patient_id=session["patient_id"],
    winner_person_id=top["person"].id,
    confidence="high",
    method="embedding",
    needs_tie_break=False,
    not_sure=False,
    candidates=candidates,
    metadata={"reason": "high_confidence_match", "top_gap": round(gap, 3)},
  )
  store.add_event(result.model_dump())
  return result
