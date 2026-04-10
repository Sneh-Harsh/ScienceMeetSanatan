from __future__ import annotations

from datetime import date as Date, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo
import json

import swisseph as swe

from .calculations import (
    FLG,
    NAKSHATRA_NAMES,
    _dt_to_jd_utc,
    _jd_to_dt_local,
    _sankranti_to_signs_between,
    _sun_moon_sidereal_longitudes,
    _sun_sidereal_sign_index,
    build_panchang_for_date,
)
from .festival_rules import rules_version as festival_rules_version


SIGN_NAMES = [
    "Mesha",
    "Vrishabha",
    "Mithuna",
    "Karka",
    "Simha",
    "Kanya",
    "Tula",
    "Vrischika",
    "Dhanu",
    "Makara",
    "Kumbha",
    "Meena",
]

MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

YOGA_NAMES = [
    "Vishkambha",
    "Preeti",
    "Ayushman",
    "Saubhagya",
    "Shobhana",
    "Atiganda",
    "Sukarman",
    "Dhriti",
    "Shoola",
    "Ganda",
    "Vriddhi",
    "Dhruva",
    "Vyaghata",
    "Harshana",
    "Vajra",
    "Siddhi",
    "Vyatipata",
    "Variyana",
    "Parigha",
    "Shiva",
    "Siddha",
    "Sadhya",
    "Shubha",
    "Shukla",
    "Brahma",
    "Indra",
    "Vaidhriti",
]

AUSPICIOUS_MARRIAGE_NAKSHATRAS = {
    "Rohini",
    "Mrigashirsha",
    "Magha",
    "Uttara Phalguni",
    "Hasta",
    "Swati",
    "Anuradha",
    "Mula",
    "Uttara Ashadha",
    "Uttara Bhadrapada",
    "Revati",
}
DISALLOWED_NAKSHATRA_PADAS = {
    ("Magha", 1),
    ("Mula", 1),
    ("Revati", 4),
}

PROHIBITED_YOGAS = {
    "Vishkambha",
    "Atiganda",
    "Shoola",
    "Ganda",
    "Vyaghata",
    "Vajra",
    "Vyatipata",
    "Parigha",
    "Vaidhriti",
}

GOOD_TITHIS = {"Dwitiya", "Tritiya", "Panchami", "Saptami", "Dashami", "Ekadashi", "Trayodashi"}
BAD_TITHIS = {"Chaturthi", "Navami", "Chaturdashi", "Amavasya", "Purnima"}
GOOD_WEEKDAYS = {0, 2, 3, 4}  # Mon, Wed, Thu, Fri
AVOID_WEEKDAYS = {1}  # Tue
ALLOWED_SOLAR_SIGNS = {0, 1, 2, 7, 9, 10}
KHARMAS_START_SIGNS = {8: "Dhanu Kharmas", 11: "Meena Kharmas"}
KHARMAS_END_SIGNS = {8: 9, 11: 0}
GOOD_KARANAS = {"Kimstughna", "Bava", "Balava", "Kaulava", "Taitila", "Garaja", "Vanija"}
BAD_KARANAS = {"Vishti", "Shakuni", "Chatushpada", "Naga"}

DEFAULT_BUNDLE_LAT = 28.614
DEFAULT_BUNDLE_LON = 77.209
DEFAULT_BUNDLE_TZ = "Asia/Kolkata"


def _local_midnight_jd(local_dt: datetime) -> float:
    return _dt_to_jd_utc(local_dt.astimezone(ZoneInfo("UTC")))


def _angular_distance(a: float, b: float) -> float:
    diff = abs((a - b) % 360.0)
    return min(diff, 360.0 - diff)


def _planet_longitude_speed(jd_ut: float, planet: int):
    values = swe.calc_ut(jd_ut, planet, FLG | swe.FLG_SPEED)[0]
    return (float(values[0] % 360.0), float(values[3]))


