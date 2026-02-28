#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/server"
FRONTEND_DIR="$ROOT_DIR/client"
BACKEND_URL="http://localhost:8000/health"

if ! command -v uv >/dev/null 2>&1; then
  echo "Missing required command: uv"
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "Missing required command: bun"
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Missing required command: curl"
  exit 1
fi

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  local exit_code=$?

  if [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" >/dev/null 2>&1; then
    kill "${FRONTEND_PID}" >/dev/null 2>&1 || true
  fi

  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
    kill "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi

  wait >/dev/null 2>&1 || true
  exit "${exit_code}"
}

trap cleanup EXIT INT TERM

echo "Starting backend at ${BACKEND_DIR}..."
(cd "${BACKEND_DIR}" && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000) &
BACKEND_PID=$!

echo "Waiting for backend health check..."
for _ in $(seq 1 60); do
  if curl -fsS "${BACKEND_URL}" >/dev/null 2>&1; then
    echo "Backend is healthy."
    break
  fi
  sleep 1
done

if ! curl -fsS "${BACKEND_URL}" >/dev/null 2>&1; then
  echo "Backend did not become ready in time."
  exit 1
fi

echo "Starting frontend web preview at ${FRONTEND_DIR}..."
(cd "${FRONTEND_DIR}" && bun run start-web) &
FRONTEND_PID=$!

echo "Both services are running."
echo "Frontend: check the URL printed by Expo in this terminal."
echo "Backend docs: http://localhost:8000/docs"
echo "Press Ctrl+C to stop both."

while kill -0 "${BACKEND_PID}" >/dev/null 2>&1 && kill -0 "${FRONTEND_PID}" >/dev/null 2>&1; do
  sleep 1
done

echo "One of the services exited. Shutting down."
