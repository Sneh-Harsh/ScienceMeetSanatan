from django.contrib import admin

from .models import Category, GuestProfile, LoginAttempt, PersonProfile, QuizAttempt, UserAccount, UserStats


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


@admin.register(GuestProfile)
class GuestProfileAdmin(admin.ModelAdmin):
    list_display = ("guest_uuid", "preferred_language", "preferred_location_name", "consent_personalization", "consent_astrology_storage", "merged_into_user", "is_active", "last_seen_at")
    search_fields = ("guest_uuid", "preferred_location_name", "merged_into_user__username")
    list_filter = ("is_active", "consent_personalization", "consent_astrology_storage")
    readonly_fields = ("created_at", "last_seen_at")
    actions = ["mark_inactive"]

    @admin.action(description="Mark guest profiles inactive")
    def mark_inactive(self, request, queryset):
        queryset.update(is_active=False)


@admin.register(UserAccount)
class UserAccountAdmin(admin.ModelAdmin):
    list_display = ("user", "full_name", "preferred_language", "onboarding_completed", "updated_at")
    search_fields = ("user__username", "full_name")


@admin.register(PersonProfile)
class PersonProfileAdmin(admin.ModelAdmin):
    list_display = ("display_name", "user", "profile_type", "birth_date", "birth_place_name", "is_primary", "is_archived")
    search_fields = ("display_name", "user__username", "birth_place_name")
    list_filter = ("profile_type", "is_primary", "is_archived")
