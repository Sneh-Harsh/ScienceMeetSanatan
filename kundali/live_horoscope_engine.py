from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Sequence, Tuple
from zoneinfo import ZoneInfo

from .calculations import NAKSHATRA, RASHI, VIMSHOTTARI_ORDER, build_kundali
from .interpretation_engine import build_lucky_elements, build_scope_narrative, rank_houses, weighted_area_scores
from .period_engine import PeriodRange, get_period_range, get_period_sample_points, split_year_windows
from .transit_engine import (
    BENEFICS,
    MALEFICS,
    PLANET_ORDER,
    TRANSIT_WEIGHTS,
    TransitPlanet,
    aspect_targets,
    get_current_transits,
    transit_signature,
    transit_snapshot,
    weekday_ruler,
)
from .variation_engine import signature_key


HOUSE_LORDS_BY_SIGN = {
    0: "Mars",
    1: "Venus",
    2: "Mercury",
    3: "Moon",
    4: "Sun",
    5: "Mercury",
    6: "Venus",
    7: "Mars",
    8: "Jupiter",
    9: "Saturn",
    10: "Saturn",
    11: "Jupiter",
}
EXALTATION_SIGNS = {"Sun": 0, "Moon": 1, "Mars": 9, "Mercury": 5, "Jupiter": 3, "Venus": 11, "Saturn": 6}
DEBILITATION_SIGNS = {"Sun": 6, "Moon": 7, "Mars": 3, "Mercury": 11, "Jupiter": 9, "Venus": 5, "Saturn": 0}
HOUSE_MULTIPLIERS = {1: 1.05, 2: 1.15, 3: 1.0, 4: 1.08, 5: 1.25, 6: 0.95, 7: 1.08, 8: 0.92, 9: 1.1, 10: 1.1, 11: 1.3, 12: 0.8}
PERIOD_PLANET_WEIGHTS = {
    "daily": {"Moon": 1.65, "Sun": 1.1, "Mercury": 1.15, "Venus": 1.15, "Mars": 1.18, "Jupiter": 0.95, "Saturn": 0.95, "Rahu": 1.0, "Ketu": 0.96},
    "weekly": {"Moon": 1.35, "Sun": 1.18, "Mercury": 1.2, "Venus": 1.18, "Mars": 1.16, "Jupiter": 1.0, "Saturn": 1.0, "Rahu": 1.02, "Ketu": 0.98},
    "monthly": {"Moon": 0.95, "Sun": 1.35, "Mercury": 1.28, "Venus": 1.24, "Mars": 1.22, "Jupiter": 1.08, "Saturn": 1.12, "Rahu": 1.06, "Ketu": 1.02},
    "yearly": {"Moon": 0.68, "Sun": 0.82, "Mercury": 0.82, "Venus": 0.84, "Mars": 0.88, "Jupiter": 1.55, "Saturn": 1.58, "Rahu": 1.34, "Ketu": 1.28},
    "specific_year": {"Moon": 0.68, "Sun": 0.82, "Mercury": 0.82, "Venus": 0.84, "Mars": 0.88, "Jupiter": 1.55, "Saturn": 1.58, "Rahu": 1.34, "Ketu": 1.28},
}
FAST_MOVERS = {"Moon", "Sun", "Mercury", "Venus", "Mars"}
SLOW_MOVERS = {"Jupiter", "Saturn", "Rahu", "Ketu"}


@dataclass(frozen=True)
class DashaState:
    mahadasha: str
    antardasha: str


def _planet_lookup(kundali: Dict) -> Dict[str, Dict]:
    return {str(row.get("planet")): row for row in list(kundali.get("planets") or [])}


def _house_lookup(kundali: Dict) -> Dict[int, Dict]:
    return {int(row.get("house")): row for row in list(kundali.get("houses") or [])}


def _house_lords(kundali: Dict) -> Dict[int, str]:
    lords: Dict[int, str] = {}
    for house in list(kundali.get("houses") or []):
        rashi_index = int(house.get("rashi_index") or 0)
        lords[int(house.get("house") or 0)] = HOUSE_LORDS_BY_SIGN.get(rashi_index, "Moon")
    return lords


def _nakshatra_lord(nakshatra_name: str) -> str:
    try:
        idx = NAKSHATRA.index(nakshatra_name)
    except ValueError:
        idx = 0
    return VIMSHOTTARI_ORDER[idx % len(VIMSHOTTARI_ORDER)]


