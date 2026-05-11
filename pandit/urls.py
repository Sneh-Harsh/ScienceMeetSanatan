from django.urls import path

from .views import (
    BookingCreateApiView,
    BookingHistoryApiView,
    BookingStatusApiView,
    PanditDashboardAvailabilityApiView,
    PanditDashboardBookingStatusApiView,
    PanditDashboardProfileApiView,
    PanditDashboardServicesApiView,
    PanditDetailApiView,
    PanditListApiView,
    ReviewCreateApiView,
    ServiceListApiView,
    pandit_dashboard_page,
    pandit_marketplace_page,
    pandit_profile_page,
)


urlpatterns = [
    path("pandits/", pandit_marketplace_page, name="pandit_marketplace"),
    path("pandits/dashboard/", pandit_dashboard_page, name="pandit_dashboard"),
    path("pandits/<slug:slug>/", pandit_profile_page, name="pandit_profile"),
    path("api/pandits/", PanditListApiView.as_view(), name="api_pandit_list"),
    path("api/pandits/services/", ServiceListApiView.as_view(), name="api_pandit_services"),
    path("api/pandits/bookings/", BookingCreateApiView.as_view(), name="api_pandit_booking_create"),
    path("api/pandits/bookings/history/", BookingHistoryApiView.as_view(), name="api_pandit_booking_history"),
    path("api/pandits/bookings/<int:booking_id>/status/", BookingStatusApiView.as_view(), name="api_pandit_booking_status"),
    path("api/pandits/dashboard/profile/", PanditDashboardProfileApiView.as_view(), name="api_pandit_dashboard_profile"),
    path("api/pandits/dashboard/services/", PanditDashboardServicesApiView.as_view(), name="api_pandit_dashboard_services"),
    path("api/pandits/dashboard/availability/", PanditDashboardAvailabilityApiView.as_view(), name="api_pandit_dashboard_availability"),
    path("api/pandits/dashboard/bookings/<int:booking_id>/status/", PanditDashboardBookingStatusApiView.as_view(), name="api_pandit_dashboard_booking_status"),
    path("api/pandits/<slug:slug>/", PanditDetailApiView.as_view(), name="api_pandit_detail"),
    path("api/pandits/<slug:slug>/reviews/", ReviewCreateApiView.as_view(), name="api_pandit_review_create"),
]
