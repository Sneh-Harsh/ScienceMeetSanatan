import json
import logging
import urllib.parse
import urllib.request
from typing import Dict, Iterable

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.http import require_GET, require_POST

from core.ratelimit import rate_limited

from .calculations import build_kundali
from .dasha_engine import build_dasha_experience
from .dosha_engine import analyze_doshas
from .experience_engine import build_kundali_experience
from .horoscope_engine import build_horoscope
from .oracle_service import ask_oracle, build_astro_context, generate_personalized_summary, get_suggested_prompts, profile_fingerprint
from .remedies_engine import build_remedies

logger = logging.getLogger(__name__)

SERVER_ERROR = "Something went wrong while calculating this. Please check your details and try again."
MAX_QUESTION_CHARS = 500
MAX_HISTORY_ITEMS = 6
MAX_HISTORY_ITEM_CHARS = 600


def _check_ranges(*, lat, lon, year, date_str="", time_str="", tz_name=""):
    """Reject out-of-range input before it reaches the (expensive) astro engine."""
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        raise ValueError("Latitude or longitude is out of range.")
    if not (1900 <= year <= 2100):
        raise ValueError("Year must be between 1900 and 2100.")
    if len(date_str) > 32 or len(time_str) > 32 or len(tz_name) > 64:
        raise ValueError("Invalid birth profile values.")


def _trim_history(history):
    trimmed = []
    for item in history[-MAX_HISTORY_ITEMS:]:
        if isinstance(item, dict):
            trimmed.append({str(k)[:40]: str(v)[:MAX_HISTORY_ITEM_CHARS] for k, v in list(item.items())[:6]})
    return trimmed


@require_GET
@rate_limited('kundali_api', 120, 3600)
def kundali_api(request):
    """
    GET /api/kundali?date=YYYY-MM-DD&time=HH:MM&lat=..&lon=..&tz=Asia/Kolkata
    """
    date_str = (request.GET.get("date") or "").strip()
    time_str = (request.GET.get("time") or "").strip()
    tz = (request.GET.get("tz") or "Asia/Kolkata").strip()

    if not date_str or not time_str:
        return JsonResponse({"error": "Missing date/time."}, status=400)

    try:
        lat = float(request.GET.get("lat") or 28.6139)
        lon = float(request.GET.get("lon") or 77.2090)
    except Exception:
        return JsonResponse({"error": "Invalid lat/lon."}, status=400)

    try:
        _check_ranges(lat=lat, lon=lon, year=2026, date_str=date_str, time_str=time_str, tz_name=tz)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    try:
        payload = build_kundali(date_str=date_str, time_str=time_str, lat=lat, lon=lon, tz_name=tz)
        payload["experience"] = build_kundali_experience(
            date_str=date_str,
            time_str=time_str,
            lat=lat,
            lon=lon,
            tz_name=tz,
            kundali=payload,
        )
        payload["dasha_experience"] = build_dasha_experience(
            date_str=date_str,
            time_str=time_str,
            tz_name=tz,
            kundali=payload,
        )
        payload["dosha_analysis"] = analyze_doshas(payload)
        payload["remedies_analysis"] = build_remedies(
            doshas=payload["dosha_analysis"],
            dasha_experience=payload["dasha_experience"],
            climate=payload["experience"]["planetary_climate"],
        )
    except Exception:
        logger.exception("Kundali/oracle request failed")
        return JsonResponse({"error": SERVER_ERROR}, status=500)

    return JsonResponse(payload)


