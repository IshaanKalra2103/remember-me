"""
session_store.py — In-memory conversation session state.

Sessions are ephemeral: they live only while the server is running.
No disk persistence — sessions are wiped on restart.
"""
import threading
import uuid
from dataclasses import dataclass
from typing import Optional
from enum import Enum


class SessionType(str, Enum):
    KNOWN = "known"
    STRANGER = "stranger"


@dataclass
class Session:
    session_id: str
    session_type: SessionType

    # For known-person sessions
    profile_id: Optional[str] = None

    # For stranger sessions
    stranger_photo: Optional[str] = None  # base64, held until save or delete

    # Populated after session ends (by transcribe_and_summarize)
    transcript: Optional[str] = None
    summary: Optional[str] = None


_sessions: dict[str, Session] = {}
_lock = threading.Lock()


class SessionStore:

    @staticmethod
    def create_session(
        session_type: SessionType,
        profile_id: Optional[str] = None,
        stranger_photo: Optional[str] = None,
    ) -> str:
        """Create a new session, store it, return the session_id."""
        session_id = str(uuid.uuid4())
        session = Session(
            session_id=session_id,
            session_type=session_type,
            profile_id=profile_id,
            stranger_photo=stranger_photo,
        )
        with _lock:
            _sessions[session_id] = session
        return session_id

    @staticmethod
    def get_session(session_id: str) -> Optional[Session]:
        """Return the Session or None if not found."""
        with _lock:
            return _sessions.get(session_id)

    @staticmethod
    def update_session(session_id: str, transcript: str, summary: str) -> bool:
        """Write transcript and summary into an existing session.

        Returns False if session was not found.
        """
        with _lock:
            session = _sessions.get(session_id)
            if session is None:
                return False
            session.transcript = transcript
            session.summary = summary
            return True

    @staticmethod
    def delete_session(session_id: str) -> bool:
        """Remove a session from memory. Returns False if it did not exist."""
        with _lock:
            existed = session_id in _sessions
            _sessions.pop(session_id, None)
            return existed
