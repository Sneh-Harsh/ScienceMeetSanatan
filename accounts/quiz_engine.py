import json
import random
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from uuid import uuid4

from .models import QuizAttempt, QuizQuestionMemory


QUIZ_POOL_PATH = Path(__file__).resolve().parent / "data" / "real_mixed_300_questions.json"
QUESTION_COUNT = 5
RECENT_SESSION_LIMIT = 7
DIFFICULTY_SEQUENCE = ["easy", "medium", "medium", "hard", "adaptive"]

CATEGORY_ALIASES = {
    "gita": "mythology",
    "ramayana": "mythology",
    "mahabharata": "mythology",
    "mythology": "mythology",
    "astrology": "astrology",
    "brain": "brain",
    "knowledge": "knowledge",
    "vedic_science": "knowledge",
}

CATEGORY_LABELS = {
    "mythology": "Spiritual & Mythology",
    "astrology": "Astrology & Destiny",
    "brain": "Brain Games & Logic",
    "knowledge": "General Knowledge",
}

DIFFICULTY_FALLBACKS = {
    "easy": ("easy", "medium", "hard"),
    "medium": ("medium", "easy", "hard"),
    "hard": ("hard", "medium", "easy"),
}


def resolve_category_slug(category_slug: str) -> str:
    normalized = str(category_slug or "").strip().lower()
    return CATEGORY_ALIASES.get(normalized, normalized)


@lru_cache(maxsize=1)
def load_question_pool() -> List[Dict]:
    raw = json.loads(QUIZ_POOL_PATH.read_text())
    normalized_questions: List[Dict] = []
    for index, item in enumerate(raw):
        options = [str(option).strip() for option in item.get("options", []) if str(option).strip()]
        if len(options) < 2:
            continue
        try:
            correct_index = int(item.get("correctAnswer"))
            weight = max(0.1, float(item.get("weight") or 1))
        except Exception:
            continue
        if correct_index < 0 or correct_index >= len(options):
            continue
        prompt = str(item.get("question") or "").strip()
        if not prompt:
            continue
        category = resolve_category_slug(item.get("category") or "")
        normalized_questions.append(
            {
                "id": str(item.get("id") or f"question_{index}"),
                "category": category,
                "subcategory": str(item.get("subcategory") or category or "general").strip().lower(),
                "difficulty": normalize_difficulty(item.get("difficulty")),
                "question": prompt,
                "options": options,
                "correctAnswer": correct_index,
                "tags": [str(tag).strip().lower() for tag in item.get("tags", []) if str(tag).strip()],
                "weight": weight,
            }
        )
    return normalized_questions


def normalize_difficulty(value: Optional[str]) -> str:
    text = str(value or "medium").strip().lower()
    if text.startswith("e"):
        return "easy"
    if text.startswith("h"):
        return "hard"
    return "medium"


def filter_pool_by_category(category_slug: str) -> List[Dict]:
    resolved = resolve_category_slug(category_slug)
    return [question for question in load_question_pool() if question["category"] == resolved]


def category_accuracy(user, category_slug: str) -> float:
    resolved = resolve_category_slug(category_slug)
    memories = QuizQuestionMemory.objects.filter(user=user, category__slug=resolved).only(
        "correct_count",
        "incorrect_count",
    )
    total_correct = 0
    total_seen = 0
    for memory in memories:
        total_correct += int(memory.correct_count or 0)
        total_seen += int(memory.correct_count or 0) + int(memory.incorrect_count or 0)
    if total_seen <= 0:
        return 0.58
    return total_correct / total_seen


def recent_question_signals(user, category_slug: str) -> Tuple[set, set, set]:
    resolved = resolve_category_slug(category_slug)
    attempts = (
        QuizAttempt.objects.filter(user=user, category__slug=resolved)
        .only("selected_question_ids", "answer_payload")
        .order_by("-created_at")[:RECENT_SESSION_LIMIT]
    )
    recent_all = set()
    recent_correct = set()
    recent_incorrect = set()
    for attempt in attempts:
        for question_id in attempt.selected_question_ids or []:
            recent_all.add(str(question_id))
        for answer in attempt.answer_payload or []:
            question_id = str(answer.get("question_id") or "").strip()
            if not question_id:
                continue
            if answer.get("is_correct"):
                recent_correct.add(question_id)
            else:
                recent_incorrect.add(question_id)
    return recent_all, recent_correct, recent_incorrect


def question_memory_map(user, category_slug: str) -> Dict[str, QuizQuestionMemory]:
    resolved = resolve_category_slug(category_slug)
    memories = QuizQuestionMemory.objects.filter(user=user, category__slug=resolved)
    return {memory.question_id: memory for memory in memories}


def adaptive_difficulty_for_user(accuracy: float) -> str:
    if accuracy >= 0.76:
        return "hard"
    if accuracy <= 0.46:
        return "easy"
    return "medium"


def _passes_for_difficulty(target: str) -> Tuple[Tuple[bool, bool, Tuple[str, ...]], ...]:
    fallback = DIFFICULTY_FALLBACKS[target]
    return (
        (True, False, (target,)),
        (True, False, fallback),
        (False, True, (target,)),
        (False, True, fallback),
        (False, False, (target,)),
        (False, False, fallback),
    )


