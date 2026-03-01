#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ -f ".env" ]]; then
  set -a
  source .env
  set +a
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Missing required command: curl"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Missing required command: python3"
  exit 1
fi

BASE_URL="${BASE_URL:-http://localhost:8000}"
API_BASE_URL="${API_BASE_URL:-${BASE_URL}/v1}"
HEALTH_URL="${HEALTH_URL:-${BASE_URL}/health}"
EMAIL="${TEST_EMAIL:-demo+tts@example.com}"
CODE="${TEST_CODE:-1234}"
PATIENT_NAME="${TEST_PATIENT_NAME:-TTS Demo Patient}"
PERSON_NAME="${TEST_PERSON_NAME:-TTS Demo Person}"
RELATIONSHIP="${TEST_RELATIONSHIP:-friend}"
REGENERATE_FIRST_CALL="${REGENERATE_FIRST_CALL:-true}"

echo "Checking backend: ${HEALTH_URL}"
curl -fsS "${HEALTH_URL}" >/dev/null

echo "Starting auth for ${EMAIL}"
curl -fsS -X POST "${API_BASE_URL}/auth/start" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\"}" >/dev/null

AUTH_JSON="$(curl -fsS -X POST "${API_BASE_URL}/auth/verify" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"code\":\"${CODE}\"}")"

TOKEN="$(printf '%s' "${AUTH_JSON}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')"

PATIENTS_JSON="$(curl -fsS "${API_BASE_URL}/patients" \
  -H "Authorization: Bearer ${TOKEN}")"

PATIENT_ID="$(printf '%s' "${PATIENTS_JSON}" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d[0]["id"] if d else "")')"

if [[ -z "${PATIENT_ID}" ]]; then
  echo "No patients found. Creating one."
  PATIENT_JSON="$(curl -fsS -X POST "${API_BASE_URL}/patients" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${PATIENT_NAME}\",\"language\":\"en\"}")"
  PATIENT_ID="$(printf '%s' "${PATIENT_JSON}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')"
fi

PEOPLE_JSON="$(curl -fsS "${API_BASE_URL}/patients/${PATIENT_ID}/people" \
  -H "Authorization: Bearer ${TOKEN}")"

PERSON_ID="$(printf '%s' "${PEOPLE_JSON}" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d[0]["id"] if d else "")')"

if [[ -z "${PERSON_ID}" ]]; then
  echo "No people found for patient ${PATIENT_ID}. Creating one."
  PERSON_JSON="$(curl -fsS -X POST "${API_BASE_URL}/patients/${PATIENT_ID}/people" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${PERSON_NAME}\",\"relationship\":\"${RELATIONSHIP}\"}")"
  PERSON_ID="$(printf '%s' "${PERSON_JSON}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')"
fi

FIRST_URL="${API_BASE_URL}/people/${PERSON_ID}/announcement-audio"
if [[ "${REGENERATE_FIRST_CALL}" == "true" ]]; then
  FIRST_URL="${FIRST_URL}?regenerate=true"
fi

post_json_with_error_details() {
  local url="$1"
  local tmp_file
  tmp_file="$(mktemp)"
  local code
  code="$(curl -sS -o "${tmp_file}" -w '%{http_code}' -X POST "${url}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json")"
  if [[ "${code}" != "200" && "${code}" != "201" ]]; then
    echo "Request failed (HTTP ${code}) for: ${url}"
    echo "Response body:"
    cat "${tmp_file}"
    rm -f "${tmp_file}"
    exit 1
  fi
  cat "${tmp_file}"
  rm -f "${tmp_file}"
}

echo "Calling announcement endpoint (1st call, regenerate=${REGENERATE_FIRST_CALL})..."
RESP1="$(post_json_with_error_details "${FIRST_URL}")"

echo "Calling announcement endpoint (2nd call)..."
RESP2="$(post_json_with_error_details "${API_BASE_URL}/people/${PERSON_ID}/announcement-audio")"

CACHED1="$(printf '%s' "${RESP1}" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("cached"))')"
CACHED2="$(printf '%s' "${RESP2}" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("cached"))')"
URL="$(printf '%s' "${RESP2}" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("url",""))')"
if [[ -z "${URL}" ]]; then
  echo "Announcement URL is empty"
  exit 1
fi

HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' "${URL}" || true)"
if [[ "${HTTP_CODE}" != "200" && "${HTTP_CODE}" != "206" && "${HTTP_CODE}" != "302" ]]; then
  echo "Announcement URL check failed (HTTP ${HTTP_CODE})"
  echo "URL: ${URL}"
  exit 1
fi

echo
echo "Success."
echo "Patient ID: ${PATIENT_ID}"
echo "Person ID: ${PERSON_ID}"
echo "First cached: ${CACHED1}"
echo "Second cached: ${CACHED2}"
echo "Audio URL: ${URL}"
echo "Audio URL HTTP: ${HTTP_CODE}"
