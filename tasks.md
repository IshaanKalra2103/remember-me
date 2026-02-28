# RememberMe 24-Hour Hackathon Task Delegation

Team: Ishaan, Saurav, Vibhu, Sathya
Goal: Deliver a backend-complete MVP from `plan.md` (real recognition, tie-break, audio caching, logs, and stable deployment) with the existing app as client.

## Ownership Map

| Person | Primary Ownership | Secondary Ownership |
|---|---|---|
| Ishaan | Backend integration lead, API contracts, release management | Deployment, final bug triage |
| Saurav | Face recognition pipeline (enroll + match + thresholds) | Tie-break logic tuning |
| Vibhu | Backend quality/reliability (tests, load, monitoring, scripts) | DB migrations and tooling |
| Sathya | Core backend services (auth/patients/people/audio/logs/storage) | Security/privacy checks |

## 24-Hour Execution Plan

## Hour 0-1: Kickoff and lock interfaces
- Ishaan: Freeze endpoint contracts and shared types (`Auth`, `Patients`, `People`, `Recognition`, `Audio`, `Logs`).
- All: Confirm backend-first scope only (no frontend feature work).
- Output: shared API doc, migration plan, and task board with owners.

## Hour 1-6: Phase 1 "Hello Demo" in parallel
- Sathya:
  - Implement backend scaffolding + auth/patient/people CRUD endpoints.
  - Set up DB schema and object storage wiring.
- Saurav:
  - Implement face-service skeleton for detect/embed/match.
  - Define threshold config and candidate response schema.
- Vibhu:
  - Build backend test harness: endpoint smoke tests + seeded test data scripts.
  - Add request/response validation and structured logging middleware.
- Ishaan:
  - Wire all modules behind stable API contracts.
  - Own first end-to-end backend flow (mock match + mock audio via API).

## Hour 6-14: Phase 2 real recognition
- Saurav:
  - Implement enrollment processing: detect face, crop, embedding generation, centroid per person.
  - Implement frame recognition endpoint with top-K candidates and confidence.
  - Implement `high / medium / low` confidence behavior + `not sure`.
- Sathya:
  - Connect photo upload endpoints to storage + metadata in DB.
  - Persist embeddings and recognition events.
  - Add session lifecycle endpoints.
- Vibhu:
  - Add integration tests for enrollment, recognition, logs, and auth boundaries.
  - Add migration/version scripts and DB index checks for performance.
  - Build reliability scripts for repeated recognition calls and latency stats.
- Ishaan:
  - Integration testing against existing app and direct API scripts.
  - Fix cross-module contract mismatches quickly.
  - Keep `main` releasable with frequent merges.

## Hour 14-19: Phase 3 tie-break + audio cache
- Saurav:
  - Add tie-break module for close scores (`top1-top2 < threshold`).
  - Return winner + confidence in stable JSON format.
- Sathya:
  - Implement announcement audio endpoint with cache (`text_hash` lookup before generation).
  - Save/reuse generated audio assets from storage.
  - Finalize logs endpoints for caregiver activity view.
- Vibhu:
  - Add failure-path tests (no face, low confidence, tie-break timeout, audio generation failure).
  - Validate observability: request IDs, error codes, and minimal debug dashboard/log views.
- Ishaan:
  - End-to-end validation with existing app: enroll 2-3 people, identify, uncertain case.
  - Measure backend latency and tune quick wins (embedding lookup, tie-break frequency, caching).

## Hour 19-22: Stabilization and demo hardening
- Ishaan + Sathya:
  - Deploy backend + DB + storage, configure env vars/secrets, verify from physical device.
- Vibhu:
  - Run regression suite + load smoke tests and track p95 latency/error rate.
- Saurav:
  - Threshold tuning with local test photos under mixed lighting.
- All:
  - Run full backend script repeatedly until clean.

## Hour 22-24: Pitch and fallback prep
- Ishaan:
  - Own live demo driver and final run order.
- Sathya:
  - Prepare backup demo dataset + backend health checks.
- Vibhu:
  - Prepare one-command backend reset + reseed scripts.
- Saurav:
  - Prepare “how recognition works” 30-second technical explanation for judges.

## P0 Definition of Done (must finish)
- Existing app successfully uses deployed backend for patient + people flows.
- Enroll 2-3 people with photos and embeddings generated server-side.
- Recognition returns top candidate with confidence in real conditions.
- Audio endpoint returns cached or newly generated announcement URL.
- Uncertain case reliably triggers not-sure or tie-break path.
- Logs endpoint records recognition events and can be retrieved for demo.

## Integration Cadence (non-negotiable)
- Merge/checkpoint every 2 hours.
- 10-minute standup at Hour 1, 6, 10, 14, 19, 22.
- No new features after Hour 19 unless a P0 blocker.

## Risk Controls
- If real recognition quality is unstable by Hour 14, lock fallback:
  - keep deterministic top candidate + explicit not-sure messaging.
- If audio generation is slow/fails:
  - use cached or pre-generated clips for enrolled people.
- If deployment is flaky:
  - keep local backup backend and recorded short demo video.
