from datetime import date as Date, timedelta
from functools import lru_cache
from pathlib import Path
import json
import logging
import math
import time
import re
from zoneinfo import available_timezones

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from core.ratelimit import rate_limited

from .auspicious import kharmas_for_year, marriage_windows_for_year, refresh_kharmas_state, refresh_marriage_state
from .calculations import build_panchang, build_panchang_for_date
from .festival_rules import rules_version as festival_rules_version


logger = logging.getLogger(__name__)
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@lru_cache(maxsize=1)
def _timezones():
    return frozenset(available_timezones())


def _geo(request, *, places: int = 2):
    """Validated (lat, lon, tz) from the query string, or None when any of them is unusable.

    Coordinates are rounded to ~1 km so a caller cannot force a fresh calculation (and a new cache row) for
    every tiny variation, and the timezone must be a real IANA name."""
    tz = (request.GET.get("tz") or "Asia/Kolkata").strip()
    if tz not in _timezones():
        return None
    try:
        lat = float(request.GET.get("lat") or 28.6139)
        lon = float(request.GET.get("lon") or 77.2090)
    except (TypeError, ValueError):
        return None
    if not (math.isfinite(lat) and math.isfinite(lon)) or not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        return None
    return round(lat, places), round(lon, places), tz


def _year(request) -> int:
    try:
        year = int(request.GET.get("year") or "")
    except (TypeError, ValueError):
        year = Date.today().year
    return max(2000, min(2100, year))


DAY_CACHE_TIMEOUT = 60 * 60 * 24 * 14
YEAR_CACHE_TIMEOUT = 60 * 60 * 24 * 45


def _day_cache_key(*, date: str, lat_r: float, lon_r: float, tz_name: str, rules_version: str) -> str:
    return f"panchang:day:v2:{date}:{lat_r:.3f}:{lon_r:.3f}:{tz_name}:{rules_version}"


def _year_cache_key(*, year: int, lat_r: float, lon_r: float, tz_name: str, rules_version: str) -> str:
    return f"panchang:corefest:v3:{year}:{lat_r:.3f}:{lon_r:.3f}:{tz_name}:{rules_version}"


def _kharmas_cache_key(*, year: int, lat_r: float, lon_r: float, tz_name: str) -> str:
    return f"panchang:kharmas:v2:{year}"


def _marriage_cache_key(*, year: int, lat_r: float, lon_r: float, tz_name: str) -> str:
    return f"panchang:marriage:v3:{year}"


def _core_festival_cache_path(*, year: int, lat_r: float, lon_r: float, tz_name: str, rules_version: str) -> Path:
    safe_tz = str(tz_name or "UTC").replace("/", "_").replace("\\", "_").replace(":", "_")
    base = Path(getattr(settings, "PANCHANG_CACHE_DIR", "/tmp/sms_panchang_cache"))
    base.mkdir(parents=True, exist_ok=True)
    return base / f"corefest_{year}_{lat_r:.3f}_{lon_r:.3f}_{safe_tz}_{rules_version}.json"


def _bundled_core_festival_cache_path(*, year: int) -> Path:
    return Path(__file__).resolve().parent / "datasets" / "resolved_core_festivals" / f"{year}.json"


@lru_cache(maxsize=24)
def _load_bundled_core_festival_dates(*, year: int):
    path = _bundled_core_festival_cache_path(year=year)
    if not path.exists():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return raw if isinstance(raw, list) and raw else None


def _cached_panchang_for_date(*, date: str, lat_r: float, lon_r: float, tz_name: str, rules_version: str):
    cache_key = _day_cache_key(
        date=date,
        lat_r=lat_r,
        lon_r=lon_r,
        tz_name=tz_name,
        rules_version=rules_version,
    )
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    payload = build_panchang_for_date(
        date=date,
        lat_r=lat_r,
        lon_r=lon_r,
        tz_name=tz_name,
        rules_version=rules_version,
    )
    cache.set(cache_key, payload, timeout=DAY_CACHE_TIMEOUT)
    return payload


