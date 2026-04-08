import json
from datetime import date as dt_date
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import authenticate, login as auth_login
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.db.models import Sum
from django.core.cache import cache
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views.decorators.http import require_GET, require_POST

from .models import LoginAttempt
from .baby_names_data import load_baby_names_json
from .library_data import PRESET_LIBRARY_CATEGORIES, build_library_payload, get_library_item, load_library_items
from .models import Category, QuizAttempt, UserStats
from kundali.calculations import PLANETS, RASHI, _dt_to_jd_ut, _rashi_index, _sidereal_lon
from panchang.festival_rules import rules_version as festival_rules_version
from panchang.views import _cached_panchang_for_date, _load_core_festival_rules
import swisseph as swe


WELCOME_TIMEOUT = 60 * 60
RASHI_TOPICS = {
    1: "clarity, confidence, and a stronger sense of self",
    2: "resources, family priorities, and grounded decisions",
    3: "courage, communication, and finishing what you begin",
    4: "home, emotional peace, and inner stability",
    5: "joy, creativity, romance, and inspired expression",
    6: "health, routines, and practical discipline",
    7: "relationships, agreements, and meaningful dialogue",
    8: "transformation, release, and hidden emotional undercurrents",
    9: "faith, luck, mentors, and a wider vision",
    10: "career, reputation, and visible action",
    11: "gains, allies, and long-term hopes",
    12: "rest, prayer, closure, and spiritual retreat",
}
PLANET_COLORS = {
    "Sun": "#f8c24f",
    "Moon": "#c7d8ff",
    "Mercury": "#72f0d1",
    "Venus": "#ff92dc",
    "Mars": "#ff7b63",
    "Jupiter": "#ffbe6b",
    "Saturn": "#7f8dff",
    "Rahu": "#9c7dff",
    "Ketu": "#7ce4ff",
}
PLANET_ORBITS = {
    "Moon": 1,
    "Mercury": 2,
    "Venus": 3,
    "Mars": 4,
    "Jupiter": 5,
    "Saturn": 6,
    "Rahu": 7,
    "Ketu": 8,
}
TIME_RULE_LABELS = {
    "sunrise": "Sunrise rule",
    "sunset": "Sunset window",
    "midnight": "Midnight rule",
    "nishita": "Nishita Kaal",
    "moonrise": "Moonrise window",
}
GREGORIAN_TO_LUNAR_HINTS = {
    1: ["Paush", "Magh"],
    2: ["Magh", "Phalguna"],
    3: ["Phalguna", "Chaitra"],
    4: ["Chaitra", "Vaishakh"],
    5: ["Vaishakh", "Jyeshtha"],
    6: ["Jyeshtha", "Ashadh"],
    7: ["Ashadh", "Shravan"],
    8: ["Shravan", "Bhadrapad"],
    9: ["Bhadrapad", "Ashwin"],
    10: ["Ashwin", "Kartik"],
    11: ["Kartik", "Margashirsha"],
    12: ["Margashirsha", "Paush"],
}


def _house_from_sign(target_idx, base_idx):
    return ((int(target_idx) - int(base_idx)) % 12) + 1


def _current_transits(*, lat: float, lon: float, tz_name: str):
    tz = ZoneInfo(tz_name)
    now_local = datetime.now(tz).replace(second=0, microsecond=0)
    jd_ut = _dt_to_jd_ut(now_local.astimezone(timezone.utc))

    transits = {}
    for name, symbol, body in PLANETS:
        lon_deg = _sidereal_lon(jd_ut, body)
        transits[name] = {
            "name": name,
            "symbol": symbol,
            "degree": round(lon_deg, 2),
            "rashi_index": int(_rashi_index(lon_deg)),
            "color": PLANET_COLORS.get(name, "#f2ca50"),
        }

    rahu_lon = _sidereal_lon(jd_ut, swe.TRUE_NODE)
    ketu_lon = (rahu_lon + 180.0) % 360.0
    transits["Rahu"] = {
        "name": "Rahu",
        "symbol": "☊",
        "degree": round(rahu_lon, 2),
        "rashi_index": int(_rashi_index(rahu_lon)),
        "color": PLANET_COLORS["Rahu"],
    }
    transits["Ketu"] = {
        "name": "Ketu",
        "symbol": "☋",
        "degree": round(ketu_lon, 2),
        "rashi_index": int(_rashi_index(ketu_lon)),
        "color": PLANET_COLORS["Ketu"],
    }
    return now_local, transits


