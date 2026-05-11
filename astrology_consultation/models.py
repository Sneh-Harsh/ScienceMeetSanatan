from __future__ import annotations

import uuid
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.text import slugify

from accounts.models import PersonProfile


class ExpertiseType(models.TextChoices):
    VEDIC = 'vedic_astrology', 'Vedic Astrology'
    KUNDALI = 'kundali', 'Kundali'
    MARRIAGE = 'marriage', 'Marriage'
    CAREER = 'career', 'Career'
    FINANCE = 'finance', 'Finance'
    LOVE = 'love_relationship', 'Love & Relationship'
    NUMEROLOGY = 'numerology', 'Numerology'
    TAROT = 'tarot', 'Tarot'
    VASTU = 'vastu', 'Vastu'
    MUHURAT = 'muhurat', 'Muhurat'
    PRASHNA = 'prashna', 'Prashna'
    PALMISTRY = 'palmistry', 'Palmistry'


class SessionStatus(models.TextChoices):
    REQUESTED = 'requested', 'Requested'
    ACTIVE = 'active', 'Active'
    ENDED = 'ended', 'Ended'
    CANCELLED = 'cancelled', 'Cancelled'
    INSUFFICIENT_BALANCE = 'insufficient_balance', 'Insufficient balance'


class TransactionType(models.TextChoices):
    CREDIT = 'credit', 'Credit'
    DEBIT = 'debit', 'Debit'
    BONUS = 'bonus', 'Bonus'
    REFUND = 'refund', 'Refund'
    HOLD = 'hold', 'Hold'


class MessageSender(models.TextChoices):
    USER = 'user', 'User'
    ASTROLOGER = 'astrologer', 'Astrologer'
    SYSTEM = 'system', 'System'


class MessageType(models.TextChoices):
    TEXT = 'text', 'Text'
    SUMMARY = 'summary', 'Summary'
    SYSTEM = 'system', 'System'


class BirthShareMode(models.TextChoices):
    NONE = 'none', 'Do not share'
    BIRTH_ONLY = 'birth_only', 'Birth details only'
    FULL_KUNDALI = 'full_kundali', 'Full kundali summary'


class AstrologerProfile(models.Model):
    user = models.OneToOneField(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='astrologer_profile')
    display_name = models.CharField(max_length=140)
    slug = models.SlugField(max_length=170, unique=True, blank=True)
    photo = models.URLField(blank=True)
    bio = models.TextField(blank=True)
    expertise = models.JSONField(default=list, blank=True)
    languages = models.JSONField(default=list, blank=True)
    experience_years = models.PositiveIntegerField(default=1)
    rating = models.FloatField(default=0, validators=[MinValueValidator(0), MaxValueValidator(5)])
    total_reviews = models.PositiveIntegerField(default=0)
    total_consultations = models.PositiveIntegerField(default=0)
    price_per_minute = models.PositiveIntegerField(default=25)
    is_verified = models.BooleanField(default=True)
    identity_verified = models.BooleanField(default=True)
    skill_verified = models.BooleanField(default=True)
    is_online = models.BooleanField(default=False)
    available_today = models.BooleanField(default=True)
    response_time = models.PositiveIntegerField(default=2, help_text='Average response time in minutes')
    estimated_wait_time = models.PositiveIntegerField(default=1)
    city = models.CharField(max_length=120, blank=True)
    free_first_chat_enabled = models.BooleanField(default=True)
    free_minutes_override = models.PositiveIntegerField(default=5)
    repeat_users_percent = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    topic_strengths = models.JSONField(default=list, blank=True)
    consultation_modes = models.JSONField(default=list, blank=True)
    trust_note = models.CharField(max_length=180, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_online', '-rating', '-total_consultations', 'display_name']
        indexes = [
            models.Index(fields=['is_online', 'is_active']),
            models.Index(fields=['city', 'is_active']),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.display_name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.display_name


class AstrologerAvailability(models.Model):
    astrologer = models.ForeignKey(AstrologerProfile, on_delete=models.CASCADE, related_name='availability_windows')
    day_of_week = models.PositiveSmallIntegerField(validators=[MinValueValidator(0), MaxValueValidator(6)])
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_available = models.BooleanField(default=True)

    class Meta:
        ordering = ['day_of_week', 'start_time']
        unique_together = [('astrologer', 'day_of_week', 'start_time', 'end_time')]


class Wallet(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='wallet')
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    currency = models.CharField(max_length=8, default='INR')
    first_chat_free_consumed = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f'{self.user.username} wallet'


class ChatSession(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='astrology_chat_sessions')
    astrologer = models.ForeignKey(AstrologerProfile, on_delete=models.CASCADE, related_name='chat_sessions')
    person_profile = models.ForeignKey(PersonProfile, null=True, blank=True, on_delete=models.SET_NULL, related_name='astrology_chat_sessions')
    status = models.CharField(max_length=32, choices=SessionStatus.choices, default=SessionStatus.REQUESTED)
    question_topic = models.CharField(max_length=120, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    rate_per_minute = models.PositiveIntegerField(default=0)
    free_minutes = models.PositiveIntegerField(default=0)
    total_duration_seconds = models.PositiveIntegerField(default=0)
    total_charge = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    birth_profile_shared = models.CharField(max_length=24, choices=BirthShareMode.choices, default=BirthShareMode.NONE)
    kundali_snapshot = models.JSONField(default=dict, blank=True)
    ai_prechat_summary = models.JSONField(default=dict, blank=True)
    last_user_message_at = models.DateTimeField(null=True, blank=True)
    astrologer_typing = models.BooleanField(default=False)
    low_balance_notified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['astrologer', 'status']),
        ]

    def __str__(self) -> str:
        return f'{self.user.username} • {self.astrologer.display_name} • {self.public_id}'


class WalletTransaction(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='wallet_transactions')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_type = models.CharField(max_length=16, choices=TransactionType.choices)
    reason = models.CharField(max_length=180)
    session = models.ForeignKey(ChatSession, null=True, blank=True, on_delete=models.SET_NULL, related_name='wallet_transactions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class ChatMessage(models.Model):
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    sender = models.CharField(max_length=16, choices=MessageSender.choices)
    message = models.TextField()
    message_type = models.CharField(max_length=16, choices=MessageType.choices, default=MessageType.TEXT)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']


class AstrologerReview(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='astrologer_reviews')
    astrologer = models.ForeignKey(AstrologerProfile, on_delete=models.CASCADE, related_name='reviews')
    session = models.ForeignKey(ChatSession, null=True, blank=True, on_delete=models.SET_NULL, related_name='reviews')
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = [('user', 'session')]


class FavoriteAstrologer(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorite_astrologers')
    astrologer = models.ForeignKey(AstrologerProfile, on_delete=models.CASCADE, related_name='favorited_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = [('user', 'astrologer')]
