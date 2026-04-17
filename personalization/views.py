from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.services import get_or_create_guest_profile, resolve_actor
from astrology.models import SavedPanchaangPreference
from astrology.serializers import SavedPanchaangPreferenceSerializer

from .models import UserPreference
from .serializers import ContentInteractionSerializer, ReadingProgressSerializer, UserPreferenceSerializer
from .services import RecommendationService, track_interaction


class UserPreferenceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        pref, _ = UserPreference.objects.get_or_create(user=request.user)
        return Response(UserPreferenceSerializer(pref).data)

    def put(self, request):
        pref, _ = UserPreference.objects.get_or_create(user=request.user)
        serializer = UserPreferenceSerializer(pref, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PanchaangPreferenceView(APIView):
    permission_classes = [permissions.AllowAny]

    def get_object(self, request):
        guest = get_or_create_guest_profile(request)
        if request.user.is_authenticated:
            obj, _ = SavedPanchaangPreference.objects.get_or_create(user=request.user, defaults={'city_name': 'New Delhi', 'latitude': 28.6139, 'longitude': 77.2090})
        else:
            obj, _ = SavedPanchaangPreference.objects.get_or_create(guest_profile=guest, defaults={'city_name': 'New Delhi', 'latitude': 28.6139, 'longitude': 77.2090})
        return obj

    def get(self, request):
        return Response(SavedPanchaangPreferenceSerializer(self.get_object(request)).data)

    def put(self, request):
        obj = self.get_object(request)
        serializer = SavedPanchaangPreferenceSerializer(obj, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class InteractionCreateView(generics.CreateAPIView):
    serializer_class = ContentInteractionSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        actor = resolve_actor(self.request)
        track_interaction(actor, **serializer.validated_data)


class RecommendationView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, recommendation_type: str):
        actor = resolve_actor(request)
        return Response(RecommendationService.build_recommendations_for_actor(actor, recommendation_type))