def _raashi_prediction(sign_idx, sign_data, transits):
    moon_house = _house_from_sign(transits["Moon"]["rashi_index"], sign_idx)
    jupiter_house = _house_from_sign(transits["Jupiter"]["rashi_index"], sign_idx)
    saturn_house = _house_from_sign(transits["Saturn"]["rashi_index"], sign_idx)
    venus_house = _house_from_sign(transits["Venus"]["rashi_index"], sign_idx)
    mars_house = _house_from_sign(transits["Mars"]["rashi_index"], sign_idx)
    mercury_house = _house_from_sign(transits["Mercury"]["rashi_index"], sign_idx)
    rahu_house = _house_from_sign(transits["Rahu"]["rashi_index"], sign_idx)

    energy = 56
    if moon_house in {1, 5, 9, 10, 11}:
        energy += 12
    if jupiter_house in {1, 2, 5, 7, 9, 10, 11}:
        energy += 14
    if venus_house in {1, 5, 7, 11}:
        energy += 8
    if mercury_house in {2, 3, 6, 10, 11}:
        energy += 6
    if saturn_house in {4, 8, 10, 12}:
        energy -= 12
    if mars_house in {1, 6, 8, 12}:
        energy -= 7
    if rahu_house in {2, 7, 8, 12}:
        energy -= 6
    energy = max(22, min(96, energy))

    dominant = "Jupiter"
    if saturn_house in {8, 10, 12}:
        dominant = "Saturn"
    elif venus_house in {1, 5, 7, 11}:
        dominant = "Venus"
    elif mars_house in {1, 6, 8, 12}:
        dominant = "Mars"

    opening = RASHI_TOPICS.get(moon_house, "reflection and recalibration")
    supportive = []
    if jupiter_house in {1, 2, 5, 7, 9, 10, 11}:
        supportive.append("Jupiter opens graceful opportunities")
    if mercury_house in {2, 3, 6, 10, 11}:
        supportive.append("Mercury sharpens your decisions")
    if venus_house in {1, 5, 7, 11}:
        supportive.append("Venus softens relationships")
    caution = []
    if saturn_house in {4, 8, 10, 12}:
        caution.append("Saturn asks for patience")
    if mars_house in {1, 6, 8, 12}:
        caution.append("Mars can make reactions too quick")
    if rahu_house in {2, 7, 8, 12}:
        caution.append("Rahu may blur priorities")

    support_text = ", ".join(supportive[:2]) if supportive else "steady effort becomes your best ally"
    caution_text = ", while ".join(caution[:2]) if caution else "so calm choices will bring the best outcome"
    prediction = (
        f"Krishna says, today {sign_data['sa']} moves through {opening}. "
        f"{support_text}, while {caution_text}. Stay close to truth, move gently, and let wisdom lead before emotion does."
    )

    return {
        "slug": sign_data["sa"].lower(),
        "sign_en": sign_data["en"],
        "sign_sa": sign_data["sa"],
        "energy": int(energy),
        "dominant_planet": dominant,
        "prediction": prediction,
        "accent": PLANET_COLORS.get(dominant, "#f2ca50"),
    }


def _format_iso_local(value, tz_name: str, include_date=False):
    if not value:
        return ""
    try:
        dt_obj = datetime.fromisoformat(str(value))
        if dt_obj.tzinfo is None:
            dt_obj = dt_obj.replace(tzinfo=ZoneInfo(tz_name))
        dt_obj = dt_obj.astimezone(ZoneInfo(tz_name))
        return dt_obj.strftime("%d %b • %I:%M %p") if include_date else dt_obj.strftime("%I:%M %p")
    except Exception:
        return str(value)


