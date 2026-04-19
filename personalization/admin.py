from django.contrib import admin

from .models import (
    Bookmark,
    ContentInteraction,
    DailyPersonalizationSnapshot,
    ReadingProgress,
    RecommendationCache,
    ReviewFeedback,
    ReviewModerationStatus,
    UserPreference,
)


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


@admin.action(description='Approve selected reviews for public display')
def approve_reviews(modeladmin, request, queryset):
    queryset.update(
        moderation_status=ReviewModerationStatus.APPROVED,
        is_public=True,
    )


@admin.action(description='Reject selected reviews')
def reject_reviews(modeladmin, request, queryset):
    queryset.update(
        moderation_status=ReviewModerationStatus.REJECTED,
        is_public=False,
        is_featured=False,
    )


@admin.action(description='Mark selected reviews as featured')
def feature_reviews(modeladmin, request, queryset):
    queryset.update(
        moderation_status=ReviewModerationStatus.APPROVED,
        is_public=True,
        is_featured=True,
    )


@admin.register(ReviewFeedback)
class ReviewFeedbackAdmin(admin.ModelAdmin):
    list_display = (
        'rating_overall',
        'feature_type',
        'sentiment',
        'name_display',
        'title',
        'review_excerpt',
        'improvement_excerpt',
        'user',
        'guest_profile',
        'moderation_status',
        'is_public',
        'is_featured',
        'created_at',
    )
    search_fields = ('name_display', 'email', 'title', 'review_text', 'improvement_suggestion', 'user__username')
    list_filter = ('rating_overall', 'feature_type', 'sentiment', 'moderation_status', 'is_public', 'is_featured', 'created_at')
    readonly_fields = ('created_at', 'updated_at')
    actions = [approve_reviews, reject_reviews, feature_reviews]
    list_per_page = 25
    fieldsets = (
        (
            'Identity',
            {
                'fields': ('user', 'guest_profile', 'name_display', 'email', 'page_url'),
            },
        ),
        (
            'Review',
            {
                'fields': (
                    'feature_type',
                    'rating_overall',
                    'rating_ui',
                    'rating_content',
                    'rating_speed',
                    'sentiment',
                    'title',
                    'review_text',
                    'improvement_suggestion',
                ),
            },
        ),
        (
            'Visibility',
            {
                'fields': ('moderation_status', 'is_public', 'is_featured'),
            },
        ),
        (
            'Timestamps',
            {
                'fields': ('created_at', 'updated_at'),
            },
        ),
    )

    @admin.display(description='Review')
    def review_excerpt(self, obj):
        text = (obj.review_text or '').strip()
        if len(text) <= 80:
            return text
        return f'{text[:80]}…'

    @admin.display(description='Improvement')
    def improvement_excerpt(self, obj):
        text = (obj.improvement_suggestion or '').strip()
        if not text:
            return '—'
        if len(text) <= 80:
            return text
        return f'{text[:80]}…'
