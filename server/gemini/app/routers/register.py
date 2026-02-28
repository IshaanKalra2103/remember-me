from fastapi import APIRouter, HTTPException

from app.models import RegisterRequest, RegisterResponse, Profile
from app.services.face_service import encode_face
from app.services.profile_store import ProfileStore
from app.utils.image_utils import base64_to_numpy_rgb

router = APIRouter(tags=["Registration"])


@router.post("/register", response_model=RegisterResponse)
async def register_profile(request: RegisterRequest) -> RegisterResponse:
    """Register a new person's face and profile into the database.

    Decodes the base64 photo, extracts a face embedding, and stores
    the profile in profiles.json for later recognition.
    """
    # 1. Decode base64 image
    try:
        image_array = base64_to_numpy_rgb(request.photo)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data.")

    # 2. Extract face embedding (stubbed until Person 2 integrates face_recognition)
    embedding = encode_face(image_array)
    if embedding is None:
        raise HTTPException(
            status_code=422,
            detail="No face detected in the provided photo. Please provide a clear face image.",
        )

    # 3. Generate a unique, URL-safe profile ID
    profile_id = ProfileStore.generate_profile_id(request.name)

    # 4. Build and persist the Profile
    profile = Profile(
        profile_id=profile_id,
        name=request.name,
        relationship=request.relationship,
        memories=request.memories,
        topics_to_avoid=request.topics_to_avoid,
        face_embedding=embedding,
    )
    ProfileStore.save_profile(profile)

    return RegisterResponse(success=True, profile_id=profile_id)
