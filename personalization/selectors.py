from datetime import date
from typing import Dict, List

from core.utils.actors import Actor

from .models import Bookmark, ContentInteraction, ReadingProgress


def get_continue_reading(actor: Actor, limit: int = 6) -> List[Dict]:
    filters = {'user': actor.user} if actor.user else {'guest_profile': actor.guest_profile}
    rows = ReadingProgress.objects.filter(**filters).order_by('-last_opened_at')[:limit]
    return [
        {
            'content_type': row.content_type,
            'object_id': row.object_id,
            'progress_percent': row.progress_percent,
            'progress_seconds': row.progress_seconds,
            'last_position_reference': row.last_position_reference,
        }
        for row in rows
    ]


def get_recent_interactions(actor: Actor, limit: int = 10) -> List[Dict]:
    filters = {'user': actor.user} if actor.user else {'guest_profile': actor.guest_profile}
    rows = ContentInteraction.objects.filter(**filters).order_by('-occurred_at')[:limit]
    return [
        {
            'content_type': row.content_type,
            'object_id': row.object_id,
            'interaction_type': row.interaction_type,
            'metadata': row.metadata,
        }
        for row in rows
    ]


def get_actor_bookmarks(actor: Actor, limit: int = 12) -> List[Dict]:
    filters = {'user': actor.user} if actor.user else {'guest_profile': actor.guest_profile}
    rows = Bookmark.objects.filter(**filters).order_by('-created_at')[:limit]
    return [{'content_type': row.content_type, 'object_id': row.object_id, 'source_context': row.source_context} for row in rows]


def get_home_dashboard_seed(actor: Actor) -> Dict:
    return {
        'continue_reading': get_continue_reading(actor, limit=4),
        'recent_activity': get_recent_interactions(actor, limit=6),
        'bookmarks': get_actor_bookmarks(actor, limit=6),
        'snapshot_date': date.today().isoformat(),
    }