def _welcome_festivals(*, lat: float, lon: float, tz_name: str):
    tz = ZoneInfo(tz_name)
    today = datetime.now(tz).date()
    rules_version = festival_rules_version()
    start_day = today.replace(day=1)
    if start_day.month == 12:
        next_month = dt_date(start_day.year + 1, 1, 1)
    else:
        next_month = dt_date(start_day.year, start_day.month + 1, 1)
    end_day = dt_date.fromordinal(next_month.toordinal() - 1)

    candidates = []
    current = start_day
    while current <= end_day:
        try:
            payload = _cached_panchang_for_date(
                date=current.isoformat(),
                lat_r=round(lat, 3),
                lon_r=round(lon, 3),
                tz_name=tz_name,
                rules_version=rules_version,
            )
        except Exception:
            current = dt_date.fromordinal(current.toordinal() + 1)
            continue

        for detail in payload.get("festivals_detail", []):
            if not isinstance(detail, dict) or str(detail.get("source") or "") != "core":
                continue
            name = str(detail.get("name") or "").strip()
            if not name:
                continue
            time_parts = []
            if detail.get("time_rule"):
                time_parts.append(TIME_RULE_LABELS.get(str(detail.get("time_rule")), str(detail.get("time_rule")).replace("_", " ").title()))
            if payload.get("tithi_end"):
                time_parts.append(f"Tithi till {_format_iso_local(payload.get('tithi_end'), tz_name)}")
            candidates.append(
                {
                    "name": name,
                    "date": current.isoformat(),
                    "date_label": current.strftime("%d %b %Y"),
                    "time_label": " • ".join(part for part in time_parts if part),
                    "icon": detail.get("icon") or "✦",
                    "description": str(detail.get("description") or "")[:180],
                    "tithi": str(payload.get("tithi") or ""),
                    "paksha": str(payload.get("paksha") or ""),
                    "month": str(payload.get("month") or ""),
                }
            )
        current = dt_date.fromordinal(current.toordinal() + 1)
        if len(candidates) >= 10 and current > today:
            break

    seen = set()
    month_items = []
    for item in candidates:
        key = f"{item['date']}|{item['name'].lower()}"
        if key in seen:
            continue
        seen.add(key)
        month_items.append(item)
    month_items.sort(key=lambda item: (item["date"], item["name"]))
    if not month_items:
        return []

    pivot = 0
    for idx, item in enumerate(month_items):
        if dt_date.fromisoformat(item["date"]) >= today:
            pivot = idx
            break
    else:
        pivot = len(month_items) - 1

    start = max(0, pivot - 1)
    if start + 4 > len(month_items):
        start = max(0, len(month_items) - 4)
    selected = month_items[start:start + 4]

    out = []
    for item in selected:
        fest_day = dt_date.fromisoformat(str(item.get("date")))
        status = "today" if fest_day == today else ("past" if fest_day < today else "upcoming")
        out.append(
            {
                "name": str(item.get("name") or ""),
                "date": str(item.get("date") or ""),
                "date_label": str(item.get("date_label") or fest_day.strftime("%d %b %Y")),
                "time_label": str(item.get("time_label") or ""),
                "status": status,
                "icon": item.get("icon") or "✦",
                "description": str(item.get("description") or "")[:180],
                "festival_meta": " • ".join(
                    part for part in [str(item.get("month") or ""), str(item.get("paksha") or ""), str(item.get("tithi") or "")] if part
                ),
            }
        )
    return out


def _welcome_planets(transits):
    bodies = []
    for name in ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Rahu", "Ketu"]:
        item = transits[name]
        bodies.append(
            {
                "name": name,
                "symbol": item["symbol"],
                "degree": item["degree"],
                "angle": round(float(item["degree"]), 2),
                "orbit": PLANET_ORBITS.get(name, 0),
                "color": item["color"],
            }
        )
    return bodies


def _build_welcome_raashi_payload(*, lat: float, lon: float, tz_name: str):
    now_local, transits = _current_transits(lat=lat, lon=lon, tz_name=tz_name)
    return {
        "generated_at": now_local.isoformat(),
        "rashi_pulse": [_raashi_prediction(idx, sign_data, transits) for idx, sign_data in enumerate(RASHI)],
    }