@require_GET
@rate_limited('panchang_month', 120, 3600)
def panchang_month_api(request):
    """GET /api/panchang/month/?year=YYYY&month=M&lat=..&lon=..&tz=..

    The whole month in one request (the calendar used to make one request per day). Each day goes through the same
    cache as /api/panchang, so the payloads are identical."""
    try:
        year, month = int(request.GET.get("year")), int(request.GET.get("month"))
        first = Date(year, month, 1)
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid year or month."}, status=400)
    if not 2000 <= year <= 2100:
        return JsonResponse({"error": "Invalid year or month."}, status=400)
    geo = _geo(request, places=3)
    if geo is None:
        return JsonResponse({"error": "Invalid lat/lon or timezone."}, status=400)
    lat, lon, tz = geo
    days, d = {}, first
    started = time.monotonic()
    try:
        # serverless functions are killed after ~10 s: stop at a 5 s budget and let the browser fetch the remaining days
        while d.month == month and time.monotonic() - started < 5.0:
            days[str(d)] = _cached_panchang_for_date(
                date=str(d), lat_r=lat, lon_r=lon, tz_name=tz, rules_version=festival_rules_version()
            )
            d += timedelta(days=1)
    except Exception:
        logger.exception("panchang_month_api failed")
        return JsonResponse({"error": "Could not calculate this month right now."}, status=500)
    complete = d.month != month
    response = JsonResponse({"days": days, "complete": complete})
    if complete:
        response["Cache-Control"] = "public, max-age=3600, s-maxage=86400"
    return response


@require_GET
@rate_limited('panchang_api', 1500, 3600)
def panchang_api(request):
    """
    GET /api/panchang?date=YYYY-MM-DD&lat=..&lon=..&tz=Asia/Kolkata&at=ISO_DATETIME
    Defaults to Delhi + Asia/Kolkata.
    """
    date = request.GET.get("date")
    at = request.GET.get("at")
    if date and not _DATE_RE.match(date):
        return JsonResponse({"error": "Invalid date."}, status=400)
    geo = _geo(request, places=3)
    if geo is None:
        return JsonResponse({"error": "Invalid lat/lon or timezone."}, status=400)
    lat, lon, tz = geo

    try:
        if date and not at:
            payload = _cached_panchang_for_date(
                date=date,
                lat_r=lat,
                lon_r=lon,
                tz_name=tz,
                rules_version=festival_rules_version(),
            )
        else:
            payload = build_panchang(date=date, lat=lat, lon=lon, tz_name=tz, at=at)
    except ValueError:
        return JsonResponse({"error": "Invalid date or time."}, status=400)
    except Exception:
        logger.exception("panchang_api failed")
        return JsonResponse({"error": "Could not calculate the Panchang right now."}, status=500)

    response = JsonResponse(payload)
    if date and not at:
        # a calendar day's Panchang never changes, so browsers and the CDN may reuse it
        response["Cache-Control"] = "public, max-age=3600, s-maxage=86400"
    return response


def _load_core_festival_rules():
    path = Path(__file__).resolve().parent / "datasets" / "panchang_full_dataset" / "core_festivals.json"
    global _CORE_RULES_CACHE  # noqa: PLW0603
    try:
        mtime = float(path.stat().st_mtime)
    except Exception:
        mtime = -1.0

    try:
        cache = _CORE_RULES_CACHE  # type: ignore[name-defined]
    except Exception:
        cache = {"mtime": None, "data": None}
        _CORE_RULES_CACHE = cache  # type: ignore[assignment]

    if cache.get("data") is not None and cache.get("mtime") == mtime:
        return cache["data"]

    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw) if raw.strip() else []
        out = [x for x in data if isinstance(x, dict)] if isinstance(data, list) else []
    except Exception:
        out = []

    cache["mtime"] = mtime
    cache["data"] = out
    return out


@require_GET
def core_festivals_api(request):
    return JsonResponse(_load_core_festival_rules(), safe=False)


@lru_cache(maxsize=128)
def _core_festival_dates_for_year(*, year: int, lat_r: float, lon_r: float, tz_name: str, rules_version: str):
    start = Date(year, 1, 1)
    end = Date(year, 12, 31)
    out = []
    seen = set()

    d = start
    while d <= end:
        try:
            payload = _cached_panchang_for_date(
                date=str(d),
                lat_r=lat_r,
                lon_r=lon_r,
                tz_name=tz_name,
                rules_version=rules_version,
            )
        except Exception:
            d += timedelta(days=1)
            continue
        details = payload.get("festivals_detail")
        if isinstance(details, list):
            for f in details:
                if not isinstance(f, dict):
                    continue
                if str(f.get("source") or "") != "core":
                    continue
                name = str(f.get("name") or "").strip()
                if not name:
                    continue
                key = f"{d.isoformat()}|{name}"
                if key in seen:
                    continue
                seen.add(key)
                out.append(
                    {
                        "date": d.isoformat(),
                        "name": name,
                        "icon": f.get("icon") or "🎉",
                        "anim": f.get("anim") or "glow",
                        "description": f.get("description") or "",
                        "time_rule": f.get("time_rule"),
                        "tithi": payload.get("tithi"),
                        "paksha": payload.get("paksha"),
                        "month": payload.get("month"),
                    }
                )
        d += timedelta(days=1)

    out.sort(key=lambda r: (str(r.get("date") or ""), str(r.get("name") or "")))
    return out


