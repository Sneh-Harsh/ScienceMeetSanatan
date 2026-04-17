from django.contrib.auth.models import User
from django.db import models

from accounts.models import GuestProfile, PersonProfile
from core.utils.constants import HoroscopeSignType, HoroscopeType


def _check_constraint(*, name: str, condition):
    try:
        return models.CheckConstraint(condition=condition, name=name)
    except TypeError:
        return models.CheckConstraint(check=condition, name=name)


class SavedKundali(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_kundalis')
    person_profile = models.ForeignKey(PersonProfile, on_delete=models.CASCADE, related_name='saved_kundalis')
    title = models.CharField(max_length=140)
    source_type = models.CharField(max_length=20, default='generated')
    chart_payload = models.JSONField(default=dict, blank=True)
    summary_payload = models.JSONField(default=dict, blank=True)
    recommendation_payload = models.JSONField(default=dict, blank=True)
    consent_confirmed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class SavedHoroscopePreference(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='horoscope_preferences')
    person_profile = models.ForeignKey(PersonProfile, null=True, blank=True, on_delete=models.SET_NULL, related_name='horoscope_preferences')
    horoscope_type = models.CharField(max_length=20, choices=HoroscopeType.choices)
    sign_type = models.CharField(max_length=20, choices=HoroscopeSignType.choices, default=HoroscopeSignType.CHART_BASED)
    preferred_language = models.CharField(max_length=20, default='en')
    notification_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class SavedPanchaangPreference(models.Model):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name='panchaang_preferences')
    guest_profile = models.ForeignKey(GuestProfile, null=True, blank=True, on_delete=models.CASCADE, related_name='panchaang_preferences')
    city_name = models.CharField(max_length=120)
    latitude = models.FloatField()
    longitude = models.FloatField()
    preferred_sections = models.JSONField(default=list, blank=True)
    notification_settings = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            _check_constraint(
                condition=models.Q(user__isnull=False) | models.Q(guest_profile__isnull=False),
                name='panchaang_preference_actor_required',
            ),
            models.UniqueConstraint(fields=['user'], condition=models.Q(user__isnull=False), name='unique_user_panchaang_preference'),
            models.UniqueConstraint(fields=['guest_profile'], condition=models.Q(guest_profile__isnull=False), name='unique_guest_panchaang_preference'),
        ]


class MantraRecommendationRule(models.Model):
    name = models.CharField(max_length=120)
    rule_type = models.CharField(max_length=40)
    trigger_config = models.JSONField(default=dict, blank=True)
    recommendation_config = models.JSONField(default=dict, blank=True)
    priority = models.PositiveIntegerField(default=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['priority', 'name']
