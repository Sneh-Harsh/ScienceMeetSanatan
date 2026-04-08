from django.urls import path

from .views import horoscope_api, kundali_api


urlpatterns = [
    path("api/kundali", kundali_api, name="kundali_api"),
    path("api/kundali/", kundali_api, name="kundali_a