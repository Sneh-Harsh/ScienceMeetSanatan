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
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.media import MediaUploadError, delete_media, upload_media
from core.ratelimit import rate_limited

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
    release_slot,
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

    @rate_limited("booking_create", 10, 3600)
    def post(self, request):
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pandit = serializer.validated_data["pandit"]
        service = serializer.validated_data["service"]
        slot = serializer.validated_data.get("slot")
        try:
            booking = create_booking(
                user=request.user,
                pandit=pandit,
                service=service,
                slot=slot,
                validated_data=serializer.validated_data,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
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
        if booking.status not in {BookingStatus.PENDING, BookingStatus.ACCEPTED}:
            return Response({"detail": "This booking can no longer be changed."}, status=400)
        booking.status = next_status
        booking.save(update_fields=["status", "updated_at"])
        if next_status == BookingStatus.CANCELLED:
            release_slot(booking)
        return Response(BookingSerializer(booking).data)


class ReviewCreateApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug: str):
        pandit = get_object_or_404(Pandit, slug=slug, is_active=True)
        if not Booking.objects.filter(user=request.user, pandit=pandit, status=BookingStatus.COMPLETED).exists():
            return Response({"detail": "You can review a pandit after a completed booking."}, status=403)
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


class PanditDashboardPhotoApiView(APIView):
    """POST a multipart "file" to set the profile photo."""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser]

    @rate_limited("pandit_photo_upload", 10, 3600)
    def post(self, request):
        pandit = getattr(request.user, "pandit_profile", None)
        if pandit is None:
            raise Http404("No pandit dashboard is linked to this user.")
        upload = request.FILES.get("file")
        if upload is None:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            media = upload_media(upload, "pandits/photos")
        except MediaUploadError as exc:
            return Response({"error": " ".join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        pandit.photo = media["url"]
        pandit.save(update_fields=["photo", "updated_at"])
        return Response({"photo": pandit.photo})


GALLERY_PREFIX = "sms/pandits/gallery/"


class PanditDashboardMediaApiView(APIView):
    """Gallery of photos/videos stored in Pandit.photos_videos.

    POST a multipart "file" to add an item; DELETE with {"public_id": ...} to remove one.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, JSONParser]
    MAX_ITEMS = 12

    def get_object(self, request):
        pandit = getattr(request.user, "pandit_profile", None)
        if pandit is None:
            raise Http404("No pandit dashboard is linked to this user.")
        return pandit

    @rate_limited("pandit_media_upload", 20, 3600)
    def post(self, request):
        pandit = self.get_object(request)
        items = list(pandit.photos_videos or [])
        if len(items) >= self.MAX_ITEMS:
            return Response(
                {"error": f"You can keep up to {self.MAX_ITEMS} gallery items."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        upload = request.FILES.get("file")
        if upload is None:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            media = upload_media(upload, "pandits/gallery", allowed=("image", "video"))
        except MediaUploadError as exc:
            return Response({"error": " ".join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        if not str(media.get("public_id", "")).startswith(GALLERY_PREFIX):
            delete_media(media.get("public_id"), media.get("type", "image"))
            return Response({"error": "Upload failed. Please try again."}, status=status.HTTP_400_BAD_REQUEST)
        items.append(media)
        pandit.photos_videos = items
        pandit.save(update_fields=["photos_videos", "updated_at"])
        return Response({"photos_videos": items}, status=status.HTTP_201_CREATED)

    def delete(self, request):
        pandit = self.get_object(request)
        public_id = request.data.get("public_id")
        items = list(pandit.photos_videos or [])
        # Only entries in this pandit's own gallery folder may be removed, so a crafted
        # public_id can never point at someone else's Cloudinary file.
        removed = [
            i for i in items
            if isinstance(i, dict) and i.get("public_id") == public_id and str(public_id).startswith(GALLERY_PREFIX)
        ]
        if not removed:
            return Response({"error": "Item not found."}, status=status.HTTP_404_NOT_FOUND)
        pandit.photos_videos = [i for i in items if i not in removed]
        pandit.save(update_fields=["photos_videos", "updated_at"])
        for item in removed:
            delete_media(item["public_id"], item.get("type", "image"))
        return Response({"photos_videos": pandit.photos_videos})


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
        next_status = serializer.validated_data["status"]
        if booking.status in {BookingStatus.CANCELLED, BookingStatus.COMPLETED} or next_status == BookingStatus.PENDING:
            return Response({"detail": "That status change is not allowed."}, status=400)
        booking.status = next_status
        booking.save(update_fields=["status", "updated_at"])
        if next_status in {BookingStatus.REJECTED, BookingStatus.CANCELLED}:
            release_slot(booking)
        return Response(BookingSerializer(booking).data)
