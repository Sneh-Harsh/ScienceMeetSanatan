from django.contrib import admin

from .models import Category, LoginAttempt, QuizAttempt, UserStats


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    list_display = ('username', 'provider', 'success', 'created_at')
    list_filter = ('provider', 'success', 'created_at')
    search_fields = ('username',)
    ordering = ('-created_at',)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at")
    search_fields = ("name", "slug")
    ordering = ("name",)


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    list_display = ("user", "category", "score", "total_questions", "attempt_best_streak", "created_at")
    list_filter = ("category", "created_at")
    search_fields = ("user__username", "category__name", "category__slug")
    ordering = ("-created_at",)


@admin.register(UserStats)
class UserStatsAdmin(admin.ModelAdmin):
    list_display = ("user", "total_score", "highest_score", "best_streak", "updated_at")
    search_fields = ("user__username",)
    ordering = ("-total_score", "-highest_score")
