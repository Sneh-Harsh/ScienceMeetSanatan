from django.conf import settings
from django.contrib import admin
from django.urls import include, path

from panchang.urls import urlpatterns as panchang_urls
from kundali.urls import urlpatterns as kundali_urls

from accounts.views import (
    api_leaderboard,
    api_leaderboard_category,
    api_library_detail,
    api_library_items,
    api_submit_score,
    apple_login_start,
    baby_names_page,
    google_login_start,
    horoscope_page,
    library_detail_page,
    library_page,
    login_page,
    kundali_page,
    panchang_page,
    profile_page,
    quizzes_page,
    welcome_page,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', login_page, name='login'),
    path('welcome/', welcome_page, name='welcome'),
    path('baby-names/', baby_names_page, name='baby_names'),
    path('quizzes/', quizzes_page, name='quizzes'),
    path('profile/', profile_page, name='profile'),
    path('library/', library_page, name='library'),
    path('library/<slug:slug>/', library_detail_page, name='library_detail'),
    path('aartis/<slug:slug>/', library_detail_page, name='aarti_detail'),
    path('panchang/', panchang_page, name='panchang'),
    path('kundali/', kundali_page, name='kundali'),
    path('horoscope/', horoscope_page, name='horoscope'),
    path('api/library/', api_library_items, name='api_library_items'),
    path('api/library/<slug:slug>/', api_library_detail, name='api_library_detail'),
    path('api/leaderboard/', api_leaderboard, name='api_leaderboard'),
    path('api/leaderboard/<slug:category_slug>/', api_leaderboard_category, name='api_leaderboard_category'),
    path('api/submit-score/', api_submit_score, name='api_submit_score'),
    path('oauth/google/', google_login_start, name='google_login_start'),
    path('oauth/apple/', apple_login_start, name='apple_login_start'),
]

urlpatterns += panchang_urls
urlpatterns += kundali_urls

if settings.SOCIAL_AUTH_ENABLED:
    urlpatterns.insert(1, path('oauth/', include('social_django.urls', namespace='social')))
