from fastapi import APIRouter, HTTPException

from app.models import RecognizeRequest, RecognizeResponse
from app.services.face_service import encode_face, find_best_match
from app.services.gemini_service import generate_whisper_for_match, generate_whisper_for_unknown
from app.services.profile_store import ProfileStore
from app.utils.image_utils import base64_to_numpy_rgb

router = APIRouter(tags=["Recognition"])


@router.post("/recognize", response_model=RecognizeResponse)
async def recognize_face(request: RecognizeRequest) -> RecognizeResponse:
    """Recognize a face in a video frame and generate a contextual whisper.

    Flow:
      1. Decode base64 frame
      2. Extract face embedding
      3. Match against all stored profiles
      4. Generate whisper via Gemini (matched or unknown visitor path)
      5. Return structured response
    """
    # 1. Decode base64 frame
    try:
        image_array = base64_to_numpy_rgb(request.frame)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 frame data.")

    # 2. Encode face — None means no face visible in frame at all
    embedding = encode_face(image_array)
    if embedding is None:
        return RecognizeResponse(
            matched=False,
            whisper="I don't see anyone clearly yet. They may still be approaching.",
        )

    # 3. Match against all stored profiles
    profiles = ProfileStore.load_all_profiles()
    matched_profile, confidence = find_best_match(embedding, profiles)

    # 4a. Known visitor — generate personalized whisper
    if matched_profile is not None:
        whisper = await generate_whisper_for_match(matched_profile)
        return RecognizeResponse(
            matched=True,
            confidence=confidence,
            whisper=whisper,
            profile_id=matched_profile.profile_id,
        )

    # 4b. Unknown visitor — generate calm, non-alarming whisper
    whisper = await generate_whisper_for_unknown()
    return RecognizeResponse(
        matched=False,
        whisper=whisper,
    )
