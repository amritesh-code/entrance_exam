from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import time

from storage import (
    get_student_folder, create_student_folder, init_student_files,
    save_answer_row, save_incident_row, read_answers,
    save_grading_results, save_summary, read_summary, read_grading
)
from grading import (
    grade_mcq, grade_keyword_with_ai_fallback, grade_speaking_with_ai,
    load_rubric, load_question_bank, get_correct_option, get_passage_context
)
from proctoring import load_image, analyze_frame, verify_single_face

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_origin_regex=r"https://.*trycloudflare\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnswerPayload(BaseModel):
    student_id: str
    exam_set: Optional[str] = "A"
    section_id: str
    section_title: Optional[str] = None
    question_id: str
    question_number: Optional[int] = None
    question_prompt: Optional[str] = None
    selected_option: Optional[str] = None
    answer: Optional[str] = None


class IncidentPayload(BaseModel):
    student_id: str
    incident_type: str
    details: Optional[str] = None
    question_context: Optional[str] = None


class StartExamPayload(BaseModel):
    student_id: str


class FinishExamPayload(BaseModel):
    student_id: str


@app.get("/")
def root():
    return {"status": "active", "service": "adira-exam-platform"}


@app.post("/start_exam")
async def start_exam(payload: StartExamPayload):
    student_id = payload.student_id.strip()
    if not student_id:
        raise HTTPException(status_code=400, detail="Student ID required")
    
    folder = create_student_folder(student_id)
    init_student_files(folder)
    return {"success": True, "folder": str(folder.name)}


@app.post("/save_answer")
async def save_answer(payload: AnswerPayload):
    student_id = payload.student_id.strip()
    if not student_id:
        raise HTTPException(status_code=400, detail="Student ID required")
    
    folder = get_student_folder(student_id)
    if not folder:
        folder = create_student_folder(student_id)
    
    subject = "maths" if payload.section_id == "maths-mcq" else "english"
    exam_set = payload.exam_set or "A"
    qb = load_question_bank(subject, exam_set)
    correct_option = get_correct_option(qb, payload.section_id, payload.question_id)
    
    save_answer_row(folder, {
        "student_id": student_id,
        "exam_set": exam_set,
        "subject": subject,
        "section_id": payload.section_id,
        "question_id": payload.question_id,
        "question_number": payload.question_number or "",
        "question_prompt": payload.question_prompt or "",
        "correct_answer": correct_option or "",
        "selected_option": payload.selected_option or "",
        "spoken_answer": payload.answer or ""
    })
    return {"success": True}


@app.post("/save_incident")
async def save_incident(payload: IncidentPayload):
    student_id = payload.student_id.strip()
    if not student_id:
        raise HTTPException(status_code=400, detail="Student ID required")
    
    folder = get_student_folder(student_id)
    if not folder:
        folder = create_student_folder(student_id)
    
    save_incident_row(folder, {
        "incident_type": payload.incident_type,
        "details": payload.details or "",
        "question_context": payload.question_context or ""
    })
    return {"success": True}


@app.post("/save_audio")
async def save_audio(file: UploadFile = File(...), student_id: str = Form(""), question_id: str = Form("")):
    student_id = student_id.strip()
    if not student_id:
        raise HTTPException(status_code=400, detail="Student ID required")
    
    folder = get_student_folder(student_id)
    if not folder:
        folder = create_student_folder(student_id)
    
    audio_file = folder / f"speaking_{question_id}.webm"
    contents = await file.read()
    with open(audio_file, "wb") as f:
        f.write(contents)
    return {"success": True, "file": str(audio_file.name)}


