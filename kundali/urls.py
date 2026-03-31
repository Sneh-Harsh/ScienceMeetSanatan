from django.urls import path

from .views import horoscope_api, kundali_api


urlpatterns = [
    path("api/kundali", kundali_api, name="kundali_api"),
    path("api/kundali/", kundali_api, name="kundali_api_slash"),
    path("api/horoscope", horoscope_api, name="horoscope_api"),
    path("api/horoscope/", horoscope_api, name="horoscope_api_slash"),
]
