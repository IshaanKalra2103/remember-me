## RememberMe: Detailed App Plan

### 1) What the app is

**RememberMe** is a caregiver-assisted mobile app designed to help people with Alzheimer’s or memory impairment **recognize who is in front of them** during everyday moments. It uses a simple, guided experience to reduce confusion, support dignity, and help patients stay socially connected.

At its core, the app does three things:

1. **Learns who the patient’s close people are** through caregiver-guided setup.
2. **Recognizes a person in front of the patient** using the phone camera.
3. **Gently communicates identity and context** using clear visuals and optional audio, so the patient can feel grounded and safe.

The app is not framed as a medical treatment. It’s an assistive tool that supports recognition and daily interactions.

---

### 2) The problem it solves

Alzheimer’s patients often experience stressful moments like:

* “I know this face but I can’t place them.”
* “Is this my daughter, my nurse, or a stranger?”
* “I don’t want to embarrass myself by asking.”
* “I feel unsafe because I’m unsure.”

These moments can trigger anxiety for the patient and frustration or sadness for loved ones. Caregivers also carry a heavy load trying to repeatedly re-introduce people and de-escalate confusion.

**RememberMe helps by providing a calm “identity anchor” in real time.**

---

### 3) Who it’s for

**Primary users**

* **Patient:** wants a simple way to know who is present without feeling overwhelmed.
* **Caregiver:** sets up the system, manages enrolled people, supervises usage, and adjusts settings.

**Secondary users**

* Family members who want a smoother, less awkward interaction.
* Home health aides and nurses (with caregiver permission).

---

### 4) Key outcomes

* Reduce “Who are you?” confusion in daily interactions.
* Reduce stress and anxiety during social contact.
* Support independence and confidence at home.
* Give caregivers a gentle supervision tool (without making the patient feel monitored).

---

### 5) Core experience design principles

**For the patient**

* Minimal reading, large buttons, one action at a time.
* Calm tone and consistent behavior.
* Never guesses when unsure.
* Always offers “Try again” or “Ask for help.”

**For the caregiver**

* Guided setup, clear progress.
* Easy editing of people profiles.
* Adjustable sensitivity (more cautious vs more automatic).
* Simple activity insights without overwhelming detail.

---

### 6) How it helps, step-by-step

#### A) Caregiver setup (one-time, guided)

The caregiver creates a patient profile and builds a small “circle of familiar people.”

**Setup includes:**

* Patient profile (name, preferred language, optional avatar).
* A secure patient access method (PIN).
* Optional supervision settings.

**Enrolling a person (caregiver adds “Mom”, “Brother”, “Nurse”, etc.):**

* Name and relationship.
* Multiple photos (ideally varied lighting and angles).
* Optional personalization:

  * preferred nickname (“Papa” instead of “Raj”)
  * short reassurance message (“Hi, it’s Priya. I’m right here with you.”)
  * optional contextual details like “lives in Newark,” “visits Sundays” (only if caregiver wants)

This builds the patient’s “familiar network.”

#### B) Patient recognition (daily use)

Patient opens Patient Mode and taps one button: **“Who is here?”**

The app:

1. Opens the camera in a simple view.
2. Captures a moment when the patient taps “Identify.”
3. Matches the face to the familiar network.
4. Shows a result screen and optionally plays a short audio line.

**Result is presented gently:**

* Large text: “This is Priya”
* Subtext: “Your daughter”
* Optional audio: “This is Priya, your daughter.”

If the app is not confident, it does not guess. It says:

* “I’m not sure who this is. Would you like to try again or ask your caregiver for help?”

#### C) Confirmation behavior (safety against mistakes)

If confidence is medium:

* The app asks a simple confirmation:

  * “Is this Priya?” with Yes/No.
* If No, it defaults to “Not sure” rather than forcing a wrong label.

This prevents harm from misidentifying someone.

---

### 7) App structure and main screens

#### Entry

* **Welcome screen:** “Caregiver Setup” or “Patient Mode”

#### Caregiver side

1. **Caregiver Dashboard**

   * Select patient
   * Add patient
   * Manage people
   * Preferences
   * Activity log
   * Enter patient mode

2. **Add Patient (Wizard)**

   * Patient name and preferences
   * Set PIN
   * Choose supervision settings

3. **People Library**

   * List of enrolled people
   * Add person wizard
   * Edit/remove person

4. **Recognition Preferences**

   * Cautious vs automatic
   * When to ask for confirmation
   * Whether to use audio
   * Whether to show relationship and name large

5. **Activity Log**

   * Recognition attempts
   * Confirmations
   * “Not correct” events
   * Help requests
   * Useful for caregiver insight, not surveillance

#### Patient side