def _nakshatra_pada(jd_ut: float) -> int:
    _sun, moon = _sun_moon_sidereal_longitudes(jd_ut)
    segment = 360.0 / 27.0
    part = moon % segment
    return int(part // (segment / 4.0)) + 1


def _yoga_name(jd_ut: float) -> str:
    sun, moon = _sun_moon_sidereal_longitudes(jd_ut)
    index = int(((sun + moon) % 360.0) // (360.0 / 27.0))
    return YOGA_NAMES[index]


def _karana_name(jd_ut: float) -> str:
    sun, moon = _sun_moon_sidereal_longitudes(jd_ut)
    diff = (moon - sun) % 360.0
    number = int(diff // 6.0) + 1  # 1..60
    if number <= 1:
        return "Kimstughna"
    if number >= 58:
        return {58: "Shakuni", 59: "Chatushpada", 60: "Naga"}.get(number, "Naga")
    sequence = ["Bava", "Balava", "Kaulava", "Taitila", "Garaja", "Vanija", "Vishti"]
    return sequence[(number - 2) % len(sequence)]


def _display_dt(dt: datetime) -> str:
    return f"{dt.day:02d} {MONTH_ABBR[dt.month - 1]} {dt.year} • {dt.strftime('%I:%M %p')}"


def _display_date(dt: datetime) -> str:
    return f"{dt.day:02d} {MONTH_ABBR[dt.month - 1]} {dt.year}"


def _display_time(dt: datetime) -> str:
    return dt.strftime("%I:%M %p")


def _kharmas_cache_path(year: int) -> Path:
    return Path(__file__).resolve().parent / "datasets" / "resolved_kharmas" / f"{year}.json"


def _marriage_cache_path(year: int) -> Path:
    return Path(__file__).resolve().parent / "datasets" / "resolved_marriage_dates" / f"{year}.json"


def _location_matches_bundle(lat_r: float, lon_r: float, tz_name: str) -> bool:
    return round(lat_r, 3) == DEFAULT_BUNDLE_LAT and round(lon_r, 3) == DEFAULT_BUNDLE_LON and tz_name == DEFAULT_BUNDLE_TZ


@lru_cache(maxsize=48)
def _load_bundled_payload(kind: str, year: int):
    path = _kharmas_cache_path(year) if kind == "kharmas" else _marriage_cache_path(year)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return data if isinstance(data, dict) and data else None


def kharmas_for_year(*, year: int, lat_r: float, lon_r: float, tz_name: str) -> Dict:
    bundled = _load_bundled_payload("kharmas", year)
    if bundled:
        return bundled

    tz = ZoneInfo(tz_name)
    start_local = datetime(year - 1, 11, 1, 0, 0, tzinfo=tz)
    end_local = datetime(year + 1, 5, 1, 0, 0, tzinfo=tz)
    start_jd = _local_midnight_jd(start_local)
    end_jd = _local_midnight_jd(end_local)
    to_signs, times = _sankranti_to_signs_between(start_jd, end_jd)

    intervals: List[Dict] = []
    for index, to_sign in enumerate(to_signs):
        if to_sign not in KHARMAS_START_SIGNS:
            continue
        target = KHARMAS_END_SIGNS[to_sign]
        end_idx = None
        for probe in range(index + 1, len(to_signs)):
            if to_signs[probe] == target:
                end_idx = probe
                break
        if end_idx is None:
            continue
        start_dt = _jd_to_dt_local(times[index], tz)
        end_dt = _jd_to_dt_local(times[end_idx], tz)
        if end_dt.year < year or start_dt.year > year:
            continue
        duration_days = max(1, int((end_dt - start_dt).total_seconds() // 86400))
        intervals.append(
            {
                "name": KHARMAS_START_SIGNS[to_sign],
                "start": start_dt.isoformat(timespec="seconds"),
                "end": end_dt.isoformat(timespec="seconds"),
                "start_label": _display_dt(start_dt),
                "end_label": _display_dt(end_dt),
                "duration_days": duration_days,
                "sun_sign": SIGN_NAMES[to_sign],
                "end_sign": SIGN_NAMES[target],
            }
        )

    now_local = datetime.now(tz)
    for item in intervals:
        start_dt = datetime.fromisoformat(item["start"])
        end_dt = datetime.fromisoformat(item["end"])
        item["is_active"] = start_dt <= now_local <= end_dt
        item["is_upcoming"] = now_local < start_dt
        item["remaining_label"] = (
            f"Ends in {max(0, (end_dt - now_local).days)} days"
            if item["is_active"]
            else (f"Begins in {(start_dt - now_local).days} days" if item["is_upcoming"] else "Completed")
        )

    active = next((item for item in intervals if item.get("is_active")), None)
    return {
        "year": year,
        "intervals": intervals,
        "active": active,
    }


def _day_payload(day: Date, lat_r: float, lon_r: float, tz_name: str) -> Dict:
    return build_panchang_for_date(
        date=day.isoformat(),
        lat_r=lat_r,
        lon_r=lon_r,
        tz_name=tz_name,
        rules_version=festival_rules_version(),
    )


def _recommended_window(payload: Dict) -> str:
    sunrise = datetime.fromisoformat(payload["sunrise"])
    sunset = datetime.fromisoformat(payload["sunset"])
    rahu_start = datetime.fromisoformat(payload["rahu_start"])
    rahu_end = datetime.fromisoformat(payload["rahu_end"])
    tithi_end = datetime.fromisoformat(payload["tithi_end"])
    nak_end = datetime.fromisoformat(payload["nak_end"])

    end_cap = min(sunset, tithi_end, nak_end)
    windows: List[str] = []
    if sunrise < rahu_start:
        left_end = min(rahu_start, end_cap)
        if (left_end - sunrise).total_seconds() >= 45 * 60:
            windows.append(f"{_display_time(sunrise)}–{_display_time(left_end)}")
    post_start = max(rahu_end, sunrise)
    if post_start < end_cap and (end_cap - post_start).total_seconds() >= 45 * 60:
        windows.append(f"{_display_time(post_start)}–{_display_time(end_cap)}")
    if not windows and payload.get("abhijit_start") and payload.get("abhijit_end"):
        windows.append(
            f"{_display_time(datetime.fromisoformat(payload['abhijit_start']))}–"
            f"{_display_time(datetime.fromisoformat(payload['abhijit_end']))}"
        )
    return " / ".join(windows[:2]) or "Consult detailed Panchang timing"


def _marriage_reason_parts(payload: Dict, yoga_name: str, karana_name: str, weekday: int) -> List[str]:
    weekday_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    parts = [payload.get("nakshatra"), payload.get("tithi"), weekday_names[weekday]]
    if yoga_name not in PROHIBITED_YOGAS:
        parts.append(yoga_name)
    if karana_name in GOOD_KARANAS:
        parts.append(karana_name)
    return [part for part in parts if part]


def marriage_windows_for_year(*, year: int, lat_r: float, lon_r: float, tz_name: str) -> Dict:
    bundled = _load_bundled_payload("marriage", year)
    if bundled:
        return bundled

    tz = ZoneInfo(tz_name)
    start = Date(year, 1, 1)
    end = Date(year, 12, 31)
    rows: List[Dict] = []
    devshayani = None
    devuthani = None

    day = start
    while day <= end:
        payload = _day_payload(day, lat_r, lon_r, tz_name)
        sunrise_dt = datetime.fromisoformat(payload["sunrise"])
        sunrise_jd = _dt_to_jd_utc(sunrise_dt.astimezone(ZoneInfo("UTC")))
        weekday = sunrise_dt.weekday()
        sun_sign = _sun_sidereal_sign_index(sunrise_jd)
        yoga_name = _yoga_name(sunrise_jd)
        karana_name = _karana_name(sunrise_jd)
        nakshatra = str(payload.get("nakshatra") or "")
        pada = _nakshatra_pada(sunrise_jd)

        sun_lon, _moon_lon = _sun_moon_sidereal_longitudes(sunrise_jd)
        venus_lon, venus_speed = _planet_longitude_speed(sunrise_jd, swe.VENUS)
        jupiter_lon, _jupiter_speed = _planet_longitude_speed(sunrise_jd, swe.JUPITER)
        venus_combust = _angular_distance(sun_lon, venus_lon) < (8.0 if venus_speed < 0 else 10.0)
        jupiter_combust = _angular_distance(sun_lon, jupiter_lon) < 11.0

        names = {
            str(item.get("name") or "").strip()
            for item in payload.get("festivals_detail", [])
            if isinstance(item, dict)
        }
        if "Devshayani Ekadashi" in names:
            devshayani = day
        if "Devuthani Ekadashi" in names:
            devuthani = day

        blocked_reasons: List[str] = []
        if sun_sign not in ALLOWED_SOLAR_SIGNS:
            blocked_reasons.append(f"Sun in {SIGN_NAMES[sun_sign]}")
        if sun_sign in KHARMAS_START_SIGNS:
            blocked_reasons.append(KHARMAS_START_SIGNS[sun_sign])
        if payload.get("month_is_adhik"):
            blocked_reasons.append("Adhik Maas")
        if payload.get("month_is_kshay"):
            blocked_reasons.append("Kshay Maas")
        if nakshatra not in AUSPICIOUS_MARRIAGE_NAKSHATRAS or (nakshatra, pada) in DISALLOWED_NAKSHATRA_PADAS:
            blocked_reasons.append(f"Nakshatra {nakshatra} pada {pada}")
        if yoga_name in PROHIBITED_YOGAS:
            blocked_reasons.append(f"{yoga_name} Yoga")
        if karana_name in BAD_KARANAS:
            blocked_reasons.append(f"{karana_name} Karana")
        if payload.get("tithi") in BAD_TITHIS:
            blocked_reasons.append(f"{payload.get('tithi')} Tithi")
        if weekday in AVOID_WEEKDAYS:
            blocked_reasons.append("Tuesday")
        if devshayani and (not devuthani or day >= devshayani and day <= (devuthani or day)):
            blocked_reasons.append("Chaturmas")
        if payload.get("month_base") == "Phalguna" and payload.get("paksha") == "Shukla Paksha" and payload.get("tithi") in {
            "Ashtami",
            "Navami",
            "Dashami",
            "Ekadashi",
            "Dwadashi",
            "Trayodashi",
            "Chaturdashi",
            "Purnima",
        }:
            blocked_reasons.append("Holashtak")
        if venus_combust:
            blocked_reasons.append("Venus combust")
        if jupiter_combust:
            blocked_reasons.append("Jupiter combust")

        score = 62
        if payload.get("tithi") in GOOD_TITHIS:
            score += 10
        if weekday in GOOD_WEEKDAYS:
            score += 7
        if payload.get("paksha") == "Shukla Paksha":
            score += 6
        if sun_sign in {1, 2, 9, 10}:
            score += 6
        if nakshatra in AUSPICIOUS_MARRIAGE_NAKSHATRAS:
            score += 14
        if yoga_name not in PROHIBITED_YOGAS:
            score += 5
        if karana_name in GOOD_KARANAS:
            score += 4
        if blocked_reasons:
            score -= min(48, 8 * len(blocked_reasons))
        score = max(0, min(100, score))

        if not blocked_reasons and score >= 70:
            rows.append(
                {
                    "date": day.isoformat(),
                    "date_label": _display_date(sunrise_dt),
                    "window": _recommended_window(payload),
                    "month": payload.get("month"),
                    "paksha": payload.get("paksha"),
                    "tithi": payload.get("tithi"),
                    "nakshatra": nakshatra,
                    "yoga": yoga_name,
                    "karana": karana_name,
                    "score": score,
                    "grade": "Excellent" if score >= 90 else ("Strong" if score >= 82 else "Good"),
                    "reason_line": " • ".join(_marriage_reason_parts(payload, yoga_name, karana_name, weekday)),
                }
            )
        day += timedelta(days=1)

    rows.sort(key=lambda item: (-int(item["score"]), str(item["date"])))
    rows_by_date = sorted(rows, key=lambda item: str(item["date"]))
    today_local = datetime.now(tz).date()
    if year < today_local.year:
        next_upcoming = None
    else:
        next_upcoming = next(
            (item for item in rows_by_date if Date.fromisoformat(str(item["date"])) >= today_local),
            rows_by_date[0] if year > today_local.year and rows_by_date else None,
        )
    top_three: List[Dict] = []
    for rank, item in enumerate(rows[:3], start=1):
        ranked = dict(item)
        ranked["rank"] = rank
        top_three.append(ranked)
    month_map: Dict[str, List[Dict]] = {}
    for item in rows_by_date:
        month_map.setdefault(item["month"], []).append(item)
    months = [{"month": month, "items": month_map[month][:6]} for month in month_map]
    return {
        "year": year,
        "count": len(rows),
        "next_best": next_upcoming,
        "next_upcoming": next_upcoming,
        "top_three": top_three,
        "timeline": rows_by_date,
        "months": months,
        "dates": rows[:36],
        "notes": [
            "Kharmas, Chaturmas, Adhik Maas, Venus combustion, and Jupiter combustion are excluded.",
            "Dates are shortlisted from Panchanga Shuddhi factors: solar month, nakshatra, yoga, karana, tithi, and weekday.",
            "Use the recommended window and then confirm final lagna-based muhurta if a personal chart is required.",
        ],
    }
