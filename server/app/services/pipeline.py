from __future__ import annotations

import hashlib

from ..store import PersonRecord


VECTOR_SIZE = 24


def _normalize(vector: list[float]) -> list[float]:
  magnitude = sum(value * value for value in vector) ** 0.5
  if not magnitude:
    return [0.0 for _ in vector]
  return [value / magnitude for value in vector]


def _average(vectors: list[list[float]]) -> list[float]:
  if not vectors:
    return []

  total = [0.0] * len(vectors[0])
  for vector in vectors:
    for index, value in enumerate(vector):
      total[index] += value

  return _normalize([value / len(vectors) for value in total])


def embedding_from_bytes(content: bytes, salt: str) -> list[float]:
  digest = hashlib.sha256(content + salt.encode("utf-8")).digest()
  vector: list[float] = []
  cursor = digest

  while len(vector) < VECTOR_SIZE:
    cursor = hashlib.sha256(cursor + salt.encode("utf-8")).digest()
    for byte in cursor:
      vector.append((byte / 255.0) * 2 - 1)
      if len(vector) == VECTOR_SIZE:
        break

  return _normalize(vector)


def update_centroid(person: PersonRecord) -> None:
  person.centroid = _average(person.embeddings) if person.embeddings else None


def similarity(left: list[float], right: list[float]) -> float:
  return sum(left[i] * right[i] for i in range(min(len(left), len(right))))


def confidence_from_score(score: float) -> str:
  if score >= 0.94:
    return "high"
  if score >= 0.84:
    return "medium"
  return "low"


def detect_face(_: bytes) -> bool:
  # Placeholder: assume any non-empty upload contains one usable face.
  return True
