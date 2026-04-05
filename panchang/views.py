from datetime import date as Date, timedelta
from functools import lru_cache
from pathlib import Path
import json

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .calculations import build_panchang, build_panchang_for_date
from .festival_rules import rules_version as festival_rules_version


DAY_CACHE_TIMEOUT = 60 * 60 * 24 * 14
YEAR_CACHE_TIMEOUT = 60 * 60 * 24 * 45


def _day_cache_key(*, date: str, lat_r: float, lon_r: float, tz_name: str, rules_version: str) -> str:
    return f"panchang:day:v2:{date}:{lat_r:.3f}:{lon_r:.3f}:{tz_name}:{rules_version}"


def _year_cache_key(*, year: int, lat_r: float, lon_r: float, tz_name: str, rules_version: str) -> str:
    return f"panchang:corefest:v2:{year}:{lat_r:.3f}:{lon_r:.3f}:{tz_name}:{rules_version}"


def _core_festival_cache_path(*, year: int, lat_r: float, lon_r: float, tz_name: str, rules_version: str) -> Path:
    safe_tz = str(tz_name or "UTC").replace("/", "_").replace("\\", "_").replace(":", "_")
    base = Path(getattr(settings, "PANCHANG_CACHE_DIR", "/tmp/sms_panchang_cache"))
    base.mkdir(parents=True, exist_ok=True)
    return base / f"corefest_{year}_{lat_r:.3f}_{lon_r:.3f}_{safe_tz}_{rules_version}.json"


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
def panchang_api(request):
    """
    GET /api/panchang?date=YYYY-MM-DD&lat=..&lon=..&tz=Asia/Kolkata&at=ISO_DATETIME
    Defaults to Delhi + Asia/Kolkata.
    """
    date = request.GET.get("date")
    at = request.GET.get("at")
    tz = request.GET.get("tz") or "Asia/Kolkata"
    try:
        lat = float(request.GET.get("lat") or 28.6139)
        lon = float(request.GET.get("lon") or 77.2090)
    except Exception:
        return JsonResponse({"error": "Invalid lat/lon."}, status=400)

    try:
        if date and not at:
            # Use a slightly finer rounding for sunrise/sunset accuracy while still caching efficiently.
            payload = _cached_panchang_for_date(
                date=date,
                lat_r=round(lat, 3),
                lon_r=round(lon, 3),
                tz_name=tz,
                rules_version=festival_rules_version(),
            )
        else:
            payload = build_panchang(date=date, lat=lat, lon=lon, tz_name=tz, at=at)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)

    return JsonResponse(payload)


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
def core_festival_dates_api(request):
    """
    GET /api/core-festivals-dates/?year=YYYY&lat=..&lon=..&tz=...
    Returns resolved core festival dates for the selected Gregorian year.
    """
    year_raw = request.GET.get("year") or ""
    try:
        year = int(year_raw)
    except Exception:
        year = Date.today().year
    year = max(1600, min(2600, year))

    tz = request.GET.get("tz") or "Asia/Kolkata"
    try:
        lat = float(request.GET.get("lat") or 28.6139)
        lon = float(request.GET.get("lon") or 77.2090)
    except Exception:
        return JsonResponse({"error": "Invalid lat/lon."}, status=400)

    rules_ver = festival_rules_version()
    try:
        cache_key = _year_cache_key(
            year=year,
            lat_r=round(lat, 3),
            lon_r=round(lon, 3),
            tz_name=tz,
            rules_version=rules_ver,
        )
        data = cache.get(cache_key)
        if data is None:
            cache_path = _core_festival_cache_path(
                year=year,
                lat_r=round(lat, 3),
                lon_r=round(lon, 3),
                tz_name=tz,
                rules_version=rules_ver,
            )
            if cache_path.exists():
                try:
                    data = json.loads(cache_path.read_text(encoding="utf-8"))
                except Exception:
                    data = None
            if data is None:
                data = _core_festival_dates_for_year(
                    year=year,
                    lat_r=round(lat, 3),
                    lon_r=round(lon, 3),
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
    except Exception as exc:
        data = []
        if request.GET.get("debug") == "1":
            return JsonResponse({"error": str(exc)}, status=500)

    return JsonResponse(data, safe=False)
