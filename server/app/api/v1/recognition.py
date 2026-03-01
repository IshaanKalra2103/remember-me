import contextlib
import hashlib
import io
import os
import sys
import uuid
from math import sqrt
from typing import Optional

import cv2
import numpy as np
import requests
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models import (
    BoundingBox,
    RecognitionCandidate,
    RecognitionEventOut,
    RecognitionResult,
    TiebreakRequest,
)
from app.supabase_client import supabase

router = APIRouter(prefix="/sessions", tags=["recognition"])

VECTOR_SIZE = 24
HIGH_CONFIDENCE_SIMILARITY = 0.6
MEDIUM_CONFIDENCE_SIMILARITY = 0.45

PHOTO_EMBEDDING_CACHE: dict[str, np.ndarray] = {}


def _init_face_app():
    """Initialize insightface with suppressed output."""
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        import insightface
        import onnxruntime

        _available_providers = set(onnxruntime.get_available_providers())
        _preferred_providers = [
            "CUDAExecutionProvider",
            "CoreMLExecutionProvider",
            "CPUExecutionProvider",
        ]
        _selected_providers = [
            provider for provider in _preferred_providers if provider in _available_providers
        ] or ["CPUExecutionProvider"]

        app = insightface.app.FaceAnalysis(
            name="buffalo_l",
            providers=_selected_providers,
        )
        app.prepare(ctx_id=0, det_size=(640, 640))
        return app


FACE_APP = _init_face_app()


def _normalize(vector: list[float]) -> list[float]:
    magnitude = sqrt(sum(value * value for value in vector))
    if not magnitude:
        return [0.0 for _ in vector]
    return [value / magnitude for value in vector]


def _vector_from_bytes(payload: bytes, salt: str) -> list[float]:
    digest = hashlib.sha256(payload + salt.encode("utf-8")).digest()
    cursor = digest
    values: list[float] = []

    while len(values) < VECTOR_SIZE:
        cursor = hashlib.sha256(cursor + salt.encode("utf-8")).digest()
        for byte in cursor:
            values.append((byte / 255.0) * 2 - 1)
            if len(values) == VECTOR_SIZE:
                break

    return _normalize(values)


def _vector_from_text(seed: str, salt: str) -> list[float]:
    return _vector_from_bytes(seed.encode("utf-8"), salt)


def _average(vectors: list[np.ndarray]) -> Optional[np.ndarray]:
    if not vectors:
        return None
    stacked = np.vstack(vectors)
    mean = np.mean(stacked, axis=0)
    norm = np.linalg.norm(mean)
    if norm == 0:
        return None
    return mean / norm


def _cosine_similarity(left: np.ndarray, right: np.ndarray) -> float:
    return float(np.dot(left, right))


def _score_similarity(left: np.ndarray, right: np.ndarray) -> float:
    raw_score = _cosine_similarity(left, right)
    return round(max(0.0, min(0.99, (raw_score + 1) / 2)), 2)


def _load_image_from_bytes(payload: bytes) -> Optional[np.ndarray]:
    buffer = np.frombuffer(payload, dtype=np.uint8)
    image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    return image


def _largest_face(faces):
    if not faces:
        return None
    return max(
        faces,
        key=lambda face: (face.bbox[2] - face.bbox[0]) * (face.bbox[3] - face.bbox[1]),
    )


def _compute_embedding(image: np.ndarray) -> Optional[np.ndarray]:
    faces = FACE_APP.get(image)
    face = _largest_face(faces)
    if not face:
        return None
    embedding = face.embedding
    norm = np.linalg.norm(embedding)
    if norm == 0:
        return None
    return embedding / norm


def _fetch_photo_embedding(photo: dict) -> Optional[np.ndarray]:
    cache_key = str(photo.get("id") or photo.get("storage_path") or photo.get("url"))
    if cache_key in PHOTO_EMBEDDING_CACHE:
        return PHOTO_EMBEDDING_CACHE[cache_key]

    url = photo.get("url")
    if not url:
        return None

    try:
        response = requests.get(url, timeout=15)
    except requests.RequestException:
        return None
    if response.status_code != 200:
        return None

    image = _load_image_from_bytes(response.content)
    if image is None:
        return None

    embedding = _compute_embedding(image)
    if embedding is None:
        return None

    PHOTO_EMBEDDING_CACHE[cache_key] = embedding
    return embedding


