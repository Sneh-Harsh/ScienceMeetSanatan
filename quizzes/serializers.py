from rest_framework import serializers

from .models import Quiz, QuizAttempt, QuizCategory, QuizChoice, QuizLeaderboardEntry, QuizQuestion


class QuizChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizChoice
        fields = ['id', 'text', 'order']


class QuizQuestionSerializer(serializers.ModelSerializer):
    choices = QuizChoiceSerializer(many=True, read_only=True)

    class Meta:
        model = QuizQuestion
        fields = ['id', 'prompt', 'question_type', 'difficulty', 'metadata', 'choices']


class QuizSerializer(serializers.ModelSerializer):
    category = serializers.StringRelatedField()

    class Meta:
        model = Quiz
        fields = ['id', 'title', 'slug', 'description', 'difficulty', 'total_questions', 'time_limit_seconds', 'category']


class QuizAttemptSubmitSerializer(serializers.Serializer):
    answers = serializers.ListField(child=serializers.DictField(), allow_empty=False)
    duration_seconds = serializers.IntegerField(min_value=0, required=False, default=0)
    device_fingerprint = serializers.CharField(required=False, allow_blank=True)


class QuizResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizAttempt
        fields = ['id', 'score', 'correct_count', 'incorrect_count', 'unanswered_count', 'percentage', 'duration_seconds', 'attempt_status', 'is_eligible_for_leaderboard', 'leaderboard_name_snapshot']


class LeaderboardEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizLeaderboardEntry
        fields = ['display_name', 'score', 'percentage', 'duration_seconds', 'attempts_count', 'board_type', 'period_start', 'period_end', 'updated_at']
