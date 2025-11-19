# Adira Proctoring Backend

FastAPI service that backs the entrance exam UI with face detection/verification, heartbeat monitoring, incident logging, and answer script persistence.

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

- `answer_scripts/`  holds CSV exports from `/save_answer`.
- `backend/incident_logs/` captures sanitized proctoring CSVs uploaded through `/save_incidents`.
- `backend/trained_faces/` stores Mediapipe/OpenCV samples plus the LBPH model.

## Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/` | GET | Basic health/status response |
| `/detect` | POST (image) | Haar cascade face count + flags (`no_face`, `multiple_faces`) |
| `/gaze` | POST (image) | Mediapipe face mesh to determine gaze deviation |
| `/train_face` | POST (image+form) | Enroll a student’s face and retrain the LBPH recognizer |
| `/verify_face` | POST (image+form) | Compare live face to trained samples, gated by `student_id` |
| `/heartbeat/{student_id}` | WebSocket | Receives `ping` messages and replies with `pong` while tracking downtime |
| `/status/{student_id}` | GET | Returns latest heartbeat + timeout information |
| `/save_incidents` | POST (CSV+form) | Accepts exported incident sheet and stores only the incident rows |
| `/save_answer` | POST (JSON) | Appends a single Q&A row per call inside `answer_scripts/` |
| `/audio` | POST (file) | Placeholder for future backend transcription |

