from collections import Counter
from datetime import timedelta
from typing import Dict, Optional

from django.db import transaction
from django.utils import timezone

from core.utils.actors import Actor
from core.utils.constants import InteractionType, RecommendationType

from .models import Bookmark, ContentInteraction, ReadingProgress, RecommendationCache, UserPreference


class RecommendationService:
    model_version = 'rules-v1'

    @classmethod
    def build_home_feed(cls, actor: Actor) -> Dict:
        interests = cls._interest_scores(actor)
        items = []
        for label, score in interests.most_common(6):
            items.append({
                'content_reference': label,
                'reason_label': 'Based on your recent activity',
                'confidence_score': round(min(score / 10, 0.99), 2),
                'source_bucket': 'behavior',
                'explanation_text': f'Because you interacted frequently with {label}.',
            })
        return {'items': items, 'generated_for': actor.identity_key}

    @classmethod
    def build_library_recommendations(cls, actor: Actor) -> Dict:
        interests = cls._interest_scores(actor)
        return {'items': [
            {
                'content_reference': label,
                'reason_label': 'Because you bookmarked similar books',
                'confidence_score': round(min(score / 10, 0.99), 2),
                'source_bucket': 'bookmark',
            }
            for label, score in interests.most_common(5)
        ]}

    @classmethod
    def build_mantra_recommendations(cls, actor: Actor) -> Dict:
        interests = cls._interest_scores(actor)
        top = interests.most_common(3)
        return {'items': [
            {
                'content_reference': f'mantra:{label}',
                'reason_label': 'Traditionally associated with your recent focus',
                'confidence_score': round(min(score / 8, 0.95), 2),
                'source_bucket': 'traditional_rule',
            }
            for label, score in top
        ]}

    @classmethod
    def build_quiz_recommendations(cls, actor: Actor) -> Dict:
        interests = cls._interest_scores(actor)
        return {'items': [
            {
                'content_reference': label,
                'reason_label': 'Based on your recent quiz interests',
                'confidence_score': round(min(score / 9, 0.98), 2),
                'source_bucket': 'quiz_interest',
            }
            for label, score in interests.most_common(4)
        ]}

    @classmethod
    def build_baby_name_recommendations(cls, actor: Actor) -> Dict:
        interests = cls._interest_scores(actor)
        return {'items': [
            {
                'content_reference': f'baby_name:{label}',
                'reason_label': 'Popular with readers like you',
                'confidence_score': round(min(score / 10, 0.9), 2),
                'source_bucket': 'community_overlap',
            }
            for label, score in interests.most_common(3)
        ]}

    @classmethod
    def build_recommendations_for_actor(cls, actor: Actor, recommendation_type: str) -> Dict:
        mapping = {
            RecommendationType.HOME_FEED: cls.build_home_feed,
            RecommendationType.LIBRARY: cls.build_library_recommendations,
            RecommendationType.MANTRA: cls.build_mantra_recommendations,
            RecommendationType.QUIZ: cls.build_quiz_recommendations,
            RecommendationType.BABY_NAMES: cls.build_baby_name_recommendations,
            RecommendationType.ASTROLOGY: cls.build_mantra_recommendations,
        }
        payload = mapping[recommendation_type](actor)
        cls.cache(actor, recommendation_type, payload)
        return payload

    @classmethod
    def cache(cls, actor: Actor, recommendation_type: str, payload: Dict) -> RecommendationCache:
        filters = {'user': actor.user} if actor.user else {'guest_profile': actor.guest_profile}
        return RecommendationCache.objects.create(
            recommendation_type=recommendation_type,
            payload=payload,
            expires_at=timezone.now() + timedelta(hours=6),
            model_version=cls.model_version,
            source_reasoning={'actor': actor.identity_key},
            **filters,
        )

    @staticmethod
    def _interest_scores(actor: Actor) -> Counter:
        filters = {'user': actor.user} if actor.user else {'guest_profile': actor.guest_profile}
        counter = Counter()
        for interaction in ContentInteraction.objects.filter(**filters).order_by('-occurred_at')[:100]:
            weight = {
                InteractionType.BOOKMARKED: 5,
                InteractionType.LIKED: 4,
                InteractionType.COMPLETED: 4,
                InteractionType.STARTED: 2,
                InteractionType.VIEWED: 1,
            }.get(interaction.interaction_type, 1)
            label = interaction.metadata.get('category') or interaction.metadata.get('tag') or interaction.content_type
            counter[label] += weight
        return counter


@transaction.atomic

def track_interaction(actor: Actor, **payload) -> ContentInteraction:
    filters = {'user': actor.user} if actor.user else {'guest_profile': actor.guest_profile}
    return ContentInteraction.objects.create(**filters, **payload)


@transaction.atomic

def toggle_bookmark(actor: Actor, *, content_type: str, object_id: str, source_context: str = '') -> Bookmark:
    filters = {'user': actor.user} if actor.user else {'guest_profile': actor.guest_profile}
    bookmark = Bookmark.objects.filter(content_type=content_type, object_id=object_id, **filters).first()
    if bookmark:
        bookmark.delete()
        return None
    return Bookmark.objects.create(content_type=content_type, object_id=object_id, source_context=source_context, **filters)


@transaction.atomic

def update_reading_progress(actor: Actor, *, content_type: str, object_id: str, progress_percent: float, progress_seconds: Optional[int] = None, last_position_reference: str = '') -> ReadingProgress:
    filters = {'user': actor.user} if actor.user else {'guest_profile': actor.guest_profile}
    progress, _ = ReadingProgress.objects.get_or_create(content_type=content_type, object_id=object_id, defaults=filters, **filters)
    progress.progress_percent = max(0, min(progress_percent, 100))
    progress.progress_seconds = progress_seconds
    progress.last_position_reference = last_position_reference
    if progress.progress_percent >= 95 and not progress.completed_at:
        progress.completed_at = timezone.now()
    progress.save()
    return progress


@transaction.atomic

def merge_recommendation_seeds(user, guest_profile) -> Dict:
    guest_pref = {'language': guest_profile.preferred_language, 'city': guest_profile.preferred_location_name}
    pref, _ = UserPreference.objects.get_or_create(user=user)
    if not pref.preferred_city and guest_pref['city']:
        pref.preferred_city = guest_pref['city']
    if guest_pref['language'] and pref.preferred_language == 'en':
        pref.preferred_language = guest_pref['language']
    pref.save()
    return {'preferred_city': pref.preferred_city, 'preferred_language': pref.preferred_language}
