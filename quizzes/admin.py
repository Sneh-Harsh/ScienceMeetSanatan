from django.contrib import admin

from .models import Quiz, QuizAttempt, QuizCategory, QuizChoice, QuizLeaderboardEntry, QuizQuestion, UserQuizStats


class QuizChoiceInline(admin.TabularInline):
    model = QuizChoice
    extra = 1


class QuizQuestionInline(admin.StackedInline):
    model = QuizQuestion
    extra = 1


@admin.register(QuizCategory)
class QuizCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'is_active')
    search_fields = ('name', 'slug')
    list_filter = ('is_active',)


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'difficulty', 'is_published', 'total_questions')
    search_fields = ('title', 'slug')
    list_filter = ('category', 'difficulty', 'is_published')
    inlines = [QuizQuestionInline]


@admin.register(QuizQuestion)
class QuizQuestionAdmin(admin.ModelAdmin):
    list_display = ('quiz', 'prompt', 'difficulty', 'is_active')
    search_fields = ('prompt', 'quiz__title')
    list_filter = ('difficulty', 'is_active')
    inlines = [QuizChoiceInline]


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    list_display = ('quiz', 'user', 'guest_profile', 'percentage', 'score', 'attempt_status', 'is_eligible_for_leaderboard', 'started_at')
    search_fields = ('quiz__title', 'user__username', 'leaderboard_name_snapshot')
    list_filter = ('attempt_status', 'is_eligible_for_leaderboard', 'quiz__category')
    readonly_fields = ('answer_payload',)


@admin.register(QuizLeaderboardEntry)
class QuizLeaderboardEntryAdmin(admin.ModelAdmin):
    list_display = ('display_name', 'board_type', 'quiz', 'category', 'percentage', 'score', 'duration_seconds', 'updated_at')
    search_fields = ('display_name', 'user__username')
    list_filter = ('board_type', 'category', 'quiz')


@admin.register(UserQuizStats)
class UserQuizStatsAdmin(admin.ModelAdmin):
    list_display = ('user', 'total_attempts', 'best_score', 'average_score', 'streak_days', 'updated_at')
    search_fields = ('user__username',)
