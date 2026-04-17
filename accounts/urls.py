from django.urls import path

from .views import MergeGuestView, PersonProfileDetailView, PersonProfileListCreateView, SessionBootstrapView, SessionMeView

urlpatterns = [
    path('session/bootstrap/', SessionBootstrapView.as_view(), name='session_bootstrap'),
    path('session/me/', SessionMeView.as_view(), name='session_me'),
    path('session/merge-guest/', MergeGuestView.as_view(), name='session_merge_guest'),
    path('person-profiles/', PersonProfileListCreateView.as_view(), name='person_profile_list'),
    path('person-profiles/<int:pk>/', PersonProfileDetailView.as_view(), name='person_profile_detail'),
]
