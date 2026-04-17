from datetime import date, timedelta
from typing import Dict, List

from django.db.models import Avg, Count, Max

from core.utils.actors import Actor

from .models import QuizAttempt, QuizLeaderboardEntry


def get_quiz_history(actor: Actor) -> List[QuizAttempt]:
    filters = {'user': actor.user} if actor.user else {'guest_profile': actor.guest_profile}
    return list(QuizAttempt.objects.filter(**filters).select_related('quiz', 'quiz__category').order_by('-started_at')[:25])


def get_quiz_stats(actor: Actor) -> Dict:
    filters = {'user': actor.user} if actor.user else {'guest_profile': actor.guest_profile}
    stats = QuizAttempt.objects.filter(**filters, completed_at__isnull=False).aggregate(total=Count('id'), average=Avg('percentage'), best=Max('percentage'))
    return {'total_attempts': stats['total'] or 0, 'average_percentage': round(stats['average'] or 0, 2), 'best_percentage': round(stats['best'] or 0, 2)}


def get_leaderboard(board_type: str, *, quiz_id=None, category_slug=None, period: str = 'all') -> Dict:
    queryset = QuizLeaderboardEntry.objects.filter(board_type=board_type)
    if quiz_id:
        queryset = queryset.filter(quiz_id=quiz_id)
    if category_slug:
        queryset = queryset.filter(category__slug=category_slug)
    today = date.today()
    if period == 'weekly':
        queryset = queryset.filter(period_start=today - timedelta(days=today.weekday()))
    rows = list(queryset.order_by('-percentage', '-score', 'duration_seconds', 'updated_at')[:50])
    return {
        'entries': rows,
        'updated_at': rows[0].updated_at if rows else None,
        'board_type': board_type,
    }
