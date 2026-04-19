from rest_framework import serializers

from .models import (
    Bookmark,
    ContentInteraction,
    ReadingProgress,
    RecommendationCache,
    ReviewFeedback,
    ReviewSentiment,
    UserPreference,
)


class UserPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreference
        exclude = ['user']


class ContentInteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentInteraction
        fields = ['id', 'content_type', 'object_id', 'interaction_type', 'metadata', 'occurred_at']
        read_only_fields = ['id', 'occurred_at']


class BookmarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bookmark
        fields = ['id', 'content_type', 'object_id', 'source_context', 'created_at']
        read_only_fields = ['id', 'created_at']


class ReadingProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReadingProgress
        fields = ['id', 'content_type', 'object_id', 'progress_percent', 'progress_seconds', 'last_position_reference', 'started_at', 'last_opened_at', 'completed_at']
        read_only_fields = ['id', 'started_at', 'last_opened_at', 'completed_at']

    def validate_progress_percent(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError('progress_percent must be in the range 0..100.')
        return value


class RecommendationCacheSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecommendationCache
        fields = ['recommendation_type', 'payload', 'generated_at', 'expires_at', 'model_version', 'source_reasoning']


class ReviewFeedbackCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewFeedback
        fields = [
            'id',
            'name_display',
            'email',
            'feature_type',
            'page_url',
            'rating_overall',
            'rating_ui',
            'rating_content',
            'rating_speed',
            'title',
            'review_text',
            'improvement_suggestion',
            'sentiment',
            'is_public',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        for field_name in ('rating_overall', 'rating_ui', 'rating_content', 'rating_speed'):
            value = attrs.get(field_name)
            if value is None:
                continue
            if value < 1 or value > 5:
                raise serializers.ValidationError({field_name: 'Ratings must be between 1 and 5.'})

        review_text = str(attrs.get('review_text') or '').strip()
        if len(review_text) < 8:
            raise serializers.ValidationError({'review_text': 'Please share a little more detail.'})

        attrs['review_text'] = review_text
        attrs['improvement_suggestion'] = str(attrs.get('improvement_suggestion') or '').strip()
        attrs['title'] = str(attrs.get('title') or '').strip()
        attrs['page_url'] = str(attrs.get('page_url') or '').strip()
        attrs['name_display'] = str(attrs.get('name_display') or '').strip()
        attrs['email'] = str(attrs.get('email') or '').strip()

        if not attrs.get('sentiment'):
            rating = attrs.get('rating_overall') or 0
            if rating >= 5:
                attrs['sentiment'] = ReviewSentiment.LOVED
            elif rating >= 3:
                attrs['sentiment'] = ReviewSentiment.GOOD
            else:
                attrs['sentiment'] = ReviewSentiment.NEEDS_IMPROVEMENT
        return attrs


class PublicReviewSerializer(serializers.ModelSerializer):
    feature_label = serializers.CharField(source='get_feature_type_display', read_only=True)
    created_label = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()

    class Meta:
        model = ReviewFeedback
        fields = [
            'id',
            'name_display',
            'initials',
            'feature_type',
            'feature_label',
            'rating_overall',
            'title',
            'review_text',
            'sentiment',
            'created_label',
        ]

    def get_created_label(self, obj):
        return obj.created_at.strftime('%b %Y')

    def get_initials(self, obj):
        name = (obj.name_display or 'Seeker').strip()
        parts = [part for part in name.split() if part]
        if not parts:
            return 'S'
        return ''.join(part[0].upper() for part in parts[:2])


class ReviewStatsSerializer(serializers.Serializer):
    average_rating = serializers.FloatField()
    total_reviews = serializers.IntegerField()
    rating_breakdown = serializers.DictField(child=serializers.IntegerField())
