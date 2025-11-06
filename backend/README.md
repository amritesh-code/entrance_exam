# Adira Proctoring Backend

FastAPI backend for advanced proctoring features using Mediapipe and OpenCV.

## Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app:app --reload --port 8000
```

## Endpoints

- `GET /` - Health check
- `POST /detect` - Face detection (returns face count)
- `POST /gaze` - Gaze tracking (checks deviation)
- `WS /heartbeat/{student_id}` - WebSocket connection monitoring
- `GET /status/{student_id}` - Check connection status

