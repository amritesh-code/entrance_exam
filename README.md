# Adira Entrance (React + FastAPI backend)

Modular React/Vite frontend with Tailwind plus a FastAPI proctoring backend for face recognition, heartbeat monitoring, incident storage, and CSV answer scripts.

## Frontend quick start

```bash
# Install dependencies
npm install

# Run Vite dev server (port 5173 by default)
npm run dev

# Build + preview for production
npm run build
npm run preview
```

## Backend quick start

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Key endpoints include:

- `/detect`, `/gaze` – frame uploads for face count and gaze deviation via Mediapipe.
- `/train_face`, `/verify_face` – LBPH enrollment/verification with persistent samples in `backend/trained_faces/samples/`.
- `/heartbeat/{student_id}` (WebSocket) + `/status/{student_id}` – live connectivity monitoring.
- `/save_incidents` – stores sanitized CSVs inside `backend/incident_logs/`.
- `/save_answer` – appends per-question responses inside `answer_scripts/` (git-ignored).
