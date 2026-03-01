#!/usr/bin/env python3
import argparse
import json
import re
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Optional


state_lock = threading.Lock()
state: Dict[str, Optional[str]] = {"name": None, "updated_at": None}
NAME_PATTERN = re.compile(r"^[A-Za-z][A-Za-z .'-]{1,79}$")


def normalize_name(value: str) -> str:
    return " ".join(value.strip().split())


def is_valid_name(value: str) -> bool:
    normalized = normalize_name(value)
    if not normalized:
        return False
    if "http://" in normalized.lower() or "https://" in normalized.lower():
        return False
    if normalized.lower().startswith("curl "):
        return False
    return bool(NAME_PATTERN.fullmatch(normalized))


def set_name(value: str) -> None:
    normalized = normalize_name(value)
    with state_lock:
        state["name"] = normalized or None
        state["updated_at"] = datetime.now(timezone.utc).isoformat()


def get_state() -> Dict[str, Optional[str]]:
    with state_lock:
        return dict(state)


class NameBridgeHandler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: Dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._send_json(200, {"ok": "true"})

    def do_GET(self) -> None:  # noqa: N802
        if self.path in {"/health", "/api/health"}:
            self._send_json(200, {"status": "ok"})
            return
        if self.path in {"/person-name", "/api/person-name"}:
            self._send_json(200, get_state())
            return
        if self.path == "/api/person-name/value":
            current = get_state()
            self._send_json(200, {"name": current.get("name")})
            return
        self._send_json(404, {"error": "Not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path not in {"/person-name", "/api/person-name", "/api/command"}:
            self._send_json(404, {"error": "Not found"})
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON"})
            return

        if self.path == "/api/command":
            command = str(payload.get("command", "")).strip().lower()
            if command != "set_name":
                self._send_json(200, {"accepted": False, "reason": "ignored_non_name_command"})
                return

            name_value = str(payload.get("name", "")).strip()
            if not is_valid_name(name_value):
                self._send_json(422, {"accepted": False, "error": "invalid_name"})
                return

            set_name(name_value)
            self._send_json(200, {"accepted": True, **get_state()})
            return

        name_value = str(payload.get("name", "")).strip()
        if not is_valid_name(name_value):
            self._send_json(422, {"error": "invalid_name"})
            return

        set_name(name_value)
        self._send_json(200, get_state())

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        # Keep terminal output focused on user prompt and updates.
        return


def terminal_loop() -> None:
    print("Name bridge running. Type a name and press Enter to publish it.")
    print("Commands: /show, /quit")
    while True:
        value = input("name> ").strip()
        if not value:
            continue
        lower = value.lower()
        if lower in {"/quit", "quit", "exit"}:
            raise KeyboardInterrupt
        if lower == "/show":
            print(get_state())
            continue
        if value.startswith("/"):
            print("Ignored: unknown command.")
            continue
        if not is_valid_name(value):
            print("Ignored: invalid name format.")
            continue
        set_name(value)
        print(f"Published name: {normalize_name(value)}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Local API endpoint for person name input.")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host")
    parser.add_argument("--port", type=int, default=8081, help="Bind port")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), NameBridgeHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    print(f"Name API available at http://{args.host}:{args.port}/api/person-name")

    try:
        terminal_loop()
    except KeyboardInterrupt:
        print("\nShutting down name bridge...")
    finally:
        server.shutdown()
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