def _planet_natal_strength(planet_row: Dict, house_lords: Dict[int, str]) -> float:
    planet = str(planet_row.get("planet") or "")
    rashi_index = int(planet_row.get("rashi_index") or 0)
    house = int(planet_row.get("house") or 0)
    score = 52.0
    if EXALTATION_SIGNS.get(planet) == rashi_index:
        score += 18.0
    elif DEBILITATION_SIGNS.get(planet) == rashi_index:
        score -= 18.0
    elif HOUSE_LORDS_BY_SIGN.get(rashi_index) == planet:
        score += 11.0

    if house in {1, 4, 5, 7, 9, 10, 11}:
        score += 7.0
    if house in {6, 8, 12}:
        score -= 7.0
    if planet in {house_lords.get(1), house_lords.get(5), house_lords.get(9), house_lords.get(10), house_lords.get(11)}:
        score += 6.0
    if planet in {house_lords.get(6), house_lords.get(8), house_lords.get(12)}:
        score -= 3.5
    return max(22.0, min(95.0, score))


def _find_mahadasha(dasha: Sequence[Dict], target_local: datetime) -> Optional[Dict]:
    for segment in dasha:
        try:
            start = datetime.fromisoformat(str(segment["start"]))
            end = datetime.fromisoformat(str(segment["end"]))
        except Exception:
            continue
        if start <= target_local <= end:
            return dict(segment)
    return dict(dasha[0]) if dasha else None


def _current_antardasha(mahadasha: Dict, target_local: datetime) -> DashaState:
    maha_name = str(mahadasha.get("planet") or "Moon")
    start = datetime.fromisoformat(str(mahadasha["start"]))
    end = datetime.fromisoformat(str(mahadasha["end"]))
    total_seconds = max((end - start).total_seconds(), 1.0)
    elapsed_seconds = max((target_local - start).total_seconds(), 0.0)
    fraction = min(max(elapsed_seconds / total_seconds, 0.0), 0.999999)

    order_start = VIMSHOTTARI_ORDER.index(maha_name)
    antardasha_order = VIMSHOTTARI_ORDER[order_start:] + VIMSHOTTARI_ORDER[:order_start]
    sub_lengths: List[Tuple[str, float]] = []
    from .calculations import VIMSHOTTARI_YEARS

    for planet in antardasha_order:
        sub_years = VIMSHOTTARI_YEARS[maha_name] * VIMSHOTTARI_YEARS[planet] / 120.0
        sub_lengths.append((planet, sub_years))

    total_units = sum(years for _, years in sub_lengths) or 1.0
    running = 0.0
    selected = antardasha_order[-1]
    for planet, years in sub_lengths:
        running += years / total_units
        if fraction <= running:
            selected = planet
            break
    return DashaState(mahadasha=maha_name, antardasha=selected)


def _dasha_state_for(kundali: Dict, target_local: datetime) -> DashaState:
    mahadasha = _find_mahadasha(list(kundali.get("dasha") or []), target_local) or {
        "planet": "Moon",
        "start": kundali["input"]["datetime_local"],
        "end": kundali["input"]["datetime_local"],
    }
    return _current_antardasha(mahadasha, target_local)


def _period_weight(period_type: str, planet: str, sample_index: int, sample_count: int, dt_local: datetime) -> float:
    weight = PERIOD_PLANET_WEIGHTS.get(period_type, PERIOD_PLANET_WEIGHTS["daily"]).get(planet, 1.0)
    if planet == weekday_ruler(dt_local):
        weight += 0.18
    if period_type == "daily" and planet in FAST_MOVERS:
        weight += 0.12
    if period_type in {"yearly", "specific_year"} and planet in SLOW_MOVERS:
        weight += 0.18
    progression = 0.9 + ((sample_index + 1) / max(sample_count, 1)) * 0.2
    return weight * progression


def _planet_polarity(planet: str) -> Tuple[float, float]:
    if planet in BENEFICS:
        return 1.0, 0.42
    if planet in MALEFICS:
        return 0.52, 1.0
    return 0.78, 0.78


