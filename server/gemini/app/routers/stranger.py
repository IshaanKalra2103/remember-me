from datetime import date

from fastapi import APIRouter, HTTPException

from app.models import (
    StrangerSaveRequest,
    StrangerSaveResponse,
    SessionDeleteResponse,
    Profile,
)
from app.services.session_store import SessionStore, SessionType
from app.services.profile_store import ProfileStore
from app.services.face_service import encode_face
from app.utils.image_utils import base64_to_numpy_rgb

router = APIRouter(tags=["Stranger"])


def _generate_visitor_name() -> str:
    """Auto-generate a unique visitor name like 'Visitor_Feb28_1'."""
    today = date.today()
    month_day = today.strftime("%b%d")  # e.g. "Feb28"
    base_name = f"Visitor_{month_day}"

    # Find a unique suffix
    profiles = ProfileStore.load_all_profiles()
    existing = [p.name for p in profiles if p.name.startswith(base_name)]
    suffix = len(existing) + 1
    return f"{base_name}_{suffix}"


@router.post("/stranger/save", response_model=StrangerSaveResponse)
async def stranger_save(request: StrangerSaveRequest) -> StrangerSaveResponse:
    """Save a stranger as a new profile after caretaker confirmation.

    Retrieves the session (which holds photo + summary from the conversation),
    creates a new Profile with the conversation as its first memory,
    then deletes the session.

    If name is omitted or blank, an auto-generated name like 'Visitor_Feb28_1' is used.
    If relationship is omitted, defaults to 'Unknown'.
    """
    session = SessionStore.get_session(request.session_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Session not found or already dismissed",
        )

    if session.session_type != SessionType.STRANGER:
        raise HTTPException(
            status_code=400,
            detail="Session is not a stranger session",
        )

    # Resolve name — auto-generate if not provided or blank
    name = request.name.strip() if request.name else ""
    if not name:
        name = _generate_visitor_name()

    # Resolve relationship — default if not provided
    relationship = request.relationship.strip() if request.relationship else "Unknown"

    # Encode face from the stored stranger photo
    embedding: list[float] = [0.0] * 128  # fallback zero vector
    if session.stranger_photo:
        try:
            image_array = base64_to_numpy_rgb(session.stranger_photo)
            result = encode_face(image_array)
            if result is not None:
                embedding = result
        except Exception:
            pass  # tolerate bad image — profile still saved with zero embedding

    # Generate profile ID from the name
    profile_id = ProfileStore.generate_profile_id(name)

    # Build first memory from the session summary (if available)
    memories: list[str] = []
    if session.summary:
        today = date.today().isoformat()
        memories = [f"{today}: {session.summary}"]

    # Build and persist profile
    profile = Profile(
        profile_id=profile_id,
        name=name,
        relationship=relationship,
        memories=memories,
        topics_to_avoid=request.topics_to_avoid,
        face_embedding=embedding,
    )
    ProfileStore.save_profile(profile)

    # Clean up the session
    SessionStore.delete_session(request.session_id)

    return StrangerSaveResponse(success=True, profile_id=profile_id)


@router.delete("/session/{session_id}", response_model=SessionDeleteResponse)
async def session_delete(session_id: str) -> SessionDeleteResponse:
    """Discard a session and all its in-memory data (photo, summary, transcript).

    Used when the caretaker dismisses the 'Save this person?' popup.
    """
    deleted = SessionStore.delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionDeleteResponse(success=True)
