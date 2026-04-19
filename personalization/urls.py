from django.urls import path

from .views import (
    InteractionCreateView,
    PanchaangPreferenceView,
    PublicReviewListView,
    RecommendationView,
    ReviewCreateView,
    ReviewStatsView,
    UserPreferenceView,
)

urlpatterns = [
    path('preferences/', UserPreferenceView.as_view(), name='preferences'),
    path('panchaang/preferences/', PanchaangPreferenceView.as_view(), name='panchaang_preferences'),
    path('interactions/', InteractionCreateView.as_view(), name='interaction_create'),
    path('recommendations/<str:recommendation_type>/', RecommendationView.as_view(), name='recommendation_view'),
    path('reviews/', ReviewCreateView.as_view(), name='review_create'),
    path('reviews/public/', PublicReviewListView.as_view(), name='public_reviews'),
    path('reviews/stats/', ReviewStatsView.as_view(), name='review_stats'),
]
