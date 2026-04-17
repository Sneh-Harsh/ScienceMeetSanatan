import uuid
from typing import Optional

from django.contrib.auth.models import AnonymousUser, User
from django.db import transaction
from django.http import HttpRequest, HttpResponse
from django.utils import timezone

from core.utils.actors import Actor

from .models import GuestProfile, UserAccount

GUEST_COOKIE_NAME = 'sms_guest_uuid'
COOKIE_MAX_AGE = 60 * 60 * 24 * 365


def ensure_user_account(user: User) -> Optional[UserAccount]:
    if not user:
        return None

    full_name = " ".join(part for part in [user.first_name, user.last_name] if part).strip()
    account, created = UserAccount.objects.get_or_create(
        user=user,
        defaults={
            'full_name': full_name,
            'preferred_language': 'en',
            'onboarding_completed': False,
        },
    )
    if not created and full_name and not account.full_name:
        account.full_name = full_name
        account.save(update_fields=['full_name', 'updated_at'])
    return account


def attach_guest_cookie(response: HttpResponse, guest_uuid: str) -> HttpResponse:
    response.set_cookie(
        GUEST_COOKIE_NAME,
        guest_uuid,
        max_age=COOKIE_MAX_AGE,
        httponly=False,
        samesite='Lax',
        secure=not __debug__,
    )
    return response


def _request_ip(request: HttpRequest) -> Optional[str]:
    forwarded = (request.META.get('HTTP_X_FORWARDED_FOR') or '').split(',')[0].strip()
    return forwarded or request.META.get('REMOTE_ADDR')


@transaction.atomic

def get_or_create_guest_profile(request: HttpRequest, response: HttpResponse = None) -> GuestProfile:
    candidate = (request.COOKIES.get(GUEST_COOKIE_NAME) or request.headers.get('X-Guest-UUID') or '').strip()
    guest_profile = None
    if candidate:
        try:
            guest_profile = GuestProfile.objects.filter(guest_uuid=uuid.UUID(candidate), is_active=True).first()
        except ValueError:
            guest_profile = None
    if guest_profile is None:
        guest_profile = GuestProfile.objects.create(
            guest_uuid=uuid.uuid4(),
            session_key=getattr(getattr(request, 'session', None), 'session_key', None),
            last_ip=_request_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:1000],
        )
    else:
        guest_profile.session_key = getattr(getattr(request, 'session', None), 'session_key', None)
        guest_profile.last_ip = _request_ip(request)
        guest_profile.user_agent = request.META.get('HTTP_USER_AGENT', '')[:1000]
        guest_profile.last_seen_at = timezone.now()
        guest_profile.save(update_fields=['session_key', 'last_ip', 'user_agent', 'last_seen_at'])
    request.guest_profile = guest_profile
    if response is not None:
        attach_guest_cookie(response, str(guest_profile.guest_uuid))
    return guest_profile


def resolve_actor(request: HttpRequest) -> Actor:
    user = getattr(request, 'user', None)
    if user and not isinstance(user, AnonymousUser) and user.is_authenticated:
        return Actor(user=user)
    guest = getattr(request, 'guest_profile', None) or get_or_create_guest_profile(request)
    return Actor(guest_profile=guest)


@transaction.atomic

def merge_guest_into_user(guest_profile: GuestProfile, user: User) -> dict:
    if not guest_profile or not guest_profile.is_active:
        return {'merged': False, 'reason': 'guest_inactive'}
    if guest_profile.merged_into_user_id == user.id:
        return {'merged': False, 'reason': 'already_merged'}

    from personalization.models import Bookmark, ContentInteraction, ReadingProgress
    from personalization.services import merge_recommendation_seeds
    from astrology.models import SavedPanchaangPreference
    from quizzes.models import QuizAttempt

    moved = {'bookmarks': 0, 'progress': 0, 'interactions': 0, 'panchaang_preferences': 0, 'quiz_attempts': 0}

    for bookmark in Bookmark.objects.filter(guest_profile=guest_profile):
        exists = Bookmark.objects.filter(user=user, content_type=bookmark.content_type, object_id=bookmark.object_id).exists()
        if exists:
            bookmark.delete()
            continue
        bookmark.user = user
        bookmark.guest_profile = None
        bookmark.save(update_fields=['user', 'guest_profile'])
        moved['bookmarks'] += 1

    for progress in ReadingProgress.objects.filter(guest_profile=guest_profile):
        existing = ReadingProgress.objects.filter(user=user, content_type=progress.content_type, object_id=progress.object_id).first()
        if existing:
            better_guest = (progress.progress_percent, progress.last_opened_at) > (existing.progress_percent, existing.last_opened_at)
            if better_guest:
                existing.progress_percent = progress.progress_percent
                existing.progress_seconds = progress.progress_seconds
                existing.last_position_reference = progress.last_position_reference
                existing.completed_at = progress.completed_at or existing.completed_at
                existing.save()
            progress.delete()
            continue
        progress.user = user
        progress.guest_profile = None
        progress.save(update_fields=['user', 'guest_profile'])
        moved['progress'] += 1

    ContentInteraction.objects.filter(guest_profile=guest_profile).update(user=user, guest_profile=None)
    moved['interactions'] = ContentInteraction.objects.filter(user=user).count()

    if not SavedPanchaangPreference.objects.filter(user=user).exists():
        SavedPanchaangPreference.objects.filter(guest_profile=guest_profile).update(user=user, guest_profile=None)
        moved['panchaang_preferences'] = 1

    QuizAttempt.objects.filter(guest_profile=guest_profile).update(user=user, guest_profile=None)
    moved['quiz_attempts'] = QuizAttempt.objects.filter(user=user).count()

    seed_summary = merge_recommendation_seeds(user, guest_profile)
    guest_profile.merged_into_user = user
    guest_profile.is_active = False
    guest_profile.save(update_fields=['merged_into_user', 'is_active'])
    return {'merged': True, 'guest_uuid': str(guest_profile.guest_uuid), 'user_id': user.id, 'moved': moved, 'seed_summary': seed_summary}
