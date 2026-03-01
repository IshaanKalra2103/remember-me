#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/server"
FRONTEND_DIR="$ROOT_DIR/client"
BACKEND_URL="http://localhost:8000/health"
BACKEND_PORT="8000"
DEV_SESSION="henhacks-dev"
BACKEND_WINDOW="backend"
FRONTEND_WINDOW="frontend"

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

if ! command -v tmux >/dev/null 2>&1; then
  echo "Missing required command: tmux"
  exit 1
fi

if ! command -v lsof >/dev/null 2>&1; then
  echo "Missing required command: lsof"
  exit 1
fi

session_exists() {
  local name="$1"
  tmux has-session -t "${name}" 2>/dev/null
}

ensure_session_not_running() {
  local name="$1"
  if session_exists "${name}"; then
    echo "tmux session '${name}' is already running."
    echo "Run ./scripts/dev-down.sh first, or attach with: tmux attach -t ${name}"
    exit 1
  fi
}

if lsof -tiTCP:"${BACKEND_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port ${BACKEND_PORT} is already in use."
  echo "Run ./scripts/dev-down.sh, or stop the process using that port and retry."
  exit 1
fi

ensure_session_not_running "${DEV_SESSION}"

echo "Starting backend at ${BACKEND_DIR}..."
tmux new-session -d -s "${DEV_SESSION}" -n "${BACKEND_WINDOW}" "cd '${BACKEND_DIR}' && uv run uvicorn main:app --reload --host 0.0.0.0 --port ${BACKEND_PORT}"

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
  echo "Recent backend logs:"
  tmux capture-pane -pt "${DEV_SESSION}:${BACKEND_WINDOW}" -S -25 2>/dev/null || true
  exit 1
fi

echo "Starting frontend web preview at ${FRONTEND_DIR}..."
tmux new-window -t "${DEV_SESSION}:" -n "${FRONTEND_WINDOW}" "cd '${FRONTEND_DIR}' && bun run start-web"

echo "Both services are running."
echo "tmux session: ${DEV_SESSION}"
echo "Windows: ${BACKEND_WINDOW}, ${FRONTEND_WINDOW}"
echo "Attach: tmux attach -t ${DEV_SESSION}"
echo "List sessions: tmux ls"
echo "Stop both: ./scripts/dev-down.sh"
echo "Backend docs: http://localhost:8000/docs"

tmux select-window -t "${DEV_SESSION}:${FRONTEND_WINDOW}"

if [[ -n "${TMUX:-}" ]]; then
  tmux switch-client -t "${DEV_SESSION}"
else
  exec tmux attach -t "${DEV_SESSION}"
fi
