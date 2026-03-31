from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple
from zoneinfo import ZoneInfo

import swisseph as swe


# ----------------------------
# Sidereal settings (Lahiri)
# ----------------------------
swe.set_sid_mode(swe.SIDM_LAHIRI, 0, 0)

FLG = swe.FLG_SWIEPH | swe.FLG_SIDEREAL


RASHI = [
    {"en": "Aries", "sa": "Mesha"},
    {"en": "Taurus", "sa": "Vrishabha"},
    {"en": "Gemini", "sa": "Mithuna"},
    {"en": "Cancer", "sa": "Karka"},
    {"en": "Leo", "sa": "Simha"},
    {"en": "Virgo", "sa": "Kanya"},
    {"en": "Libra", "sa": "Tula"},
    {"en": "Scorpio", "sa": "Vrischika"},
    {"en": "Sagittarius", "sa": "Dhanu"},
    {"en": "Capricorn", "sa": "Makara"},
    {"en": "Aquarius", "sa": "Kumbha"},
    {"en": "Pisces", "sa": "Meena"},
]

NAKSHATRA = [
    "Ashwini",
    "Bharani",
    "Krittika",
    "Rohini",
    "Mrigashirsha",
    "Ardra",
    "Punarvasu",
    "Pushya",
    "Ashlesha",
    "Magha",
    "Purva Phalguni",
    "Uttara Phalguni",
    "Hasta",
    "Chitra",
    "Swati",
    "Vishakha",
    "Anuradha",
    "Jyeshtha",
    "Mula",
    "Purva Ashadha",
    "Uttara Ashadha",
    "Shravana",
    "Dhanishta",
    "Shatabhisha",
    "Purva Bhadrapada",
    "Uttara Bhadrapada",
    "Revati",
]

PLANETS = [
    ("Sun", "☉", swe.SUN),
    ("Moon", "☽", swe.MOON),
    ("Mercury", "☿", swe.MERCURY),
    ("Venus", "♀", swe.VENUS),
    ("Mars", "♂", swe.MARS),
    ("Jupiter", "♃", swe.JUPITER),
    ("Saturn", "♄", swe.SATURN),
]

NODE = ("Rahu", "☊", swe.TRUE_NODE)


VIMSHOTTARI_ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]
VIMSHOTTARI_YEARS = {
    "Ketu": 7,
    "Venus": 20,
    "Sun": 6,
    "Moon": 10,
    "Mars": 7,
    "Rahu": 18,
    "Jupiter": 16,
    "Saturn": 19,
    "Mercury": 17,
}


def _dt_to_jd_ut(dt_utc: datetime) -> float:
    hour = dt_utc.hour + dt_utc.minute / 60 + dt_utc.second / 3600 + dt_utc.microsecond / 3_600_000_000
    return float(swe.julday(dt_utc.year, dt_utc.month, dt_utc.day, hour))


def _parse_birth_datetime(*, date_str: str, time_str: str, tz_name: str) -> Tuple[datetime, datetime, float, str]:
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")
        tz_name = "UTC"

    y, m, d = (int(x) for x in date_str.split("-"))
    hh, mm = (int(x) for x in time_str.split(":"))
    dt_local = datetime(y, m, d, hh, mm, 0, tzinfo=tz)
    dt_utc = dt_local.astimezone(timezone.utc)
    jd_ut = _dt_to_jd_ut(dt_utc)
    return dt_local, dt_utc, jd_ut, tz_name


def _sidereal_lon(jd_ut: float, body: int) -> float:
    lon = float(swe.calc_ut(jd_ut, body, FLG)[0][0]) % 360.0
    return lon


def _ascendant_lon(jd_ut: float, lat: float, lon: float) -> float:
    try:
        _cusps, ascmc = swe.houses_ex(jd_ut, lat, lon, b"W", FLG)
        asc = float(ascmc[0]) % 360.0
        return asc
    except Exception:
        # Fallback: tropical ascendant - ayanamsa
        _cusps, ascmc = swe.houses(jd_ut, lat, lon, b"W")
        asc_trop = float(ascmc[0]) % 360.0
        ay = float(swe.get_ayanamsa_ut(jd_ut)) % 360.0
        return (asc_trop - ay) % 360.0