@require_GET
@rate_limited('horoscope_api', 120, 3600)
def horoscope_api(request):
    date_str = (request.GET.get("date") or "").strip()
    time_str = (request.GET.get("time") or "").strip()
    tz = (request.GET.get("tz") or "Asia/Kolkata").strip()

    if not date_str or not time_str:
        return JsonResponse({"error": "Missing date/time."}, status=400)

    try:
        lat = float(request.GET.get("lat") or 28.6139)
        lon = float(request.GET.get("lon") or 77.2090)
        specific_year = int(request.GET.get("year") or 2026)
        debug = str(request.GET.get("debug") or "").strip().lower() in {"1", "true", "yes", "debug"}
    except Exception:
        return JsonResponse({"error": "Invalid input values."}, status=400)

    try:
        _check_ranges(lat=lat, lon=lon, year=specific_year, date_str=date_str, time_str=time_str, tz_name=tz)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    try:
        payload = build_horoscope(
            date_str=date_str,
            time_str=time_str,
            lat=lat,
            lon=lon,
            tz_name=tz,
            specific_year=specific_year,
            debug=debug,
        )
    except Exception:
        logger.exception("Kundali/oracle request failed")
        return JsonResponse({"error": SERVER_ERROR}, status=500)

    return JsonResponse(payload)


def _oracle_request_payload(request) -> Dict:
    try:
        body = json.loads(request.body.decode("utf-8") or "{}")
    except Exception as exc:
        raise ValueError("Invalid JSON payload.") from exc

    profile = body.get("profile") or {}
    date_str = str(profile.get("date") or "").strip()
    time_str = str(profile.get("time") or "").strip()
    tz_name = str(profile.get("tz") or profile.get("timezone") or "Asia/Kolkata").strip() or "Asia/Kolkata"
    question = str(body.get("question") or "").strip()

    if not date_str or not time_str:
        raise ValueError("Birth date and time are required.")
    if not question:
        raise ValueError("Question is required.")

    try:
        lat = float(profile.get("lat") or profile.get("latitude") or 28.6139)
        lon = float(profile.get("lon") or profile.get("longitude") or 77.2090)
        specific_year = int(body.get("year") or profile.get("year") or profile.get("specificYear") or 2026)
    except Exception as exc:
        raise ValueError("Invalid birth profile values.") from exc

    if len(question) > MAX_QUESTION_CHARS:
        raise ValueError(f"Question is too long (max {MAX_QUESTION_CHARS} characters).")
    _check_ranges(lat=lat, lon=lon, year=specific_year, date_str=date_str, time_str=time_str, tz_name=tz_name)
    history = _trim_history(body.get("history")) if isinstance(body.get("history"), list) else []
    return {
        "date_str": date_str,
        "time_str": time_str,
        "lat": lat,
        "lon": lon,
        "tz_name": tz_name,
        "question": question,
        "history": history,
        "specific_year": specific_year,
    }


def _summary_request_payload(request) -> Dict:
    try:
        body = json.loads(request.body.decode("utf-8") or "{}")
    except Exception as exc:
        raise ValueError("Invalid JSON payload.") from exc

    profile = body.get("profile") or {}
    date_str = str(profile.get("date") or "").strip()
    time_str = str(profile.get("time") or "").strip()
    tz_name = str(profile.get("tz") or profile.get("timezone") or "Asia/Kolkata").strip() or "Asia/Kolkata"
    scope_key = str(body.get("scope") or "daily").strip().lower()

    if not date_str or not time_str:
        raise ValueError("Birth date and time are required.")

    try:
        lat = float(profile.get("lat") or profile.get("latitude") or 28.6139)
        lon = float(profile.get("lon") or profile.get("longitude") or 77.2090)
        specific_year = int(body.get("year") or profile.get("year") or profile.get("specificYear") or 2026)
    except Exception as exc:
        raise ValueError("Invalid birth profile values.") from exc

    _check_ranges(lat=lat, lon=lon, year=specific_year, date_str=date_str, time_str=time_str, tz_name=tz_name)
    return {
        "date_str": date_str,
        "time_str": time_str,
        "lat": lat,
        "lon": lon,
        "tz_name": tz_name,
        "specific_year": specific_year,
        "scope_key": scope_key[:32],
    }