def compute_house_activation(
    kundali: Dict,
    transits_by_sample: Sequence[Tuple[datetime, Dict[str, TransitPlanet]]],
    dasha: DashaState,
    period_type: str,
) -> Dict[int, Dict[str, float]]:
    planets = _planet_lookup(kundali)
    house_lords = _house_lords(kundali)
    activation = {house: {"score": 0.0, "support": 0.0, "pressure": 0.0} for house in range(1, 13)}
    if not transits_by_sample:
        return activation

    for sample_index, (sample_dt, transits) in enumerate(transits_by_sample):
        dt_weight_count = len(transits_by_sample)
        for planet in PLANET_ORDER:
            row = transits.get(planet)
            if not row:
                continue
            weight = _period_weight(period_type, planet, sample_index, dt_weight_count, sample_dt)
            natal = planets.get(planet, {})
            natal_strength = _planet_natal_strength(natal, house_lords) if natal else 50.0
            house = int(row.house_from_lagna)
            support_ratio, pressure_ratio = _planet_polarity(planet)
            multiplier = HOUSE_MULTIPLIERS.get(house, 1.0)
            base = TRANSIT_WEIGHTS.get(planet, 1.0) * weight * multiplier * (0.75 + (natal_strength / 100.0) * 0.55)
            support = base * support_ratio
            pressure = base * pressure_ratio * (1.0 if house in {6, 8, 12} else 0.62)
            activation[house]["support"] += support
            activation[house]["pressure"] += pressure
            activation[house]["score"] += support - pressure

            for target_house in aspect_targets(planet, house):
                aspect_support = support * 0.42
                aspect_pressure = pressure * 0.42
                activation[target_house]["support"] += aspect_support
                activation[target_house]["pressure"] += aspect_pressure
                activation[target_house]["score"] += aspect_support - aspect_pressure

            if planet == "Moon":
                moon_house = int(row.house_from_moon)
                activation[moon_house]["support"] += support * 0.35
                activation[moon_house]["pressure"] += pressure * 0.25
                activation[moon_house]["score"] += (support * 0.35) - (pressure * 0.25)

    for dasha_planet in {dasha.mahadasha, dasha.antardasha}:
        natal = planets.get(dasha_planet)
        if natal:
            occupied_house = int(natal.get("house") or 1)
            activation[occupied_house]["support"] += 12.0
            activation[occupied_house]["score"] += 8.0
        for house, lord in house_lords.items():
            if lord == dasha_planet:
                activation[house]["support"] += 10.0
                activation[house]["score"] += 6.0

    for house, lord in house_lords.items():
        natal_lord = planets.get(lord)
        if not natal_lord:
            continue
        natal_strength = _planet_natal_strength(natal_lord, house_lords)
        activation[house]["support"] += max(0.0, natal_strength - 50.0) * 0.12
        activation[house]["pressure"] += max(0.0, 50.0 - natal_strength) * 0.12
        activation[house]["score"] += (natal_strength - 50.0) * 0.08

    return activation


def compute_planet_influence(
    kundali: Dict,
    transits_by_sample: Sequence[Tuple[datetime, Dict[str, TransitPlanet]]],
    dasha: DashaState,
    period_type: str,
    reference_dt: datetime,
) -> Dict[str, float]:
    planets = _planet_lookup(kundali)
    house_lords = _house_lords(kundali)
    influences: Dict[str, float] = {}
    sample_count = max(len(transits_by_sample), 1)
    weekday_bonus = weekday_ruler(reference_dt)
    for planet in PLANET_ORDER:
        natal = planets.get(planet)
        natal_strength = _planet_natal_strength(natal, house_lords) if natal else 48.0
        influence = natal_strength * 0.55
        if planet == dasha.mahadasha:
            influence += 26.0
        if planet == dasha.antardasha:
            influence += 18.0
        if planet == weekday_bonus:
            influence += 6.0
        transit_accum = 0.0
        for index, (sample_dt, transits) in enumerate(transits_by_sample):
            row = transits.get(planet)
            if not row:
                continue
            house_weight = HOUSE_MULTIPLIERS.get(row.house_from_lagna, 1.0)
            transit_accum += TRANSIT_WEIGHTS.get(planet, 1.0) * _period_weight(period_type, planet, index, sample_count, sample_dt) * house_weight
            if row.retrograde:
                transit_accum -= 1.5
        influences[planet] = max(12.0, min(99.0, influence + transit_accum * 4.2))
    return influences


def _quarter_notes(kundali: Dict, year_windows: Sequence[PeriodRange], natal_lagna_idx: int, natal_moon_idx: int) -> List[str]:
    notes: List[str] = []
    for window in year_windows:
        probe = window.start.replace(day=15, hour=12, minute=0)
        transits = get_current_transits(probe, natal_lagna_idx, natal_moon_idx)
        jupiter_house = transits["Jupiter"].house_from_lagna
        saturn_house = transits["Saturn"].house_from_lagna
        notes.append(f"{window.label}: growth leans toward house {jupiter_house}, while responsibility concentrates around house {saturn_house}.")
    return notes


