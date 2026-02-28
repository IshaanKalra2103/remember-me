#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8000/v1}"
HEALTH_URL="${HEALTH_URL:-http://localhost:8000/health}"
DUMMY_EMAIL="${DUMMY_EMAIL:-demo+$(date +%s)@example.com}"
DUMMY_CODE="${DUMMY_CODE:-1234}"
PATIENT_NAME="${PATIENT_NAME:-Margaret Demo}"
PATIENT_LANGUAGE="${PATIENT_LANGUAGE:-en}"
PATIENT_PIN="${PATIENT_PIN:-1234}"

if ! command -v curl >/dev/null 2>&1; then
  echo "Missing required command: curl"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Missing required command: python3"
  exit 1
fi

echo "Checking backend health..."
curl -fsS "${HEALTH_URL}" >/dev/null

echo "Starting auth for ${DUMMY_EMAIL}..."
curl -fsS -X POST "${API_BASE_URL}/auth/start" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${DUMMY_EMAIL}\"}" >/dev/null

VERIFY_RESPONSE="$(curl -fsS -X POST "${API_BASE_URL}/auth/verify" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${DUMMY_EMAIL}\",\"code\":\"${DUMMY_CODE}\"}")"

TOKEN="$(printf '%s' "${VERIFY_RESPONSE}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"

PATIENT_RESPONSE="$(curl -fsS -X POST "${API_BASE_URL}/patients" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${PATIENT_NAME}\",\"language\":\"${PATIENT_LANGUAGE}\"}")"

PATIENT_ID="$(printf '%s' "${PATIENT_RESPONSE}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"

curl -fsS -X POST "${API_BASE_URL}/patients/${PATIENT_ID}/pin" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"pin\":\"${PATIENT_PIN}\"}" >/dev/null

create_person() {
  local name="$1"
  local relationship="$2"
  curl -fsS -X POST "${API_BASE_URL}/patients/${PATIENT_ID}/people" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${name}\",\"relationship\":\"${relationship}\"}" >/dev/null
}

echo "Creating demo people..."
create_person "Priya Demo" "daughter"
create_person "Alex Demo" "friend"
create_person "Sam Demo" "caregiver"

create_log() {
  local type="$1"
  local person_name="$2"
  local confidence="$3"
  local note="$4"
  curl -fsS -X POST "${API_BASE_URL}/patients/${PATIENT_ID}/logs" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"${type}\",\"personName\":\"${person_name}\",\"confidence\":${confidence},\"note\":\"${note}\"}" >/dev/null
}

echo "Creating demo activity logs..."
create_log "identified" "Priya Demo" "0.93" "Recognized confidently."
create_log "unsure" "Alex Demo" "0.61" "Prompted for confirmation."
create_log "audio_played" "Priya Demo" "0.0" "Played reassurance message."

echo ""
echo "Seed complete."
echo "Email: ${DUMMY_EMAIL}"
echo "Verification code: ${DUMMY_CODE}"
echo "Patient PIN: ${PATIENT_PIN}"
echo "Patient ID: ${PATIENT_ID}"
echo ""
echo "Now open the app and sign in with the email above."
