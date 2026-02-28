from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import validate_config
from app.routers import register, recognize, sessions, stranger
from app.services.profile_store import ProfileStore


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: validate env vars and ensure database file exists
    validate_config()
    ProfileStore.ensure_database_exists()
    yield
    # Shutdown: nothing to clean up


app = FastAPI(
    title="Remember Me API",
    description=(
        "Dementia companion backend: face recognition + Gemini whisper generation. "
        "Recognizes visitors and whispers personalized context to the patient through earbuds."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Allow React Native app and local dev to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Restrict to specific origins for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(register.router)
app.include_router(recognize.router)
app.include_router(sessions.router)
app.include_router(stranger.router)


@app.get("/health", tags=["Health"])
async def health_check():
    """Check that the API is running."""
    return {"status": "ok", "service": "remember-me-backend"}