@router.post("/{session_id}/frame", response_model=RecognitionResult)
async def submit_frame(
    session_id: uuid.UUID,
    file: UploadFile | None = File(default=None),
    seed: str | None = Form(default=None),
):
    """Recognition pipeline using InsightFace embeddings."""
    session = (
        supabase.table("sessions")
        .select("*")
        .eq("id", str(session_id))
        .maybe_single()
        .execute()
    )
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    patient_id = session.data["patient_id"]
    frame_bytes: bytes | None = None
    if file is not None:
        frame_bytes = await file.read()

    if not frame_bytes and seed:
        frame_bytes = seed.encode("utf-8")

    if not frame_bytes:
        raise HTTPException(status_code=400, detail="Missing frame upload")

    people = (
        supabase.table("people")
        .select("id, name")
        .eq("patient_id", patient_id)
        .execute()
    )

    if not people.data:
        event = (
            supabase.table("recognition_events")
            .insert(
                {
                    "session_id": str(session_id),
                    "status": "not_sure",
                    "confidence_score": 0.0,
                    "confidence_band": "low",
                    "candidates": [],
                    "needs_tie_break": False,
                }
            )
            .execute()
        )
        return RecognitionResult(
            event_id=event.data[0]["id"],
            status="not_sure",
            confidence_score=0.0,
            confidence_band="low",
            candidates=[],
            needs_tie_break=False,
        )

    frame_image = _load_image_from_bytes(frame_bytes)
    primary_face = None
    if frame_image is not None:
        faces = FACE_APP.get(frame_image)
        primary_face = _largest_face(faces)

    if primary_face is None:
        event = (
            supabase.table("recognition_events")
            .insert(
                {
                    "session_id": str(session_id),
                    "status": "not_sure",
                    "confidence_score": 0.0,
                    "confidence_band": "low",
                    "candidates": [],
                    "needs_tie_break": False,
                }
            )
            .execute()
        )
        return RecognitionResult(
            event_id=event.data[0]["id"],
            status="not_sure",
            confidence_score=0.0,
            confidence_band="low",
            candidates=[],
            needs_tie_break=False,
        )

    primary_embedding = primary_face.embedding
    norm = np.linalg.norm(primary_embedding)
    if norm == 0:
        primary_embedding = None
    else:
        primary_embedding = primary_embedding / norm

    candidates: list[RecognitionCandidate] = []
    person_centroids: dict[str, np.ndarray] = {}
    for person in people.data:
        photos = (
            supabase.table("photos")
            .select("id, storage_path, url")
            .eq("person_id", person["id"])
            .execute()
        )
        if not photos.data:
            continue

        embeddings = []
        for photo in photos.data:
            embedding = _fetch_photo_embedding(photo)
            if embedding is not None:
                embeddings.append(embedding)

        centroid = _average(embeddings)
        if centroid is None:
            continue

        person_centroids[str(person["id"])] = centroid
        candidates.append(
            RecognitionCandidate(
                person_id=person["id"],
                name=person["name"],
                confidence=0.0,
            )
        )

    if not candidates or primary_embedding is None:
        event = (
            supabase.table("recognition_events")
            .insert(
                {
                    "session_id": str(session_id),
                    "status": "not_sure",
                    "confidence_score": 0.0,
                    "confidence_band": "low",
                    "candidates": [],
                    "needs_tie_break": False,
                }
            )
            .execute()
        )
        return RecognitionResult(
            event_id=event.data[0]["id"],
            status="not_sure",
            confidence_score=0.0,
            confidence_band="low",
            candidates=[],
            needs_tie_break=False,
        )

    rescored_candidates = []
    for candidate in candidates:
        centroid = person_centroids.get(str(candidate.person_id))
        if centroid is None:
            continue
        rescored_candidates.append(
            RecognitionCandidate(
                person_id=candidate.person_id,
                name=candidate.name,
                confidence=_score_similarity(primary_embedding, centroid),
            )
        )

    candidates = sorted(rescored_candidates, key=lambda c: c.confidence, reverse=True)
    top = candidates[0]
    runner_up = candidates[1] if len(candidates) > 1 else None
    score_gap = round(top.confidence - runner_up.confidence, 2) if runner_up else top.confidence

    if top.confidence >= HIGH_CONFIDENCE_SIMILARITY and score_gap >= 0.08:
        status = "identified"
        band = "high"
        needs_tie_break = False
    elif top.confidence >= MEDIUM_CONFIDENCE_SIMILARITY:
        status = "unsure"
        band = "medium"
        needs_tie_break = len(candidates) > 1
    else:
        status = "not_sure"
        band = "low"
        needs_tie_break = False

    winner_id = str(top.person_id) if status == "identified" else None

    event = (
        supabase.table("recognition_events")
        .insert(
            {
                "session_id": str(session_id),
                "status": status,
                "confidence_score": top.confidence,
                "confidence_band": band,
                "winner_person_id": winner_id,
                "candidates": [c.model_dump(mode="json") for c in candidates],
                "needs_tie_break": needs_tie_break,
            }
        )
        .execute()
    )

    x1, y1, x2, y2 = [int(value) for value in primary_face.bbox]
    bbox = BoundingBox(x=x1, y=y1, w=max(0, x2 - x1), h=max(0, y2 - y1))

    return RecognitionResult(
        event_id=event.data[0]["id"],
        status=status,
        confidence_score=top.confidence,
        confidence_band=band,
        winner_person_id=winner_id,
        recognized_name=top.name,
        primary_bbox=bbox,
        candidates=candidates,
        needs_tie_break=needs_tie_break,
    )


@router.post("/{session_id}/tiebreak", response_model=RecognitionResult)
async def tiebreak(session_id: uuid.UUID, body: TiebreakRequest):
    event = (
        supabase.table("recognition_events")
        .select("*")
        .eq("session_id", str(session_id))
        .eq("needs_tie_break", True)
        .order("created_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )
    if not event.data:
        raise HTTPException(status_code=404, detail="No tiebreak event found")

    updated = (
        supabase.table("recognition_events")
        .update(
            {
                "status": "identified",
                "winner_person_id": str(body.selected_person_id),
                "needs_tie_break": False,
                "confidence_band": "high",
            }
        )
        .eq("id", event.data["id"])
        .execute()
    )

    return RecognitionResult(
        event_id=updated.data[0]["id"],
        status="identified",
        confidence_score=updated.data[0]["confidence_score"],
        confidence_band="high",
        winner_person_id=body.selected_person_id,
        candidates=[RecognitionCandidate(**c) for c in updated.data[0]["candidates"]],
        needs_tie_break=False,
    )


@router.get("/{session_id}/result/{event_id}", response_model=RecognitionEventOut)
async def get_result(session_id: uuid.UUID, event_id: uuid.UUID):
    result = (
        supabase.table("recognition_events")
        .select("*")
        .eq("id", str(event_id))
        .eq("session_id", str(session_id))
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    return RecognitionEventOut(**result.data)