def _transit_summary(period_type: str, active_houses: List[int], dominant_planets: List[str], transits: Dict[str, TransitPlanet], period_range: PeriodRange) -> str:
    if period_type == "weekly":
        return f"The week repeatedly activates houses {active_houses[0]} and {active_houses[1]}, with {transits['Moon'].rashi} Moon passages changing the emotional tone through the days."
    if period_type == "monthly":
        return f"This month is organized around the Sun in house {transits['Sun'].house_from_lagna}, while Mercury and Venus color decisions and conversations."
    if period_type in {"yearly", "specific_year"}:
        return (
            f"The long-range field is being shaped by Jupiter in house {transits['Jupiter'].house_from_lagna}, "
            f"Saturn in house {transits['Saturn'].house_from_lagna}, and the Rahu–Ketu axis across houses "
            f"{transits['Rahu'].house_from_lagna} and {transits['Ketu'].house_from_lagna}."
        )
    return f"Today responds most strongly through houses {active_houses[0]} and {active_houses[1]}, while {dominant_planets[0]} sets the sharper tone."


def _date_range_payload(period_range: PeriodRange) -> Dict[str, str]:
    return {
        "start": period_range.start.isoformat(timespec="minutes"),
        "end": period_range.end.isoformat(timespec="minutes"),
        "label": period_range.label,
    }


