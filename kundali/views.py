from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .calculations import build_kundali
from .horoscope_engine import build_horoscope


@require_GET
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
        payload = build_kundali(date_str=date_str, time_str=time_str, lat=lat, lon=lon, tz_name=tz)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)

    return JsonResponse(payload)


@require_GET
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
    except Exception:
        return JsonResponse({"error": "Invalid input values."}, status=400)

    try:
        payload = build_horoscope(
            date_str=date_str,
            time_str=time_str,
            lat=lat,
            lon=lon,
            tz_name=tz,
            specific_year=specific_year,
        )
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)

    return JsonResponse(payload)
