#!/bin/bash

# Start ngrok and automatically update client API URL
# Usage: ./start-ngrok.sh [port]

PORT="${1:-8000}"
CLIENT_APP_JSON="$(dirname "$0")/client/app.json"

# Kill any existing ngrok processes
pkill -f "ngrok http" 2>/dev/null

echo "Starting ngrok on port $PORT..."

# Start ngrok in the background
ngrok http "$PORT" > /dev/null 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start and get the public URL
echo "Waiting for ngrok to initialize..."
sleep 2

# Get the public URL from ngrok's local API
MAX_RETRIES=10
RETRY=0
NGROK_URL=""

while [ -z "$NGROK_URL" ] && [ $RETRY -lt $MAX_RETRIES ]; do
    NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | \
        python3 -c "import sys, json; data = json.load(sys.stdin); print(data['tunnels'][0]['public_url'] if data.get('tunnels') else '')" 2>/dev/null)

    if [ -z "$NGROK_URL" ]; then
        RETRY=$((RETRY + 1))
        echo "Retrying... ($RETRY/$MAX_RETRIES)"
        sleep 1
    fi
done

if [ -z "$NGROK_URL" ]; then
    echo "Error: Failed to get ngrok URL. Make sure ngrok is properly configured."
    kill $NGROK_PID 2>/dev/null
    exit 1
fi

# Ensure we use HTTPS
NGROK_URL=$(echo "$NGROK_URL" | sed 's/^http:/https:/')

API_BASE_URL="${NGROK_URL}/v1"

echo "ngrok URL: $NGROK_URL"
echo "API Base URL: $API_BASE_URL"

# Update the client's app.json
if [ -f "$CLIENT_APP_JSON" ]; then
    # Use python to update JSON properly
    python3 << EOF
import json

with open("$CLIENT_APP_JSON", "r") as f:
    config = json.load(f)

config["expo"]["extra"]["EXPO_PUBLIC_API_BASE_URL"] = "$API_BASE_URL"

with open("$CLIENT_APP_JSON", "w") as f:
    json.dump(config, f, indent=2)
    f.write("\n")

print("Updated $CLIENT_APP_JSON with new API URL")
EOF
else
    echo "Warning: $CLIENT_APP_JSON not found"
fi

echo ""
echo "ngrok is running (PID: $NGROK_PID)"
echo "Press Ctrl+C to stop ngrok and restore local URL"

# Trap to restore local URL on exit
cleanup() {
    echo ""
    echo "Stopping ngrok..."
    kill $NGROK_PID 2>/dev/null

    # Restore local URL
    if [ -f "$CLIENT_APP_JSON" ]; then
        python3 << EOF
import json

with open("$CLIENT_APP_JSON", "r") as f:
    config = json.load(f)

config["expo"]["extra"]["EXPO_PUBLIC_API_BASE_URL"] = "http://127.0.0.1:8000/v1"

with open("$CLIENT_APP_JSON", "w") as f:
    json.dump(config, f, indent=2)
    f.write("\n")

print("Restored local API URL in $CLIENT_APP_JSON")
EOF
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

# Keep the script running
wait $NGROK_PID
