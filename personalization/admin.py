from django.contrib import admin

from .models import Bookmark, ContentInteraction, DailyPersonalizationSnapshot, ReadingProgress, RecommendationCache, UserPreference


@admin.register(UserPreference)
class UserPreferenceAdmin(admin.ModelAdmin):
    list_display = ('user', 'preferred_language', 'preferred_city', 'astrology_personalization_enabled', 'quiz_public_profile_enabled', 'updated_at')
    search_fields = ('user__username', 'preferred_city')
    list_filter = ('preferred_language', 'astrology_personalization_enabled', 'quiz_public_profile_enabled')


@admin.register(ContentInteraction)
class ContentInteractionAdmin(admin.ModelAdmin):
    list_display = ('content_type', 'object_id', 'interaction_type', 'user', 'guest_profile', 'occurred_at')
    search_fields = ('object_id', 'user__username')
    list_filter = ('content_type', 'interaction_type', 'occurred_at')


@admin.register(Bookmark)
class BookmarkAdmin(admin.ModelAdmin):
    list_display = ('content_type', 'object_id', 'user', 'guest_profile', 'created_at')
    search_fields = ('object_id', 'user__username')
    list_filter = ('content_type', 'created_at')


@admin.register(ReadingProgress)
class ReadingProgressAdmin(admin.ModelAdmin):
    list_display = ('content_type', 'object_id', 'progress_percent', 'user', 'guest_profile', 'last_opened_at', 'completed_at')
    search_fields = ('object_id', 'user__username')
    list_filter = ('content_type', 'completed_at')


@admin.register(RecommendationCache)
class RecommendationCacheAdmin(admin.ModelAdmin):
    list_display = ('recommendation_type', 'user', 'guest_profile', 'model_version', 'generated_at', 'expires_at')
    list_filter = ('recommendation_type', 'model_version')


@admin.register(DailyPersonalizationSnapshot)
class DailyPersonalizationSnapshotAdmin(admin.ModelAdmin):
    list_display = ('snapshot_date', 'user', 'guest_profile', 'generated_at')
    list_filter = ('snapshot_date',)
