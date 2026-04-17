from django.urls import path

from .views import InteractionCreateView, PanchaangPreferenceView, RecommendationView, UserPreferenceView

urlpatterns = [
    path('preferences/', UserPreferenceView.as_view(), name='preferences'),
    path('panchaang/preferences/', PanchaangPreferenceView.as_view(), name='panchaang_preferences'),
    path('interactions/', InteractionCreateView.as_view(), name='interaction_create'),
    path('recommendations/<str:recommendation_type>/', RecommendationView.as_view(), name='recommendation_view'),
]
