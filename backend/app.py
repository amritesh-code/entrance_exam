from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect, Form
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
from PIL import Image
import io
import time
import mediapipe as mp

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mp_face_detection = mp.solutions.face_detection
mp_face_mesh = mp.solutions.face_mesh
face_detection = mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.3)
face_mesh = mp_face_mesh.FaceMesh(max_num_faces=2, refine_landmarks=True, min_detection_confidence=0.2, min_tracking_confidence=0.2)

def load_image(contents):
    return cv2.cvtColor(np.array(Image.open(io.BytesIO(contents))), cv2.COLOR_BGR2RGB)

@app.get("/")
def root():
    return {"status": "active", "service": "adira-proctoring"}

@app.post("/detect")
async def detect_faces(file: UploadFile = File(...)):
    image_rgb = load_image(await file.read())
    results = face_detection.process(image_rgb)
    
    face_count = 0
    confidence_scores = []
    if results.detections:
        face_count = len(results.detections)
        confidence_scores = [d.score[0] for d in results.detections]
    
    flag = None
    if face_count == 0:
        flag = "no_face"
    elif face_count > 1:
        flag = "multiple_faces"
    
    print(f"Face detection: {face_count} faces, confidence: {confidence_scores}, flag: {flag}")
    
    return {
        "faces": face_count,
        "flag": flag,
        "timestamp": int(time.time() * 1000)
    }

@app.post("/gaze")
async def check_gaze(file: UploadFile = File(...)):
    image_rgb = load_image(await file.read())
    results = face_mesh.process(image_rgb)
    
    if not results.multi_face_landmarks:
        return {"gaze_valid": False, "deviation": None, "flag": "no_face_mesh", "timestamp": int(time.time() * 1000)}
    
    landmarks = results.multi_face_landmarks[0].landmark
    
    nose_tip = landmarks[1]
    chin = landmarks[152]
    left_eye = landmarks[33]
    right_eye = landmarks[263]
    left_mouth = landmarks[61]
    right_mouth = landmarks[291]
    
    face_center_x = (left_eye.x + right_eye.x) / 2
    face_center_y = (left_eye.y + right_eye.y) / 2
    
    horizontal_deviation = abs(nose_tip.x - face_center_x) * 100
    vertical_deviation = abs(nose_tip.y - face_center_y) * 100
    
    mouth_center_x = (left_mouth.x + right_mouth.x) / 2
    face_tilt = abs(mouth_center_x - face_center_x) * 100
    
    total_deviation = horizontal_deviation + vertical_deviation + face_tilt
    
    gaze_valid = total_deviation < 9
    flag = None if gaze_valid else "gaze_away"
    print(f"Gaze: h={horizontal_deviation:.1f}, v={vertical_deviation:.1f}, tilt={face_tilt:.1f}, total={total_deviation:.1f}, valid={gaze_valid}")
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

import os
import pickle
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
face_recognizer = cv2.face.LBPHFaceRecognizer_create()
known_faces = {}
training_dir = "trained_faces"

if not os.path.exists(training_dir):
    os.makedirs(training_dir)

model_file = os.path.join(training_dir, "face_model.yml")
names_file = os.path.join(training_dir, "face_names.pkl")

if os.path.exists(model_file) and os.path.exists(names_file):
    try:
        face_recognizer.read(model_file)
        with open(names_file, "rb") as f:
            known_faces = pickle.load(f)
    except:
        pass

@app.post("/train_face")
async def train_face(file: UploadFile = File(...), student_id: str = Form("")):
    if not student_id or student_id.strip() == "":
        return {"success": False, "message": "Student ID required"}
    
    gray = cv2.cvtColor(np.array(Image.open(io.BytesIO(await file.read()))), cv2.COLOR_BGR2GRAY)
    
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)
    
    if len(faces) == 0:
        return {"success": False, "message": "No face detected"}
    
    if len(faces) > 1:
        return {"success": False, "message": "Multiple faces detected"}
    
    x, y, w, h = faces[0]
    face_roi = cv2.resize(gray[y:y+h, x:x+w], (200, 200))
    
    label = len(known_faces)
    known_faces[label] = student_id
    
    if os.path.exists(model_file):
        face_recognizer.update([face_roi], np.array([label]))
    else:
        face_recognizer.train([face_roi], np.array([label]))
    
    face_recognizer.save(model_file)
    with open(names_file, "wb") as f:
        pickle.dump(known_faces, f)
    
    return {"success": True, "message": f"Face registered for {student_id}", "timestamp": int(time.time() * 1000)}

@app.post("/save_incidents")
async def save_incidents(file: UploadFile = File(...), student_id: str = Form("")):
    if not student_id:
        return {"success": False, "message": "Student ID required"}
    
    logs_dir = "incident_logs"
    os.makedirs(logs_dir, exist_ok=True)
    
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = os.path.join(logs_dir, f"{student_id}_{timestamp}.csv")
    
    with open(filepath, "wb") as f:
        f.write(await file.read())
    
    return {"success": True, "message": "Incidents logged successfully", "filepath": filepath, "timestamp": int(time.time() * 1000)}
