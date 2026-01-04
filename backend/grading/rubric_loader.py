import json
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent.parent.parent
RUBRICS_DIR = BASE_DIR / "rubrics"
QUESTION_BANK_DIR = BASE_DIR / "QuestionBank"


def load_rubric(subject: str, exam_set: str) -> dict:
    rubric_file = RUBRICS_DIR / f"{subject}_set{exam_set}.json"
    if rubric_file.exists():
        with open(rubric_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def load_question_bank(subject: str, exam_set: Optional[str] = None) -> dict:
    """Load question bank for a subject, optionally for a specific exam set.
    
    If exam_set is provided (e.g., 'A', 'B', 'C'), loads {subject}_exam_{exam_set}.json
    Otherwise falls back to {subject}_exam.json for backwards compatibility.
    """
    if exam_set:
        qb_file = QUESTION_BANK_DIR / f"{subject}_exam_{exam_set}.json"
        if qb_file.exists():
            with open(qb_file, "r", encoding="utf-8") as f:
                return json.load(f)
    
    # Fallback to default (for backwards compatibility)
    qb_file = QUESTION_BANK_DIR / f"{subject}_exam.json"
    if qb_file.exists():
        with open(qb_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def get_correct_option(question_bank: dict, section_id: str, question_id: str) -> Optional[str]:
    for section in question_bank.get("sections", []):
        if section.get("id") == section_id:
            for q in section.get("questions", []):
                if q.get("id") == question_id:
                    for opt in q.get("options", []):
                        if opt.get("correct"):
                            return opt.get("key")
    return None


def get_passage_context(question_bank: dict, section_id: str, question_id: str) -> str:
    """RAG: Retrieve the reference passage text for a question"""
    for section in question_bank.get("sections", []):
        if section.get("id") == section_id:
            references = section.get("references", [])
            for q in section.get("questions", []):
                if q.get("id") == question_id:
                    ref_id = q.get("referenceId")
                    if ref_id:
                        for ref in references:
                            if ref.get("id") == ref_id:
                                return f"{ref.get('title', '')}\n\n{ref.get('text', '')}"
                    # If no specific referenceId, return all references for context
                    if references:
                        return "\n\n".join([f"{r.get('title', '')}\n{r.get('text', '')}" for r in references])
    return ""
