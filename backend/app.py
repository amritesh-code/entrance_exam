from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import cv2
import numpy as np
from PIL import Image
import io
import time
import mediapipe as mp
import os
import pickle
from pathlib import Path
from datetime import datetime
from threading import Lock
from typing import Optional
import csv
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_origin_regex=r"https://.*trycloudflare\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mp_face_detection = mp.solutions.face_detection
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(max_num_faces=2, refine_landmarks=False, min_detection_confidence=0.5, min_tracking_confidence=0.5)

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

BASE_DIR = Path(__file__).resolve().parent.parent
TRAINING_DIR = Path("trained_faces")
SAMPLES_DIR = TRAINING_DIR / "samples"
MODEL_FILE = TRAINING_DIR / "face_model.yml"
LABELS_FILE = TRAINING_DIR / "face_labels.pkl"
LBPH_CONFIDENCE_THRESHOLD = 60.0
ANSWER_SCRIPTS_DIR = BASE_DIR / "answer_scripts"

TRAINING_DIR.mkdir(exist_ok=True)
SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
ANSWER_SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

recognizer_lock = Lock()
face_recognizer = cv2.face.LBPHFaceRecognizer_create(radius=2, neighbors=12, grid_x=8, grid_y=8)
label_mapping = {
    "label_to_student": {},
    "student_to_label": {}
}
recognizer_ready = False


class AnswerPayload(BaseModel):
    student_id: str
    attempt_id: Optional[str] = None
    section_id: str
    section_title: Optional[str] = None
    question_number: Optional[int] = None
    question_id: str
    question: str
    answer: Optional[str] = None
    accuracy: Optional[float] = None
    clarity: Optional[float] = None
    feedback: Optional[str] = None
    timestamp: Optional[float] = None

if LABELS_FILE.exists():
    try:
        with open(LABELS_FILE, "rb") as f:
            loaded_mapping = pickle.load(f)
            raw_label_map = loaded_mapping.get("label_to_student", {})
            label_mapping["label_to_student"] = {int(k): v for k, v in raw_label_map.items()}
            label_mapping["student_to_label"] = loaded_mapping.get("student_to_label", {})
    except Exception:
        label_mapping = {
            "label_to_student": {},
            "student_to_label": {}
        }

def _save_label_mapping():
    with open(LABELS_FILE, "wb") as f:
        pickle.dump(label_mapping, f)

def _get_or_create_label(student_id: str) -> int:
    if student_id in label_mapping["student_to_label"]:
        return label_mapping["student_to_label"][student_id]
    next_label = max(label_mapping["label_to_student"].keys(), default=-1) + 1
    label_mapping["label_to_student"][next_label] = student_id
    label_mapping["student_to_label"][student_id] = next_label
    return next_label

def _preprocess_face(gray_frame, face_bbox):
    x, y, w, h = face_bbox
    pad_w = int(w * 0.15)
    pad_h = int(h * 0.15)
    x0 = max(x - pad_w, 0)
    y0 = max(y - pad_h, 0)
    x1 = min(x + w + pad_w, gray_frame.shape[1])
    y1 = min(y + h + pad_h, gray_frame.shape[0])
    roi = gray_frame[y0:y1, x0:x1]
    roi = cv2.resize(roi, (200, 200))
    roi = cv2.equalizeHist(roi)
    roi = cv2.GaussianBlur(roi, (3, 3), 0)
    return roi

def _store_face_sample(student_id: str, face_roi: np.ndarray) -> Path:
    student_dir = SAMPLES_DIR / student_id
    student_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')}.png"
    file_path = student_dir / filename
    cv2.imwrite(str(file_path), face_roi)
    return file_path

def _collect_training_data():
    images = []
    labels = []
    for student_dir in SAMPLES_DIR.iterdir():
        if not student_dir.is_dir():
            continue
        student_id = student_dir.name
        label = _get_or_create_label(student_id)
        for image_path in student_dir.glob("*.png"):
            img = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
            if img is None:
                continue
            images.append(img)
            labels.append(label)
    return images, labels

def _retrain_recognizer() -> int:
    global recognizer_ready
    with recognizer_lock:
        images, labels = _collect_training_data()
        if not images:
            recognizer_ready = False
            return 0
        face_recognizer.train(images, np.array(labels))
        face_recognizer.write(str(MODEL_FILE))
        _save_label_mapping()
        recognizer_ready = True
        return len(images)

def _count_samples(student_id: str) -> int:
    student_dir = SAMPLES_DIR / student_id
    if not student_dir.exists():
        return 0
    return len(list(student_dir.glob("*.png")))