@app.post("/finish_exam")
async def finish_exam(payload: FinishExamPayload):
    student_id = payload.student_id.strip()
    if not student_id:
        raise HTTPException(status_code=400, detail="Student ID required")
    
    folder = get_student_folder(student_id)
    if not folder:
        raise HTTPException(status_code=404, detail="No exam data found for student")
    
    answers = read_answers(folder)
    if not answers:
        return {"success": True, "message": "No answers to grade"}
    
    exam_set = answers[0].get("exam_set", "A")
    rubric = load_rubric("english", exam_set)
    question_bank = load_question_bank("english", exam_set)  # Load set-specific QB for RAG context
    
    grading_results = []
    total_score = 0
    total_max = 0
    
    for ans in answers:
        section_id = ans.get("section_id", "")
        question_id = ans.get("question_id", "")
        selected_option = ans.get("selected_option", "")
        spoken_answer = ans.get("spoken_answer", "")
        correct_answer = ans.get("correct_answer", "")
        question_prompt = ans.get("question_prompt", "")
        
        section_rubric = rubric.get("sections", {}).get(section_id, {})
        question_rubric = section_rubric.get("questions", {}).get(question_id, {})
        grading_type = question_rubric.get("grading_type") or section_rubric.get("grading_type", "auto")
        
        result = {"question_id": question_id, "section_id": section_id, "grading_type": grading_type}
        
        if grading_type == "auto":
            grade = grade_mcq(selected_option, correct_answer)
            result.update(grade)
        elif grading_type == "keyword":
            # RAG: Retrieve passage context for better AI grading
            passage_context = get_passage_context(question_bank, section_id, question_id)
            grade = grade_keyword_with_ai_fallback(spoken_answer, question_rubric, question_prompt, passage_context)
            result.update(grade)
        elif grading_type == "ai_rubric":
            speaking_rubric = section_rubric.get("rubric", {})
            grade = grade_speaking_with_ai(spoken_answer, speaking_rubric, question_prompt)
            result["ai_score"] = grade.get("ai_score")
            result["max_marks"] = grade.get("max_marks", 40)
            result["feedback"] = grade.get("feedback", "")
            result["breakdown"] = grade.get("breakdown", {})
            result["auto_score"] = grade.get("ai_score")
        else:
            if selected_option and correct_answer:
                grade = grade_mcq(selected_option, correct_answer)
            else:
                grade = {"auto_score": 0, "max_marks": 1, "feedback": "Could not grade"}
            result.update(grade)
        
        final_score = result.get("auto_score") or result.get("ai_score") or 0
        result["final_score"] = final_score
        total_score += final_score
        total_max += result.get("max_marks", 1)
        grading_results.append(result)
    
    save_grading_results(folder, grading_results)
    
    summary = {
        "student_id": student_id,
        "exam_set": exam_set,
        "total_score": total_score,
        "total_max": total_max,
        "percentage": round((total_score / total_max * 100), 1) if total_max > 0 else 0,
        "graded_at": datetime.now().isoformat()
    }
    save_summary(folder, summary)
    
    return {"success": True, "total_score": total_score, "total_max": total_max, "percentage": summary["percentage"]}


@app.get("/results/{student_id}")
async def get_results(student_id: str):
    folder = get_student_folder(student_id)
    if not folder:
        raise HTTPException(status_code=404, detail="No results found")
    
    result = {"student_id": student_id}
    summary = read_summary(folder)
    if summary:
        result["summary"] = summary
    grading = read_grading(folder)
    if grading:
        result["grading"] = grading
    return result


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    image_rgb = load_image(await file.read())
    ts = int(time.time() * 1000)
    return analyze_frame(image_rgb, ts)


@app.post("/train_face")
async def train_face(file: UploadFile = File(...), student_id: str = Form("")):
    student_id = student_id.strip()
    if not student_id:
        return {"success": False, "message": "Student ID required"}

    image_rgb = load_image(await file.read())
    result = verify_single_face(image_rgb)
    
    if result["success"]:
        result["message"] = f"Face verified for {student_id}"
        result["timestamp"] = int(time.time() * 1000)
    return result


active_connections = {}

@app.websocket("/heartbeat/{student_id}")
async def websocket_heartbeat(websocket: WebSocket, student_id: str):
    await websocket.accept()
    active_connections[student_id] = {"ws": websocket, "last_ping": time.time()}
    
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                active_connections[student_id]["last_ping"] = time.time()
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        if student_id in active_connections:
            del active_connections[student_id]