def _sse(event: str, payload: Dict) -> bytes:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")


def _stream_direct_answer(answer: Dict) -> Iterable[bytes]:
    direct = str(answer.get("directAnswer") or "").strip()
    words = direct.split()
    current = ""
    for word in words:
        current = f"{current} {word}".strip()
        yield _sse("delta", {"section": "directAnswer", "text": current})
    for section in ("chartBasis", "opportunities", "cautions", "bestTiming", "remedy"):
        yield _sse("section", {"section": section, "text": str(answer.get(section) or "").strip()})
    yield _sse("done", {"answer": answer})


@require_POST
@rate_limited('oracle_api', 20, 3600)
def oracle_api(request):
    try:
        payload = _oracle_request_payload(request)
        astro_context = build_astro_context(
            date_str=payload["date_str"],
            time_str=payload["time_str"],
            lat=payload["lat"],
            lon=payload["lon"],
            tz_name=payload["tz_name"],
            specific_year=payload["specific_year"],
        )
        answer = ask_oracle(
            question=payload["question"],
            astro_context=astro_context,
            history=payload["history"],
            user_identifier=profile_fingerprint(astro_context["profile"]),
        )
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except Exception:
        logger.exception("Kundali/oracle request failed")
        return JsonResponse({"error": SERVER_ERROR}, status=500)

    return JsonResponse(
        {
            "answer": answer,
            "astro_context": astro_context,
            "suggested_prompts": get_suggested_prompts(astro_context),
            "profile_key": profile_fingerprint(astro_context["profile"]),
        }
    )


@require_POST
@rate_limited('oracle_stream_api', 20, 3600)
def oracle_stream_api(request):
    try:
        payload = _oracle_request_payload(request)
        astro_context = build_astro_context(
            date_str=payload["date_str"],
            time_str=payload["time_str"],
            lat=payload["lat"],
            lon=payload["lon"],
            tz_name=payload["tz_name"],
            specific_year=payload["specific_year"],
        )
        answer = ask_oracle(
            question=payload["question"],
            astro_context=astro_context,
            history=payload["history"],
            user_identifier=profile_fingerprint(astro_context["profile"]),
        )
        suggested_prompts = get_suggested_prompts(astro_context)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except Exception:
        logger.exception("Kundali/oracle request failed")
        return JsonResponse({"error": SERVER_ERROR}, status=500)

    def event_stream():
        yield _sse("meta", {"suggested_prompts": suggested_prompts, "profile_key": profile_fingerprint(astro_context["profile"])})
        yield from _stream_direct_answer(answer)

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


@require_POST
@rate_limited('horoscope_summary_api', 30, 3600)
def horoscope_summary_api(request):
    try:
        payload = _summary_request_payload(request)
        astro_context = build_astro_context(
            date_str=payload["date_str"],
            time_str=payload["time_str"],
            lat=payload["lat"],
            lon=payload["lon"],
            tz_name=payload["tz_name"],
            specific_year=payload["specific_year"],
        )
        summary = generate_personalized_summary(
            astro_context=astro_context,
            scope_key=payload["scope_key"],
            user_identifier=profile_fingerprint(astro_context["profile"]),
        )
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except Exception:
        logger.exception("Kundali/oracle request failed")
        return JsonResponse({"error": SERVER_ERROR}, status=500)

    return JsonResponse({"summary": summary})


GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
PLACE_CACHE_SECONDS = 60 * 60 * 24 * 7


def _place_label(row: Dict) -> str:
    parts = []
    for key in ("name", "admin1", "country"):
        value = str(row.get(key) or "").strip()
        if value and value not in parts:
            parts.append(value)
    return ", ".join(parts)


