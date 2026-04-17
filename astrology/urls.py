from django.urls import path

from .views import HoroscopeFeedView, HoroscopeTodayView, KundaliGenerateView, KundaliListView, KundaliRecommendationsView, KundaliSaveView

urlpatterns = [
    path('kundali/generate/', KundaliGenerateView.as_view(), name='kundali_generate_v2'),
    path('kundali/save/', KundaliSaveView.as_view(), name='kundali_save_v2'),
    path('kundali/', KundaliListView.as_view(), name='kundali_list_v2'),
    path('kundali/<int:pk>/recommendations/', KundaliRecommendationsView.as_view(), name='kundali_recommendations_v2'),
    path('horoscope/today/', HoroscopeTodayView.as_view(), name='horoscope_today_v2'),
    path('horoscope/feed/', HoroscopeFeedView.as_view(), name='horoscope_feed_v2'),
]
