#!/usr/bin/env python3
import argparse
import asyncio
import json
import os
import sys
from typing import Any, Dict, Optional
from urllib.parse import quote_plus

import requests
import websockets


DEFAULT_AGENT_ID = "agent_9801kjjt1x3ferhvtf6xb7nwh0a3"


def pick_name_field(payload: Dict[str, Any]) -> Optional[str]:
    candidates = ["name", "person_name", "person", "full_name", "subject"]
    for key in candidates:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def get_name_from_api(url: str, timeout_seconds: int = 10) -> Optional[str]:
    response = requests.get(url, timeout=timeout_seconds)
    response.raise_for_status()
    data = response.json()

    if isinstance(data, dict):
        return pick_name_field(data)
    return None


def get_name_terminal() -> str:
    while True:
        value = input("Enter person name: ").strip()
        if value:
            return value
        print("Name cannot be empty.")


def build_ws_url(agent_id: str) -> str:
    return f"wss://api.elevenlabs.io/v1/convai/conversation?agent_id={quote_plus(agent_id)}"


async def send_json(ws: websockets.WebSocketClientProtocol, payload: Dict[str, Any]) -> None:
    await ws.send(json.dumps(payload))


async def receiver_loop(ws: websockets.WebSocketClientProtocol) -> None:
    async for raw in ws:
        try:
            event = json.loads(raw)
        except json.JSONDecodeError:
            print(f"[raw] {raw}")
            continue

        event_type = event.get("type")
        if event_type == "agent_response":
            response = event.get("agent_response_event", {}).get("agent_response", "")
            if response:
                print(f"Agent: {response}")
        elif event_type == "user_transcript":
            transcript = event.get("user_transcription_event", {}).get("user_transcript", "")
            if transcript:
                print(f"You (transcribed): {transcript}")
        elif event_type == "ping":
            ping_event = event.get("ping_event", {})
            await send_json(
                ws,
                {
                    "type": "pong",
                    "event_id": ping_event.get("event_id"),
                },
            )
        elif event_type == "error":
            print(f"[error] {event}")


async def sender_loop(ws: websockets.WebSocketClientProtocol) -> None:
    print("Type messages to ask questions. Commands: /disconnect, /exit")
    while True:
        user_text = await asyncio.to_thread(input, "> ")
        text = user_text.strip()
        if not text:
            continue

        if text.lower() in {"/exit", "exit", "quit"}:
            await ws.close()
            return

        if text.lower() in {"/disconnect", "disconnect"}:
            await send_json(ws, {"type": "user_message", "text": "disconnect"})
            await asyncio.sleep(0.2)
            await ws.close()
            return

        await send_json(ws, {"type": "user_message", "text": text})


async def run_session(agent_id: str, person_name: str) -> None:
    ws_url = build_ws_url(agent_id)
    async with websockets.connect(ws_url) as ws:
        await send_json(ws, {"type": "conversation_initiation_client_data"})

        # Seed context so the agent can answer questions about the selected person.
        await send_json(
            ws,
            {
                "type": "contextual_update",
                "text": f"Person selected by user: {person_name}",
            },
        )
        await send_json(ws, {"type": "user_message", "text": person_name})

        receiver = asyncio.create_task(receiver_loop(ws))
        sender = asyncio.create_task(sender_loop(ws))

        done, pending = await asyncio.wait(
            {receiver, sender}, return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
        for task in done:
            exc = task.exception()
            if exc:
                raise exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Terminal bridge for ElevenLabs agent with optional name API fetch."
    )
    parser.add_argument("--agent-id", default=DEFAULT_AGENT_ID, help="ElevenLabs agent id")
    parser.add_argument(
        "--name-api",
        default=None,
        help="Optional HTTP endpoint that returns JSON with a name field",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    person_name: Optional[str] = None
    if args.name_api:
        try:
            person_name = get_name_from_api(args.name_api)
            if person_name:
                print(f"Name from API: {person_name}")
            else:
                print("Could not find a valid name field from API response.")
        except Exception as exc:
            print(f"Name API failed: {exc}")

    if not person_name:
        person_name = get_name_terminal()

    try:
        asyncio.run(run_session(args.agent_id, person_name))
    except KeyboardInterrupt:
        pass
    except Exception as exc:
        print(f"Session failed: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
