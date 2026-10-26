from django.urls import path

from .views import horoscope_api, horoscope_summary_api, kundali_api, oracle_api, oracle_stream_api, place_search_api, place_reverse_api


urlpatterns = [
    path("api/kundali", kundali_api, name="kundali_api"),
    path("api/kundali/", kundali_api, name="kundali_api_slash"),
    path("api/horoscope", horoscope_api, name="horoscope_api"),
    path("api/horoscope/", horoscope_api, name="horoscope_api_slash"),
    path("api/places/search", place_search_api, name="place_search_api"),
    path("api/places/search/", place_search_api, name="place_search_api_slash"),
    path("api/places/reverse", place_reverse_api, name="place_reverse_api"),
    path("api/oracle", oracle_api, name="oracle_api"),
    path("api/oracle/", oracle_api, name="oracle_api_slash"),
    path("api/oracle/stream", oracle_stream_api, name="oracle_stream_api"),
    path("api/oracle/stream/", oracle_stream_api, name="oracle_stream_api_slash"),
    path("api/horoscope-summary", horoscope_summary_api, name="horoscope_summary_api"),
    path("api/horoscope-summary/", horoscope_summary_api, name="horoscope_summary_api_slash"),
]
