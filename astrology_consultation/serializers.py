from __future__ import annotations

from rest_framework import serializers

from accounts.models import PersonProfile
from astrology_consultation.models import (
    AstrologerAvailability,
    AstrologerProfile,
    AstrologerReview,
    BirthShareMode,
    ChatMessage,
    ChatSession,
    FavoriteAstrologer,
    Wallet,
    WalletTransaction,
)


class AstrologerAvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = AstrologerAvailability
        fields = ['id', 'day_of_week', 'start_time', 'end_time', 'is_available']


class AstrologerReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AstrologerReview
        fields = ['id', 'rating', 'comment', 'user_name', 'created_at']

    def get_user_name(self, obj):
        return obj.user.first_name or obj.user.username


class AstrologerCardSerializer(serializers.ModelSerializer):
    expertise_preview = serializers.SerializerMethodField()
    online_status = serializers.SerializerMethodField()
    free_chat_badge = serializers.SerializerMethodField()

    class Meta:
        model = AstrologerProfile
        fields = [
            'id', 'display_name', 'slug', 'photo', 'experience_years', 'rating',
            'total_consultations', 'price_per_minute', 'languages', 'city', 'is_verified',
            'is_online', 'available_today', 'response_time', 'estimated_wait_time',
            'repeat_users_percent', 'trust_note', 'expertise', 'expertise_preview',
            'online_status', 'free_chat_badge',
        ]

    def get_expertise_preview(self, obj):
        return obj.expertise[:3]

    def get_online_status(self, obj):
        return 'Online now' if obj.is_online else 'Available today' if obj.available_today else 'Offline'

    def get_free_chat_badge(self, obj):
        return f'First {obj.free_minutes_override} min free' if obj.free_first_chat_enabled else ''


class AstrologerDetailSerializer(AstrologerCardSerializer):
    availability_windows = AstrologerAvailabilitySerializer(many=True, read_only=True)
    reviews = AstrologerReviewSerializer(many=True, read_only=True)
    is_favorite = serializers.SerializerMethodField()

    class Meta(AstrologerCardSerializer.Meta):
        fields = AstrologerCardSerializer.Meta.fields + [
            'bio', 'topic_strengths', 'consultation_modes', 'identity_verified', 'skill_verified',
            'availability_windows', 'reviews', 'is_favorite',
        ]

    def get_is_favorite(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return FavoriteAstrologer.objects.filter(user=request.user, astrologer=obj).exists()


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = ['balance', 'currency', 'first_chat_free_consumed', 'updated_at']


class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = ['id', 'amount', 'transaction_type', 'reason', 'created_at']


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'sender', 'message', 'message_type', 'created_at', 'read_at']


class ChatSessionSerializer(serializers.ModelSerializer):
    astrologer = AstrologerCardSerializer(read_only=True)
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model = ChatSession
        fields = [
            'public_id', 'status', 'question_topic', 'started_at', 'ended_at', 'rate_per_minute',
            'free_minutes', 'total_duration_seconds', 'total_charge', 'birth_profile_shared',
            'kundali_snapshot', 'ai_prechat_summary', 'astrologer_typing', 'low_balance_notified',
            'astrologer', 'messages', 'created_at',
        ]


class StartChatSessionSerializer(serializers.Serializer):
    astrologer_id = serializers.PrimaryKeyRelatedField(source='astrologer', queryset=AstrologerProfile.objects.filter(is_active=True))
    topic = serializers.CharField(required=False, allow_blank=True, max_length=200)
    birth_share_mode = serializers.ChoiceField(choices=BirthShareMode.choices, default=BirthShareMode.NONE)
    person_profile_id = serializers.PrimaryKeyRelatedField(source='person_profile', queryset=PersonProfile.objects.all(), required=False, allow_null=True)

    def validate_person_profile_id(self, value):
        # DRF names this hook after the field (person_profile_id), not its source.
        request = self.context.get('request')
        if value is not None and (request is None or value.user_id != request.user.id or value.is_archived):
            raise serializers.ValidationError('Invalid birth profile.')
        return value


class SendMessageSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=2000, trim_whitespace=True)


class EndSessionSerializer(serializers.Serializer):
    ended_by = serializers.ChoiceField(choices=['user', 'timeout'], required=False, default='user')


class RechargeSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=1, max_value=5000)


class ReviewCreateSerializer(serializers.Serializer):
    session_id = serializers.UUIDField(required=False)
    astrologer_id = serializers.PrimaryKeyRelatedField(source='astrologer', queryset=AstrologerProfile.objects.filter(is_active=True))
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class AstrologerDashboardUpdateSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=140, required=False)
    bio = serializers.CharField(max_length=3000, required=False, allow_blank=True)
    city = serializers.CharField(max_length=120, required=False, allow_blank=True)
    is_online = serializers.BooleanField(required=False)
    available_today = serializers.BooleanField(required=False)
    price_per_minute = serializers.IntegerField(min_value=1, max_value=5000, required=False)
    response_time = serializers.IntegerField(min_value=0, max_value=1440, required=False)
    estimated_wait_time = serializers.IntegerField(min_value=0, max_value=1440, required=False)
    trust_note = serializers.CharField(max_length=180, required=False, allow_blank=True)
    languages = serializers.ListField(child=serializers.CharField(max_length=60), max_length=20, required=False)
    expertise = serializers.ListField(child=serializers.CharField(max_length=60), max_length=20, required=False)
    topic_strengths = serializers.ListField(child=serializers.CharField(max_length=60), max_length=20, required=False)
    consultation_modes = serializers.ListField(child=serializers.CharField(max_length=60), max_length=10, required=False)

    def to_internal_value(self, data):
        # Accept comma separated strings for list fields, as the dashboard form sends them.
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        for field in ('languages', 'expertise', 'topic_strengths', 'consultation_modes'):
            value = data.get(field)
            if isinstance(value, str):
                data[field] = [item.strip() for item in value.split(',') if item.strip()]
        return super().to_internal_value(data)
