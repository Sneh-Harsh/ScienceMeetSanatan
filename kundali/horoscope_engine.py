from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo

import swisseph as swe

from .calculations import (
    FLG,
    NAKSHATRA,
    PLANETS,
    RASHI,
    VIMSHOTTARI_ORDER,
    VIMSHOTTARI_YEARS,
    _dt_to_jd_ut,
    _moon_nakshatra,
    _parse_birth_datetime,
    _rashi_index,
    _rashi_name,
    _sidereal_lon,
    build_kundali,
)


TRANSIT_BODIES = {
    "Sun": swe.SUN,
    "Moon": swe.MOON,
    "Mercury": swe.MERCURY,
    "Venus": swe.VENUS,
    "Mars": swe.MARS,
    "Jupiter": swe.JUPITER,
    "Saturn": swe.SATURN,
    "Rahu": swe.TRUE_NODE,
}

HOUSE_TOPICS = {
    1: "self-definition and emotional visibility",
    2: "financial choices and family values",
    3: "communication, courage, and execution",
    4: "home, peace, and inner grounding",
    5: "creativity, romance, and inspiration",
    6: "health, discipline, and problem-solving",
    7: "partnerships and relationship dynamics",
    8: "transformation, secrets, and surrender",
    9: "luck, dharma, and faith",
    10: "career, duty, and public image",
    11: "gains, networks, and long-term desires",
    12: "release, rest, and spiritual retreat",
}

PLANET_SIGNIFICATIONS = {
    "Sun": "authority and life direction",
    "Moon": "emotions and mental flow",
    "Mars": "drive and confrontation",
    "Mercury": "intellect and communication",
    "Jupiter": "growth and protection",
    "Venus": "love and comfort",
    "Saturn": "karma and responsibility",
    "Rahu": "desire and unusual turns",
    "Ketu": "detachment and spiritual insight",
}

LUCKY_COLORS = [
    "Saffron Gold",
    "Moonlit White",
    "Peacock Blue",
    "Lotus Pink",
    "Deep Emerald",
    "Sacred Silver",
]

LUCKY_TIMES = [
    "6:24 AM",
    "9:12 AM",
    "12:18 PM",
    "4:08 PM",
    "7:36 PM",
]


@dataclass
class TransitPlanet:
    name: str
    symbol: str
    degree: float
    rashi_index: int
    rashi: str
    house_from_lagna: int
    house_from_moon: int


def _local_to_utc(dt_local: datetime) -> datetime:
    return dt_local.astimezone(timezone.utc)


def _transit_planets(dt_local: datetime, natal_lagna_idx: int, natal_moon_idx: int) -> Dict[str, TransitPlanet]:
    dt_utc = _local_to_utc(dt_local)
    jd_ut = _dt_to_jd_ut(dt_utc)
    out: Dict[str, TransitPlanet] = {}
    for name, symbol, body in PLANETS:
        lon = _sidereal_lon(jd_ut, body)
        rashi_idx = _rashi_index(lon)
        out[name] = TransitPlanet(
            name=name,
            symbol=symbol,
            degree=lon,
            rashi_index=rashi_idx,
            rashi=_rashi_name(rashi_idx),
            house_from_lagna=((rashi_idx - natal_lagna_idx) % 12) + 1,
            house_from_moon=((rashi_idx - natal_moon_idx) % 12) + 1,
        )

    rahu_lon = _sidereal_lon(jd_ut, swe.TRUE_NODE)
    rahu_idx = _rashi_index(rahu_lon)
    out["Rahu"] = TransitPlanet(
        name="Rahu",
        symbol="☊",
        degree=rahu_lon,
        rashi_index=rahu_idx,
        rashi=_rashi_name(rahu_idx),
        house_from_lagna=((rahu_idx - natal_lagna_idx) % 12) + 1,
        house_from_moon=((rahu_idx - natal_moon_idx) % 12) + 1,
    )
    ketu_lon = (rahu_lon + 180.0) % 360.0
    ketu_idx = _rashi_index(ketu_lon)
    out["Ketu"] = TransitPlanet(
        name="Ketu",
        symbol="☋",
        degree=ketu_lon,
        rashi_index=ketu_idx,
        rashi=_rashi_name(ketu_idx),
        house_from_lagna=((ketu_idx - natal_lagna_idx) % 12) + 1,
        house_from_moon=((ketu_idx - natal_moon_idx) % 12) + 1,
    )
    return out


