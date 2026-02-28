"""
face_service.py — Face encoding and matching.

STUB: This file is intentionally incomplete.
Person 2 should implement the two functions below.

Dependencies to install (Person 2 only):
    pip install face-recognition dlib cmake

Interface contract (DO NOT change function signatures or return types):
    - encode_face(image_array) -> List[float] | None
    - find_best_match(embedding, profiles, tolerance) -> Tuple[Optional[Profile], float]
"""
import numpy as np
from typing import Optional, Tuple, List

from app.models import Profile


def encode_face(image_array: np.ndarray) -> Optional[List[float]]:
    """
    Extract a 128-dimensional face embedding from an RGB numpy array.

    Args:
        image_array: RGB numpy array, shape (H, W, 3), dtype uint8.

    Returns:
        A list of 128 floats representing the face embedding,
        or None if no face was detected in the image.

    TODO (Person 2): Replace stub body with:
        import face_recognition
        encodings = face_recognition.face_encodings(image_array)
        return encodings[0].tolist() if encodings else None
    """
    # STUB: returns a fake 128-dim zero vector so the full app flow
    # (register → recognize → Gemini whisper) can be tested end-to-end
    # before Person 2's implementation is ready.
    return [0.0] * 128


def find_best_match(
    query_embedding: List[float],
    profiles: List[Profile],
    tolerance: float = 0.6,
) -> Tuple[Optional[Profile], float]:
    """
    Compare a query embedding against all stored profiles and return the best match.

    Args:
        query_embedding: 128-float list from encode_face().
        profiles: All Profile objects loaded from the database.
        tolerance: Maximum L2 distance to count as a match (lower = stricter).
                   face_recognition default is 0.6.

    Returns:
        A tuple of (best_matching_profile, confidence_score).
        confidence is in [0.0, 1.0] — higher means more similar.
        Returns (None, 0.0) if no profile matched within tolerance.

    TODO (Person 2): Replace stub body with:
        import face_recognition
        if not profiles:
            return None, 0.0
        known_encodings = [np.array(p.face_embedding) for p in profiles]
        distances = face_recognition.face_distance(known_encodings, np.array(query_embedding))
        best_idx = int(np.argmin(distances))
        best_dist = float(distances[best_idx])
        if best_dist <= tolerance:
            confidence = round(1.0 - best_dist, 4)
            return profiles[best_idx], confidence
        return None, 0.0
    """
    # STUB: never matches — simulates no face in the database yet.
    # This allows Person 3 and Person 1 (React Native) to test the
    # "unknown visitor" Gemini path end-to-end.
    return None, 0.0