def _fallback_welcome_raashi_payload(*, tz_name: str):
    tz = ZoneInfo(tz_name)
    today = datetime.now(tz)
    day_seed = today.timetuple().tm_yday
    items = []
    for idx, sign_data in enumerate(RASHI):
        energy = 48 + ((day_seed + idx * 7) % 36)
        mood_bucket = (day_seed + idx * 3) % 4
        if mood_bucket == 0:
            opening = "clarity in decision-making and a calmer inner pace"
        elif mood_bucket == 1:
            opening = "relationships, grace, and steadier emotional balance"
        elif mood_bucket == 2:
            opening = "work, duty, and practical problem-solving"
        else:
            opening = "rest, reflection, and spiritual reset"
        items.append(
            {
                "slug": sign_data["sa"].lower(),
                "sign_en": sign_data["en"],
                "sign_sa": sign_data["sa"],
                "energy": energy,
                "dominant_planet": ["Jupiter", "Venus", "Mercury", "Saturn"][(day_seed + idx) % 4],
                "prediction": f"Krishna says, today {sign_data['sa']} moves through {opening}. Stay measured, trust dharma over impulse, and let small wise actions shape the day.",
                "accent": ["#f2ca50", "#ff92dc", "#72f0d1", "#7f8dff"][(day_seed + idx) % 4],
            }
        )
    return {
        "generated_at": today.isoformat(),
        "rashi_pulse": items,
        "fallback": True,
    }


def _build_welcome_festivals_payload(*, lat: float, lon: float, tz_name: str):
    return {
        "generated_at": datetime.now(ZoneInfo(tz_name)).isoformat(),
        "monthly_festivals": _welcome_festivals(lat=lat, lon=lon, tz_name=tz_name),
    }


def _fallback_welcome_festivals_payload(*, tz_name: str):
    tz = ZoneInfo(tz_name)
    today = datetime.now(tz).date()
    rules = _load_core_festival_rules()
    hinted_months = GREGORIAN_TO_LUNAR_HINTS.get(today.month, [])
    items = []
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        month_name = str(rule.get("month") or "")
        fixed_date = str(rule.get("fixed_date") or "")
        if month_name and month_name not in hinted_months:
            continue
        name = str(rule.get("name") or "").strip()
        if not name:
            continue
        timing_bits = []
        if fixed_date:
            timing_bits.append(fixed_date)
        if rule.get("paksha"):
            timing_bits.append(str(rule.get("paksha")))
        if rule.get("tithi"):
            timing_bits.append(str(rule.get("tithi")))
        elif rule.get("start_tithi") and rule.get("end_tithi"):
            timing_bits.append(f"{rule.get('start_tithi')} → {rule.get('end_tithi')}")
        items.append(
            {
                "name": name,
                "date": today.isoformat(),
                "date_label": today.strftime("%d %b %Y"),
                "time_label": " • ".join(bit for bit in timing_bits if bit) or "See Panchang for exact timing",
                "status": "upcoming",
                "icon": "✦",
                "description": f"{month_name or 'Sacred'} observance. Open Panchang for exact resolved timing.",
                "festival_meta": " • ".join(
                    part for part in [month_name, str(rule.get("paksha") or ""), str(rule.get("tithi") or "")] if part
                ),
            }
        )
    if not items:
        items = [
            {
                "name": "Sacred Festival Window",
                "date": today.isoformat(),
                "date_label": today.strftime("%d %b %Y"),
                "time_label": "See Panchang for exact timing",
                "status": "upcoming",
                "icon": "✦",
                "description": "Festival timings are being refreshed. Open Panchang for the latest resolved observances.",
                "festival_meta": "",
            }
        ]
    if len(items) > 4:
        items = items[:4]
    if items:
        if len(items) > 1:
            items[0]["status"] = "past"
        if len(items) > 2:
            items[1]["status"] = "today"
        for item in items[2:]:
            item["status"] = "upcoming"
    return {
        "generated_at": datetime.now(tz).isoformat(),
        "monthly_festivals": items,
        "fallback": True,
    }


def _welcome_payload_has_items(payload, key):
    return isinstance(payload, dict) and isinstance(payload.get(key), list) and bool(payload.get(key))


