#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${NAME_BRIDGE_BASE_URL:-http://127.0.0.1:8081}"

usage() {
  cat <<'EOF'
Usage:
  ./name_bridge_api.sh health
  ./name_bridge_api.sh get-name
  ./name_bridge_api.sh get-state
  ./name_bridge_api.sh set-name "Sarah Johnson"
  ./name_bridge_api.sh command set_name "Sarah Johnson"
  ./name_bridge_api.sh interactive

Optional env var:
  NAME_BRIDGE_BASE_URL (default: http://127.0.0.1:8081)
EOF
}

health() {
  curl -sS "${BASE_URL}/api/health"
  echo
}

get_name() {
  curl -sS "${BASE_URL}/api/person-name/value"
  echo
}

get_state() {
  curl -sS "${BASE_URL}/api/person-name"
  echo
}

set_name() {
  local name="${1:-}"
  if [[ -z "${name}" ]]; then
    echo "Error: set-name requires a name string."
    exit 1
  fi
  curl -sS -X POST "${BASE_URL}/api/person-name" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${name//\"/\\\"}\"}"
  echo
}

send_command() {
  local command="${1:-}"
  local name="${2:-}"
  if [[ -z "${command}" ]]; then
    echo "Error: command requires at least a command string."
    exit 1
  fi
  if [[ -n "${name}" ]]; then
    curl -sS -X POST "${BASE_URL}/api/command" \
      -H "Content-Type: application/json" \
      -d "{\"command\":\"${command//\"/\\\"}\",\"name\":\"${name//\"/\\\"}\"}"
  else
    curl -sS -X POST "${BASE_URL}/api/command" \
      -H "Content-Type: application/json" \
      -d "{\"command\":\"${command//\"/\\\"}\"}"
  fi
  echo
}

interactive() {
  while true; do
    cat <<'EOF'

Name Bridge API Menu
1) Health
2) Get Name
3) Get State
4) Set Name
5) Send Command
6) Exit
EOF
    read -r -p "Choose [1-6]: " choice
    case "${choice}" in
      1) health ;;
      2) get_name ;;
      3) get_state ;;
      4)
        read -r -p "Enter name: " name
        set_name "${name}"
        ;;
      5)
        read -r -p "Enter command: " cmd
        read -r -p "Enter name (optional): " name
        send_command "${cmd}" "${name}"
        ;;
      6) exit 0 ;;
      *) echo "Invalid choice." ;;
    esac
  done
}

main() {
  local action="${1:-}"
  case "${action}" in
    health) health ;;
    get-name) get_name ;;
    get-state) get_state ;;
    set-name) shift; set_name "${1:-}" ;;
    command) shift; send_command "${1:-}" "${2:-}" ;;
    interactive) interactive ;;
    ""|-h|--help|help) usage ;;
    *)
      echo "Unknown action: ${action}"
      usage
      exit 1
      ;;
  esac
}

main "$@"
