# RememberMe API

Backend API for RememberMe using FastAPI and Supabase.

The server currently includes:
- caregiver auth
- patient and people management
- media upload routes
- recognition session routes
- a deterministic placeholder recognition pipeline in `server/app/api/v1/recognition.py`

That recognition pipeline is still a stub. It no longer picks people randomly, but it is not a real face model yet:
- it derives stable placeholder vectors from uploaded frame bytes and enrolled photo paths
- it scores enrolled people deterministically
- it returns `identified`, `unsure`, or `not_sure`
- it preserves the existing API contract so the frontend can integrate now

Run locally:

```bash
cd server
uv sync
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
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
| POST | `/v1/people/{id}/announcement-audio` | Generate announcement audio (stub) | Yes |

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
- **Audio generation**: Creates placeholder files (integrate OpenAI TTS later)

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
2. **Audio Generation**: Integrate OpenAI TTS in `audio.py`
3. **Email Delivery**: Add email provider (SendGrid, Resend, etc.) to `auth.py`
4. **Rate Limiting**: Add rate limiting middleware
5. **Error Tracking**: Integrate Sentry or similar
6. **Testing**: Add pytest tests for all endpoints

## License

MIT
>>>>>>> main
