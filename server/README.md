# RememberMe API

Backend API for RememberMe - a facial recognition assistant for people with memory challenges.

## Overview

FastAPI backend using Supabase (PostgreSQL + Storage) to manage:
- Caregiver authentication (email + OTP)
- Patient profiles and preferences
- Enrolled people with photos and voice messages
- Recognition sessions and events (stubbed)
- Activity logs

## Core Architecture

### Design Principles

**1. Dual User Model**
- **Caregivers**: Full access with bearer token authentication to manage patients and enrolled people
- **Patients**: Limited access with PIN verification for recognition sessions only
- Caregivers set up and configure; patients use the system in a simplified, locked-down mode

**2. Stateless Recognition Sessions**
- Each recognition attempt creates a `session` record
- Sessions track multiple frame submissions and store `recognition_events`
- Events contain confidence scores, candidate rankings, and tiebreak state
- Separation allows audit trail and result replay without storing raw images

**3. Modular Media Pipeline**
- Photos stored in Supabase Storage with CDN URLs (no local file system)
- Voice clips uploaded once per person, overwritten on re-upload
- Announcement audio cached by text hash to avoid regeneration
- All media publicly accessible via signed URLs

**4. Confidence-Based Recognition Flow**
```
Frame → Detection → Embedding Match → Confidence Scoring
                                       ├─ High (≥0.85) → Identified
                                       ├─ Medium (0.6-0.85) → Unsure (tiebreak available)
                                       └─ Low (<0.6) → Not Sure
```

**5. Privacy-First Activity Logging**
- Logs capture recognition outcomes, not raw frames
- Supports filtering by event type (`identified`, `unsure`, `not_correct`, etc.)
- Lightweight for caregiver review dashboards

### Tech Stack Choices

| Technology | Why |
|------------|-----|
| **FastAPI** | Modern async Python framework with automatic OpenAPI docs |
| **Supabase** | Managed Postgres + Storage + Auth in one platform; no local DB setup |
| **Pydantic v2** | Type-safe request/response validation with camelCase JSON serialization |
| **Bearer Tokens** | Simple stateless auth; tokens stored in DB for revocation support |
| **SHA-256 PIN Hash** | Sufficient for 4-digit PINs (upgrade to bcrypt for longer secrets) |

### Data Model Relationships

```
caregivers (1) ──< (M) patients (1) ──< (M) people (1) ──< (M) photos
                          │                    │
                          │                    └──< (M) voice clips
                          │
                          └──< (M) sessions (1) ──< (M) recognition_events
                          └──< (M) activity_logs
                          └──< (1) recognition_prefs
```

- Cascade deletes: Removing a patient deletes all related people, photos, sessions, etc.
- Foreign key constraints enforce referential integrity
- UUIDs for all primary keys (stable across environments)

### API Design Philosophy

**RESTful Resource Hierarchy**
- `/patients/{id}/people` - People belong to a patient
- `/people/{id}/photos` - Photos belong to a person
- `/sessions/{id}/frame` - Frames belong to a session

**Consistent Response Shapes**
- All timestamps in ISO 8601 format
- All IDs as UUIDs
- camelCase JSON for TypeScript client compatibility
- HTTP status codes: 200 (OK), 201 (Created), 204 (No Content), 401 (Unauthorized), 404 (Not Found)

**Auth Boundaries**
- Caregiver routes: Require `Authorization: Bearer <token>` header
- Patient routes: PIN verification only (no token needed)
- Recognition submission: No auth required (session ID acts as implicit scope)

### Stubbed Components

Two areas are intentionally stubbed for future AI integration:

**Recognition Pipeline** (`recognition.py`)
- Current: Randomly selects enrolled people with fake confidence scores
- Future: Integrate face detection (MediaPipe, InsightFace) + embedding model (FaceNet, ArcFace)
- Planned: Real-time frame processing with GPU acceleration

