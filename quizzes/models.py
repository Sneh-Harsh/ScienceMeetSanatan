from django.contrib.auth.models import User
from django.db import models

from accounts.models import GuestProfile


class QuizCategory(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=40, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']


class Quiz(models.Model):
    category = models.ForeignKey(QuizCategory, on_delete=models.CASCADE, related_name='quizzes')
    title = models.CharField(max_length=160)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    difficulty = models.CharField(max_length=30, blank=True)
    is_published = models.BooleanField(default=True)
    total_questions = models.PositiveIntegerField(default=0)
    time_limit_seconds = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['title']


class QuizQuestion(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='questions')
    prompt = models.TextField()
    question_type = models.CharField(max_length=30, default='single_choice')
    explanation = models.TextField(blank=True)
    difficulty = models.CharField(max_length=30, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['id']


class QuizChoice(models.Model):
    question = models.ForeignKey(QuizQuestion, on_delete=models.CASCADE, related_name='choices')
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']


class QuizAttempt(models.Model):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name='new_quiz_attempts')
    guest_profile = models.ForeignKey(GuestProfile, null=True, blank=True, on_delete=models.CASCADE, related_name='new_quiz_attempts')
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='attempts')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    score = models.FloatField(default=0)
    correct_count = models.PositiveIntegerField(default=0)
    incorrect_count = models.PositiveIntegerField(default=0)
    unanswered_count = models.PositiveIntegerField(default=0)
    percentage = models.FloatField(default=0)
    duration_seconds = models.PositiveIntegerField(default=0)
    attempt_status = models.CharField(max_length=20, default='started')
    answer_payload = models.JSONField(default=list, blank=True)
    device_fingerprint = models.CharField(max_length=120, blank=True)
    is_eligible_for_leaderboard = models.BooleanField(default=False)
    leaderboard_name_snapshot = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ['-started_at']
        constraints = [
            models.CheckConstraint(check=models.Q(user__isnull=False) | models.Q(guest_profile__isnull=False), name='quiz_attempt_actor_required'),
        ]


class QuizLeaderboardEntry(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='quiz_leaderboards')
    quiz = models.ForeignKey(Quiz, null=True, blank=True, on_delete=models.CASCADE, related_name='leaderboard_entries')
    category = models.ForeignKey(QuizCategory, null=True, blank=True, on_delete=models.CASCADE, related_name='leaderboard_entries')
    board_type = models.CharField(max_length=30)
    score = models.FloatField(default=0)
    percentage = models.FloatField(default=0)
    duration_seconds = models.PositiveIntegerField(default=0)
    attempts_count = models.PositiveIntegerField(default=0)
    rank_score = models.FloatField(default=0)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    display_name = models.CharField(max_length=120)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-rank_score', '-percentage', 'duration_seconds', 'updated_at']
        indexes = [models.Index(fields=['board_type', 'period_start', 'period_end'])]


class UserQuizStats(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='quiz_stats_v2')
    total_attempts = models.PositiveIntegerField(default=0)
    best_score = models.FloatField(default=0)
    average_score = models.FloatField(default=0)
    streak_days = models.PositiveIntegerField(default=0)
    strongest_categories = models.JSONField(default=list, blank=True)
    weakest_categories = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
