#!/usr/bin/env bash
set -euo pipefail

DEV_SESSION="henhacks-dev"
BACKEND_SESSION="henhacks-backend"
FRONTEND_SESSION="henhacks-frontend"
PORTS=(8000 8081 19000 19001 19002 19006)

if ! command -v tmux >/dev/null 2>&1; then
  echo "Missing required command: tmux"
  exit 1
fi

if ! command -v lsof >/dev/null 2>&1; then
  echo "Missing required command: lsof"
  exit 1
fi

kill_session_if_exists() {
  local name="$1"
  if tmux has-session -t "${name}" 2>/dev/null; then
    tmux kill-session -t "${name}"
    echo "Stopped tmux session: ${name}"
  else
    echo "tmux session not running: ${name}"
  fi
}

kill_listeners_on_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    # shellcheck disable=SC2086
    kill ${pids} >/dev/null 2>&1 || true
    echo "Stopped listener(s) on port ${port}: ${pids}"
  fi
}

kill_session_if_exists "${DEV_SESSION}"
kill_session_if_exists "${BACKEND_SESSION}"
kill_session_if_exists "${FRONTEND_SESSION}"

for port in "${PORTS[@]}"; do
  kill_listeners_on_port "${port}"
done

echo "Done."
