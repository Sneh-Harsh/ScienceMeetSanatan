from django.db import models


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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user.username} • {self.category.slug} • {self.score}/{self.total_questions}"


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
