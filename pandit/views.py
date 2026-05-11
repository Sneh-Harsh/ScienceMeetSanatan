from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Prefetch, Q
from django.http import Http404
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.http import require_GET
from rest_framework import generics, permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Booking, BookingStatus, Pandit, PanditAvailabilitySlot, PanditService, Review, Service
from .serializers import (
    BookingCreateSerializer,
    BookingSerializer,
    BookingStatusSerializer,
    PanditAvailabilitySlotSerializer,
    PanditCardSerializer,
    PanditDetailSerializer,
    PanditProfileUpdateSerializer,
    PanditServiceSerializer,
    ReviewSerializer,
    ServiceSerializer,
)
from .services import (
    build_pandit_queryset,
    build_service_worlds,
    create_booking,
    get_astro_recommendation,
    get_dashboard_payload,
    get_pandit_filters,
)


class PanditPagination(PageNumberPagination):
    page_size = 9
    page_size_query_param = "page_size"
    max_page_size = 24


@require_GET
def pandit_marketplace_page(request):
    queryset = build_pandit_queryset(request.GET)
    paginator = Paginator(queryset, 9)
    page_number = request.GET.get("page") or 1
    page_obj = paginator.get_page(page_number)
    services = Service.objects.order_by("name")
    service_worlds = build_service_worlds(services)

    initial_cards = PanditCardSerializer(page_obj.object_list, many=True).data
    astro_match = get_astro_recommendation(request.user, page_obj.object_list) if request.user.is_authenticated else None
    user_bookings = []
    if request.user.is_authenticated:
        user_bookings = Booking.objects.filter(user=request.user).select_related("pandit", "service").order_by("date", "time")[:6]

    return render(
        request,
        "pandit/index.html",
        {
            "pandit_filters": get_pandit_filters(),
            "pandit_cards": initial_cards,
            "pandit_cards_json": initial_cards,
            "page_obj": page_obj,
            "services": services,
            "service_worlds": service_worlds,
            "active_service": request.GET.get("service", ""),
            "active_city": request.GET.get("city", ""),
            "active_language": request.GET.get("language", ""),
            "active_rating": request.GET.get("rating", ""),
            "active_query": request.GET.get("q", ""),
            "available_today": str(request.GET.get("available_today", "")).lower() in {"1", "true", "yes"},
            "astro_match": astro_match,
            "user_bookings": user_bookings,
        },
    )


@require_GET
def pandit_profile_page(request, slug: str):
    pandit = get_object_or_404(
        Pandit.objects.filter(is_active=True).prefetch_related(
            Prefetch("pandit_services", queryset=PanditService.objects.select_related("service").filter(is_active=True)),
            Prefetch("availability_slots", queryset=PanditAvailabilitySlot.objects.filter(is_available=True).order_by("date", "start_time")),
            "reviews__user",
        ),
        slug=slug,
    )
    related_pandits = (
        Pandit.objects.filter(is_active=True, city=pandit.city)
        .exclude(id=pandit.id)
        .order_by("-rating", "-available_today")[:3]
    )
    return render(
        request,
        "pandit/profile.html",
        {
            "pandit_obj": pandit,
            "pandit_detail": PanditDetailSerializer(pandit).data,
            "related_pandits": related_pandits,
            "services": pandit.pandit_services.select_related("service").all(),
            "slots": pandit.availability_slots.filter(is_available=True).order_by("date", "start_time")[:24],
            "reviews": pandit.reviews.select_related("user").all()[:10],
        },
    )


@login_required
def pandit_dashboard_page(request):
    pandit = getattr(request.user, "pandit_profile", None)
    if pandit is None:
        raise Http404("No pandit dashboard is linked to this user.")
    return render(
        request,
        "pandit/dashboard.html",
        {
            "dashboard_payload": get_dashboard_payload(pandit),
            "dashboard_profile": PanditDetailSerializer(pandit).data,
            "service_options": Service.objects.order_by("name"),
        },
    )


class PanditListApiView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = PanditCardSerializer
    pagination_class = PanditPagination

    def get_queryset(self):
        return build_pandit_queryset(self.request.query_params)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response.data["filters"] = get_pandit_filters()
        if request.user.is_authenticated:
            astro_match = get_astro_recommendation(request.user, self.get_queryset()[:5])
            response.data["astro_match"] = astro_match
        return response


class PanditDetailApiView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = PanditDetailSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return Pandit.objects.filter(is_active=True).prefetch_related(
            Prefetch("pandit_services", queryset=PanditService.objects.select_related("service").filter(is_active=True)),
            Prefetch("availability_slots", queryset=PanditAvailabilitySlot.objects.filter(is_available=True).order_by("date", "start_time")),
            Prefetch("reviews", queryset=Review.objects.select_related("user").order_by("-created_at")),
        )


