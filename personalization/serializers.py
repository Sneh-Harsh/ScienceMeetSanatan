from rest_framework import serializers

from .models import Bookmark, ContentInteraction, ReadingProgress, RecommendationCache, UserPreference


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
