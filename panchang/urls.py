from django.urls import path

from .views import core_festival_dates_api, core_festivals_api, panchang_api


urlpatterns = [
    path("api/panchang", panchang_api, name="panchang_api"),
    path("api/panchang/", panchang_api, name="panchang_api_slash"),
    path("api/core-festivals/", core_festivals_api, name="core_festivals_api"),
    path("api/core-festivals-dates/", core_festival_dates_api, name="core_festival_dates_api"),
]
