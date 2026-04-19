from django.db import OperationalError, ProgrammingError
from django.db.models import Avg, Count
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.services import attach_guest_cookie, get_or_create_guest_profile, resolve_actor
from astrology.models import SavedPanchaangPreference
from astrology.serializers import SavedPanchaangPreferenceSerializer

from .models import ReviewFeedback, ReviewModerationStatus, UserPreference
from .serializers import (
    ContentInteractionSerializer,
    PublicReviewSerializer,
    ReadingProgressSerializer,
    ReviewFeedbackCreateSerializer,
    ReviewStatsSerializer,
    UserPreferenceSerializer,
)
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


class ReviewCreateView(generics.CreateAPIView):
    serializer_class = ReviewFeedbackCreateSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        actor = resolve_actor(request)

        payload = dict(serializer.validated_data)
        if not payload.get('name_display'):
            if actor.user:
                payload['name_display'] = (
                    f'{actor.user.first_name} {actor.user.last_name}'.strip()
                    or actor.user.username
                    or 'Seeker'
                )
            else:
                payload['name_display'] = 'Anonymous Seeker'

        try:
            review = ReviewFeedback.objects.create(
                user=actor.user,
                guest_profile=actor.guest_profile,
                **payload,
            )
        except (OperationalError, ProgrammingError):
            return Response(
                {
                    'error': 'Review system is not ready yet. Run the latest database migrations and try again.',
                    'code': 'review_migration_required',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        track_interaction(
            actor,
            content_type='other',
            object_id=f'review:{review.pk}',
            interaction_type='completed',
            metadata={
                'feature_type': review.feature_type,
                'rating_overall': review.rating_overall,
                'sentiment': review.sentiment,
                'page_url': review.page_url,
            },
        )

        response_data = {
            'id': review.pk,
            'message': 'Thank you for your feedback 🙏',
            'status': 'received',
            'moderation_status': review.moderation_status,
            'review': ReviewFeedbackCreateSerializer(review).data,
        }
        response = Response(response_data, status=status.HTTP_201_CREATED)
        if actor.guest_profile and not actor.user:
            attach_guest_cookie(response, str(actor.guest_profile.guest_uuid))
        return response


class PublicReviewListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        limit = min(max(int(request.GET.get('limit', 8) or 8), 1), 24)
        try:
            queryset = ReviewFeedback.objects.filter(
                moderation_status=ReviewModerationStatus.APPROVED,
                is_public=True,
                is_featured=True,
            ).order_by('-created_at')[:limit]
            return Response(PublicReviewSerializer(queryset, many=True).data)
        except (OperationalError, ProgrammingError):
            return Response([])


class ReviewStatsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        try:
            queryset = ReviewFeedback.objects.filter(
                moderation_status=ReviewModerationStatus.APPROVED,
                is_public=True,
            )
            aggregate = queryset.aggregate(
                average_rating=Avg('rating_overall'),
                total_reviews=Count('id'),
            )
            breakdown_rows = queryset.values('rating_overall').annotate(total=Count('id'))
            breakdown = {str(index): 0 for index in range(1, 6)}
            for row in breakdown_rows:
                breakdown[str(row['rating_overall'])] = row['total']

            payload = {
                'average_rating': round(float(aggregate['average_rating'] or 0), 1),
                'total_reviews': int(aggregate['total_reviews'] or 0),
                'rating_breakdown': breakdown,
            }
            return Response(ReviewStatsSerializer(payload).data)
        except (OperationalError, ProgrammingError):
            return Response(
                ReviewStatsSerializer(
                    {
                        'average_rating': 0.0,
                        'total_reviews': 0,
                        'rating_breakdown': {str(index): 0 for index in range(1, 6)},
                    }
                ).data
            )
