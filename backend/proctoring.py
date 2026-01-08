import cv2
import numpy as np
from PIL import Image
import io
import mediapipe as mp

# MediaPipe setup
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(max_num_faces=3, refine_landmarks=True, min_detection_confidence=0.7, min_tracking_confidence=0.6)
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

GAZE_YAW_THRESHOLD = 25.0
GAZE_PITCH_UP_THRESHOLD = 15.0
GAZE_PITCH_DOWN_THRESHOLD = -25.0


def load_image(contents: bytes):
    return cv2.cvtColor(np.array(Image.open(io.BytesIO(contents))), cv2.COLOR_BGR2RGB)


def estimate_head_pose(landmarks):
    nose_tip = landmarks[1]
    chin = landmarks[152]
    left_eye_outer = landmarks[33]
    right_eye_outer = landmarks[263]
    forehead = landmarks[10]
    
    eye_center_x = (left_eye_outer.x + right_eye_outer.x) / 2
    eye_width = abs(right_eye_outer.x - left_eye_outer.x)
    
    if eye_width < 0.01:
        return 0.0, 0.0
    
    yaw_offset = (nose_tip.x - eye_center_x) / eye_width
    yaw = yaw_offset * 60.0
    
    face_height = abs(chin.y - forehead.y)
    if face_height < 0.01:
        return yaw, 0.0
    
    nose_relative_y = (nose_tip.y - forehead.y) / face_height
    pitch_offset = (nose_relative_y - 0.55) * 2
    pitch = pitch_offset * 45.0
    
    return yaw, pitch


def analyze_frame(image_rgb, timestamp: int) -> dict:
    results = face_mesh.process(image_rgb)
    face_count = len(results.multi_face_landmarks) if results.multi_face_landmarks else 0
    
    response = {"faces": face_count, "yaw": None, "pitch": None, "flag": None, "timestamp": timestamp}
    
    if face_count == 0:
        response["flag"] = "no_face"
        return response
    
    if face_count > 1:
        response["flag"] = "multiple_faces"
        return response
    
    landmarks = results.multi_face_landmarks[0].landmark
    yaw, pitch = estimate_head_pose(landmarks)
    response["yaw"] = round(yaw, 1)
    response["pitch"] = round(pitch, 1)
    
    if abs(yaw) > GAZE_YAW_THRESHOLD:
        response["flag"] = "gaze_away"
    elif pitch > GAZE_PITCH_UP_THRESHOLD:
        response["flag"] = "gaze_away"
    elif pitch < GAZE_PITCH_DOWN_THRESHOLD:
        response["flag"] = "gaze_away"
    
    return response


def verify_single_face(image_rgb) -> dict:
    gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(80, 80))
    
    if len(faces) == 0:
        return {"success": False, "message": "No face detected"}
    if len(faces) > 1:
        return {"success": False, "message": "Multiple faces detected"}
    
    return {"success": True, "message": "Face verified"}
