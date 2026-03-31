from django.contrib import admin

from .models import Category, LoginAttempt, QuizAttempt, UserStats


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    list_display = ('username', 'provider', 'success', 'created_at')
    list_filter = ('provider', 'success', 'created_at')
    search_fields = ('username'