def _rashi_index(lon: float) -> int:
    return int((lon % 360.0) // 30.0)


def _rashi_name(idx: int) -> str:
    return RASHI[int(idx) % 12]["sa"]


def _navamsa_sign_index(lon: float) -> int:
    """
    Navamsa (D9) sign for a sidereal longitude.
    - Each sign (30°) is divided into 9 parts of 3°20' (3.333...°)
    - Movable signs start from same sign
    - Fixed signs start from 9th from itself
    - Dual signs start from 5th from itself
    """
    lon = lon % 360.0
    sign = _rashi_index(lon)
    within = lon % 30.0
    part = int(within // (30.0 / 9.0))  # 0..8

    movable = {0, 3, 6, 9}
    fixed = {1, 4, 7, 10}
    dual = {2, 5, 8, 11}
    if sign in movable:
        start = sign
    elif sign in fixed:
        start = (sign + 8) % 12
    else:  # dual
        start = (sign + 4) % 12

    return int((start + part) % 12)


def _moon_nakshatra(lon: float) -> Tuple[str, int]:
    seg = 360.0 / 27.0
    idx = int((lon % 360.0) // seg)  # 0..26
    pada = int(((lon % seg) / (seg / 4.0))) + 1  # 1..4
    return NAKSHATRA[idx], max(1, min(4, pada))


def _vimshottari_dasha(*, dt_local: datetime, moon_lon: float) -> List[Dict]:
    seg = 360.0 / 27.0
    nak_idx = int((moon_lon % 360.0) // seg)
    lord = VIMSHOTTARI_ORDER[nak_idx % 9]

    within = (moon_lon % seg)
    remaining_frac = (seg - within) / seg
    first_years = float(VIMSHOTTARI_YEARS[lord]) * remaining_frac

    # Build up to the full 120-year cycle starting from birth.
    out: List[Dict] = []
    start = dt_local

    def add_segment(name: str, years: float):
        nonlocal start
        days = years * 365.25
        end = start + timedelta(days=days)
        out.append(
            {
                "planet": name,
                "years": round(float(years), 4),
                "start": start.isoformat(timespec="seconds"),
                "end": end.isoformat(timespec="seconds"),
            }
        )
        start = end

    add_segment(lord, first_years)

    # Continue with full mahadashas until we complete one 120-year cycle.
    idx = (VIMSHOTTARI_ORDER.index(lord) + 1) % 9
    total_years = first_years
    while total_years < 120.0 - 1e-6:
        name = VIMSHOTTARI_ORDER[idx]
        years = float(VIMSHOTTARI_YEARS[name])
        add_segment(name, years)
        total_years += years
        idx = (idx + 1) % 9

    return out


def build_kundali(
    *,
    date_str: str,
    time_str: str,
    lat: float,
    lon: float,
    tz_name: str,
) -> Dict:
    dt_local, dt_utc, jd_ut, tz_name = _parse_birth_datetime(date_str=date_str, time_str=time_str, tz_name=tz_name)

    ayanamsa = float(swe.get_ayanamsa_ut(jd_ut)) % 360.0

    asc_lon = _ascendant_lon(jd_ut, lat, lon)
    lagna_idx = _rashi_index(asc_lon)
    lagna = _rashi_name(lagna_idx)

    planet_rows: List[Dict] = []
    placements_by_house: Dict[int, List[Dict]] = {i: [] for i in range(1, 13)}

    def add_planet(name: str, symbol: str, lon_deg: float):
        r_idx = _rashi_index(lon_deg)
        house = int(((r_idx - lagna_idx) % 12) + 1)
        row = {
            "planet": name,
            "symbol": symbol,
            "degree": round(float(lon_deg), 6),
            "degree_in_sign": round(float(lon_deg % 30.0), 6),
            "rashi": _rashi_name(r_idx),
            "rashi_index": int(r_idx),
            "house": int(house),
        }
        planet_rows.append(row)
        placements_by_house[house].append(row)

    # Classical planets
    moon_lon = None
    for name, symbol, body in PLANETS:
        lon_deg = _sidereal_lon(jd_ut, body)
        if name == "Moon":
            moon_lon = lon_deg
        add_planet(name, symbol, lon_deg)

    # Rahu/Ketu
    rahu_lon = _sidereal_lon(jd_ut, NODE[2])
    add_planet("Rahu", "☊", rahu_lon)
    add_planet("Ketu", "☋", (rahu_lon + 180.0) % 360.0)

    if moon_lon is None:
        moon_lon = _sidereal_lon(jd_ut, swe.MOON)

    nak_name, nak_pada = _moon_nakshatra(moon_lon)
    dasha = _vimshottari_dasha(dt_local=dt_local, moon_lon=moon_lon)

    houses: List[Dict] = []
    for h in range(1, 13):
        sign_idx = (lagna_idx + (h - 1)) % 12
        houses.append(
            {
                "house": h,
                "rashi": _rashi_name(sign_idx),
                "rashi_index": int(sign_idx),
                "planets": [p["planet"] for p in placements_by_house[h]],
                "planet_symbols": [p["symbol"] for p in placements_by_house[h]],
            }
        )

    # Navamsa (D9)
    nav_asc_idx = _navamsa_sign_index(asc_lon)
    nav_lagna = _rashi_name(nav_asc_idx)
    nav_planets: List[Dict] = []
    nav_by_house: Dict[int, List[Dict]] = {i: [] for i in range(1, 13)}
    for p in planet_rows:
        nav_idx = _navamsa_sign_index(float(p["degree"]))
        nav_house = int(((nav_idx - nav_asc_idx) % 12) + 1)
        row = {
            "planet": p["planet"],
            "symbol": p["symbol"],
            "degree": p["degree"],
            "rashi": _rashi_name(nav_idx),
            "rashi_index": int(nav_idx),
            "house": int(nav_house),
        }
        nav_planets.append(row)
        nav_by_house[nav_house].append(row)

    nav_houses: List[Dict] = []
    for h in range(1, 13):
        sign_idx = (nav_asc_idx + (h - 1)) % 12
        nav_houses.append(
            {
                "house": h,
                "rashi": _rashi_name(sign_idx),
                "rashi_index": int(sign_idx),
                "planets": [p["planet"] for p in nav_by_house[h]],
                "planet_symbols": [p["symbol"] for p in nav_by_house[h]],
            }
        )

    return {
        "input": {
            "date": date_str,
            "time": time_str,
            "lat": float(lat),
            "lon": float(lon),
            "tz": tz_name,
            "datetime_local": dt_local.isoformat(timespec="seconds"),
            "datetime_utc": dt_utc.isoformat(timespec="seconds"),
        },
        "ayanamsa": round(float(ayanamsa), 6),
        "lagna": lagna,
        "lagna_degree": round(float(asc_lon), 6),
        "planets": planet_rows,
        "houses": houses,
        "navamsa": {
            "lagna": nav_lagna,
            "planets": nav_planets,
            "houses": nav_houses,
        },
        "nakshatra": nak_name,
        "nakshatra_pada": int(nak_pada),
        "dasha": dasha,
    }

