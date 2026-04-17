from rest_framework import serializers

from .models import MantraRecommendationRule, SavedHoroscopePreference, SavedKundali, SavedPanchaangPreference


class SavedKundaliSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedKundali
        exclude = ['user']


class SavedHoroscopePreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedHoroscopePreference
        exclude = ['user']


class SavedPanchaangPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedPanchaangPreference
        exclude = ['user', 'guest_profile']


class MantraRecommendationRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = MantraRecommendationRule
        fields = '__all__'
