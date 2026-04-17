from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import PersonProfile
from accounts.services import resolve_actor
from personalization.services import RecommendationService

from .models import SavedKundali, SavedPanchaangPreference
from .serializers import SavedKundaliSerializer, SavedPanchaangPreferenceSerializer
from .selectors import get_saved_kundalis, get_today_panchaang
from .services import generate_kundali, save_kundali_for_user


class KundaliGenerateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        return Response(generate_kundali(request.data))


class KundaliSaveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        person = generics.get_object_or_404(PersonProfile, pk=request.data.get('person_profile_id'), user=request.user)
        generated_payload = request.data.get('generated_payload') or generate_kundali(request.data)
        kundali = save_kundali_for_user(
            user=request.user,
            person_profile=person,
            title=request.data.get('title') or f'{person.display_name} Kundali',
            generated_payload=generated_payload,
            consent_confirmed=bool(request.data.get('consent_confirmed')),
        )
        return Response(SavedKundaliSerializer(kundali).data)


class KundaliListView(generics.ListAPIView):
    serializer_class = SavedKundaliSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SavedKundali.objects.filter(user=self.request.user).select_related('person_profile')


class KundaliRecommendationsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk: int):
        kundali = generics.get_object_or_404(SavedKundali, pk=pk, user=request.user)
        return Response({'kundali_id': kundali.id, 'recommendations': RecommendationService.build_mantra_recommendations(resolve_actor(request))})


class HoroscopeTodayView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        actor = resolve_actor(request)
        return Response({'period': 'today', 'guidance': 'Traditionally associated with steady action, emotional clarity, and measured speech.', 'panchaang': get_today_panchaang(actor)})


class HoroscopeFeedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        actor = resolve_actor(request)
        return Response({'modules': RecommendationService.build_mantra_recommendations(actor), 'saved_kundalis': SavedKundaliSerializer(get_saved_kundalis(request.user), many=True).data})
