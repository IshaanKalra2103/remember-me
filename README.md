# Remember Me

## Run Frontend + Backend

```bash
./scripts/dev-up.sh
```

This starts:
- FastAPI backend on `http://localhost:8000`
- Expo web frontend from `client/`

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
