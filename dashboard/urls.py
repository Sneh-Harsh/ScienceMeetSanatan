from django.urls import path

from .views import DashboardHomeView, DashboardModuleView

urlpatterns = [
    path('dashboard/home/', DashboardHomeView.as_view(), name='dashboard_home_v2'),
    path('dashboard/modules/', DashboardModuleView.as_view(), name='dashboard_modules_v2'),
]
