from django.contrib.auth.models import User
from django.db import models

from accounts.models import GuestProfile
from core.utils.constants import ContentType, InteractionType, ProgressContentType, RecommendationType


class UserPreference(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='preferences')
    preferred_language = models.CharField(max_length=20, default='en')
    preferred_script = models.CharField(max_length=30, blank=True)
    timezone = models.CharField(max_length=50, default='UTC')
    preferred_city = models.CharField(max_length=120, blank=True)
    favorite_categories = models.JSONField(default=list, blank=True)
    favorite_deities = models.JSONField(default=list, blank=True)
    interest_tags = models.JSONField(default=list, blank=True)
    astrology_personalization_enabled = models.BooleanField(default=True)
    quiz_public_profile_enabled = models.BooleanField(default=True)
    recommendation_profile = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f'Preferences<{self.user.username}>'


class ContentInteraction(models.Model):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name='content_interactions')
    guest_profile = models.ForeignKey(GuestProfile, null=True, blank=True, on_delete=models.CASCADE, related_name='content_interactions')
    content_type = models.CharField(max_length=40, choices=ContentType.choices)
    object_id = models.CharField(max_length=120)
    interaction_type = models.CharField(max_length=20, choices=InteractionType.choices)
    metadata = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-occurred_at']
        indexes = [
            models.Index(fields=['content_type', 'object_id', 'interaction_type']),
            models.Index(fields=['occurred_at']),
        ]
        constraints = [
            models.CheckConstraint(check=models.Q(user__isnull=False) | models.Q(guest_profile__isnull=False), name='interaction_actor_required'),
        ]


class Bookmark(models.Model):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name='bookmarks')
    guest_profile = models.ForeignKey(GuestProfile, null=True, blank=True, on_delete=models.CASCADE, related_name='bookmarks')
    content_type = models.CharField(max_length=40, choices=ContentType.choices)
    object_id = models.CharField(max_length=120)
    source_context = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['content_type', 'object_id'])]
        constraints = [
            models.CheckConstraint(check=models.Q(user__isnull=False) | models.Q(guest_profile__isnull=False), name='bookmark_actor_required'),
            models.UniqueConstraint(fields=['user', 'content_type', 'object_id'], condition=models.Q(user__isnull=False), name='unique_user_bookmark'),
            models.UniqueConstraint(fields=['guest_profile', 'content_type', 'object_id'], condition=models.Q(guest_profile__isnull=False), name='unique_guest_bookmark'),
        ]


class ReadingProgress(models.Model):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name='reading_progress')
    guest_profile = models.ForeignKey(GuestProfile, null=True, blank=True, on_delete=models.CASCADE, related_name='reading_progress')
    content_type = models.CharField(max_length=40, choices=ProgressContentType.choices)
    object_id = models.CharField(max_length=120)
    progress_percent = models.FloatField(default=0)
    progress_seconds = models.PositiveIntegerField(null=True, blank=True)
    last_position_reference = models.CharField(max_length=120, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    last_opened_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-last_opened_at']
        constraints = [
            models.CheckConstraint(check=models.Q(user__isnull=False) | models.Q(guest_profile__isnull=False), name='progress_actor_required'),
            models.UniqueConstraint(fields=['user', 'content_type', 'object_id'], condition=models.Q(user__isnull=False), name='unique_user_progress'),
            models.UniqueConstraint(fields=['guest_profile', 'content_type', 'object_id'], condition=models.Q(guest_profile__isnull=False), name='unique_guest_progress'),
        ]


class RecommendationCache(models.Model):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name='recommendation_caches')
    guest_profile = models.ForeignKey(GuestProfile, null=True, blank=True, on_delete=models.CASCADE, related_name='recommendation_caches')
    recommendation_type = models.CharField(max_length=40, choices=RecommendationType.choices)
    payload = models.JSONField(default=dict, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    model_version = models.CharField(max_length=32, default='rules-v1')
    source_reasoning = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-generated_at']
        indexes = [models.Index(fields=['recommendation_type', 'expires_at'])]
        constraints = [
            models.CheckConstraint(check=models.Q(user__isnull=False) | models.Q(guest_profile__isnull=False), name='recommendation_cache_actor_required'),
        ]


class DailyPersonalizationSnapshot(models.Model):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name='daily_snapshots')
    guest_profile = models.ForeignKey(GuestProfile, null=True, blank=True, on_delete=models.CASCADE, related_name='daily_snapshots')
    snapshot_date = models.DateField()
    summary_payload = models.JSONField(default=dict, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-snapshot_date', '-generated_at']
        constraints = [
            models.CheckConstraint(check=models.Q(user__isnull=False) | models.Q(guest_profile__isnull=False), name='daily_snapshot_actor_required'),
        ]
