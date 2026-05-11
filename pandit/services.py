from __future__ import annotations

from datetime import timedelta
from secrets import token_hex

from django.core.cache import cache
from django.db.models import Min, Prefetch, Q
from django.utils import timezone

from astrology.models import SavedKundali

from .category_worlds import build_service_worlds
from .models import Booking, BookingStatus, Pandit, PanditAvailabilitySlot, PanditService, PaymentStatus, Service


FILTER_CACHE_TTL = 60 * 5


def _normalize_list_query(value: str) -> list[str]:
    return [item.strip() for item in (value or "").split(",") if item.strip()]


def build_pandit_queryset(params):
    queryset = Pandit.objects.filter(is_active=True).prefetch_related(
        Prefetch("pandit_services", queryset=PanditService.objects.select_related("service").filter(is_active=True)),
        Prefetch("reviews"),
    )

    city = (params.get("city") or "").strip()
    service_slug = (params.get("service") or "").strip()
    language = (params.get("language") or "").strip()
    rating = (params.get("rating") or "").strip()
    available_today = str(params.get("available_today") or "").lower() in {"1", "true", "yes"}
    max_price = params.get("max_price")
    query = (params.get("q") or "").strip()

    if city:
        queryset = queryset.filter(city__icontains=city)
    if language:
        queryset = queryset.filter(languages__icontains=language)
    if service_slug:
        queryset = queryset.filter(
            Q(pandit_services__service__slug=service_slug)
            | Q(specialization_tags__icontains=service_slug.replace("_", " "))
        )
    if rating:
        try:
            queryset = queryset.filter(rating__gte=float(rating))
        except (TypeError, ValueError):
            pass
    if available_today:
        queryset = queryset.filter(available_today=True)
    if max_price:
        try:
            max_price_value = int(max_price)
            queryset = queryset.filter(
                Q(starting_price__lte=max_price_value)
                | Q(pandit_services__price__lte=max_price_value, pandit_services__is_active=True)
            )
        except (TypeError, ValueError):
            pass
    if query:
        queryset = queryset.filter(
            Q(name__icontains=query)
            | Q(city__icontains=query)
            | Q(area__icontains=query)
            | Q(specialization__icontains=query)
            | Q(specialization_tags__icontains=query)
            | Q(languages__icontains=query)
        )

    return queryset.distinct()


def get_pandit_filters():
    cache_key = "pandit_marketplace_filters"
    cached = cache.get(cache_key)
    if cached:
        return cached

    payload = {
        "cities": list(Pandit.objects.filter(is_active=True).values_list("city", flat=True).distinct().order_by("city")),
        "languages": sorted(
            {
                language
                for languages in Pandit.objects.filter(is_active=True).values_list("languages", flat=True)
                for language in (languages or [])
            }
        ),
        "services": list(Service.objects.values("name", "slug", "category", "icon").order_by("name")),
        "price_range": {
            "min": Pandit.objects.filter(is_active=True).aggregate(value=Min("starting_price")).get("value") or 0,
            "max": max(
                [pandit.starting_price for pandit in Pandit.objects.filter(is_active=True)[:200]]
                or [0]
            ),
        },
    }
    cache.set(cache_key, payload, FILTER_CACHE_TTL)
    return payload


def get_astro_recommendation(user, queryset):
    if not user or not user.is_authenticated:
        return None

    latest_kundali = (
        SavedKundali.objects.filter(user=user)
        .exclude(recommendation_payload={})
        .order_by("-created_at")
        .first()
    )
    if latest_kundali is None:
        return None

    recommendation_payload = latest_kundali.recommendation_payload or {}
    summary_payload = latest_kundali.summary_payload or {}
    priority_tags = [
        tag
        for tag in (
            recommendation_payload.get("service_tags")
            or recommendation_payload.get("remedy_tags")
            or summary_payload.get("focus_areas")
            or []
        )
        if tag
    ]

    for pandit in queryset:
        tags_blob = " ".join(
            [pandit.specialization.lower(), *(tag.lower() for tag in pandit.specialization_tags)]
        )
        if any(str(tag).lower() in tags_blob for tag in priority_tags):
            return {
                "pandit_slug": pandit.slug,
                "headline": "Astro matched for your current spiritual focus",
                "basis": "Matched against your saved kundali remedies and service themes.",
            }
    return None


def create_booking(*, user, pandit: Pandit, service: Service, slot: PanditAvailabilitySlot | None, validated_data: dict) -> Booking:
    pandit_service = PanditService.objects.filter(pandit=pandit, service=service, is_active=True).first()
    price_amount = pandit_service.price if pandit_service else max(service.base_price, pandit.starting_price)
    booking = Booking.objects.create(
        user=user,
        pandit=pandit,
        service=service,
        pandit_service=pandit_service,
        slot=slot,
        date=validated_data["date"],
        time=validated_data["time"],
        address=validated_data["address"],
        city=validated_data.get("city", ""),
        notes=validated_data.get("notes", ""),
        contact_phone=validated_data.get("contact_phone", ""),
        preferred_language=validated_data.get("preferred_language", ""),
        status=BookingStatus.PENDING,
        payment_status=PaymentStatus.PENDING,
        price_amount=price_amount,
        payment_note="Payment integration will be added in a future step.",
        confirmation_code=f"SMS-{token_hex(4).upper()}",
    )
    pandit.total_bookings = pandit.bookings.exclude(status=BookingStatus.CANCELLED).count()
    pandit.save(update_fields=["total_bookings", "updated_at"])
    return booking


def get_dashboard_payload(pandit: Pandit):
    now = timezone.localdate()
    upcoming = pandit.bookings.filter(date__gte=now).select_related("user", "service").order_by("date", "time")
    recent = pandit.bookings.select_related("user", "service").order_by("-created_at")[:8]
    return {
        "pandit": pandit,
        "services": pandit.pandit_services.select_related("service").all(),
        "slots": pandit.availability_slots.order_by("date", "start_time")[:24],
        "upcoming": upcoming[:10],
        "recent": recent,
        "stats": {
            "pending": upcoming.filter(status=BookingStatus.PENDING).count(),
            "confirmed": upcoming.filter(status=BookingStatus.ACCEPTED).count(),
            "reviews": pandit.reviews.count(),
            "today": pandit.bookings.filter(date=now).count(),
        },
    }