1. **PIN Entry**
2. **Patient Home**

   * “Who is here?”
   * “Repeat last”
   * “Ask caregiver for help”
3. **Recognition camera**
4. **Result**
5. **Not sure / Ask for help**

---

### 8) What makes it feel “AI-native” without being scary

The app should feel like a calm assistant, not a surveillance tool.

So it emphasizes:

* **Caregiver-controlled enrollment** (only known people).
* **Opt-in recognition** (patient taps to identify).
* **Transparency in uncertainty** (“I’m not sure”).
* **Privacy controls** (caregiver can disable logs, disable audio, require confirmations).
* **On-device friendly behavior where possible** (design-wise, not as a claim).

---

### 9) Personalization features that matter

These make the experience emotionally supportive, not just functional:

* **Nicknames:** “Nani,” “Papa,” “Coach,” etc.
* **Relationship labels:** “Your sister,” “Your friend”
* **Familiar reassurance clip:** caregiver voice can reduce anxiety more than synthetic voice.
* **Language preference:** patient sees and hears the language they’re comfortable with.
* **Calm chime:** small auditory cue before speaking can feel grounding.

---

### 10) Safety and ethics plan

Because the domain is sensitive, safety is part of the product:

**Avoid harm**

* Never present a low-confidence label.
* Provide confirmation when uncertain.
* Allow “Not correct” instantly.
* Offer “Ask caregiver for help.”

**Avoid surveillance framing**

* No continuous scanning.
* No background monitoring.
* Recognition is initiated by the patient or caregiver.

**Control and consent**

* Caregiver manages the familiar network.
* Patient mode is protected.
* Logs are optional, designed for support not monitoring.

---

### 11) Hackathon MVP scope (what you can demo)

A strong MVP demo includes:

* Caregiver creates patient + sets PIN
* Caregiver enrolls 2–3 people with photos
* Patient taps “Who is here?”
* App identifies a teammate and shows name + relationship
* App speaks the identification line
* Demonstrate an uncertain case:

  * App says “I’m not sure,” offers try again/help

This is enough for judges to understand the impact immediately.

---

### 12) Stretch goals (if time remains)

* “Memory card” after recognition: one line of context (“She visits on weekends.”)
* Multi-person detection: “I see 2 people. Tap the person you want to identify.”
* Caregiver remote assist: send a notification when patient asks for help
* Accessibility extras: larger text toggle, high contrast toggle, reduced motion
* Event insights: “Most confusion happens in evenings” (simple trend)

---

### 13) What you’d say in one sentence on stage

“RememberMe is a caregiver-assisted app that helps Alzheimer’s patients recognize loved ones in real time using camera-based recognition and gentle guidance, reducing confusion and making daily interactions feel safe and human.”

---

# Tech Implementation (APP has ALREADY BEEN IMPLEMENTED)

Below is a **detailed, end-to-end technical implementation plan** for RememberMe, covering **frontend + backend**, with an architecture that is realistic for a hackathon MVP but also scales into a real product.

I’ll assume: **React Native + Expo + Expo Router + TypeScript + React Query** on the client (matches your reference), plus a small backend that handles **face recognition + tie-break + audio generation + auth + storage**.

---

## 0) High-level architecture

### Components

1. **Mobile app (Caregiver + Patient modes)**

* Captures enrollment photos and live “identify” snapshots
* Displays results, confirms when unsure
* Plays audio announcements
* Stores lightweight local state (selected patient, last result)

2. **Backend API**

* Authentication and caregiver-patient linking
* People enrollment processing (face detection + embeddings)
* Recognition endpoint (match live face to enrolled people)
* Optional tie-break endpoint using Gemini when uncertain
* Audio generation endpoint (ElevenLabs) and caching
* Activity logging (supervision)

3. **Storage**

* Object storage for photos and audio (S3/GCS)
* Database for caregivers/patients/people metadata + embeddings + logs

---

## 1) Frontend implementation plan (React Native + Expo)

### 1.1 App structure (based on your Expo Router layout)

Recommended expansion of your structure:

```
├── app/
│   ├── _layout.tsx                 # Root navigation
│   ├── index.tsx                   # Welcome (Caregiver / Patient)
│   ├── caregiver/
│   │   ├── _layout.tsx             # Caregiver stack
│   │   ├── sign-in.tsx
│   │   ├── dashboard.tsx
│   │   ├── patients/
│   │   │   ├── create.tsx
│   │   │   └── switch.tsx
│   │   ├── people/
│   │   │   ├── index.tsx           # list people
│   │   │   ├── add/
│   │   │   │   ├── step1.tsx       # name + relationship
│   │   │   │   ├── step2.tsx       # add photos
│   │   │   │   ├── step3.tsx       # voice clip
│   │   │   │   └── review.tsx
│   │   │   └── [personId].tsx      # person details
│   │   ├── settings.tsx
│   │   └── activity.tsx
│   ├── patient/
│   │   ├── _layout.tsx
│   │   ├── pin.tsx
│   │   ├── home.tsx
│   │   ├── camera.tsx
│   │   ├── result.tsx
│   │   └── not-sure.tsx
│   └── +not-found.tsx
├── src/
│   ├── api/
│   │   ├── client.ts               # fetch wrapper + auth header
│   │   ├── endpoints.ts            # typed functions
│   │   └── queries.ts              # React Query hooks
│   ├── components/
│   ├── state/
│   │   ├── auth.ts                 # caregiver token
│   │   ├── patient.ts              # selected patient + pin state
│   │   └── settings.ts
│   ├── utils/
│   │   ├── audio.ts                # play, cache, stop
│   │   ├── image.ts                # resize/compress before upload
│   │   └── match.ts                # tie-break thresholds
│   ├── types/
│   └── theme/
├── assets/
├── constants/
```

### 1.2 Key frontend responsibilities

#### A) Caregiver sign-in + session

* Token stored locally
* React Query “me” query to validate session
* Logout clears token and cached queries

#### B) Patient selection & PIN gate

* Caregiver selects active patient for management
* PIN required for patient mode entry
* PIN stored securely, never shown to patient in settings without caregiver confirmation

#### C) Enrollment flow (add person)

* Step wizard with form validation
* Photo selection and preview grid
* Photo upload progress UI
* Optional voice clip record and playback
* Submit to backend: creates person + triggers embedding build server-side

#### D) Recognition flow (patient)

* Camera screen: user taps Identify
* Capture single photo, compress
* Submit to backend: get ranked candidates + confidence
* If uncertain: backend tie-break and return final choice
* Result screen auto-plays audio line
* “Not correct” triggers log + “not sure” flow

#### E) Audio logic (client)

* Always attempt to play cached local audio first (if stored)
* If none cached: fetch a ready-to-play audio URL from backend
* Play and unload sound after completion
* Repeat button replays last audio
* Stop button stops playback

### 1.3 Network API calls (frontend-facing contract)

You’ll wire these with React Query hooks.

**Auth**

* `POST /auth/start` email -> code sent (mock in hackathon)
* `POST /auth/verify` email+code -> token

**Patients**

* `GET /patients`
* `POST /patients`
* `POST /patients/:id/pin` (caregiver sets)
* `POST /patients/:id/link` (optional if multi caregivers)

**People**

* `GET /patients/:id/people`
* `POST /patients/:id/people` (name, relationship)
* `POST /people/:personId/photos` (multi upload)
* `POST /people/:personId/voice` (optional upload)

**Recognition**

* `POST /patients/:id/sessions` -> sessionId
* `POST /sessions/:id/frame` -> candidates + needsTieBreak
* `POST /sessions/:id/tiebreak` -> winner

**Audio**

* `POST /people/:personId/announcement-audio` -> audioUrl (cached)
* Optionally: `GET /audio/:audioId` if you want signed URLs

**Logs**

* `POST /patients/:id/logs`

### 1.4 Image handling on mobile (important)

* Use one still image per recognition attempt
* Resize and compress before upload (faster, cheaper)
* Limit resolution to something like 720p max for recognition

### 1.5 Frontend caching strategy

* Cache selected patient + last result locally
* Cache “announcement audio” per person locally once fetched
* Cache people list in React Query (invalidate on enroll)

---

## 2) Backend implementation plan

### 2.1 Backend responsibilities

1. **Authentication + role separation**
2. **Patient and people management**
3. **Face processing pipeline**

   * detect faces
   * build embeddings for enrolled people
   * match live images to enrolled people
4. **Tie-breaking via Gemini**
5. **Audio generation + caching via ElevenLabs**
6. **Logging and supervision view**

### 2.2 Backend service layout (clean separation)

**Services**

* `api-gateway` (HTTP API)
* `face-service` (compute: detection + embeddings + matching)
* `audio-service` (generate + cache voice)
* `storage-service` (object storage wrapper)
* `db` (metadata + embeddings + logs)

For hackathon: you can keep this as a **single FastAPI server** with modules inside. Structure it as if it could be split later.

### 2.3 Data model (DB tables)

Use Postgres (or SQLite for hackathon). Recommended tables:

**caregivers**

* id, email, name, created_at

**patients**

* id, name, preferred_language, created_at

**caregiver_patients**

* caregiver_id, patient_id, role (owner/admin)

**people**

* id, patient_id, name, relationship, created_at, updated_at

**person_photos**

* id, person_id, storage_url, created_at

**face_embeddings**

* id, person_id, embedding_vector (float array or blob), source_photo_id, created_at
* Optional: `embedding_mean_vector` per person in `people` for fast matching

