from datetime import date, timedelta

from django.db import transaction
from django.db.models import Avg, Count, Max
from django.utils import timezone

from personalization.services import RecommendationService
from core.utils.actors import Actor

from .models import Quiz, QuizAttempt, QuizCategory, QuizLeaderboardEntry, UserQuizStats


def _display_name(user) -> str:
    account = getattr(user, 'account_profile', None)
    return (getattr(account, 'full_name', '') or user.username).strip()


def _board_period_bounds(today: date):
    start = today - timedelta(days=today.weekday())
    end = start + timedelta(days=6)
    return start, end


def _rank_score(percentage: float, score: float, duration_seconds: int) -> float:
    return round((percentage * 1000000) + (score * 1000) - duration_seconds, 6)


@transaction.atomic

def submit_quiz_attempt(actor: Actor, quiz: Quiz, answers: list, duration_seconds: int = 0, device_fingerprint: str = '') -> QuizAttempt:
    question_map = {question.id: question for question in quiz.questions.prefetch_related('choices').filter(is_active=True)}
    correct = incorrect = unanswered = 0
    graded_answers = []
    for answer in answers:
        question = question_map.get(int(answer.get('question_id')))
        if not question:
            continue
        choice_id = answer.get('choice_id')
        selected_choice = next((choice for choice in question.choices.all() if choice.id == choice_id), None)
        is_correct = bool(selected_choice and selected_choice.is_correct)
        if choice_id is None:
            unanswered += 1
        elif is_correct:
            correct += 1
        else:
            incorrect += 1
        graded_answers.append({
            'question_id': question.id,
            'choice_id': choice_id,
            'is_correct': is_correct,
        })
    total = max(len(question_map), 1)
    percentage = round((correct / total) * 100, 2)
    score = round((correct * 100) + max(0, 100 - duration_seconds), 2)
    attempt = QuizAttempt.objects.create(
        user=actor.user,
        guest_profile=actor.guest_profile,
        quiz=quiz,
        completed_at=timezone.now(),
        score=score,
        correct_count=correct,
        incorrect_count=incorrect,
        unanswered_count=max(total - correct - incorrect, unanswered),
        percentage=percentage,
        duration_seconds=duration_seconds,
        attempt_status='submitted',
        answer_payload=graded_answers,
        device_fingerprint=device_fingerprint,
        is_eligible_for_leaderboard=bool(actor.user),
        leaderboard_name_snapshot=_display_name(actor.user) if actor.user else 'Guest',
    )
    if actor.user:
        update_leaderboards_for_attempt(attempt)
        update_user_quiz_stats(actor.user)
    return attempt


@transaction.atomic

def update_leaderboards_for_attempt(attempt: QuizAttempt):
    if not attempt.user_id:
        return
    today = timezone.localdate()
    weekly_start, weekly_end = _board_period_bounds(today)
    specs = [
        ('global_all_time', None, None),
        ('quiz_all_time', attempt.quiz, None),
        ('category_all_time', None, attempt.quiz.category),
        ('global_weekly', None, None),
        ('quiz_weekly', attempt.quiz, None),
        ('category_weekly', None, attempt.quiz.category),
    ]
    for board_type, quiz, category in specs:
        period_start = weekly_start if board_type.endswith('weekly') else None
        period_end = weekly_end if board_type.endswith('weekly') else None
        filters = {'user': attempt.user, 'board_type': board_type, 'quiz': quiz, 'category': category, 'period_start': period_start, 'period_end': period_end}
        defaults = {
            'score': attempt.score,
            'percentage': attempt.percentage,
            'duration_seconds': attempt.duration_seconds,
            'attempts_count': 1,
            'rank_score': _rank_score(attempt.percentage, attempt.score, attempt.duration_seconds),
            'display_name': attempt.leaderboard_name_snapshot,
        }
        entry, created = QuizLeaderboardEntry.objects.get_or_create(defaults=defaults, **filters)
        if not created:
            entry.attempts_count += 1
            better = (attempt.percentage, attempt.score, -attempt.duration_seconds, -int(attempt.completed_at.timestamp())) > (entry.percentage, entry.score, -entry.duration_seconds, -int(entry.updated_at.timestamp()))
            if better:
                entry.score = attempt.score
                entry.percentage = attempt.percentage
                entry.duration_seconds = attempt.duration_seconds
                entry.display_name = attempt.leaderboard_name_snapshot
            entry.rank_score = _rank_score(entry.percentage, entry.score, entry.duration_seconds)
            entry.save()


@transaction.atomic

def update_user_quiz_stats(user):
    stats, _ = UserQuizStats.objects.get_or_create(user=user)
    agg = QuizAttempt.objects.filter(user=user, completed_at__isnull=False).aggregate(total=Count('id'), average=Avg('percentage'), best=Max('score'))
    stats.total_attempts = agg['total'] or 0
    stats.average_score = round(agg['average'] or 0, 2)
    stats.best_score = agg['best'] or 0
    stats.save()
    return stats


def build_quiz_recommendations(actor: Actor):
    return RecommendationService.build_quiz_recommendations(actor)