def _moon_house_phrase(house_from_moon: int) -> str:
    return HOUSE_TOPICS.get(house_from_moon, "inner processing")


def _find_mahadasha(dasha: List[Dict], target_local: datetime) -> Optional[Dict]:
    for segment in dasha:
        try:
            start = datetime.fromisoformat(segment["start"])
            end = datetime.fromisoformat(segment["end"])
        except Exception:
            continue
        if start <= target_local <= end:
            return segment
    return dasha[0] if dasha else None


def _current_antardasha(mahadasha: Dict, target_local: datetime) -> Dict:
    maha_name = str(mahadasha.get("planet") or "Moon")
    start = datetime.fromisoformat(mahadasha["start"])
    end = datetime.fromisoformat(mahadasha["end"])
    total_seconds = max((end - start).total_seconds(), 1.0)
    elapsed_seconds = max((target_local - start).total_seconds(), 0.0)
    fraction = min(max(elapsed_seconds / total_seconds, 0.0), 0.999999)

    order_start = VIMSHOTTARI_ORDER.index(maha_name)
    antardasha_order = VIMSHOTTARI_ORDER[order_start:] + VIMSHOTTARI_ORDER[:order_start]
    sub_lengths = []
    for planet in antardasha_order:
        sub_years = VIMSHOTTARI_YEARS[maha_name] * VIMSHOTTARI_YEARS[planet] / 120.0
        sub_lengths.append((planet, sub_years))

    total_units = sum(years for _, years in sub_lengths) or 1.0
    running = 0.0
    for planet, years in sub_lengths:
        running += years / total_units
        if fraction <= running:
            return {"planet": planet}
    return {"planet": antardasha_order[-1]}


def _transit_strength(transits: Dict[str, TransitPlanet], dasha_planets: set[str]) -> Dict[str, int]:
    scores = {"love": 50, "career": 50, "health": 50, "finance": 50}

    jupiter = transits["Jupiter"]
    venus = transits["Venus"]
    mercury = transits["Mercury"]
    saturn = transits["Saturn"]
    mars = transits["Mars"]
    rahu = transits["Rahu"]
    ketu = transits["Ketu"]

    if jupiter.house_from_lagna in {1, 2, 5, 7, 9, 10, 11}:
        scores["career"] += 15
        scores["finance"] += 15
    if venus.house_from_lagna in {1, 5, 7, 11}:
        scores["love"] += 10
    if mercury.house_from_lagna in {2, 3, 6, 10, 11}:
        scores["career"] += 10
        scores["finance"] += 8
    if saturn.house_from_lagna in {4, 8, 10, 12}:
        scores["career"] -= 15
        scores["health"] -= 10
    if mars.house_from_lagna in {1, 6, 8, 12}:
        scores["health"] -= 10
        scores["love"] -= 6
    if rahu.house_from_lagna in {2, 7, 8, 12} or ketu.house_from_lagna in {2, 7, 8, 12}:
        scores["finance"] -= 10
        scores["love"] -= 6

    for planet in dasha_planets:
        if planet == "Jupiter":
            scores["career"] += 8
            scores["finance"] += 8
        if planet == "Venus":
            scores["love"] += 8
        if planet == "Mercury":
            scores["career"] += 8
        if planet == "Saturn":
            scores["career"] -= 8
        if planet in {"Rahu", "Ketu", "Mars"}:
            scores["health"] -= 5

    return {key: max(0, min(100, value)) for key, value in scores.items()}


def _dominant_planet(transits: Dict[str, TransitPlanet], dasha_planets: set[str]) -> str:
    priorities = ["Jupiter", "Saturn", "Rahu", "Mars", "Venus", "Mercury", "Sun", "Moon"]
    for name in priorities:
        if name in dasha_planets:
            return name
    moon_house = transits["Moon"].house_from_moon
    if moon_house in {5, 9, 10, 11}:
        return "Jupiter"
    if moon_house in {6, 8, 12}:
        return "Saturn"
    return "Moon"


def _cosmic_opening(moon_rashi: str, dominant_planet: str, scope_label: str) -> str:
    return (
        f"For {moon_rashi} natives, this {scope_label.lower()} opens under the watch of {dominant_planet}, "
        f"stirring a more personal current around {PLANET_SIGNIFICATIONS.get(dominant_planet, 'inner movement')}."
    )