def _cached_or_fallback_raashi_payload(*, lat: float, lon: float, tz_name: str):
    cache_key = f"welcome:raashi:v1:{round(lat,3)}:{round(lon,3)}:{tz_name}"
    cached = cache.get(cache_key)
    if _welcome_payload_has_items(cached, "rashi_pulse"):
        return cached
    payload = _fallback_welcome_raashi_payload(tz_name=tz_name)
    cache.set(cache_key, payload, timeout=min(WELCOME_TIMEOUT, 15 * 60))
    return payload


def _cached_or_fallback_festivals_payload(*, lat: float, lon: float, tz_name: str):
    cache_key = f"welcome:festivals:v3:{round(lat,3)}:{round(lon,3)}:{tz_name}"
    cached = cache.get(cache_key)
    if _welcome_payload_has_items(cached, "monthly_festivals"):
        return cached
    payload = _fallback_welcome_festivals_payload(tz_name=tz_name)
    cache.set(cache_key, payload, timeout=min(WELCOME_TIMEOUT, 15 * 60))
    return payload


@require_GET
def welcome_insights_api(request):
    tz_name = (request.GET.get("tz") or "Asia/Kolkata").strip() or "Asia/Kolkata"
    try:
        lat = float(request.GET.get("lat") or 28.6139)
        lon = float(request.GET.get("lon") or 77.2090)
    except Exception:
        return JsonResponse({"error": "Invalid lat/lon."}, status=400)

    cache_key = f"welcome:insights:v1:{round(lat,3)}:{round(lon,3)}:{tz_name}"
    cached = cache.get(cache_key)
    if cached is not None:
        return JsonResponse(cached)

    try:
        now_local, transits = _current_transits(lat=lat, lon=lon, tz_name=tz_name)
        payload = {
            **_build_welcome_raashi_payload(lat=lat, lon=lon, tz_name=tz_name),
            **_build_welcome_festivals_payload(lat=lat, lon=lon, tz_name=tz_name),
            "planets": _welcome_planets(transits),
        }
    except Exception:
        payload = {
            **_cached_or_fallback_raashi_payload(lat=lat, lon=lon, tz_name=tz_name),
            **_cached_or_fallback_festivals_payload(lat=lat, lon=lon, tz_name=tz_name),
            "planets": [],
            "fallback": True,
        }
    cache.set(cache_key, payload, timeout=WELCOME_TIMEOUT)
    return JsonResponse(payload)

@require_GET
def welcome_raashi_api(request):
    tz_name = (request.GET.get("tz") or "Asia/Kolkata").strip() or "Asia/Kolkata"
    try:
        lat = float(request.GET.get("lat") or 28.6139)
        lon = float(request.GET.get("lon") or 77.2090)
    except Exception:
        return JsonResponse({"error": "Invalid lat/lon."}, status=400)

    cache_key = f"welcome:raashi:v1:{round(lat,3)}:{round(lon,3)}:{tz_name}"
    cached = cache.get(cache_key)
    if _welcome_payload_has_items(cached, "rashi_pulse"):
        return JsonResponse(cached)

    try:
        payload = _build_welcome_raashi_payload(lat=lat, lon=lon, tz_name=tz_name)
    except Exception as exc:
        payload = _fallback_welcome_raashi_payload(tz_name=tz_name)
        payload["error"] = str(exc)
    cache.set(cache_key, payload, timeout=WELCOME_TIMEOUT)
    return JsonResponse(payload)

@require_GET
def welcome_festivals_api(request):
    tz_name = (request.GET.get("tz") or "Asia/Kolkata").strip() or "Asia/Kolkata"
    try:
        lat = float(request.GET.get("lat") or 28.6139)
        lon = float(request.GET.get("lon") or 77.2090)
    except Exception:
        return JsonResponse({"error": "Invalid lat/lon."}, status=400)

    cache_key = f"welcome:festivals:v3:{round(lat,3)}:{round(lon,3)}:{tz_name}"
    cached = cache.get(cache_key)
    if _welcome_payload_has_items(cached, "monthly_festivals"):
        return JsonResponse(cached)

    try:
        payload = _build_welcome_festivals_payload(lat=lat, lon=lon, tz_name=tz_name)
    except Exception as exc:
        payload = _fallback_welcome_festivals_payload(tz_name=tz_name)
        payload["error"] = str(exc)
    cache.set(cache_key, payload, timeout=WELCOME_TIMEOUT)
    return JsonResponse(payload)