if MODEL_FILE.exists() and LABELS_FILE.exists():
    try:
        face_recognizer.read(str(MODEL_FILE))
        recognizer_ready = True
    except cv2.error:
        recognizer_ready = False

def load_image(contents):
    return cv2.cvtColor(np.array(Image.open(io.BytesIO(contents))), cv2.COLOR_BGR2RGB)


def _sanitize_filename_segment(value: str, fallback: str = "value") -> str:
    text = (value or "").strip()
    if not text:
        return fallback
    safe = ''.join(ch if ch.isalnum() or ch in ('-', '_') else '-' for ch in text)
    safe = safe.strip('-_')
    return safe or fallback


def _extract_incident_section(csv_text: str) -> str:
    if not csv_text:
        return ""
    normalized = csv_text.replace('\ufeff', '')
    marker = "PROCTORING INCIDENTS"
    idx = normalized.find(marker)
    if idx == -1:
        return normalized.strip()
    trimmed = normalized[idx:]
    return trimmed.strip()

@app.get("/")
def root():
    return {"status": "active", "service": "adira-proctoring"}

@app.post("/detect")
async def detect_faces(file: UploadFile = File(...)):
    image_rgb = load_image(await file.read())
    gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=5, minSize=(60, 60))
    face_count = len(faces)
    flag = None
    if face_count == 0:
        flag = "no_face"
    elif face_count > 1:
        flag = "multiple_faces"
    print(f"[Haar] {face_count} faces, flag: {flag}")
    return {"faces": face_count, "flag": flag, "timestamp": int(time.time() * 1000)}

@app.post("/gaze")
async def check_gaze(file: UploadFile = File(...)):
    image_rgb = load_image(await file.read())
    results = face_mesh.process(image_rgb)
    if not results.multi_face_landmarks:
        print("[Gaze] No face mesh")
        return {"gaze_valid": False, "deviation": None, "flag": "no_face_mesh", "timestamp": int(time.time() * 1000)}
    landmarks = results.multi_face_landmarks[0].landmark
    nose_tip = landmarks[1]
    left_eye_inner = landmarks[133]
    right_eye_inner = landmarks[362]
    left_eye_outer = landmarks[33]
    right_eye_outer = landmarks[263]
    face_center_x = (left_eye_inner.x + right_eye_inner.x + left_eye_outer.x + right_eye_outer.x) / 4
    face_center_y = (left_eye_inner.y + right_eye_inner.y + left_eye_outer.y + right_eye_outer.y) / 4
    horizontal_deviation = abs(nose_tip.x - face_center_x) * 100
    vertical_deviation = abs(nose_tip.y - face_center_y) * 100
    total_deviation = horizontal_deviation + vertical_deviation
    gaze_valid = total_deviation < 12
    flag = None if gaze_valid else "gaze_away"
    print(f"[Gaze] h={horizontal_deviation:.1f}, v={vertical_deviation:.1f}, dev={total_deviation:.1f}, ok={gaze_valid}")
    return {"gaze_valid": gaze_valid, "deviation": round(total_deviation, 2), "flag": flag, "timestamp": int(time.time() * 1000)}

active_connections = {}

@app.websocket("/heartbeat/{student_id}")
async def websocket_heartbeat(websocket: WebSocket, student_id: str):
    await websocket.accept()
    active_connections[student_id] = {
        "ws": websocket,
        "last_ping": time.time()
    }
    
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                active_connections[student_id]["last_ping"] = time.time()
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        if student_id in active_connections:
            del active_connections[student_id]

@app.get("/status/{student_id}")
def check_connection_status(student_id: str):
    if student_id not in active_connections:
        return {"connected": False, "downtime": None}
    elapsed = time.time() - active_connections[student_id]["last_ping"]
    if elapsed > 10:
        return {"connected": False, "downtime": round(elapsed, 2), "flag": "connectivity_timeout"}
    return {"connected": True, "downtime": 0}

@app.post("/audio")
async def analyze_audio(file: UploadFile = File(...)):
    return {"message": "Audio analysis not yet implemented", "timestamp": int(time.time() * 1000)}

