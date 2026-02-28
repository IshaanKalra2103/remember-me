# RememberMe Placeholder Backend

This is a placeholder FastAPI backend for the face recognition pipeline.

It provides:
- API route shapes for people enrollment and recognition
- in-memory storage for demo use
- deterministic fake embeddings and matching logic

It does not provide:
- real auth
- real face detection
- real ML embeddings
- persistent database storage
- Gemini or ElevenLabs integration

Run locally after installing dependencies:

```bash
cd server
pip install -r requirements.txt
python run.py
```
