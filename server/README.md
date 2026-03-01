# RememberMe API

Backend API for RememberMe using FastAPI + Supabase.

This repo powers caregiver setup and patient recognition flows. It exposes authenticated caregiver endpoints for managing patients/people/media, plus patient-mode endpoints for read-only data and activity logging. Recognition and audio generation are implemented server-side, with ML and TTS integrations.

## Architecture Overview

### Roles and Auth
- **Caregiver**: Authenticated with a bearer token. Full access to patients, people, preferences, media, and logs.
- **Patient Mode**: No bearer token. Limited to read-only data + activity log creation + recognition session creation.

Auth flow:
1. `POST /v1/auth/start` stores a mock OTP (dev only)
2. `POST /v1/auth/verify` returns a bearer token
3. Token is stored in `auth_tokens` and validated for caregiver routes

### Core Data Model
```
caregivers (1) ──< patients (M)
patients (1) ──< people (M) ──< photos (M)
patients (1) ──< recognition_prefs (1)
patients (1) ──< sessions (M) ──< recognition_events (M)
patients (1) ──< activity_logs (M)
```

### Media Storage (Supabase Storage)
- `photos`: Enrollment photos used for recognition
- `voice-clips`: Caregiver-recorded voice messages
- `announcement-audio`: Generated announcement audio (TTS)

### Recognition Pipeline
1. Client creates a `session`
2. Client submits a frame to `/v1/sessions/{id}/frame`
3. Server runs InsightFace detection + embedding
4. Server compares against enrolled photo embeddings
5. Returns `identified`, `unsure`, or `not_sure`, with candidates + confidence
6. Logs a `recognition_event`

### Audio Generation
- Uses ElevenLabs TTS to create "This is {name}, your {relationship}"
- Caches per person + voice/model in `announcement-audio` bucket
- Uses signed URLs when possible

## Project Structure
```
server/
├── .env
├── main.py                 # FastAPI app entry point
├── pyproject.toml          # Dependencies
├── uv.lock                 # Locked dependencies
└── app/
    ├── config.py           # Environment variables
    ├── supabase_client.py  # Supabase singleton client
    ├── models.py           # Pydantic request/response models
    ├── auth_utils.py       # Auth helpers (PIN hash, tokens)
    └── api/v1/
        ├── auth.py         # Auth endpoints
        ├── patients.py     # Patient CRUD + PIN + prefs + session create
        ├── people.py       # People CRUD + media uploads
        ├── recognition.py  # Recognition flow (InsightFace)
        ├── audio.py        # ElevenLabs TTS
        ├── logs.py         # Activity logs (caregiver)
        └── patient_mode.py # Patient-mode endpoints
```

## Environment Variables
`.env` example:
```
SUPABASE_URL=https://<your>.supabase.co
SUPABASE_KEY=<service-or-anon-key>
ELEVENLABS_API_KEY=<your-elevenlabs-api-key>
ELEVENLABS_VOICE_ID=<optional-voice-id>      # default: XrExE9yKIg1WjnnlVkGX
ELEVENLABS_MODEL_ID=<optional-model-id>      # default: eleven_flash_v2_5
```

## Setup and Run
```
cd server
uv sync
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Summary

### Auth
- `POST /v1/auth/start`
- `POST /v1/auth/verify`
- `GET /v1/auth/me`

### Patients (Caregiver)
- `GET /v1/patients`
- `POST /v1/patients`
- `GET /v1/patients/{id}`
- `PATCH /v1/patients/{id}`
- `POST /v1/patients/{id}/pin`
- `POST /v1/patients/{id}/pin/verify` (no auth)
- `GET /v1/patients/{id}/preferences`
- `PATCH /v1/patients/{id}/preferences`
- `POST /v1/patients/{id}/sessions` (patient mode uses this unauthenticated)

### People (Caregiver)
- `GET /v1/patients/{id}/people`
- `POST /v1/patients/{id}/people`
- `GET /v1/people/{id}`
- `PATCH /v1/people/{id}`
- `DELETE /v1/people/{id}`
- `POST /v1/people/{id}/photos`
- `DELETE /v1/people/{id}/photos/{photoId}`
- `POST /v1/people/{id}/voice`

### Recognition
- `POST /v1/sessions/{id}/frame`
- `POST /v1/sessions/{id}/tiebreak`
- `GET /v1/sessions/{id}/result/{eventId}`

### Audio
- `POST /v1/people/{id}/announcement-audio`

### Activity Logs
- `GET /v1/patients/{id}/logs`
- `POST /v1/patients/{id}/logs`

### Patient Mode (No Auth)
- `GET /v1/patient-mode/patients/{id}`
- `GET /v1/patient-mode/patients/{id}/people`
- `GET /v1/patient-mode/patients/{id}/preferences`
- `GET /v1/patient-mode/patients/{id}/logs`
- `POST /v1/patient-mode/patients/{id}/logs`

## Development Notes
- PINs are hashed with SHA-256 (consider bcrypt/Argon2 for production)
- CORS is permissive in development (lock down in production)
- Recognition is functional but still a baseline pipeline; improve matching thresholds and performance as needed

## Next Steps
- Improve recognition accuracy and throughput
- Add real email delivery for auth codes
- Add rate limiting and monitoring
- Add tests for all endpoints

## License
MIT
