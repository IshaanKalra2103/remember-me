# RememberMe

RememberMe is a caregiver-guided recognition app that helps patients identify familiar people. The project includes a React Native client (Expo) and a FastAPI backend backed by Supabase.

## What’s in this repo

```
./
├── client/   # Expo + React Native app
├── server/   # FastAPI backend + Supabase integration
├── plan/     # Planning artifacts (if any)
├── 11-lab/   # Eleven Labs Audio component with API endpoint for data transition (not connected to app)
└── README.md # This file
```

## Architecture Summary

- **Client**: Expo Router + React Native with local caching and optional backend sync.
- **Backend**: FastAPI API providing caregiver management, recognition sessions, and activity logging.
- **Database**: Supabase Postgres (caregivers, patients, people, photos, sessions, recognition events, logs).
- **Media**: Supabase Storage buckets for photos, voice clips, and announcement audio.
- **Recognition**: InsightFace-based pipeline on the server (baseline implementation).
- **Audio**: ElevenLabs TTS for announcement audio (cached by person + voice/model).

## Quick Start

### Client
```
cd client
bun i
bun run start
```

### Server
```
cd server
uv sync
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Environment Variables

Create `server/.env`:
```
SUPABASE_URL=https://<your>.supabase.co
SUPABASE_KEY=<service-or-anon-key>
ELEVENLABS_API_KEY=<your-elevenlabs-api-key>
ELEVENLABS_VOICE_ID=<optional-voice-id>
ELEVENLABS_MODEL_ID=<optional-model-id>
```

Client-side optional overrides (via Expo env):
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_PATIENT_ID`
- `EXPO_PUBLIC_PATIENT_PIN`

## Where to look

- Client app flow and storage: `client/app/*`, `client/providers/AppProvider.tsx`
- API and models: `server/app/api/v1/*`, `server/app/models.py`
- Recognition: `server/app/api/v1/recognition.py`
- Audio generation: `server/app/api/v1/audio.py`

## Notes

- Caregiver flow uses authenticated endpoints.
- Patient mode can use unauthenticated “patient-mode” endpoints and local PIN verification.
- Recognition and audio are implemented but should be treated as baseline quality.

## License

MIT
