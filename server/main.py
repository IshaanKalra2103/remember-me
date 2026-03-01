import logging
import os
import warnings
from contextlib import asynccontextmanager

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)

os.environ["ONNXRUNTIME_LOG_LEVEL"] = "ERROR"
logging.getLogger("insightface").setLevel(logging.ERROR)
logging.getLogger("onnxruntime").setLevel(logging.ERROR)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as v1_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Preload models on startup."""
    print("[main] Starting server, preloading models...")

    # Preload TitaNet model (takes ~30s on first load)
    try:
        from app.titanet import _get_speaker_model
        print("[main] Loading TitaNet speaker model...")
        _get_speaker_model()
        print("[main] TitaNet model loaded successfully")
    except Exception as e:
        print(f"[main] Warning: Failed to preload TitaNet: {e}")

    yield

    print("[main] Shutting down...")


app = FastAPI(title="RememberMe API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