def login_page(request):
    mode = request.GET.get('mode', 'login')

    if request.method == 'POST':
        form_type = request.POST.get('form_type', 'login')

        if form_type == 'signup':
            full_name = request.POST.get('name', '').strip()
            username = request.POST.get('username', '').strip()
            email = request.POST.get('email', '').strip()
            password = request.POST.get('password', '')

            if not full_name or not username or not email or not password:
                messages.error(request, 'Please fill all signup fields.')
                mode = 'signup'
            elif User.objects.filter(username=username).exists():
                messages.error(request, 'Username already exists. Please choose another one.')
                mode = 'signup'
            elif User.objects.filter(email=email).exists():
                messages.error(request, 'Email already registered. Please use a different email.')
                mode = 'signup'
            else:
                first_name = full_name
                last_name = ''
                if ' ' in full_name:
                    first_name, last_name = full_name.split(' ', 1)

                User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                )
                messages.success(request, 'Signup successful. Please log in with your new account.')
                return redirect('/login/?mode=login')

        elif form_type == 'reset_password':
            username = request.POST.get('username', '').strip()
            email = request.POST.get('email', '').strip()
            new_password = request.POST.get('new_password', '')
            confirm_password = request.POST.get('confirm_password', '')

            if not username or not email or not new_password or not confirm_password:
                messages.error(request, 'Please fill all password reset fields.')
                mode = 'forgot'
            elif new_password != confirm_password:
                messages.error(request, 'New password and confirm password do not match.')
                mode = 'forgot'
            else:
                try:
                    user = User.objects.get(username=username, email__iexact=email)
                except User.DoesNotExist:
                    user = None

                if user is None:
                    messages.error(request, 'No account matched that username and email.')
                    mode = 'forgot'
                else:
                    user.set_password(new_password)
                    user.save(update_fields=['password'])
                    messages.success(request, 'Password updated successfully. Please log in with your new password.')
                    return redirect('/login/?mode=login')

        else:
            username = request.POST.get('username', '').strip()
            password = request.POST.get('password', '')
            user = authenticate(request, username=username, password=password)
            success = user is not None
            LoginAttempt.objects.create(username=username or 'unknown', provider=LoginAttempt.PROVIDER_PASSWORD, success=success)

            if success and user is not None:
                auth_login(request, user)

                if user.is_staff or user.is_superuser:
                    messages.success(request, 'Login successful. Redirected to Django admin.')
                    return redirect('/admin/')

                return redirect('/welcome/')

            messages.error(request, 'Invalid username or password.')

    return render(
        request,
        'index.html',
        {
            'mode': mode,
            'google_oauth_configured': settings.GOOGLE_OAUTH_CONFIGURED,
            'apple_oauth_configured': settings.APPLE_OAUTH_CONFIGURED,
        },
    )


def google_login_start(request):
    if not settings.SOCIAL_AUTH_ENABLED:
        messages.error(request, 'Google login is unavailable because social-auth package is not installed.')
        return redirect('/login/?mode=login')

    if not settings.GOOGLE_OAUTH_CONFIGURED:
        messages.error(
            request,
            'Google OAuth is not configured. Set SOCIAL_AUTH_GOOGLE_OAUTH2_KEY and SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET.',
        )
        return redirect('/login/?mode=login')

    return redirect(reverse('social:begin', args=['google-oauth2']))


def apple_login_start(request):
    if not settings.SOCIAL_AUTH_ENABLED:
        messages.error(request, 'Apple login is unavailable because social-auth package is not installed.')
        return redirect('/login/?mode=login')

    if not settings.APPLE_OAUTH_CONFIGURED:
        messages.error(
            request,
            'Apple OAuth is not configured. Set SOCIAL_AUTH_APPLE_ID_CLIENT, TEAM, KEY and valid SECRET/PEM key.',
        )
        return redirect('/login/?mode=login')

    return redirect(reverse('social:begin', args=['apple-id']))


