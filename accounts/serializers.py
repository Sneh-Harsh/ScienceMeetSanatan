from django.contrib.auth.models import User
from rest_framework import serializers

from .models import GuestProfile, PersonProfile, UserAccount


class GuestProfileBootstrapSerializer(serializers.ModelSerializer):
    class Meta:
        model = GuestProfile
        fields = ['guest_uuid', 'preferred_language', 'preferred_location_name', 'consent_personalization', 'consent_astrology_storage', 'is_active']


class UserAccountSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = UserAccount
        fields = ['username', 'email', 'full_name', 'avatar', 'preferred_language', 'onboarding_completed']


class UserSummarySerializer(serializers.ModelSerializer):
    account_profile = UserAccountSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'account_profile']


class PersonProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonProfile
        exclude = ['user']

    def validate(self, attrs):
        request = self.context['request']
        if not request.user.is_authenticated:
            raise serializers.ValidationError('Authentication required for person profiles.')
        return attrs
