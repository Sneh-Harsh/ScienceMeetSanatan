from django.contrib import admin

from .models import MantraRecommendationRule, SavedHoroscopePreference, SavedKundali, SavedPanchaangPreference


@admin.register(SavedKundali)
class SavedKundaliAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'person_profile', 'source_type', 'consent_confirmed', 'created_at')
    search_fields = ('title', 'user__username', 'person_profile__display_name')
    list_filter = ('source_type', 'consent_confirmed')
    readonly_fields = ('chart_payload', 'summary_payload', 'recommendation_payload')


@admin.register(SavedHoroscopePreference)
class SavedHoroscopePreferenceAdmin(admin.ModelAdmin):
    list_display = ('user', 'person_profile', 'horoscope_type', 'sign_type', 'notification_enabled')
    list_filter = ('horoscope_type', 'sign_type', 'notification_enabled')


@admin.register(SavedPanchaangPreference)
class SavedPanchaangPreferenceAdmin(admin.ModelAdmin):
    list_display = ('city_name', 'user', 'guest_profile', 'updated_at')
    search_fields = ('city_name', 'user__username')


@admin.register(MantraRecommendationRule)
class MantraRecommendationRuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'rule_type', 'priority', 'is_active')
    list_filter = ('rule_type', 'is_active')
    search_fields = ('name',)
