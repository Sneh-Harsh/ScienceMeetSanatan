from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Avg
from django.http import Http404
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.http import require_GET
from rest_framework import generics, permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from astrology_consultation.models import (
    AstrologerAvailability,
    AstrologerProfile,
    AstrologerReview,
    ChatMessage,
    ChatSession,
    FavoriteAstrologer,
    MessageSender,
    SessionStatus,
)
from astrology_consultation.serializers import (
    AstrologerAvailabilitySerializer,
    AstrologerCardSerializer,
    AstrologerDetailSerializer,
    AstrologerReviewSerializer,
    ChatMessageSerializer,
    ChatSessionSerializer,
    EndSessionSerializer,
    RechargeSerializer,
    ReviewCreateSerializer,
    SendMessageSerializer,
    StartChatSessionSerializer,
    WalletSerializer,
    WalletTransactionSerializer,
)
from astrology_consultation.services import build_astrologer_queryset, get_live_consultation_pulse, get_marketplace_filters, get_personalized_match
from astrology_consultation.services.chat_sessions import SUGGESTED_QUESTIONS, add_dev_recharge, append_message, end_chat_session, start_chat_session
from astrology_consultation.services.wallet import get_or_create_wallet


class AstrologerPagination(PageNumberPagination):
    page_size = 9
    page_size_query_param = 'page_size'
    max_page_size = 24


@require_GET
def astrologer_marketplace_page(request):
    queryset = build_astrologer_queryset(request.GET)
    page_obj = Paginator(queryset, 9).get_page(request.GET.get('page') or 1)
    top_rated = AstrologerProfile.objects.filter(is_active=True).order_by('-rating', '-total_consultations')[:4]
    online_now = AstrologerProfile.objects.filter(is_active=True, is_online=True).order_by('-rating', '-response_time')[:4]
    first_chat_free = AstrologerProfile.objects.filter(is_active=True, free_first_chat_enabled=True).order_by('-is_online', 'price_per_minute')[:4]
    match = get_personalized_match(request.user, queryset, request.GET.get('q', '')) if request.user.is_authenticated else None
    return render(
        request,
        'astrology_consultation/index.html',
        {
            'page_obj': page_obj,
            'astrologer_cards': AstrologerCardSerializer(page_obj.object_list, many=True).data,
            'filters': get_marketplace_filters(),
            'top_rated': top_rated,
            'online_now': online_now,
            'first_chat_free': first_chat_free,
            'consultation_pulse': get_live_consultation_pulse(),
            'best_match': match,
            'active_filters': request.GET,
        },
    )


@require_GET
def astrologer_profile_page(request, slug: str):
    astrologer = get_object_or_404(AstrologerProfile.objects.prefetch_related('availability_windows', 'reviews__user'), slug=slug, is_active=True)
    related = AstrologerProfile.objects.filter(is_active=True).exclude(id=astrologer.id).order_by('-is_online', '-rating')[:3]
    return render(
        request,
        'astrology_consultation/profile.html',
        {
            'astrologer_obj': astrologer,
            'astrologer_detail': AstrologerDetailSerializer(astrologer, context={'request': request}).data,
            'related_astrologers': related,
            'question_chips': SUGGESTED_QUESTIONS,
        },
    )


@login_required
def wallet_page(request):
    wallet = get_or_create_wallet(request.user)
    sessions = request.user.astrology_chat_sessions.select_related('astrologer').order_by('-created_at')[:12]
    return render(
        request,
        'astrology_consultation/wallet.html',
        {
            'wallet': wallet,
            'transactions': request.user.wallet_transactions.order_by('-created_at')[:20],
            'sessions': sessions,
        },
    )


@login_required
def chat_session_page(request, session_id):
    session = get_object_or_404(ChatSession.objects.select_related('astrologer', 'person_profile'), public_id=session_id, user=request.user)
    return render(
        request,
        'astrology_consultation/chat.html',
        {
            'session_obj': session,
            'session_payload': ChatSessionSerializer(session).data,
            'wallet': get_or_create_wallet(request.user),
            'question_chips': SUGGESTED_QUESTIONS,
        },
    )


@login_required
def astrologer_dashboard_page(request):
    astrologer = getattr(request.user, 'astrologer_profile', None)
    if astrologer is None:
        raise Http404('No astrologer dashboard is linked to this user.')
    active_sessions = astrologer.chat_sessions.filter(status=SessionStatus.ACTIVE).select_related('user')
    recent_sessions = astrologer.chat_sessions.select_related('user').order_by('-created_at')[:12]
    return render(
        request,
        'astrology_consultation/dashboard.html',
        {
            'astrologer_obj': astrologer,
            'active_sessions': active_sessions,
            'recent_sessions': recent_sessions,
            'availability_windows': astrologer.availability_windows.all(),
        },
    )


class AstrologerListApiView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = AstrologerCardSerializer
    pagination_class = AstrologerPagination

    def get_queryset(self):
        return build_astrologer_queryset(self.request.query_params)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response.data['filters'] = get_marketplace_filters()
        response.data['consultation_pulse'] = get_live_consultation_pulse()
        if request.user.is_authenticated:
            response.data['best_match'] = get_personalized_match(request.user, self.get_queryset(), request.query_params.get('q', ''))
        return response


class AstrologerFiltersApiView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(get_marketplace_filters())