def build_horoscope_scope(*, period_type: str, kundali: Dict, reference_dt: datetime, selected_year: Optional[int] = None, debug: bool = False) -> Dict:
    period_range = get_period_range(period_type, reference_dt, selected_year)
    natal_lagna_idx = next((int(h["rashi_index"]) for h in kundali["houses"] if int(h["house"]) == 1), 0)
    natal_moon = next((p for p in kundali["planets"] if p["planet"] == "Moon"), None)
    natal_moon_idx = int(natal_moon["rashi_index"]) if natal_moon else 0

    sample_points = get_period_sample_points(period_range)
    transits_by_sample = [(sample_dt, get_current_transits(sample_dt, natal_lagna_idx, natal_moon_idx)) for sample_dt in sample_points]
    anchor_dt = reference_dt if period_type == "daily" else sample_points[len(sample_points) // 2]
    anchor_transits = get_current_transits(anchor_dt, natal_lagna_idx, natal_moon_idx)
    dasha = _dasha_state_for(kundali, anchor_dt)
    house_activation = compute_house_activation(kundali, transits_by_sample, dasha, period_type)
    planet_influence = compute_planet_influence(kundali, transits_by_sample, dasha, period_type, anchor_dt)
    active_houses, support_houses, pressure_houses = rank_houses(house_activation)
    dominant_planets = sorted(planet_influence.keys(), key=lambda name: planet_influence[name], reverse=True)[:4]
    area_scores = weighted_area_scores(house_activation)
    variation_key = signature_key([
        period_type,
        period_range.label,
        kundali.get("lagna"),
        next((p.get("rashi") for p in kundali.get("planets", []) if p.get("planet") == "Moon"), ""),
        kundali.get("nakshatra"),
        dasha.mahadasha,
        dasha.antardasha,
        transit_signature(anchor_transits, dominant_planets[:3] or ["Moon"]),
        "-".join(str(house) for house in active_houses[:3]),
    ])
    narrative = build_scope_narrative(
        scope_label=period_type.replace("_", " ").title(),
        period_label="" if period_type == "daily" else f"For {period_range.label},",
        dominant_planets=dominant_planets,
        active_houses=active_houses,
        support_houses=support_houses,
        pressure_houses=pressure_houses,
        area_scores=area_scores,
        dasha={"mahadasha": dasha.mahadasha, "antardasha": dasha.antardasha},
        transit_summary=_transit_summary(period_type, active_houses, dominant_planets, anchor_transits, period_range),
        date_range_label=period_range.label,
        variation_key=variation_key,
    )
    lucky = build_lucky_elements(
        dominant_planets=dominant_planets,
        active_houses=active_houses,
        weekday_ruler=weekday_ruler(anchor_dt),
    )
    quarter_notes = []
    if period_type in {"yearly", "specific_year"}:
        quarter_notes = _quarter_notes(kundali, split_year_windows(period_range), natal_lagna_idx, natal_moon_idx)

    payload = {
        "periodType": period_type,
        "scope": period_type.replace("_", " ").title(),
        "dateRange": _date_range_payload(period_range),
        "headline": narrative["headline"],
        "cosmic_message": narrative["headline"],
        "summary": narrative["summary"] + (f" {' '.join(quarter_notes[:2])}" if quarter_notes else ""),
        "details": narrative["details"],
        "advice": narrative["advice"],
        "lucky": lucky,
        "scores": {
            "love": area_scores["relationships"],
            "career": area_scores["career"],
            "health": area_scores["health"],
            "finance": area_scores["finance"],
        },
        "emotionalTone": narrative["details"]["emotional"],
        "career": narrative["details"]["career"],
        "relationships": narrative["details"]["relationships"],
        "finance": narrative["details"]["finance"],
        "health": narrative["details"]["health"],
        "spiritualNote": narrative["spiritualNote"],
        "opportunities": narrative["opportunities"],
        "cautions": narrative["cautions"],
        "dominant_planet": dominant_planets[0] if dominant_planets else "Moon",
        "transit_house": active_houses[0] if active_houses else anchor_transits["Moon"].house_from_moon,
        "mahadasha": dasha.mahadasha,
        "antardasha": dasha.antardasha,
        "confidence": narrative["confidence"],
        "astroBasis": {
            "dominantPlanets": dominant_planets,
            "activeHouses": active_houses,
            "supportiveHouses": support_houses,
            "pressureHouses": pressure_houses,
            "dasha": dasha.mahadasha,
            "antardasha": dasha.antardasha,
            "keyTransits": transit_snapshot(anchor_transits),
        },
    }
    if quarter_notes:
        payload["quarterNotes"] = quarter_notes
    if debug:
        payload["debug"] = {
            "variationKey": variation_key,
            "houseActivation": house_activation,
            "planetInfluence": planet_influence,
            "anchorTransits": transit_snapshot(anchor_transits),
            "samplePoints": [sample.isoformat(timespec="minutes") for sample in sample_points],
        }
    return payload


def build_personalized_horoscope(
    *,
    date_str: str,
    time_str: str,
    lat: float,
    lon: float,
    tz_name: str,
    specific_year: int = 2026,
    debug: bool = False,
    kundali: Optional[Dict] = None,
) -> Dict:
    kundali = kundali or build_kundali(date_str=date_str, time_str=time_str, lat=lat, lon=lon, tz_name=tz_name)
    tz = ZoneInfo(tz_name)
    now_local = datetime.now(tz=tz).replace(second=0, microsecond=0)
    yearly_anchor = now_local.replace(month=7, day=1, hour=12, minute=0)
    specific_anchor = now_local.replace(year=specific_year, month=7, day=1, hour=12, minute=0)

    natal_moon = next((p for p in kundali["planets"] if p["planet"] == "Moon"), None)
    natal_sun = next((p for p in kundali["planets"] if p["planet"] == "Sun"), None)
    payload = {
        "natal": {
            "lagna": kundali["lagna"],
            "moon_sign": natal_moon["rashi"] if natal_moon else RASHI[0]["sa"],
            "sun_sign": natal_sun["rashi"] if natal_sun else RASHI[0]["sa"],
            "nakshatra": kundali["nakshatra"],
            "nakshatra_pada": kundali["nakshatra_pada"],
        },
        "daily": build_horoscope_scope(period_type="daily", kundali=kundali, reference_dt=now_local, debug=debug),
        "weekly": build_horoscope_scope(period_type="weekly", kundali=kundali, reference_dt=now_local, debug=debug),
        "monthly": build_horoscope_scope(period_type="monthly", kundali=kundali, reference_dt=now_local, debug=debug),
        "yearly": build_horoscope_scope(period_type="yearly", kundali=kundali, reference_dt=yearly_anchor, debug=debug),
        "specific_year": build_horoscope_scope(period_type="specific_year", kundali=kundali, reference_dt=specific_anchor, selected_year=specific_year, debug=debug),
        "specific_year_label": specific_year,
    }
    if debug:
        payload["debug"] = {
            "chartAnchors": {
                "lagna": kundali["lagna"],
                "moonSign": payload["natal"]["moon_sign"],
                "nakshatraLord": _nakshatra_lord(kundali["nakshatra"]),
            }
        }
    return payload