class ServiceListApiView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ServiceSerializer
    queryset = Service.objects.order_by("name")


class BookingCreateApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pandit = serializer.validated_data["pandit"]
        service = serializer.validated_data["service"]
        slot = serializer.validated_data.get("slot")
        booking = create_booking(
            user=request.user,
            pandit=pandit,
            service=service,
            slot=slot,
            validated_data=serializer.validated_data,
        )
        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)


class BookingHistoryApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = Booking.objects.filter(user=request.user).select_related("pandit", "service").order_by("date", "time")
        upcoming = queryset.filter(date__gte=timezone.localdate()).exclude(status__in=[BookingStatus.CANCELLED, BookingStatus.REJECTED])
        history = queryset.exclude(id__in=upcoming.values_list("id", flat=True))
        return Response(
            {
                "upcoming": BookingSerializer(upcoming[:10], many=True).data,
                "history": BookingSerializer(history[:10], many=True).data,
            }
        )


class BookingStatusApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, booking_id: int):
        booking = get_object_or_404(Booking, id=booking_id, user=request.user)
        serializer = BookingStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        next_status = serializer.validated_data["status"]
        if next_status not in {BookingStatus.CANCELLED, BookingStatus.RESCHEDULE_REQUESTED}:
            return Response({"detail": "Users can only cancel or request reschedule."}, status=400)
        booking.status = next_status
        booking.save(update_fields=["status", "updated_at"])
        return Response(BookingSerializer(booking).data)


class ReviewCreateApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug: str):
        pandit = get_object_or_404(Pandit, slug=slug, is_active=True)
        serializer = ReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review, _created = Review.objects.update_or_create(
            user=request.user,
            pandit=pandit,
            defaults={
                "rating": serializer.validated_data["rating"],
                "comment": serializer.validated_data.get("comment", ""),
            },
        )
        pandit.refresh_rating()
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


class PanditDashboardProfileApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, request):
        pandit = getattr(request.user, "pandit_profile", None)
        if pandit is None:
            raise Http404("No pandit dashboard is linked to this user.")
        return pandit

    def get(self, request):
        return Response(PanditDetailSerializer(self.get_object(request)).data)

    def put(self, request):
        pandit = self.get_object(request)
        serializer = PanditProfileUpdateSerializer(pandit, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(PanditDetailSerializer(pandit).data)


class PanditDashboardServicesApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, request):
        pandit = getattr(request.user, "pandit_profile", None)
        if pandit is None:
            raise Http404("No pandit dashboard is linked to this user.")
        return pandit

    def get(self, request):
        pandit = self.get_object(request)
        return Response(PanditServiceSerializer(pandit.pandit_services.select_related("service").all(), many=True).data)

    def post(self, request):
        pandit = self.get_object(request)
        serializer = PanditServiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pandit_service, _created = PanditService.objects.update_or_create(
            pandit=pandit,
            service=serializer.validated_data["service"],
            defaults={
                "price": serializer.validated_data["price"],
                "is_featured": serializer.validated_data.get("is_featured", False),
                "is_active": serializer.validated_data.get("is_active", True),
                "delivery_mode": serializer.validated_data.get("delivery_mode", "at_home"),
                "notes": serializer.validated_data.get("notes", ""),
            },
        )
        return Response(PanditServiceSerializer(pandit_service).data, status=status.HTTP_201_CREATED)


class PanditDashboardAvailabilityApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, request):
        pandit = getattr(request.user, "pandit_profile", None)
        if pandit is None:
            raise Http404("No pandit dashboard is linked to this user.")
        return pandit

    def get(self, request):
        pandit = self.get_object(request)
        return Response(PanditAvailabilitySlotSerializer(pandit.availability_slots.order_by("date", "start_time"), many=True).data)

    def post(self, request):
        pandit = self.get_object(request)
        serializer = PanditAvailabilitySlotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        slot = serializer.save(pandit=pandit)
        return Response(PanditAvailabilitySlotSerializer(slot).data, status=status.HTTP_201_CREATED)


class PanditDashboardBookingStatusApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, booking_id: int):
        pandit = getattr(request.user, "pandit_profile", None)
        if pandit is None:
            raise Http404("No pandit dashboard is linked to this user.")
        booking = get_object_or_404(Booking, id=booking_id, pandit=pandit)
        serializer = BookingStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking.status = serializer.validated_data["status"]
        booking.save(update_fields=["status", "updated_at"])
        return Response(BookingSerializer(booking).data)