@require_GET
@rate_limited("places_search", 120, 600)
def place_search_api(request):
    """
    GET /api/places/search?q=Varanasi
    Returns up to 6 matching places with the coordinates and timezone the kundali needs,
    so people search for their birthplace instead of typing latitude/longitude.
    """
    query = " ".join((request.GET.get("q") or "").split())
    if len(query) < 2:
        return JsonResponse({"results": []})
    if len(query) > 80:
        return JsonResponse({"error": "Search text is too long."}, status=400)

    cache_key = "places:v2:" + query.lower()
    cached = cache.get(cache_key)
    if cached is not None:
        return JsonResponse({"results": cached})

    def fetch(extra):
        params = {"name": query, "language": "en", "format": "json", **extra}
        url = GEOCODE_URL + "?" + urllib.parse.urlencode(params)
        with urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=6) as response:
            return json.loads(response.read().decode("utf-8")).get("results") or []

    try:
        # Most visitors are in India, so list Indian matches first, then the rest of the world.
        rows = fetch({"count": 5, "countryCode": "IN"})
        rows += fetch({"count": 6})
    except Exception:
        logger.warning("Place search failed for %r", query, exc_info=True)
        return JsonResponse({"error": "Place search is unavailable right now. Please try again."}, status=502)

    results, seen = [], set()
    for row in rows:
        try:
            lat = round(float(row["latitude"]), 4)
            lon = round(float(row["longitude"]), 4)
        except (KeyError, TypeError, ValueError):
            continue
        if (lat, lon) in seen:
            continue
        seen.add((lat, lon))
        results.append(
            {
                "label": _place_label(row),
                "name": str(row.get("name") or ""),
                "lat": lat,
                "lon": lon,
                "tz": str(row.get("timezone") or ""),
            }
        )
    results = results[:8]
    cache.set(cache_key, results, timeout=PLACE_CACHE_SECONDS)
    return JsonResponse({"results": results})


REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
REVERSE_CACHE_SECONDS = 60 * 60 * 24 * 30


def _reverse_label(address: Dict) -> str:
    place = ""
    for key in ("city", "town", "village", "municipality", "suburb", "hamlet", "city_district", "county"):
        if address.get(key):
            place = str(address[key]).strip()
            break
    parts = []
    for value in (place, str(address.get("state") or address.get("state_district") or "").strip(), str(address.get("country") or "").strip()):
        if value and value not in parts:
            parts.append(value)
    return ", ".join(parts)


@require_GET
@rate_limited("places_reverse", 30, 600)
def place_reverse_api(request):
    """
    GET /api/places/reverse?lat=..&lon=..
    Turns the device's coordinates into a place name ("Varanasi, Uttar Pradesh, India").
    """
    try:
        lat = float(request.GET.get("lat"))
        lon = float(request.GET.get("lon"))
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid coordinates."}, status=400)
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return JsonResponse({"error": "Invalid coordinates."}, status=400)

    # ~1 km grid: keeps the cache useful and sends the lookup service less precise data.
    key_lat, key_lon = round(lat, 2), round(lon, 2)
    cache_key = f"places:rev:v1:{key_lat}:{key_lon}"
    cached = cache.get(cache_key)
    if cached is not None:
        return JsonResponse({"label": cached})

    url = REVERSE_URL + "?" + urllib.parse.urlencode(
        {"lat": key_lat, "lon": key_lon, "format": "jsonv2", "zoom": 10, "addressdetails": 1, "accept-language": "en"}
    )
    agent = f"ScienceMeetsSanatan/1.0 ({getattr(settings, 'NOMINATIM_CONTACT', '') or 'place lookup'})"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": agent}), timeout=6) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        logger.warning("Reverse geocode failed for %s,%s", key_lat, key_lon, exc_info=True)
        return JsonResponse({"error": "Could not look up the place name."}, status=502)

    label = _reverse_label(payload.get("address") or {})
    if not label:
        return JsonResponse({"error": "No place found for this location."}, status=404)
    cache.set(cache_key, label, timeout=REVERSE_CACHE_SECONDS)
    return JsonResponse({"label": label})