def select_questions_for_user(user, category_slug: str) -> List[Dict]:
    resolved = resolve_category_slug(category_slug)
    pool = filter_pool_by_category(resolved)
    if len(pool) < QUESTION_COUNT:
        raise ValueError(f"Not enough questions for category '{resolved}'.")

    accuracy = category_accuracy(user, resolved)
    adaptive_difficulty = adaptive_difficulty_for_user(accuracy)
    difficulty_plan = [
        adaptive_difficulty if difficulty == "adaptive" else difficulty
        for difficulty in DIFFICULTY_SEQUENCE
    ]

    recent_all, recent_correct, recent_incorrect = recent_question_signals(user, resolved)
    memories = question_memory_map(user, resolved)

    rng = random.Random()
    selected: List[Dict] = []
    selected_ids = set()
    selected_subcategories: Counter = Counter()
    selected_tags: Counter = Counter()

    for difficulty in difficulty_plan:
        candidate = _pick_question(
            pool=pool,
            target_difficulty=difficulty,
            recent_all=recent_all,
            recent_correct=recent_correct,
            recent_incorrect=recent_incorrect,
            memory_map=memories,
            selected_ids=selected_ids,
            selected_subcategories=selected_subcategories,
            selected_tags=selected_tags,
            rng=rng,
        )
        if candidate is None:
            raise ValueError(f"Could not assemble a balanced question set for '{resolved}'.")
        selected.append(_shuffle_options(candidate, rng))
        selected_ids.add(candidate["id"])
        selected_subcategories[candidate["subcategory"]] += 1
        for tag in candidate["tags"]:
            selected_tags[tag] += 1

    return selected


def _pick_question(
    *,
    pool: Iterable[Dict],
    target_difficulty: str,
    recent_all: set,
    recent_correct: set,
    recent_incorrect: set,
    memory_map: Dict[str, QuizQuestionMemory],
    selected_ids: set,
    selected_subcategories: Counter,
    selected_tags: Counter,
    rng: random.Random,
) -> Optional[Dict]:
    fallback_passes = _passes_for_difficulty(target_difficulty)
    pool_list = list(pool)
    for avoid_recent_all, avoid_recent_correct, allowed_difficulties in fallback_passes:
        candidates = []
        weights = []
        for question in pool_list:
            question_id = question["id"]
            if question_id in selected_ids:
                continue
            if question["difficulty"] not in allowed_difficulties:
                continue
            if avoid_recent_all and question_id in recent_all:
                continue
            if avoid_recent_correct and question_id in recent_correct:
                continue
            weight = _question_weight(
                question=question,
                recent_correct=recent_correct,
                recent_incorrect=recent_incorrect,
                memory=memory_map.get(question_id),
                selected_subcategories=selected_subcategories,
                selected_tags=selected_tags,
            )
            if weight <= 0:
                continue
            candidates.append(question)
            weights.append(weight)
        if candidates:
            return rng.choices(candidates, weights=weights, k=1)[0]
    return None


def _question_weight(
    *,
    question: Dict,
    recent_correct: set,
    recent_incorrect: set,
    memory: Optional[QuizQuestionMemory],
    selected_subcategories: Counter,
    selected_tags: Counter,
) -> float:
    weight = float(question.get("weight") or 1)
    question_id = question["id"]
    if question_id in recent_incorrect:
        weight *= 0.52
    if question_id in recent_correct:
        weight *= 0.18
    if memory is not None:
        seen_count = int(memory.seen_count or 0)
        correct_count = int(memory.correct_count or 0)
        incorrect_count = int(memory.incorrect_count or 0)
        weight *= max(0.42, 1.08 - min(seen_count, 7) * 0.08)
        if incorrect_count > correct_count:
            weight *= 1.14
        elif correct_count > incorrect_count:
            weight *= 0.88
    weight *= 0.76 ** selected_subcategories[question["subcategory"]]
    tag_overlap = sum(selected_tags[tag] for tag in question["tags"])
    if tag_overlap:
        weight *= max(0.62, 0.92 ** tag_overlap)
    return max(weight, 0.01)


def _shuffle_options(question: Dict, rng: random.Random) -> Dict:
    option_rows = [
        {"text": option_text, "is_correct": index == question["correctAnswer"]}
        for index, option_text in enumerate(question["options"])
    ]
    rng.shuffle(option_rows)
    answer_index = next(index for index, row in enumerate(option_rows) if row["is_correct"])
    return {
        "id": question["id"],
        "category": question["category"],
        "subcategory": question["subcategory"],
        "difficulty": question["difficulty"],
        "question": question["question"],
        "options": [row["text"] for row in option_rows],
        "answerIndex": answer_index,
        "tags": list(question["tags"]),
        "weight": float(question["weight"]),
    }


def build_quiz_session_payload(user, category_slug: str) -> Dict:
    resolved = resolve_category_slug(category_slug)
    questions = select_questions_for_user(user, resolved)
    session_id = uuid4().hex
    return {
        "session_id": session_id,
        "category": resolved,
        "category_label": CATEGORY_LABELS.get(resolved, resolved.replace("_", " ").title()),
        "questions": questions,
    }
