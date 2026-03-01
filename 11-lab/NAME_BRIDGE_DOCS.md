# Name Bridge Quick Docs

## 1) Run The Python `.sh` File

From the project root:

```bash
cd "/Users/sauravpatel/Desktop/Personal Projects/eleven_sandbox"
./run_name_bridge.sh
```

Expected startup message:

```text
Name API available at http://127.0.0.1:8081/api/person-name
Name bridge running. Type a name and press Enter to publish it.
Commands: /show, /quit
```

Terminal commands while running:

- Type a name (example: `Sarah Johnson`) to publish it
- `/show` to print current state
- `/quit` to stop the bridge

## 2) API Commands (cURL)

Base URL:

```text
http://127.0.0.1:8081
```

### Health check

```bash
curl http://127.0.0.1:8081/api/health
```

### Set name directly

```bash
curl -X POST http://127.0.0.1:8081/api/person-name \
  -H "Content-Type: application/json" \
  -d '{"name":"Sarah Johnson"}'
```

### Set name via command endpoint

```bash
curl -X POST http://127.0.0.1:8081/api/command \
  -H "Content-Type: application/json" \
  -d '{"command":"set_name","name":"Sarah Johnson"}'
```

### Read current state

```bash
curl http://127.0.0.1:8081/api/person-name
```

### Read only current name

```bash
curl http://127.0.0.1:8081/api/person-name/value
```

### Example non-name command (ignored)

```bash
curl -X POST http://127.0.0.1:8081/api/command \
  -H "Content-Type: application/json" \
  -d '{"command":"health_check","text":"curl http://127.0.0.1:8081/api/health"}'
```

Expected behavior: response indicates command ignored, and frontend text box does not update.

## Optional Bash Helper Script

You can use:

```bash
./name_bridge_api.sh
```

Available commands:

```bash
./name_bridge_api.sh health
./name_bridge_api.sh get-name
./name_bridge_api.sh get-state
./name_bridge_api.sh set-name "Sarah Johnson"
./name_bridge_api.sh command set_name "Sarah Johnson"
./name_bridge_api.sh interactive
```

Interactive mode gives a numbered menu so you do not need to type raw `curl`.