def welcome_page(request):
    if request.method == "HEAD":
        return render(request, 'welcome.html', {
            'welcome_raashi_bootstrap': {"generated_at": "", "rashi_pulse": []},
            'welcome_festivals_bootstrap': {"generated_at": "", "monthly_festivals": []},
        })
    tz_name = "Asia/Kolkata"
    lat = 28.6139
    lon = 77.2090
    bootstrap_raashi = _cached_or_fallback_raashi_payload(lat=lat, lon=lon, tz_name=tz_name)
    bootstrap_festivals = _cached_or_fallback_festivals_payload(lat=lat, lon=lon, tz_name=tz_name)
    return render(request, 'welcome.html', {
        'welcome_raashi_bootstrap': bootstrap_raashi,
        'welcome_festivals_bootstrap': bootstrap_festivals,
    })

def baby_names_page(request):
    baby_names_error = ""
    baby_names_json = "{}"
    try:
        baby_names_json = load_baby_names_json()
    except Exception as exc:
        baby_names_error = str(exc)

    return render(
        request,
        'baby_names.html',
        {
            "baby_names_json": baby_names_json,
            "baby_names_error": baby_names_error,
        },
    )


def quizzes_page(request):
    return render(request, "quizzes.html")


def panchang_page(request):
    return render(request, "panchang.html")


def kundali_page(request):
    return render(request, "kundali.html")


def horoscope_page(request):
    return render(request, "horoscope.html")


@login_required
def profile_page(request):
    if request.method == "POST":
        form_type = request.POST.get("form_type", "").strip()

        if form_type == "profile":
            full_name = request.POST.get("name", "").strip()
            username = request.POST.get("username", "").strip()
            email = request.POST.get("email", "").strip()

            if not full_name or not username or not email:
                messages.error(request, "Please fill all profile fields.")
            elif User.objects.exclude(pk=request.user.pk).filter(username=username).exists():
                messages.error(request, "That username is already taken.")
            elif User.objects.exclude(pk=request.user.pk).filter(email__iexact=email).exists():
                messages.error(request, "That email is already used by another account.")
            else:
                first_name = full_name
                last_name = ""
                if " " in full_name:
                    first_name, last_name = full_name.split(" ", 1)

                request.user.username = username
                request.user.email = email
                request.user.first_name = first_name
                request.user.last_name = last_name
                request.user.save(update_fields=["username", "email", "first_name", "last_name"])
                messages.success(request, "Profile updated successfully.")
                return redirect("/profile/")

        elif form_type == "password":
            current_password = request.POST.get("current_password", "")
            new_password = request.POST.get("new_password", "")
            confirm_password = request.POST.get("confirm_password", "")

            if not current_password or not new_password or not confirm_password:
                messages.error(request, "Please fill all password fields.")
            elif new_password != confirm_password:
                messages.error(request, "New password and confirm password do not match.")
            elif not request.user.check_password(current_password):
                messages.error(request, "Current password is incorrect.")
            else:
                request.user.set_password(new_password)
                request.user.save(update_fields=["password"])
                update_session_auth_hash(request, request.user)
                messages.success(request, "Password changed successfully.")
                return redirect("/profile/")

    full_name = " ".join(filter(None, [request.user.first_name, request.user.last_name])).strip() or request.user.username
    return render(
        request,
        "profile.html",
        {
            "full_name": full_name,
        },
    )


def library_page(request):
    library_error = ""
    payload = {"items": [], "featured": [], "categories": [], "total": 0}
    try:
        payload = build_library_payload()
    except Exception as exc:
        library_error = str(exc)

    return render(
        request,
        "library.html",
        {
            "library_payload": json.dumps(payload),
            "library_payload_obj": payload,
            "library_categories": PRESET_LIBRARY_CATEGORIES,
            "library_error": library_error,
        },
    )


def library_detail_page(request, slug: str):
    item = get_library_item(slug)
    if item is None:
        return redirect("/library/")

    return render(
        request,
        "library_detail.html",
        {
            "item_slug": item["slug"],
            "item_name": item["name"],
        },
    )