@app.post("/train_face")
async def train_face(file: UploadFile = File(...), student_id: str = Form("")):
    student_id = student_id.strip()
    if not student_id:
        return {"success": False, "message": "Student ID required"}

    image_rgb = load_image(await file.read())
    gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(80, 80))

    if len(faces) == 0:
        return {"success": False, "message": "No face detected"}
    if len(faces) > 1:
        return {"success": False, "message": "Multiple faces detected"}

    face_roi = _preprocess_face(gray, tuple(faces[0]))
    _store_face_sample(student_id, face_roi)
    total_samples = _retrain_recognizer()
    student_samples = _count_samples(student_id)

    return {
        "success": True,
        "message": f"Face registered for {student_id}",
        "samples_for_student": student_samples,
        "total_samples": total_samples,
        "timestamp": int(time.time() * 1000)
    }

@app.post("/verify_face")
async def verify_face(file: UploadFile = File(...), student_id: str = Form("")):
    if not recognizer_ready or not LABELS_FILE.exists() or not MODEL_FILE.exists():
        return {"success": False, "message": "Face recognizer is not trained yet"}

    image_rgb = load_image(await file.read())
    gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(80, 80))

    if len(faces) == 0:
        return {"success": False, "message": "No face detected", "flag": "no_face"}
    if len(faces) > 1:
        return {"success": False, "message": "Multiple faces detected", "flag": "multiple_faces"}

    face_roi = _preprocess_face(gray, tuple(faces[0]))

    with recognizer_lock:
        try:
            label, confidence = face_recognizer.predict(face_roi)
        except cv2.error as err:
            return {"success": False, "message": f"Recognizer error: {err}"}

    predicted_student = label_mapping["label_to_student"].get(label)
    confidence_score = round(float(confidence), 2)
    match = predicted_student is not None and confidence_score <= LBPH_CONFIDENCE_THRESHOLD
    provided_id = student_id.strip()
    if provided_id:
        match = match and (predicted_student == provided_id)

    response = {
        "success": match,
        "predicted_student": predicted_student,
        "confidence": confidence_score,
        "threshold": LBPH_CONFIDENCE_THRESHOLD,
        "timestamp": int(time.time() * 1000)
    }

    if provided_id:
        response["student_id"] = provided_id
        if not match:
            response["message"] = "Face does not match registered student"
    else:
        response["message"] = "No student_id provided; returning best match"

    return response

@app.post("/save_incidents")
async def save_incidents(file: UploadFile = File(...), student_id: str = Form("")):
    if not student_id:
        return {"success": False, "message": "Student ID required"}
    
    logs_dir = "incident_logs"
    os.makedirs(logs_dir, exist_ok=True)
    
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = os.path.join(logs_dir, f"{student_id}_{timestamp}.csv")
    
    contents = await file.read()
    try:
        text = contents.decode("utf-8")
    except UnicodeDecodeError:
        text = contents.decode("utf-8", errors="ignore")

    incidents_only = _extract_incident_section(text)
    if not incidents_only.strip():
        incidents_only = "PROCTORING INCIDENTS\nStudent ID,Incident Type,Timestamp (IST),Details\n"

    if not incidents_only.endswith("\n"):
        incidents_only += "\n"

    with open(filepath, "wb") as f:
        f.write(incidents_only.encode("utf-8"))
    
    return {"success": True, "message": "Incidents logged successfully", "filepath": filepath, "timestamp": int(time.time() * 1000)}


@app.post("/save_answer")
async def save_answer(payload: AnswerPayload):
    student_id = (payload.student_id or "").strip()
    if not student_id:
        return {"success": False, "message": "Student ID required"}

    attempt_fallback = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    attempt_id = payload.attempt_id or attempt_fallback
    safe_attempt = _sanitize_filename_segment(attempt_id, attempt_fallback)
    safe_student = _sanitize_filename_segment(student_id, "student")
    section_hint = payload.section_id or payload.section_title or "section"
    safe_section = _sanitize_filename_segment(section_hint, "section")
    student_prefix = f"{safe_student}_"
    if safe_attempt.startswith(student_prefix):
        trimmed = safe_attempt[len(student_prefix):].strip('-_')
        safe_attempt = trimmed or safe_attempt
    filename = f"{safe_student}_{safe_section}_{safe_attempt}.csv"
    file_path = ANSWER_SCRIPTS_DIR / filename

    record = {
        "Student": student_id,
        "Section": payload.section_title or payload.section_id,
        "Question Number": payload.question_number if payload.question_number is not None else "",
        "Answer": payload.answer or ""
    }

    file_exists = file_path.exists()
    fieldnames = ["Student", "Section", "Question Number", "Answer"]

    with file_path.open("a", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerow(record)

    return {
        "success": True,
        "message": "Answer stored successfully",
        "filepath": str(file_path),
        "timestamp": int(time.time() * 1000)
    }