def _summary_line(moon_house: int, dasha_planet: str, dominant_planet: str) -> str:
    return (
        f"With the transit Moon activating house {moon_house}, the emotional theme turns toward "
        f"{_moon_house_phrase(moon_house)}, while {dasha_planet} in dasha amplifies {PLANET_SIGNIFICATIONS.get(dasha_planet, 'timing')}. "
        f"This makes {dominant_planet} the loudest cosmic voice in the background."
    )


def _detailed_blocks(transits: Dict[str, TransitPlanet], dasha_planets: set[str], scope_label: str) -> Dict[str, str]:
    moon_house = transits["Moon"].house_from_moon
    sun_house = transits["Sun"].house_from_lagna
    venus_house = transits["Venus"].house_from_lagna
    jupiter_house = transits["Jupiter"].house_from_lagna
    saturn_house = transits["Saturn"].house_from_lagna

    emotional = (
        f"The Moon traveling through the {moon_house}th house from your natal Moon makes your mind lean toward "
        f"{_moon_house_phrase(moon_house)}. Feelings may arrive in layers, but clarity improves once you slow the pace."
    )
    career = (
        f"Career currents are shaped by the Sun in house {sun_house} and Jupiter in house {jupiter_house}. "
        f"This {scope_label.lower()} favors visible effort, but Saturn in house {saturn_house} asks for patience before results mature."
    )
    relationship = (
        f"Venus activating house {venus_house} colors relationships with a stronger need for tenderness and honest dialogue. "
        + (
            "Because your current dasha is touching emotional planets, reciprocity becomes especially important now."
            if ("Venus" in dasha_planets or "Moon" in dasha_planets)
            else "Even quiet interactions now reveal what is balanced and what still needs healing."
        )
    )
    finance = (
        f"Financially, gains improve when Mercury and Jupiter support practical decisions, while Rahu and Ketu caution against impulsive bets. "
        f"Stable planning works better than speculative moves in this cycle."
    )
    return {
        "emotional": emotional,
        "career": career,
        "relationships": relationship,
        "finance": finance,
    }


def _advice(scope_label: str, dominant_planet: str, moon_house: int) -> str:
    return (
        f"Your best remedy for this {scope_label.lower()} is to act in rhythm, not haste. "
        f"Honor the lesson of {dominant_planet} by giving steady attention to house {moon_house} matters before chasing external noise."
    )


def _lucky_payload(scores: Dict[str, int], transits: Dict[str, TransitPlanet]) -> Dict:
    moon_house = transits["Moon"].house_from_moon
    return {
        "color": LUCKY_COLORS[moon_house % len(LUCKY_COLORS)],
        "number": int((scores["career"] + scores["love"] + moon_house) % 9) + 1,
        "time": LUCKY_TIMES[moon_house % len(LUCKY_TIMES)],
    }


def _weekly_theme(natal_moon_idx: int, dt_local: datetime) -> Dict:
    daily_houses: List[int] = []
    for offset in range(7):
        sample = dt_local + timedelta(days=offset)
        moon_lon = _sidereal_lon(_dt_to_jd_ut(_local_to_utc(sample)), swe.MOON)
        moon_idx = _rashi_index(moon_lon)
        daily_houses.append(((moon_idx - natal_moon_idx) % 12) + 1)
    dominant_house = max(set(daily_houses), key=daily_houses.count)
    return {
        "dominant_house": dominant_house,
        "summary": f"The week circles repeatedly around house {dominant_house}, bringing emphasis to {_moon_house_phrase(dominant_house)}.",
    }


def _monthly_theme(transits: Dict[str, TransitPlanet]) -> str:
    sun_house = transits["Sun"].house_from_lagna
    mercury_house = transits["Mercury"].house_from_lagna
    venus_house = transits["Venus"].house_from_lagna
    mars_house = transits["Mars"].house_from_lagna
    return (
        f"The Sun lights up house {sun_house}, setting the main monthly stage, while Mercury in house {mercury_house}, "
        f"Venus in house {venus_house}, and Mars in house {mars_house} decide how quickly events unfold."
    )