class AstrologerDetailApiView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = AstrologerDetailSerializer
    lookup_field = 'slug'
    queryset = AstrologerProfile.objects.filter(is_active=True).prefetch_related('availability_windows', 'reviews__user')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class StartChatSessionApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = StartChatSessionSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        try:
            session = start_chat_session(
                user=request.user,
                astrologer=serializer.validated_data['astrologer'],
                topic=serializer.validated_data.get('topic', ''),
                share_mode=serializer.validated_data.get('birth_share_mode', 'none'),
                person_profile=serializer.validated_data.get('person_profile'),
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ChatSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class ChatMessagesApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, request, session_id):
        return get_object_or_404(ChatSession.objects.select_related('astrologer'), public_id=session_id, user=request.user)

    def get(self, request, session_id):
        session = self.get_object(request, session_id)
        return Response(
            {
                'session': ChatSessionSerializer(session).data,
                'messages': ChatMessageSerializer(session.messages.all(), many=True).data,
                'wallet': WalletSerializer(get_or_create_wallet(request.user)).data,
            }
        )

    def post(self, request, session_id):
        session = self.get_object(request, session_id)
        if session.status != SessionStatus.ACTIVE:
            return Response({'detail': 'This consultation is no longer active.'}, status=400)
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = append_message(session=session, sender=MessageSender.USER, message=serializer.validated_data['message'])
        return Response(ChatMessageSerializer(message).data, status=status.HTTP_201_CREATED)


class EndChatSessionApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, session_id):
        session = get_object_or_404(ChatSession, public_id=session_id, user=request.user)
        serializer = EndSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = end_chat_session(session=session, ended_by=serializer.validated_data.get('ended_by', 'user'))
        return Response(ChatSessionSerializer(session).data)


class WalletApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        wallet = get_or_create_wallet(request.user)
        transactions = request.user.wallet_transactions.order_by('-created_at')[:20]
        return Response({'wallet': WalletSerializer(wallet).data, 'transactions': WalletTransactionSerializer(transactions, many=True).data})


class WalletRechargeApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = RechargeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        wallet = add_dev_recharge(user=request.user, amount=serializer.validated_data['amount'])
        return Response({'wallet': WalletSerializer(wallet).data, 'detail': 'Wallet recharge placeholder completed. Connect Razorpay server-side next.'})


class ConsultationHistoryApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        sessions = request.user.astrology_chat_sessions.select_related('astrologer').order_by('-created_at')[:30]
        return Response(ChatSessionSerializer(sessions, many=True).data)


class ReviewCreateApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ReviewCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = None
        session_id = serializer.validated_data.get('session_id')
        if session_id:
            session = get_object_or_404(ChatSession, public_id=session_id, user=request.user)
        astrologer = serializer.validated_data['astrologer']
        if session is not None:
            review, _created = AstrologerReview.objects.update_or_create(
                user=request.user,
                session=session,
                defaults={
                    'astrologer': astrologer,
                    'rating': serializer.validated_data['rating'],
                    'comment': serializer.validated_data.get('comment', ''),
                },
            )
        else:
            review, _created = AstrologerReview.objects.update_or_create(
                user=request.user,
                astrologer=astrologer,
                session=None,
                defaults={
                    'rating': serializer.validated_data['rating'],
                    'comment': serializer.validated_data.get('comment', ''),
                },
            )
        astrologer.total_reviews = astrologer.reviews.count()
        astrologer.rating = round(float(astrologer.reviews.aggregate(avg=Avg('rating')).get('avg') or review.rating), 2)
        astrologer.save(update_fields=['total_reviews', 'rating', 'updated_at'])
        return Response(AstrologerReviewSerializer(review).data, status=status.HTTP_201_CREATED)


class FavoriteAstrologerApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug: str):
        astrologer = get_object_or_404(AstrologerProfile, slug=slug, is_active=True)
        favorite, created = FavoriteAstrologer.objects.get_or_create(user=request.user, astrologer=astrologer)
        if not created:
            favorite.delete()
            return Response({'favorited': False})
        return Response({'favorited': True})


class AstrologerDashboardProfileApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, request):
        astrologer = getattr(request.user, 'astrologer_profile', None)
        if astrologer is None:
            raise Http404('No astrologer dashboard is linked to this user.')
        return astrologer

    def get(self, request):
        return Response(AstrologerDetailSerializer(self.get_object(request), context={'request': request}).data)

    def put(self, request):
        astrologer = self.get_object(request)
        for field in ['display_name', 'bio', 'city', 'is_online', 'available_today', 'price_per_minute', 'response_time', 'estimated_wait_time', 'trust_note']:
            if field in request.data:
                setattr(astrologer, field, request.data[field])
        for json_field in ['languages', 'expertise', 'topic_strengths', 'consultation_modes']:
            if json_field in request.data:
                value = request.data[json_field]
                if isinstance(value, str):
                    value = [item.strip() for item in value.split(',') if item.strip()]
                setattr(astrologer, json_field, value)
        astrologer.save()
        return Response(AstrologerDetailSerializer(astrologer, context={'request': request}).data)


class AstrologerDashboardAvailabilityApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, request):
        astrologer = getattr(request.user, 'astrologer_profile', None)
        if astrologer is None:
            raise Http404('No astrologer dashboard is linked to this user.')
        return astrologer

    def get(self, request):
        astrologer = self.get_object(request)
        return Response(AstrologerAvailabilitySerializer(astrologer.availability_windows.all(), many=True).data)

    def post(self, request):
        astrologer = self.get_object(request)
        serializer = AstrologerAvailabilitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        slot = serializer.save(astrologer=astrologer)
        return Response(AstrologerAvailabilitySerializer(slot).data, status=status.HTTP_201_CREATED)


class AstrologerDashboardSessionsApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        astrologer = getattr(request.user, 'astrologer_profile', None)
        if astrologer is None:
            raise Http404('No astrologer dashboard is linked to this user.')
        sessions = astrologer.chat_sessions.select_related('user').order_by('-created_at')[:30]
        return Response(ChatSessionSerializer(sessions, many=True).data)
