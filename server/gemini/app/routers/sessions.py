from datetime import date

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.models import (
    SessionStartRequest,
    SessionStartResponse,
    SessionEndRequest,
)
from app.services.session_store import SessionStore, SessionType
from app.services.gemini_service import transcribe_and_summarize
from app.services.profile_store import ProfileStore

router = APIRouter(tags=["Sessions"])


@router.post("/session/start", response_model=SessionStartResponse)
async def session_start(request: SessionStartRequest) -> SessionStartResponse:
    """Begin a conversation session.

    Called when a face enters the camera frame.
    The React Native app starts recording audio on the device at the same time.

    - For known people: provide profile_id from the /recognize response.
    - For strangers: set is_stranger=True and provide a stranger_photo.
    """
    if request.is_stranger:
        # Stranger session: photo is required
        if not request.stranger_photo:
            raise HTTPException(
                status_code=400,
                detail="stranger_photo is required when is_stranger=True",
            )
        session_id = SessionStore.create_session(
            session_type=SessionType.STRANGER,
            stranger_photo=request.stranger_photo,
        )
    else:
        # Known-person session: profile_id is required and must exist
        if not request.profile_id:
            raise HTTPException(
                status_code=400,
                detail="profile_id is required when is_stranger=False",
            )
        profile = ProfileStore.get_profile_by_id(request.profile_id)
        if profile is None:
            raise HTTPException(
                status_code=404,
                detail=f"Profile '{request.profile_id}' not found",
            )
        session_id = SessionStore.create_session(
            session_type=SessionType.KNOWN,
            profile_id=request.profile_id,
        )

    return SessionStartResponse(session_id=session_id)


@router.post("/session/end")
async def session_end(request: SessionEndRequest):
    """End a conversation session.

    Called when the face leaves the camera frame. The React Native app
    stops recording and sends the full audio blob here.

    For known visitors:
      - Transcribes the audio → generates a memory summary → appends to profile.
      - Session is cleaned up immediately.

    For strangers:
      - Transcribes the audio → generates a summary → returns notification payload.
      - Session stays alive until /stranger/save or DELETE /session/{id}.
    """
    session = SessionStore.get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    # Resolve profile for known-person sessions
    profile = None
    if session.session_type == SessionType.KNOWN and session.profile_id:
        profile = ProfileStore.get_profile_by_id(session.profile_id)

    # Transcribe and summarize (always returns, never raises)
    transcript, summary = await transcribe_and_summarize(
        audio_b64=request.audio,
        mime_type=request.audio_mime_type,
        profile=profile,
    )

    # Store transcript/summary in session (needed for stranger save path)
    SessionStore.update_session(request.session_id, transcript, summary)

    if session.session_type == SessionType.KNOWN and profile is not None:
        # Append dated memory to profile
        today = date.today().isoformat()  # "YYYY-MM-DD"
        memory_string = f"{today}: {summary}"
        memories_updated = ProfileStore.add_memory(session.profile_id, memory_string)

        # Session is fully resolved — clean it up
        SessionStore.delete_session(request.session_id)

        return JSONResponse(content={
            "type": "known",
            "summary": summary,
            "memories_updated": memories_updated,
        })

    else:
        # Stranger path: session stays alive until save or dismiss
        return JSONResponse(content={
            "type": "stranger",
            "summary": summary,
            "stranger_photo": session.stranger_photo,
            "session_id": request.session_id,
            "notification": {
                "title": "Unknown Visitor",
                "body": "Someone visited. Do you recognise them?",
            },
        })
