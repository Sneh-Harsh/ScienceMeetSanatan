from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from accounts.models import PersonProfile
from astrology.models import SavedKundali
from astrology_consultation.models import (
    AstrologerProfile,
    BirthShareMode,
    ChatMessage,
    ChatSession,
    MessageSender,
    MessageType,
    SessionStatus,
)
from astrology_consultation.services.wallet import credit_wallet, debit_wallet, get_or_create_wallet


DEFAULT_FREE_MINUTES = 5
LOW_BALANCE_THRESHOLD = Decimal('50.00')


SUGGESTED_QUESTIONS = {
    'career': ['Ask about career timing', 'Ask about 2026 work growth'],
    'marriage': ['Ask about marriage timing', 'Ask about compatibility guidance'],
    'finance': ['Ask about money flow', 'Ask about investment caution'],
    'health': ['Ask about vitality patterns', 'Ask about stress periods'],
}


def build_kundali_snapshot(*, user, person_profile: PersonProfile | None, share_mode: str) -> tuple[dict, dict]:
    if share_mode == BirthShareMode.NONE:
        return {}, {}

    target_profile = person_profile or user.person_profiles.filter(is_primary=True).first()
    if not target_profile:
        return {}, {}

    snapshot = {
        'name': target_profile.display_name,
        'dob': target_profile.birth_date.isoformat() if target_profile.birth_date else '',
        'time': target_profile.birth_time.isoformat() if target_profile.birth_time else '',
        'place': target_profile.birth_place_name,
    }

    kundali = (
        SavedKundali.objects.filter(user=user, person_profile=target_profile)
        .order_by('-created_at')
        .first()
    )
    if not kundali:
        return snapshot if share_mode == BirthShareMode.BIRTH_ONLY else snapshot, {}

    summary = kundali.summary_payload or {}
    snapshot.update(
        {
            'moon_sign': summary.get('moon_sign', ''),
            'lagna': summary.get('lagna', ''),
            'current_dasha': summary.get('current_dasha', ''),
        }
    )

    if share_mode == BirthShareMode.BIRTH_ONLY:
        return snapshot, {}

    ai_summary = {
        'headline': 'AI pre-chat summary',
        'focus': summary.get('focus_areas') or summary.get('summary') or 'Kundali-backed context shared for this consultation.',
        'recommendations': (kundali.recommendation_payload or {}).get('service_tags', []),
    }
    return snapshot, ai_summary


def can_start_session(user, astrologer: AstrologerProfile):
    wallet = get_or_create_wallet(user)
    if not astrologer.is_active:
        return False, 'This astrologer is not available for consultation right now.'
    if user.astrology_chat_sessions.filter(status__in=[SessionStatus.REQUESTED, SessionStatus.ACTIVE]).exists():
        return False, 'Please end your active consultation before starting a new one.'
    if wallet.balance <= 0 and wallet.first_chat_free_consumed:
        return False, 'Recharge wallet to start a new chat session.'
    return True, ''


@transaction.atomic
def start_chat_session(*, user, astrologer: AstrologerProfile, topic: str = '', share_mode: str = BirthShareMode.NONE, person_profile: PersonProfile | None = None):
    allowed, reason = can_start_session(user, astrologer)
    if not allowed:
        raise ValueError(reason)

    wallet = get_or_create_wallet(user)
    free_minutes = 0 if wallet.first_chat_free_consumed or not astrologer.free_first_chat_enabled else astrologer.free_minutes_override or DEFAULT_FREE_MINUTES
    snapshot, ai_summary = build_kundali_snapshot(user=user, person_profile=person_profile, share_mode=share_mode)

    session = ChatSession.objects.create(
        user=user,
        astrologer=astrologer,
        person_profile=person_profile,
        status=SessionStatus.ACTIVE,
        started_at=timezone.now(),
        rate_per_minute=astrologer.price_per_minute,
        free_minutes=free_minutes,
        birth_profile_shared=share_mode,
        kundali_snapshot=snapshot,
        ai_prechat_summary=ai_summary,
        question_topic=topic,
    )
    ChatMessage.objects.create(
        session=session,
        sender=MessageSender.SYSTEM,
        message='Consultation started. Your astrologer now has the shared context you approved.',
        message_type=MessageType.SYSTEM,
    )
    if ai_summary:
        ChatMessage.objects.create(
            session=session,
            sender=MessageSender.SYSTEM,
            message=ai_summary.get('focus') if isinstance(ai_summary.get('focus'), str) else 'Kundali summary shared.',
            message_type=MessageType.SUMMARY,
        )
    astrologer.total_consultations += 1
    astrologer.save(update_fields=['total_consultations', 'updated_at'])
    return session


def append_message(*, session: ChatSession, sender: str, message: str, message_type: str = MessageType.TEXT):
    chat_message = ChatMessage.objects.create(session=session, sender=sender, message=message, message_type=message_type)
    if sender == MessageSender.USER:
        session.last_user_message_at = timezone.now()
        session.save(update_fields=['last_user_message_at', 'updated_at'])
    return chat_message


@transaction.atomic
def end_chat_session(*, session: ChatSession, ended_by: str = 'user'):
    if session.status not in {SessionStatus.ACTIVE, SessionStatus.REQUESTED}:
        return session

    ended_at = timezone.now()
    started_at = session.started_at or session.created_at
    total_duration_seconds = max(0, int((ended_at - started_at).total_seconds()))
    free_seconds = session.free_minutes * 60
    payable_seconds = max(0, total_duration_seconds - free_seconds)
    charge = (Decimal(payable_seconds) / Decimal('60')) * Decimal(session.rate_per_minute)
    charge = charge.quantize(Decimal('0.01'))

    wallet = get_or_create_wallet(session.user)
    actual_charge = min(wallet.balance, charge)
    status = SessionStatus.ENDED if actual_charge == charge else SessionStatus.INSUFFICIENT_BALANCE
    if actual_charge > 0:
        debit_wallet(user=session.user, amount=actual_charge, reason='Astrology consultation charge', session=session)
    if session.free_minutes > 0 and not wallet.first_chat_free_consumed:
        wallet.first_chat_free_consumed = True
        wallet.save(update_fields=['first_chat_free_consumed', 'updated_at'])

    session.status = status
    session.ended_at = ended_at
    session.total_duration_seconds = total_duration_seconds
    session.total_charge = actual_charge
    session.save(update_fields=['status', 'ended_at', 'total_duration_seconds', 'total_charge', 'updated_at'])
    append_message(
        session=session,
        sender=MessageSender.SYSTEM,
        message=f'Session ended by {ended_by}. Total charged: ₹{actual_charge}.',
        message_type=MessageType.SYSTEM,
    )
    return session


def add_dev_recharge(*, user, amount: Decimal):
    return credit_wallet(user=user, amount=amount, reason='Wallet recharge placeholder')
