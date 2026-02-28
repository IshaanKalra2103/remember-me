from __future__ import annotations

import uuid
from dataclasses import dataclass, field


def new_id(prefix: str) -> str:
  return f"{prefix}-{uuid.uuid4().hex[:12]}"


@dataclass
class PersonRecord:
  id: str
  patient_id: str
  name: str
  relationship: str
  photos: list[dict] = field(default_factory=list)
  embeddings: list[list[float]] = field(default_factory=list)
  centroid: list[float] | None = None


class PlaceholderStore:
  def __init__(self) -> None:
    self.people: dict[str, PersonRecord] = {}
    self.sessions: dict[str, dict] = {}
    self.events: list[dict] = []

  def create_person(self, patient_id: str, name: str, relationship: str) -> PersonRecord:
    person = PersonRecord(
      id=new_id("person"),
      patient_id=patient_id,
      name=name,
      relationship=relationship,
    )
    self.people[person.id] = person
    return person

  def list_people(self, patient_id: str) -> list[PersonRecord]:
    return [person for person in self.people.values() if person.patient_id == patient_id]

  def get_person(self, person_id: str) -> PersonRecord | None:
    return self.people.get(person_id)

  def create_session(self, patient_id: str) -> dict:
    session = {"id": new_id("session"), "patient_id": patient_id}
    self.sessions[session["id"]] = session
    return session

  def get_session(self, session_id: str) -> dict | None:
    return self.sessions.get(session_id)

  def add_event(self, event: dict) -> None:
    self.events.append(event)


store = PlaceholderStore()
