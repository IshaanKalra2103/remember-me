# Remember Me

## Run Frontend + Backend

```bash
./scripts/dev-up.sh
```

This starts a `tmux` session and attaches you to it:
- FastAPI backend on `http://localhost:8000`
- Expo web frontend from `client/`

Useful commands:

```bash
tmux ls
tmux attach -t henhacks-dev
./scripts/dev-down.sh
```

Backend docs:
- `http://localhost:8000/docs`

## Seed Dummy Data

With backend running, seed demo data:

```bash
./scripts/seed-demo.sh
```

The script prints:
- caregiver email to sign in with
- verification code (default `1234`)
- patient PIN (default `1234`)

## Optional Frontend API Base Override

Set this in the shell before launching frontend if needed:

```bash
export EXPO_PUBLIC_API_BASE_URL="http://localhost:8000/v1"
```
