import os
import json
import re
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

groq_client = None
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if GROQ_API_KEY:
    groq_client = Groq(api_key=GROQ_API_KEY)


def grade_mcq(selected_option: str, correct_option: str) -> dict:
    is_correct = selected_option and correct_option and selected_option.upper() == correct_option.upper()
    return {
        "auto_score": 1 if is_correct else 0,
        "max_marks": 1,
        "feedback": "Correct" if is_correct else f"Incorrect. Correct answer: {correct_option}"
    }


def grade_keyword(answer: str, rubric_config: dict) -> dict:
    if not answer:
        return {"auto_score": 0, "max_marks": rubric_config.get("max_marks", 1), "feedback": "No answer provided"}
    
    answer_lower = answer.lower()
    total_score = 0
    max_marks = rubric_config.get("max_marks", 1)
    feedback_parts = []
    
    for idea in rubric_config.get("ideas", []):
        idea_marks = idea.get("marks", 1)
        required_any = idea.get("required_any", [])
        banned = idea.get("banned", [])
        supporting = idea.get("supporting", [])
        
        has_banned = any(b.lower() in answer_lower for b in banned if b)
        if has_banned:
            feedback_parts.append(f"[{idea.get('id')}] Contains misconception - 0 marks")
            continue
        
        has_required = any(r.lower() in answer_lower for r in required_any if r)
        if has_required:
            score = idea_marks
            supporting_count = sum(1 for s in supporting if s and s.lower() in answer_lower)
            if supporting_count > 0:
                score = min(score + 0.25, idea_marks)
            total_score += score
            feedback_parts.append(f"[{idea.get('id')}] Matched - {score} marks")
        else:
            feedback_parts.append(f"[{idea.get('id')}] Not matched - 0 marks")
    
    return {
        "auto_score": min(total_score, max_marks),
        "max_marks": max_marks,
        "feedback": "; ".join(feedback_parts) if feedback_parts else "Graded by keyword matching"
    }


def grade_speaking_with_ai(answer: str, rubric: dict, question_prompt: str) -> dict:
    if not groq_client:
        return {"ai_score": None, "max_marks": 40, "feedback": "AI grading unavailable - API key not configured"}
    
    if not answer or len(answer.strip()) < 10:
        return {"ai_score": 0, "max_marks": 40, "feedback": "Response too short to evaluate"}
    
    rubric_text = ""
    for category, config in rubric.items():
        rubric_text += f"\n{category.upper()} (max {config['max']} marks):\n"
        for level in config.get("levels", []):
            rubric_text += f"  Level {level['level']} ({level['marks']} marks): {level['description']}\n"
    
    prompt = f"""You are an English language examiner. Grade the following spoken response using ONLY the rubric provided.

QUESTION/PROMPT:
{question_prompt}

STUDENT'S RESPONSE:
{answer}

GRADING RUBRIC:
{rubric_text}

Instructions:
1. Evaluate the response for each category: grammar, vocabulary, development, pronunciation
2. For pronunciation, since this is a transcript, evaluate based on word choice clarity and sentence structure
3. Assign a specific mark within each level range based on how well the response meets the criteria
4. Be fair but strict - award marks only where criteria are clearly met

Respond in this exact JSON format:
{{"grammar": {{"score": <number 0-10>, "level": <1-5>, "reason": "<brief explanation>"}}, "vocabulary": {{"score": <number 0-10>, "level": <1-5>, "reason": "<brief explanation>"}}, "development": {{"score": <number 0-10>, "level": <1-5>, "reason": "<brief explanation>"}}, "pronunciation": {{"score": <number 0-10>, "level": <1-5>, "reason": "<brief explanation>"}}, "total": <sum of all scores>, "overall_feedback": "<2-3 sentence summary>"}}"""

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=1000
        )
        
        result_text = response.choices[0].message.content
        json_match = re.search(r'\{[\s\S]*\}', result_text)
        if json_match:
            result = json.loads(json_match.group())
            return {
                "ai_score": result.get("total", 0),
                "max_marks": 40,
                "feedback": result.get("overall_feedback", ""),
                "breakdown": {
                    "grammar": result.get("grammar", {}),
                    "vocabulary": result.get("vocabulary", {}),
                    "development": result.get("development", {}),
                    "pronunciation": result.get("pronunciation", {})
                }
            }
    except Exception as e:
        return {"ai_score": None, "max_marks": 40, "feedback": f"AI grading error: {str(e)}"}
    
    return {"ai_score": None, "max_marks": 40, "feedback": "Could not parse AI response"}


def grade_keyword_with_ai_fallback(answer: str, rubric_config: dict, question_prompt: str, passage_context: str = "") -> dict:
    keyword_result = grade_keyword(answer, rubric_config)
    
    if keyword_result["auto_score"] > 0:
        return keyword_result
    
    # AI fallback with RAG - include passage context for better grading
    if groq_client and answer and len(answer.strip()) > 5:
        max_marks = rubric_config.get("max_marks", 1)
        ideas_desc = "\n".join([
            f"- {idea.get('id')}: Award {idea.get('marks')} mark(s) if answer contains any of: {', '.join(idea.get('required_any', []))}"
            for idea in rubric_config.get("ideas", [])
        ])
        
        # RAG: Include passage context if available
        context_section = ""
        if passage_context:
            context_section = f"""
REFERENCE PASSAGE (use this to verify the student's answer):
{passage_context}
"""
        
        prompt = f"""Grade this student answer. Be strict but fair. The answer must be based on information from the reference passage.
{context_section}
Question: {question_prompt}
Student Answer: {answer}
Max Marks: {max_marks}

Grading Criteria:
{ideas_desc}

Respond with JSON only:
{{"score": <number 0 to {max_marks}>, "feedback": "<brief explanation>"}}"""

        try:
            response = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=200
            )
            result_text = response.choices[0].message.content
            json_match = re.search(r'\{[\s\S]*?\}', result_text)
            if json_match:
                result = json.loads(json_match.group())
                return {
                    "auto_score": min(result.get("score", 0), max_marks),
                    "max_marks": max_marks,
                    "feedback": f"[AI] {result.get('feedback', '')}"
                }
        except:
            pass
    
    return keyword_result
