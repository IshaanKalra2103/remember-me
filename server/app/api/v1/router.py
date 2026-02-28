from fastapi import APIRouter

from app.api.v1 import auth, patients, people, recognition, audio, logs

router = APIRouter(prefix="/v1")

router.include_router(auth.router)
router.include_router(patients.router)
router.include_router(people.router)
router.include_router(recognition.router)
router.include_router(audio.router)
router.include_router(logs.router)