**recognition_sessions**

* id, patient_id, started_at, last_used_at

**recognition_events**

* id, session_id, timestamp, result_person_id, confidence, method (embedding/tiebreak), metadata json

**audio_assets**

* id, person_id, text_hash, storage_url, voice_type (elevenlabs/caregiver), created_at

### 2.4 Storage strategy

Store raw assets in object storage:

* enrollment photos
* caregiver voice clips
* generated announcement audio

DB stores:

* references to storage URLs
* embeddings and metadata

### 2.5 Face recognition pipeline (core)

#### Enrollment processing

When caregiver uploads photos for a person:

1. Detect face(s) in each photo
2. If multiple faces, choose the largest or prompt caregiver (MVP can choose largest)
3. Crop face region
4. Generate embedding vector per face crop
5. Store embeddings in DB
6. Compute per-person centroid embedding (average) and store for fast match

#### Recognition processing

When patient submits a frame:

1. Detect face(s)
2. If no face -> return “not sure”
3. Crop face
4. Generate embedding for crop
5. Compare against each person centroid embedding for that patient
6. Return top K candidates with similarity score
7. Determine:

   * high confidence -> winner
   * close scores -> needsTieBreak = true
   * low confidence -> “not sure”

#### Tie-break with Gemini

Tie-break call is only used when:

* top1 and top2 are close
* or overall confidence is medium

Tie-break behavior:

* Provide Gemini with:

  * live face crop
  * a small subset of reference crops for top candidates
* Ask it to output JSON winner + confidence
* Return that winner to the app

Important: keep the candidate set small (2–3 people max), otherwise tie-break becomes slow and costly.

### 2.6 Audio generation pipeline (ElevenLabs)

When app requests announcement audio:

1. Compute `text_hash = hash(personId + text + voice_id)`
2. Check `audio_assets` for existing audio
3. If exists -> return storage URL
4. Else:

   * Generate audio using ElevenLabs
   * Upload audio file to storage
   * Insert record into `audio_assets`
   * Return URL

Optional: let caregiver pick “voice style” later, but not needed for MVP.

### 2.7 API endpoints (backend)

Recommended REST endpoints:

**Auth**

* `POST /auth/start` {email}
* `POST /auth/verify` {email, code} -> {token}

**Patients**

* `GET /patients`
* `POST /patients` {name, preferredLanguage}
* `POST /patients/:id/pin` {pinHash}

**People**

* `GET /patients/:id/people`
* `POST /patients/:id/people` {name, relationship} -> {personId}
* `POST /people/:personId/photos` (multipart)
* `POST /people/:personId/voice` (multipart)

**Recognition**

* `POST /patients/:id/sessions` -> {sessionId}
* `POST /sessions/:id/frame` (image) -> {candidates, needsTieBreak}
* `POST /sessions/:id/tiebreak` (image + candidateIds) -> {winnerPersonId, confidence}

**Audio**

* `POST /people/:personId/announcement-audio` {text} -> {audioUrl}

**Logs**

* `POST /patients/:id/logs` {type, metadata, timestamp}
* `GET /patients/:id/logs` (caregiver view)

### 2.8 Security and privacy (baseline)

* Token-based auth
* Only caregiver linked to patient can manage that patient
* Patient mode uses PIN on device; backend only sees patientId/sessionId
* Do not store recognition frames long-term (process and discard)
* Keep logs minimal and opt-in

---

## 3) Deployment plan (hackathon-ready)

### MVP deployment (simple)

* One backend server (FastAPI or Node) deployed on a single host
* One object storage bucket
* One DB (managed Postgres or SQLite if local demo)
* Mobile app points to backend URL

### Reliability notes

* Recognition must feel fast: compress images on client, keep tie-break rare
* Precompute embeddings on enrollment, never during recognition
* Cache announcement audio so repeat is instant

---

## 4) Step-by-step build order (what to implement first)

### Phase 1: “Hello Demo”

1. Caregiver creates patient locally
2. Caregiver adds person with photos
3. Patient captures frame
4. Backend returns a mocked match
5. App plays a mocked audio URL

### Phase 2: Real recognition

1. Implement face detection + embeddings for enrollment photos
2. Store centroids per person
3. Implement matching on recognition frames
4. Add thresholds + not sure behavior

### Phase 3: Tie-break and audio cache

1. Implement Gemini tie-break for close calls
2. Implement ElevenLabs cached audio endpoint
3. Add activity log events

---

## 5) Key thresholds (practical defaults)

* High confidence: similarity >= 0.85
* Medium: 0.70–0.85, confirm
* Low: < 0.70, not sure
* Tie-break trigger: top1 - top2 < 0.08

You can tune based on quick testing in the room.

---


