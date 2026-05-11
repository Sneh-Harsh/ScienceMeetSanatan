from __future__ import annotations

from django.core.cache import cache
from django.db.models import Avg, Min, Q

from astrology.models import SavedKundali
from astrology_consultation.models import AstrologerProfile, ExpertiseType

FILTER_TTL = 300


def build_astrologer_queryset(params):
    queryset = AstrologerProfile.objects.filter(is_active=True).prefetch_related("reviews", "availability_windows")

    expertise = (params.get("expertise") or "").strip()
    language = (params.get("language") or "").strip()
    city = (params.get("city") or "").strip()
    rating = (params.get("rating") or "").strip()
    availability = (params.get("availability") or "").strip()
    experience = (params.get("experience") or "").strip()
    sort_price = (params.get("price_sort") or "").strip()
    query = (params.get("q") or "").strip()

    if expertise:
        queryset = queryset.filter(Q(expertise__icontains=expertise) | Q(topic_strengths__icontains=expertise))
    if language:
        queryset = queryset.filter(languages__icontains=language)
    if city:
        queryset = queryset.filter(city__icontains=city)
    if rating:
        try:
            queryset = queryset.filter(rating__gte=float(rating))
        except (TypeError, ValueError):
            pass
    if availability == "online":
        queryset = queryset.filter(is_online=True)
    elif availability == "today":
        queryset = queryset.filter(available_today=True)
    if experience == "1-3":
        queryset = queryset.filter(experience_years__gte=1, experience_years__lt=3)
    elif experience == "3-7":
        queryset = queryset.filter(experience_years__gte=3, experience_years__lt=7)
    elif experience == "7-15":
        queryset = queryset.filter(experience_years__gte=7, experience_years__lt=15)
    elif experience == "15+":
        queryset = queryset.filter(experience_years__gte=15)
    if query:
        queryset = queryset.filter(
            Q(display_name__icontains=query)
            | Q(expertise__icontains=query)
            | Q(languages__icontains=query)
            | Q(city__icontains=query)
            | Q(topic_strengths__icontains=query)
        )
    if sort_price == "low_to_high":
        queryset = queryset.order_by("price_per_minute", "-is_online", "-rating")
    elif sort_price == "high_to_low":
        queryset = queryset.order_by("-price_per_minute", "-is_online", "-rating")
    return queryset.distinct()


def get_marketplace_filters():
    cache_key = "astrologer_marketplace_filters"
    cached = cache.get(cache_key)
    if cached:
        return cached
    payload = {
        "expertise": [{"value": value, "label": label} for value, label in ExpertiseType.choices],
        "languages": sorted(
            {
                language
                for languages in AstrologerProfile.objects.values_list("languages", flat=True)
                for language in (languages or [])
            }
        ),
        "cities": sorted({city for city in AstrologerProfile.objects.values_list("city", flat=True) if city}),
        "price": {
            "min": AstrologerProfile.objects.aggregate(value=Min("price_per_minute")).get("value") or 0,
            "max": max([item.price_per_minute for item in AstrologerProfile.objects.all()[:200]] or [0]),
        },
    }
    cache.set(cache_key, payload, FILTER_TTL)
    return payload


def get_live_consultation_pulse():
    total_online = AstrologerProfile.objects.filter(is_active=True, is_online=True).count()
    total_active_sessions = AstrologerProfile.objects.filter(chat_sessions__status="active").distinct().count()
    avg_response = AstrologerProfile.objects.filter(is_active=True).aggregate(value=Avg("response_time")).get("value") or 0
    return {
        "online": total_online,
        "active_sessions": total_active_sessions,
        "avg_response": round(avg_response, 1),
    }


def get_personalized_match(user, queryset, topic=""):
    if not user or not user.is_authenticated:
        return None
    latest = SavedKundali.objects.filter(user=user).order_by("-created_at").first()
    preference_blob = " ".join([topic.lower()])
    if latest:
        summary = latest.summary_payload or {}
        recommendation = latest.recommendation_payload or {}
        preference_blob += " " + " ".join(str(item).lower() for item in (summary.get("focus_areas") or []))
        preference_blob += " " + " ".join(str(item).lower() for item in (recommendation.get("service_tags") or []))
    best = None
    best_score = -1
    for astrologer in queryset[:20]:
        score = 0
        blob = " ".join(
            [
                astrologer.bio.lower(),
                astrologer.city.lower(),
                *(item.lower() for item in astrologer.expertise),
                *(item.lower() for item in astrologer.topic_strengths),
            ]
        )
        for token in filter(None, preference_blob.split()):
            if token in blob:
                score += 3
        if astrologer.is_online:
            score += 2
        score += int(astrologer.rating * 2)
        if score > best_score:
            best = astrologer
            best_score = score
    if not best:
        return None
    return {
        "slug": best.slug,
        "headline": "Best guide for you",
        "basis": "Matched from your kundali focus, current consultation topic, and astrologer strengths.",
    }
