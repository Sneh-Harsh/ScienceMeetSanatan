from django.db import models
from django.contrib.auth.models import User

from core.utils.constants import ProfileType


class LoginAttempt(models.Model):
    PROVIDER_PASSWORD = 'password'
    PROVIDER_GOOGLE = 'google'
    PROVIDER_APPLE = 'apple'

    PROVIDER_CHOICES = [
        (PROVIDER_PASSWORD, 'Password'),
        (PROVIDER_GOOGLE, 'Google'),
        (PROVIDER_APPLE, 'Apple ID'),
    ]

    username = models.CharField(max_length=150)
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default=PROVIDER_PASSWORD)
    success = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        status = 'success' if self.success else 'failed'
        return f'{self.username} ({self.provider}) - {status}'


class GuestProfile(models.Model):
    guest_uuid = models.UUIDField(unique=True, db_index=True)
    session_key = models.CharField(max_length=80, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    last_ip = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    preferred_language = models.CharField(max_length=20, default='en')
    preferred_location_name = models.CharField(max_length=120, blank=True)
    preferred_location_lat = models.FloatField(blank=True, null=True)
    preferred_location_lng = models.FloatField(blank=True, null=True)
    consent_personalization = models.BooleanField(default=True)
    consent_astrology_storage = models.BooleanField(default=False)
    merged_into_user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='merged_guest_profiles')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-last_seen_at']

    def __str__(self) -> str:
        return f'{self.guest_uuid}{" merged" if self.merged_into_user_id else ""}'


class UserAccount(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='account_profile')
    full_name = models.CharField(max_length=255, blank=True)
    avatar = models.URLField(blank=True)
    preferred_language = models.CharField(max_length=20, default='en')
    onboarding_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['user__username']

    def __str__(self) -> str:
        return self.full_name or self.user.username


class PersonProfile(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='person_profiles')
    profile_type = models.CharField(max_length=20, choices=ProfileType.choices, default=ProfileType.SELF)
    display_name = models.CharField(max_length=120)
    relationship_label = models.CharField(max_length=120, blank=True)
    birth_date = models.DateField()
    birth_time = models.TimeField(blank=True, null=True)
    birth_place_name = models.CharField(max_length=160)
    birth_lat = models.FloatField(blank=True, null=True)
    birth_lng = models.FloatField(blank=True, null=True)
    gender = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)
    is_primary = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_primary', 'display_name']
        constraints = [
            models.UniqueConstraint(fields=['user'], condition=models.Q(is_primary=True, profile_type=ProfileType.SELF), name='accounts_single_primary_self_profile'),
        ]

    def __str__(self) -> str:
        return f'{self.display_name} ({self.user.username})'


class Category(models.Model):
    slug = models.SlugField(max_length=60, unique=True)
    name = models.CharField(max_length=120, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class QuizAttempt(models.Model):
    user = models.ForeignKey("auth.User", on_delete=models.CASCADE, related_name="quiz_attempts")
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="attempts")
    score = models.PositiveIntegerField()
    total_questions = models.PositiveIntegerField()
    attempt_best_streak = models.PositiveIntegerField(default=0)
    session_token = models.CharField(max_length=64, blank=True, default="", db_index=True)
    selected_question_ids = models.JSONField(default=list, blank=True)
    answer_payload = models.JSONField(default=list, blank=True)
    accuracy = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user.username} • {self.category.slug} • {self.score}/{self.total_questions}"


class QuizQuestionMemory(models.Model):
    user = models.ForeignKey("auth.User", on_delete=models.CASCADE, related_name="quiz_question_memory")
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="question_memory")
    question_id = models.CharField(max_length=120)
    seen_count = models.PositiveIntegerField(default=0)
    correct_count = models.PositiveIntegerField(default=0)
    incorrect_count = models.PositiveIntegerField(default=0)
    last_result_correct = models.BooleanField(default=False)
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_seen_at"]
        unique_together = [("user", "category", "question_id")]

    def __str__(self) -> str:
        return f"{self.user.username} • {self.category.slug} • {self.question_id}"


class UserStats(models.Model):
    user = models.OneToOneField("auth.User", on_delete=models.CASCADE, related_name="user_stats")
    total_score = models.PositiveIntegerField(default=0)
    highest_score = models.PositiveIntegerField(default=0)
    best_streak = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-total_score", "-highest_score"]

    def __str__(self) -> str:
        return f"{self.user.username} • total={self.total_score}"
