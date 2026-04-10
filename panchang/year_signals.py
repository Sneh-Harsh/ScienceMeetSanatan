from __future__ import annotations

from datetime import date as Date, datetime, timedelta
from functools import lru_cache
from pathlib import Path
import json
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo

from .calculations import (
    NAKSHATRA_NAMES,
    _dt_to_jd_utc,
    _jd_to_dt_local,
    _sankranti_to_signs_between,
    _sun_moon_sidereal_longitudes,
    _sun_sidereal_sign_index,
    build_panchang_for_date,
)
from .festival_rules import rules_version as festival_rules_version


YOGA_NAMES = [
    "Vishkambha",
    "Priti",
    "Ayushman",
    "Saubhagya",
    "Shobhana",
    "Atiganda",
    "Sukarma",
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

ALLOWED_SUN_SIGNS = {0, 1, 2, 7, 9, 10}
AUSPICIOUS_NAKSHATRA_INDICES = {3, 4, 9, 11, 12, 14, 16, 18, 20, 25, 26}
DISALLOWED_NAKSHATRA_PADAS = {
    (9, 1),   # Magha pada 1
    (18, 1),  # Mula pada 1
    (26, 4),  # Revati pada 4
}
PROHIBITED_YOGAS = {"Vishkambha", "Atiganda", "Shoola", "Ganda", "Vyaghata", "Vajra", "Vyatipata", "Parigha", "Vaidhriti"}
PROHIBITED_KARANAS = {"Vishti", "Shakuni", "Chatushpada", "Nagava"}
GOOD_TITHIS = {"Dwitiya", "Tritiya", "Panchami", "Saptami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi"}
BAD_TITHIS = {"Pratipada", "Chaturthi", "Shashthi", "Ashtami", "Navami", "Chaturdashi", "Purnima", "Amavasya"}
WEEKDAY_BONUS = {0: 7, 1: -10, 2: 8, 3: 9, 4: 8, 5: -2, 6: -1}

SUN_SIGN_NAMES = {
    0: "Mesha",
    1: "Vrishabha",
    2: "Mithuna",
    3: "Karka",
    4: "Simha",
    5: "Kanya",
    6: "Tula",
    7: "Vrischika",
    8: "Dhanu",
    9: "Makara",
    10: "Kumbha",
    11: "Meena",
}

KHARMAS_NAMES = {
    8: "Dhanu Kharmas",
    11: "Meena Kharmas",
}


def _sunrise_jd_from_payload(payload: Dict) -> float:
    sunrise_local = datetime.fromisoformat(str(payload["sunrise"]))
    return _dt_to_jd_utc(sunrise_local.astimezone(ZoneInfo("UTC")))


def _yoga_name(jd_ut: float) -> str:
    sun, moon = _sun_moon_sidereal_longitudes(jd_ut)
    idx = int(((sun + moon) % 360.0) // (360.0 / 27.0))
    return YOGA_NAMES[idx]


def _karana_name(jd_ut: float) -> str:
    sun, moon = _sun_moon_sidereal_longitudes(jd_ut)
    diff = (moon - sun) % 360.0
    slot = int(diff // 6.0)
    repeaters = ["Bava", "Balava", "Kaulava", "Taitila", "Garaja", "Vanija", "Vishti"]
    if slot == 0:
        return "Kinstughna"
    if 1 <= slot <= 56:
        return repeaters[(slot - 1) % 7]
    if slot == 57:
        return "Shakuni"
    if slot == 58:
        return "Chatushpada"
    return "Nagava"


def _nakshatra_index_and_pada(jd_ut: float) -> tuple[int, int]:
    _, moon = _sun_moon_sidereal_longitudes(jd_ut)
    span = 360.0 / 27.0
    idx = int((moon % 360.0) // span)
    remainder = (moon % span)
    pada = int(remainder // (span / 4.0)) + 1
    return idx, min(4, max(1, pada))


def _quality_label(score: int) -> str:
    if score >= 95:
        return "Exceptional"
    if score >= 88:
        return "Highly auspicious"
    return "Strong"


def _marriage_score(*, payload: Dict, sun_sign_idx: int, yoga_name: str, karana_name: str, nakshatra_idx: int, pada: int, local_day: Date) -> int:
    score = 72
    score += 14  # passed solar month / Kharmas gate
    score += 10  # passed nakshatra gate
    score += 5 if (nakshatra_idx, pada) not in DISALLOWED_NAKSHATRA_PADAS else -6
    score += 8 if payload.get("tithi") in GOOD_TITHIS else -10 if payload.get("tithi") in BAD_TITHIS else 0
    score += WEEKDAY_BONUS.get(local_day.weekday(), 0)
    score += 4 if yoga_name not in PROHIBITED_YOGAS else -12
    score += 3 if karana_name not in PROHIBITED_KARANAS else -15
    if str(payload.get("paksha") or "").startswith("Shukla"):
        score += 3
    if payload.get("month") in {"Magh", "Phalguna", "Chaitra", "Vaishakh", "Jyeshtha"}:
        score += 4
    if sun_sign_idx in {0, 1, 9, 10}:
        score += 2
    return max(0, min(100, score))


def kharmas_periods_for_year(*, year: int, tz_name: str = "Asia/Kolkata") -> List[Dict]:
    tz = ZoneInfo(tz_name or "Asia/Kolkata")
    start_local = datetime(year - 1, 12, 1, 0, 0, 0, tzinfo=tz)
    end_local = datetime(year + 1, 1, 31, 23, 59, 0, tzinfo=tz)
    jd_start = _dt_to_jd_utc(start_local.astimezone(ZoneInfo("UTC")))
    jd_end = _dt_to_jd_utc(end_local.astimezone(ZoneInfo("UTC")))
    to_signs, times = _sankranti_to_signs_between(jd_start, jd_end)
    year_start = datetime(year, 1, 1, 0, 0, 0, tzinfo=tz)
    year_end = datetime(year, 12, 31, 23, 59, 59, tzinfo=tz)

    out: List[Dict] = []
    for idx, sign in enumerate(to_signs):
        if sign not in KHARMAS_NAMES:
            continue
        if idx + 1 >= len(times):
            continue
        start_dt = _jd_to_dt_local(times[idx], tz)
        end_dt = _jd_to_dt_local(times[idx + 1], tz)
        if end_dt < year_start or start_dt > year_end:
            continue
        out.append(
            {
                "name": KHARMAS_NAMES[sign],
                "start": start_dt.isoformat(timespec="seconds"),
                "end": end_dt.isoformat(timespec="seconds"),
                "start_sign": SUN_SIGN_NAMES[sign],
                "end_sign": SUN_SIGN_NAMES[(sign + 1) % 12],
                "active": start_dt <= datetime.now(tz) <= end_dt,
            }
        )
    return out


def marriage_dates_for_year(*, year: int, lat: float = 28.6139, lon: float = 77.2090, tz_name: str = "Asia/Kolkata") -> List[Dict]:
    rules_ver = festival_rules_version()
    start = Date(year, 1, 1)
    end = Date(year, 12, 31)
    candidates: List[Dict] = []
    day = start
    while day <= end:
        payload = build_panchang_for_date(
            date=day.isoformat(),
            lat_r=round(lat, 3),
            lon_r=round(lon, 3),
            tz_name=tz_name,
            rules_version=rules_ver,
        )
        jd_ref = _sunrise_jd_from_payload(payload)
        sun_sign_idx = _sun_sidereal_sign_index(jd_ref)
        if sun_sign_idx not in ALLOWED_SUN_SIGNS:
            day += timedelta(days=1)
            continue
        if payload.get("month_is_adhik") or payload.get("month_is_kshay"):
            day += timedelta(days=1)
            continue

        nak_idx, pada = _nakshatra_index_and_pada(jd_ref)
        if nak_idx not in AUSPICIOUS_NAKSHATRA_INDICES or (nak_idx, pada) in DISALLOWED_NAKSHATRA_PADAS:
            day += timedelta(days=1)
            continue

        yoga_name = _yoga_name(jd_ref)
        if yoga_name in PROHIBITED_YOGAS:
            day += timedelta(days=1)
            continue

        karana_name = _karana_name(jd_ref)
        if karana_name in PROHIBITED_KARANAS:
            day += timedelta(days=1)
            continue

        score = _marriage_score(
            payload=payload,
            sun_sign_idx=sun_sign_idx,
            yoga_name=yoga_name,
            karana_name=karana_name,
            nakshatra_idx=nak_idx,
            pada=pada,
            local_day=day,
        )
        if score < 82:
            day += timedelta(days=1)
            continue

        candidates.append(
            {
                "date": day.isoformat(),
                "weekday": day.strftime("%A"),
                "score": score,
                "quality": _quality_label(score),
                "tithi": payload.get("tithi"),
                "nakshatra": payload.get("nakshatra"),
                "pada": pada,
                "paksha": payload.get("paksha"),
                "month": payload.get("month"),
                "solar_month": SUN_SIGN_NAMES[sun_sign_idx],
                "abhijit": f"{payload.get('abhijit_start')}|{payload.get('abhijit_end')}",
                "reason": f"{payload.get('nakshatra')} • {payload.get('tithi')} • {payload.get('paksha')}",
                "yoga": yoga_name,
                "karana": karana_name,
            }
        )
        day += timedelta(days=1)

    candidates.sort(key=lambda item: (-int(item["score"]), str(item["date"])))
    month_counts: Dict[str, int] = {}
    selected: List[Dict] = []
    for item in candidates:
        month_key = str(item["date"])[:7]
        if month_counts.get(month_key, 0) >= 3:
            continue
        selected.append(item)
        month_counts[month_key] = month_counts.get(month_key, 0) + 1
        if len(selected) >= 36:
            break
    return selected


def build_annual_signals_payload(*, year: int, lat: float = 28.6139, lon: float = 77.2090, tz_name: str = "Asia/Kolkata") -> Dict:
    return {
        "year": int(year),
        "basis": "General Panchanga Shuddhi screening",
        "kharmas": kharmas_periods_for_year(year=year, tz_name=tz_name),
        "marriage_dates": marriage_dates_for_year(year=year, lat=lat, lon=lon, tz_name=tz_name),
    }


def bundled_annual_signals_path(*, year: int) -> Path:
    return Path(__file__).resolve().parent / "datasets" / "resolved_annual_signals" / f"{year}.json"


@lru_cache(maxsize=24)
def load_bundled_annual_signals(*, year: int) -> Optional[Dict]:
    path = bundled_annual_signals_path(year=year)
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None
