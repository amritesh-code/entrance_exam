import csv
import json
from pathlib import Path
from datetime import datetime
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent.parent
RESULTS_DIR = BASE_DIR / "results"
RESULTS_DIR.mkdir(exist_ok=True)


def get_student_folder(student_id: str) -> Optional[Path]:
    folders = list(RESULTS_DIR.glob(f"{student_id}_*"))
    if folders:
        return max(folders, key=lambda p: p.stat().st_mtime)
    return None


def create_student_folder(student_id: str) -> Path:
    timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    folder = RESULTS_DIR / f"{student_id}_{timestamp}"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def init_student_files(folder: Path):
    answers_file = folder / "answers.csv"
    incidents_file = folder / "incidents.csv"
    
    with open(answers_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["student_id", "exam_set", "subject", "section_id", "question_id", 
                        "question_number", "question_prompt", "correct_answer", 
                        "selected_option", "spoken_answer"])
    
    with open(incidents_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["incident_type", "details", "question_context"])


def save_answer_row(folder: Path, data: dict):
    answers_file = folder / "answers.csv"
    file_exists = answers_file.exists()
    
    with open(answers_file, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["student_id", "exam_set", "subject", "section_id", "question_id",
                           "question_number", "question_prompt", "correct_answer",
                           "selected_option", "spoken_answer"])
        writer.writerow([
            data.get("student_id", ""),
            data.get("exam_set", "A"),
            data.get("subject", ""),
            data.get("section_id", ""),
            data.get("question_id", ""),
            data.get("question_number", ""),
            data.get("question_prompt", ""),
            data.get("correct_answer", ""),
            data.get("selected_option", ""),
            data.get("spoken_answer", "")
        ])


def save_incident_row(folder: Path, data: dict):
    incidents_file = folder / "incidents.csv"
    file_exists = incidents_file.exists()
    
    with open(incidents_file, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["incident_type", "details", "question_context"])
        writer.writerow([
            data.get("incident_type", ""),
            data.get("details", ""),
            data.get("question_context", "")
        ])


def read_answers(folder: Path) -> list:
    answers_file = folder / "answers.csv"
    if not answers_file.exists():
        return []
    
    with open(answers_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def save_grading_results(folder: Path, results: list):
    grading_file = folder / "grading.csv"
    with open(grading_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["question_id", "section_id", "grading_type", "max_marks", 
                        "auto_score", "ai_score", "final_score", "feedback"])
        for r in results:
            writer.writerow([
                r.get("question_id"),
                r.get("section_id"),
                r.get("grading_type"),
                r.get("max_marks"),
                r.get("auto_score"),
                r.get("ai_score"),
                r.get("final_score"),
                r.get("feedback", "")
            ])


def save_summary(folder: Path, summary: dict):
    summary_file = folder / "summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)


def read_summary(folder: Path) -> Optional[dict]:
    summary_file = folder / "summary.json"
    if summary_file.exists():
        with open(summary_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def read_grading(folder: Path) -> list:
    grading_file = folder / "grading.csv"
    if grading_file.exists():
        with open(grading_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            return list(reader)
    return []
