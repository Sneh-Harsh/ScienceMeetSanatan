import json
from typing import Dict, Iterable

from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.http import require_GET, require_POST

from .calculations import build_kundali
from .dasha_engine import build_dasha_experience
from .dosha_engine import analyze_doshas
from .experience_engine import build_kundali_experience
from .horoscope_engine import build_horoscope
from .oracle_service import ask_oracle, build_astro_context, generate_personalized_summary, get_suggested_prompts, profile_fingerprint
from .remedies_engine import build_remedies


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
        debug = str(request.GET.get("debug") or "").strip().lower() in {"1", "true", "yes", "debug"}
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
            debug=debug,
        )
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)

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

    history = body.get("history") if isinstance(body.get("history"), list) else []
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

    return {
        "date_str": date_str,
        "time_str": time_str,
        "lat": lat,
        "lon": lon,
        "tz_name": tz_name,
        "specific_year": specific_year,
        "scope_key": scope_key,
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
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)

    return JsonResponse(
        {
            "answer": answer,
            "astro_context": astro_context,
            "suggested_prompts": get_suggested_prompts(astro_context),
            "profile_key": profile_fingerprint(astro_context["profile"]),
        }
    )


@require_POST
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
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)

    def event_stream():
        yield _sse("meta", {"suggested_prompts": suggested_prompts, "profile_key": profile_fingerprint(astro_context["profile"])})
        yield from _stream_direct_answer(answer)

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


@require_POST
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
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)

    return JsonResponse({"summary": summary})