**Audio Generation** (`audio.py`)
- Current: Uses ElevenLabs TTS to generate "This is {name}, your {relationship}" audio
- Caches output in `announcement-audio` bucket by text hash
- Planned: Voice cloning from uploaded caregiver clips for personalized announcements

## Prerequisites

- Python 3.12+
- `uv` package manager ([installation](https://docs.astral.sh/uv/))
- Supabase project (already created)

## Setup

### 1. Install Dependencies

```bash
uv sync
```

### 2. Environment Variables

The `.env` file should include:

```
SUPABASE_URL=https://lzuznpfxmqvxqtybycgb.supabase.co
SUPABASE_KEY=<anon-key>
ELEVENLABS_API_KEY=<your-elevenlabs-api-key>
ELEVENLABS_VOICE_ID=<optional-voice-id> # default: XrExE9yKIg1WjnnlVkGX
ELEVENLABS_MODEL_ID=<optional-model-id> # default: eleven_flash_v2_5
```

### 3. Database

The database schema has already been applied. It includes:

**Tables:**
- `caregivers` - Caregiver accounts
- `auth_codes` - Email verification codes
- `auth_tokens` - Bearer tokens for auth
- `patients` - Patient profiles
- `recognition_prefs` - Recognition behavior settings
- `people` - Enrolled people for recognition
- `photos` - Photo enrollment images
- `sessions` - Recognition sessions
- `recognition_events` - Recognition results and candidates
- `activity_logs` - Activity timeline

**Storage Buckets:**
- `photos` - Enrollment photos
- `voice-clips` - Caregiver voice messages
- `announcement-audio` - Generated announcement audio

## Running the Server

### Development Mode (with auto-reload)

```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode

```bash
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

## API Documentation

### Interactive Docs

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Health Check

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

## API Endpoints

All endpoints are prefixed with `/v1`

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/v1/auth/start` | Send verification code to email | No |
| POST | `/v1/auth/verify` | Verify code and get auth token | No |
| GET | `/v1/auth/me` | Get current caregiver profile | Yes |

### Patients

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/v1/patients` | List all patients for caregiver | Yes |
| POST | `/v1/patients` | Create a new patient | Yes |
| GET | `/v1/patients/{id}` | Get patient details | Yes |
| PATCH | `/v1/patients/{id}` | Update patient | Yes |
| POST | `/v1/patients/{id}/pin` | Set patient PIN | Yes |
| POST | `/v1/patients/{id}/pin/verify` | Verify patient PIN | No (patient mode) |
| GET | `/v1/patients/{id}/preferences` | Get recognition preferences | Yes |
| PATCH | `/v1/patients/{id}/preferences` | Update preferences | Yes |
| POST | `/v1/patients/{id}/sessions` | Create recognition session | Yes |

### People

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/v1/patients/{id}/people` | List enrolled people | Yes |
| POST | `/v1/patients/{id}/people` | Create person record | Yes |
| GET | `/v1/people/{id}` | Get person details | Yes |
| PATCH | `/v1/people/{id}` | Update person | Yes |
| DELETE | `/v1/people/{id}` | Delete person and assets | Yes |
| POST | `/v1/people/{id}/photos` | Upload enrollment photo | Yes |
| DELETE | `/v1/people/{id}/photos/{photoId}` | Delete photo | Yes |
| POST | `/v1/people/{id}/voice` | Upload voice clip | Yes |

### Recognition

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/v1/sessions/{id}/frame` | Submit frame for recognition (stub) | No |
| POST | `/v1/sessions/{id}/tiebreak` | Resolve tie between candidates | No |
| GET | `/v1/sessions/{id}/result/{eventId}` | Get recognition result | No |

### Audio

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/v1/people/{id}/announcement-audio` | Generate announcement audio | Yes |

### Activity Logs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/v1/patients/{id}/logs` | List activity logs | Yes |
| POST | `/v1/patients/{id}/logs` | Create activity log | Yes |

## Testing the API

### 1. Start Authentication Flow

```bash
# Request verification code
curl -X POST http://localhost:8000/v1/auth/start \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com"}'

# Verify with mock code "1234"
curl -X POST http://localhost:8000/v1/auth/verify \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","code":"1234"}'
# Returns: {"token":"...","caregiver":{...}}
```

### 2. Create a Patient

```bash
TOKEN="your-token-from-above"

curl -X POST http://localhost:8000/v1/patients \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"John Doe","language":"en"}'
# Returns: {"id":"...","caregiverId":"...","name":"John Doe",...}
```

### 3. Enroll a Person

```bash
PATIENT_ID="patient-uuid-from-above"

# Create person
curl -X POST http://localhost:8000/v1/patients/$PATIENT_ID/people \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Jane Smith","relationship":"daughter"}'
# Returns: {"id":"...","name":"Jane Smith",...}

# Upload photo
PERSON_ID="person-uuid-from-above"
curl -X POST http://localhost:8000/v1/people/$PERSON_ID/photos \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/photo.jpg"
```

### 4. Test Recognition (Stub)

```bash
# Create session
curl -X POST http://localhost:8000/v1/patients/$PATIENT_ID/sessions \
  -H "Authorization: Bearer $TOKEN"
# Returns: {"id":"...","patientId":"..."}

# Submit frame (returns random stub result)
SESSION_ID="session-uuid-from-above"
curl -X POST http://localhost:8000/v1/sessions/$SESSION_ID/frame \
  -F "file=@/path/to/test-image.jpg"
# Returns: {"eventId":"...","status":"identified|unsure|not_sure",...}
```

## Project Structure

```
server/
├── .env                          # Environment variables
├── main.py                       # FastAPI app entry point
├── pyproject.toml               # Project dependencies
├── uv.lock                      # Locked dependencies
└── app/
    ├── __init__.py
    ├── config.py                # Load environment variables
    ├── supabase_client.py       # Supabase singleton client
    ├── models.py                # Pydantic request/response models
    ├── auth_utils.py            # Auth helpers (PIN hash, tokens)
    └── api/
        └── v1/
            ├── __init__.py
            ├── router.py        # Combine all routers
            ├── auth.py          # Authentication endpoints
            ├── patients.py      # Patient CRUD + PIN + preferences
            ├── people.py        # People CRUD + media uploads
            ├── recognition.py   # Recognition flow (stubbed)
            ├── audio.py         # Audio generation (stubbed)
            └── logs.py          # Activity logging
```

## Key Features

### Authentication
- Email-based OTP flow (mock code "1234" for development)
- Bearer token authentication
- Protected routes with `get_current_caregiver` dependency

### Patient Mode
- PIN verification without bearer token (patient-facing)
- Separate auth flow for caregivers vs patients

### File Storage
- Photos stored in Supabase Storage `photos` bucket
- Voice clips in `voice-clips` bucket
- Generated audio in `announcement-audio` bucket
- All buckets are public with CDN URLs

### Data Model
- camelCase JSON for client compatibility (via Pydantic alias_generator)
- UUID primary keys
- Cascade deletes for related records

### Stubs
- **Recognition**: Returns random candidates from enrolled people
- **Audio generation**: Uses ElevenLabs TTS and caches generated audio in storage

## Development Notes

### Mock Auth Code
The verification code is hardcoded to `"1234"` for development. Update `app/api/v1/auth.py` for production email delivery.

### PIN Security
PINs are hashed with SHA-256. For production, consider bcrypt or Argon2.

### CORS
All origins are allowed for development. Update `main.py` to restrict origins in production:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend.com"],
    ...
)
```

## Next Steps

1. **Recognition Pipeline**: Replace stub in `recognition.py` with actual face detection + embedding matching
2. **Audio Generation**: Add custom voice cloning + personalized voice profile controls
3. **Email Delivery**: Add email provider (SendGrid, Resend, etc.) to `auth.py`
4. **Rate Limiting**: Add rate limiting middleware
5. **Error Tracking**: Integrate Sentry or similar
6. **Testing**: Add pytest tests for all endpoints

## License

MIT