@require_GET
def api_library_items(request):
    refresh = request.GET.get("refresh") == "1"
    try:
        items = load_library_items(force_refresh=refresh)
    except Exception as exc:
        return JsonResponse({"items": [], "error": str(exc)}, status=502)

    query = str(request.GET.get("q") or "").strip().lower()
    category = str(request.GET.get("category") or "").strip().lower()
    language = str(request.GET.get("language") or "").strip().lower()

    filtered = items
    if category and category != "all":
        filtered = [item for item in filtered if item["category"].lower() == category]

    if language and language != "all":
        filtered = [
            item
            for item in filtered
            if item.get("languages", {}).get(language)
        ]

    if query:
        filtered = [
            item
            for item in filtered
            if query in item["name"].lower()
            or query in item.get("deity", "").lower()
            or query in item["category"].lower()
            or any(query in text.lower() for text in item.get("languages", {}).values() if text)
        ]

    return JsonResponse(
        {
            "items": filtered,
            "categories": list(PRESET_LIBRARY_CATEGORIES),
            "total": len(filtered),
            "debug_total_before_filters": len(items),
        }
    )


@require_GET
def api_library_detail(request, slug: str):
    item = get_library_item(slug)
    if item is None:
        return JsonResponse({"error": "Library item not found."}, status=404)
    return JsonResponse(item)


def _category_display_name(category_slug: str) -> str:
    mapping = {
        "gita": "Bhagavad Gita",
        "ramayana": "Ramayana",
        "mahabharata": "Mahabharata",
        "vedic_science": "Vedic Science",
    }
    return mapping.get(category_slug, category_slug.replace("_", " ").title())


@login_required
@require_GET
def api_leaderboard(request):
    top = (
        UserStats.objects.select_related("user")
        .order_by("-total_score", "-highest_score", "user__username")[:20]
    )
    data = [{"username": row.user.username, "score": row.total_score} for row in top]
    return JsonResponse(data, safe=False)


@login_required
@require_GET
def api_leaderboard_category(request, category_slug: str):
    category_slug = (category_slug or "").strip().lower()
    try:
        category = Category.objects.get(slug=category_slug)
    except Category.DoesNotExist:
        return JsonResponse([], safe=False)

    rows = (
        QuizAttempt.objects.filter(category=category)
        .values("user__username")
        .annotate(score=Sum("score"))
        .order_by("-score", "user__username")[:20]
    )
    data = [{"username": r["user__username"], "score": int(r["score"] or 0)} for r in rows]
    return JsonResponse(data, safe=False)


@login_required
@require_POST
def api_submit_score(request):
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        return JsonResponse({"error": "Invalid JSON payload."}, status=400)

    category_slug = str(payload.get("category") or "").strip().lower()
    if not category_slug:
        return JsonResponse({"error": "Missing category."}, status=400)

    try:
        score = int(payload.get("score"))
        total = int(payload.get("total"))
    except Exception:
        return JsonResponse({"error": "score and total must be integers."}, status=400)

    try:
        attempt_best_streak = int(payload.get("best_streak") or 0)
    except Exception:
        attempt_best_streak = 0

    if total <= 0 or score < 0 or score > total:
        return JsonResponse({"error": "Invalid score/total range."}, status=400)

    category, _ = Category.objects.get_or_create(
        slug=category_slug,
        defaults={"name": _category_display_name(category_slug)},
    )

    QuizAttempt.objects.create(
        user=request.user,
        category=category,
        score=score,
        total_questions=total,
        attempt_best_streak=max(attempt_best_streak, 0),
    )

    stats, _ = UserStats.objects.get_or_create(user=request.user)
    stats.total_score = int(stats.total_score) + score
    stats.highest_score = max(int(stats.highest_score), score)
    stats.best_streak = max(int(stats.best_streak), max(attempt_best_streak, 0))
    stats.save(update_fields=["total_score", "highest_score", "best_streak", "updated_at"])

    return JsonResponse(
        {
            "ok": True,
            "user_stats": {
                "username": request.user.username,
                "total_score": stats.total_score,
                "highest_score": stats.highest_score,
                "best_streak": stats.best_streak,
            },
        }
    )