def _yearly_theme(transits: Dict[str, TransitPlanet], dasha_planets: set[str], year: int) -> str:
    jupiter_house = transits["Jupiter"].house_from_lagna
    saturn_house = transits["Saturn"].house_from_lagna
    rahu_house = transits["Rahu"].house_from_lagna
    ketu_house = transits["Ketu"].house_from_lagna
    sentence = (
        f"In {year}, Jupiter expands house {jupiter_house}, Saturn tests house {saturn_house}, "
        f"and the Rahu–Ketu axis activates houses {rahu_house} and {ketu_house}."
    )
    if jupiter_house == saturn_house:
        sentence += " Since Jupiter and Saturn are pressing on the same house, a major life-defining chapter can crystallize there."
    for planet in ("Jupiter", "Saturn", "Rahu", "Ketu"):
        if planet in dasha_planets:
            sentence += f" Because your active dasha is resonating with {planet}, that transit carries extra weight."
            break
    return sentence


def _build_scope(scope_label: str, natal: Dict, dt_local: datetime, year: Optional[int] = None, weekly_meta: Optional[Dict] = None) -> Dict:
    natal_moon = next((p for p in natal["planets"] if p["planet"] == "Moon"), None)
    natal_sun = next((p for p in natal["planets"] if p["planet"] == "Sun"), None)
    natal_lagna_idx = next((h["rashi_index"] for h in natal["houses"] if h["house"] == 1), 0)
    natal_moon_idx = int(natal_moon["rashi_index"])
    transits = _transit_planets(dt_local, natal_lagna_idx, natal_moon_idx)
    mahadasha = _find_mahadasha(natal["dasha"], dt_local) or {"planet": "Moon", "start": natal["input"]["datetime_local"], "end": natal["input"]["datetime_local"]}
    antardasha = _current_antardasha(mahadasha, dt_local)
    dasha_planets = {str(mahadasha.get("planet") or "Moon"), str(antardasha.get("planet") or "Moon")}
    dominant = _dominant_planet(transits, dasha_planets)
    scores = _transit_strength(transits, dasha_planets)
    moon_house = transits["Moon"].house_from_moon

    summary_extra = ""
    if scope_label == "Weekly" and weekly_meta:
        summary_extra = f" {weekly_meta['summary']}"
    if scope_label == "Monthly":
        summary_extra = f" {_monthly_theme(transits)}"
    if scope_label in {"Yearly", "Specific Year"}:
        summary_extra = f" {_yearly_theme(transits, dasha_planets, year or dt_local.year)}"

    return {
        "scope": scope_label,
        "cosmic_message": _cosmic_opening(natal_moon["rashi"], dominant, scope_label),
        "summary": _summary_line(moon_house, str(mahadasha.get("planet") or "Moon"), dominant) + summary_extra,
        "details": _detailed_blocks(transits, dasha_planets, scope_label),
        "advice": _advice(scope_label, dominant, moon_house),
        "lucky": _lucky_payload(scores, transits),
        "scores": scores,
        "transit_house": moon_house,
        "dominant_planet": dominant,
        "mahadasha": str(mahadasha.get("planet") or "Moon"),
        "antardasha": str(antardasha.get("planet") or "Moon"),
    }


def build_horoscope(*, date_str: str, time_str: str, lat: float, lon: float, tz_name: str, specific_year: int = 2026) -> Dict:
    natal = build_kundali(date_str=date_str, time_str=time_str, lat=lat, lon=lon, tz_name=tz_name)
    tz = ZoneInfo(tz_name)
    now_local = datetime.now(tz=tz).replace(second=0, microsecond=0)
    weekly_meta = _weekly_theme(int(next(p for p in natal["planets"] if p["planet"] == "Moon")["rashi_index"]), now_local)

    monthly_dt = now_local.replace(day=15, hour=12, minute=0)
    yearly_dt = datetime(now_local.year, 7, 1, 12, 0, tzinfo=tz)
    specific_dt = datetime(specific_year, 7, 1, 12, 0, tzinfo=tz)

    return {
        "natal": {
            "lagna": natal["lagna"],
            "moon_sign": next(p["rashi"] for p in natal["planets"] if p["planet"] == "Moon"),
            "sun_sign": next(p["rashi"] for p in natal["planets"] if p["planet"] == "Sun"),
            "nakshatra": natal["nakshatra"],
            "nakshatra_pada": natal["nakshatra_pada"],
        },
        "daily": _build_scope("Daily", natal, now_local),
        "weekly": _build_scope("Weekly", natal, now_local, weekly_meta=weekly_meta),
        "monthly": _build_scope("Monthly", natal, monthly_dt),
        "yearly": _build_scope("Yearly", natal, yearly_dt, year=yearly_dt.year),
        "specific_year": _build_scope("Specific Year", natal, specific_dt, year=specific_year),
        "specific_year_label": specific_year,
    }
