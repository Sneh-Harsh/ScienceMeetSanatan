from django.conf import settings
from django.contrib import admin
from django.urls import include, path

from panchang.urls import urlpatterns as panchang_urls
from kundali.urls import urlpatterns as kundali_urls
from gita_site.views import healthz

from accounts.views import (
    api_leaderboard,
    api_leaderboard_category,
    api_library_detail,
    api_library_items,
    api_quiz_session,
    api_submit_score,
    welcome_insights_api,
    welcome_raashi_api,
    welcome_festivals_api,
    apple_login_start,
    baby_names_page,
    google_login_start,
    horoscope_page,
    library_collection_page,
    library_detail_page,
    library_page,
    login_page,
    logout_page,
    kundali_page,
    panchang_page,
    profile_page,
    quizzes_page,
    welcome_page,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('healthz/', healthz, name='healthz'),
    path('api/', include('accounts.urls')),
    path('api/', include('personalization.urls')),
    path('api/', include('library.urls')),
    path('api/', include('astrology.urls')),
    path('api/', include('quizzes.urls')),
    path('api/', include('dashboard.urls')),
    path('', welcome_page, name='home'),
    path('login/', login_page, name='login'),
    path('logout/', logout_page, name='logout'),
    path('welcome/', welcome_page, name='welcome'),
    path('baby-names/', baby_names_page, name='baby_names'),
    path('quizzes/', quizzes_page, name='quizzes'),
    path('profile/', profile_page, name='profile'),
    path('library/', library_page, name='library'),
    path('library/collections/<slug:collection_slug>/', library_collection_page, name='library_collection'),
    path('library/<slug:slug>/', library_detail_page, name='library_detail'),
    path('aartis/<slug:slug>/', library_detail_page, name='aarti_detail'),
    path('panchang/', panchang_page, name='panchang'),
    path('kundali/', kundali_page, name='kundali'),
    path('horoscope/', horoscope_page, name='horoscope'),
    path('api/library/', api_library_items, name='api_library_items'),
    path('api/library/<slug:slug>/', api_library_detail, name='api_library_detail'),
    path('api/quiz-session/', api_quiz_session, name='api_quiz_session'),
    path('api/leaderboard/', api_leaderboard, name='api_leaderboard'),
    path('api/leaderboard/<slug:category_slug>/', api_leaderboard_category, name='api_leaderboard_category'),
    path('api/submit-score/', api_submit_score, name='api_submit_score'),
    path('api/welcome-insights/', welcome_insights_api, name='api_welcome_insights'),
    path('api/welcome-raashi/', welcome_raashi_api, name='api_welcome_raashi'),
    path('api/welcome-festivals/', welcome_festivals_api, name='api_welcome_festivals'),
    path('oauth/google/', google_login_start, name='google_login_start'),
    path('oauth/apple/', apple_login_start, name='apple_login_start'),
]

urlpatterns += panchang_urls
urlpatterns += kundali_urls

if settings.SOCIAL_AUTH_ENABLED:
    urlpatterns.insert(1, path('oauth/', include('social_django.urls', namespace='social')))