@require_GET
@rate_limited('panchang_year', 40, 3600)
def core_festival_dates_api(request):
    """
    GET /api/core-festivals-dates/?year=YYYY&lat=..&lon=..&tz=...
    Returns resolved core festival dates for the selected Gregorian year.
    """
    year = _year(request)
    geo = _geo(request)
    if geo is None:
        return JsonResponse({"error": "Invalid lat/lon or timezone."}, status=400)
    lat, lon, tz = geo

    rules_ver = festival_rules_version()
    try:
        cache_key = _year_cache_key(
            year=year,
            lat_r=lat,
            lon_r=lon,
            tz_name=tz,
            rules_version=rules_ver,
        )
        data = cache.get(cache_key)
        if not isinstance(data, list) or not data:
            bundled = _load_bundled_core_festival_dates(year=year)
            if bundled:
                data = bundled
                cache.set(cache_key, data, timeout=YEAR_CACHE_TIMEOUT)
        if not isinstance(data, list) or not data:
            cache_path = _core_festival_cache_path(
                year=year,
                lat_r=lat,
                lon_r=lon,
                tz_name=tz,
                rules_version=rules_ver,
            )
            if cache_path.exists():
                try:
                    data = json.loads(cache_path.read_text(encoding="utf-8"))
                except Exception:
                    data = None
            if not isinstance(data, list) or not data:
                data = _core_festival_dates_for_year(
                    year=year,
                    lat_r=lat,
                    lon_r=lon,
                    tz_name=tz,
                    rules_version=rules_ver,
                )
                cache.set(cache_key, data, timeout=YEAR_CACHE_TIMEOUT)
                try:
                    cache_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
                except Exception:
                    pass
            else:
                cache.set(cache_key, data, timeout=YEAR_CACHE_TIMEOUT)
    except Exception:
        logger.exception("core_festival_dates_api failed")
        data = []

    return JsonResponse(data, safe=False)


@require_GET
@rate_limited('panchang_year', 40, 3600)
def kharmas_api(request):
    year = _year(request)
    geo = _geo(request)
    if geo is None:
        return JsonResponse({"error": "Invalid lat/lon or timezone."}, status=400)
    lat, lon, tz = geo

    cache_key = _kharmas_cache_key(year=year, lat_r=lat, lon_r=lon, tz_name=tz)
    try:
        data = cache.get(cache_key)
        if not isinstance(data, dict) or not data:
            data = kharmas_for_year(year=year, lat_r=lat, lon_r=lon, tz_name=tz)
            cache.set(cache_key, data, timeout=YEAR_CACHE_TIMEOUT)
    except Exception:
        logger.exception("panchang year endpoint failed")
        return JsonResponse({"error": "Could not calculate this right now."}, status=500)

    data = refresh_kharmas_state(data, tz)
    response = JsonResponse(data)
    response["Cache-Control"] = "public, max-age=900, s-maxage=3600"
    return response


@require_GET
@rate_limited('panchang_year', 40, 3600)
def marriage_dates_api(request):
    year = _year(request)
    geo = _geo(request)
    if geo is None:
        return JsonResponse({"error": "Invalid lat/lon or timezone."}, status=400)
    lat, lon, tz = geo

    cache_key = _marriage_cache_key(year=year, lat_r=lat, lon_r=lon, tz_name=tz)
    try:
        data = cache.get(cache_key)
        if not isinstance(data, dict) or not data:
            data = marriage_windows_for_year(year=year, lat_r=lat, lon_r=lon, tz_name=tz)
            cache.set(cache_key, data, timeout=YEAR_CACHE_TIMEOUT)
    except Exception:
        logger.exception("panchang year endpoint failed")
        return JsonResponse({"error": "Could not calculate this right now."}, status=500)

    data = refresh_marriage_state(data, tz)
    response = JsonResponse(data)
    response["Cache-Control"] = "public, max-age=900, s-maxage=3600"
    return response
