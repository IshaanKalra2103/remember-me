# RememberMe API Layout

This document defines the backend API contract for the app, based on:
- `plan.md`
- `tasks.md`
- current client flows in `client/`

Base path: `/v1`

## Backend Folder Ownership

```txt
backend/
  app/api/v1/
    auth.py
    patients.py
    people.py
    recognition.py
    audio.py
    logs.py
```

Each section below lists endpoints that belong in that module and the purpose of each endpoint.

## `auth.py`

### `POST /v1/auth/start`
Purpose: Start caregiver sign-in by accepting email and sending/verifying a short code flow (mock or real provider).

### `POST /v1/auth/verify`
Purpose: Verify email + code, then issue auth token/session for caregiver access.

### `GET /v1/auth/me`
Purpose: Return currently authenticated caregiver profile and session validity.

## `patients.py`

### `GET /v1/patients`
Purpose: List all patients the signed-in caregiver can access.

### `POST /v1/patients`
Purpose: Create a new patient profile (name, language, defaults).

### `GET /v1/patients/:patientId`
Purpose: Fetch one patient profile with current configuration.

### `PATCH /v1/patients/:patientId`
Purpose: Update editable patient metadata (name/language/settings fields as allowed).

### `POST /v1/patients/:patientId/pin`
Purpose: Set or rotate the patient mode PIN (stored as hash).

### `POST /v1/patients/:patientId/pin/verify`
Purpose: Validate PIN before entering patient mode.

### `GET /v1/patients/:patientId/preferences`
Purpose: Read recognition behavior preferences used by patient result flow.

### `PATCH /v1/patients/:patientId/preferences`
Purpose: Update preferences (auto-play, confirm behavior, display options, etc.).

### `POST /v1/patients/:patientId/sessions`
Purpose: Create a recognition session before submitting live frame(s).

## `people.py`

### `GET /v1/patients/:patientId/people`
Purpose: List enrolled people for a patient (name, relationship, media flags).

### `POST /v1/patients/:patientId/people`
Purpose: Create a person record before photo/voice uploads.

### `GET /v1/people/:personId`
Purpose: Fetch full person details for caregiver review/edit screens.

### `PATCH /v1/people/:personId`
Purpose: Update person metadata (name, relationship, nickname).

### `DELETE /v1/people/:personId`
Purpose: Remove a person and associated recognition assets per retention rules.

### `POST /v1/people/:personId/photos`
Purpose: Upload one or multiple enrollment photos and trigger embedding pipeline.

### `DELETE /v1/people/:personId/photos/:photoId`
Purpose: Remove a specific enrollment photo and re-sync embeddings if needed.

### `POST /v1/people/:personId/voice`
Purpose: Upload caregiver voice clip tied to this person for comfort playback.

## `recognition.py`

### `POST /v1/sessions/:sessionId/frame`
Purpose: Submit captured frame, run face detection + embedding match, return candidates/confidence/not-sure state.

### `POST /v1/sessions/:sessionId/tiebreak`
Purpose: Resolve close matches using tie-break logic (Gemini or fallback strategy).

### `GET /v1/sessions/:sessionId/result/:eventId`
Purpose: Retrieve final recognition result/event payload for replay or audit.

## `audio.py`

### `POST /v1/people/:personId/announcement-audio`
Purpose: Return announcement audio URL for person text; cache by `text_hash` and generate only on miss.

## `logs.py`

### `GET /v1/patients/:patientId/logs`
Purpose: Fetch activity timeline for caregiver view (`identified`, `unsure`, `not_correct`, `audio_played`, `help_requested`).

### `POST /v1/patients/:patientId/logs`
Purpose: Insert a new activity event from patient/caregiver actions and recognition outcomes.

## Request/Response Notes

- Auth: bearer token on all non-auth routes.
- IDs: use stable UUIDs for `patientId`, `personId`, `sessionId`, `eventId`.
- Recognition response should include:
  - `status`: `identified | unsure | not_sure`
  - `confidenceScore`
  - `confidenceBand`: `high | medium | low`
  - `winnerPersonId` (if identified)
  - `candidates[]`
  - `needsTieBreak`
- Logs should be lightweight and privacy-conscious (no raw recognition frames stored long term).
