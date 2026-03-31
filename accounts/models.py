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