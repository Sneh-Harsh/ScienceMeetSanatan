from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Tuple

import swisseph as swe

from .calculations import FLG, PLANETS, _dt_to_jd_ut, _rashi_index, _rashi_name, _sidereal_lon


PLANET_ORDER = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"]
BENEFICS = {"Jupiter", "Venus", "Mercury", "Moon"}
MALEFICS = {"Saturn", "Mars", "Rahu", "Ketu", "Sun"}
WEEKDAY_RULERS = {
    0: "Moon",
    1: "Mars",
    2: "Mercury",
    3: "Jupiter",
    4: "Venus",
    5: "Saturn",
    6: "Sun",
}
VEDIC_ASPECTS = {
    "Sun": (7,),
    "Moon": (7,),
    "Mercury": (7,),
    "Venus": (7,),
    "Mars": (4, 7, 8),
    "Jupiter": (5, 7, 9),
    "Saturn": (3, 7, 10),
    "Rahu": (5, 7, 9),
    "Ketu": (5, 7, 9),
}
TRANSIT_WEIGHTS = {
    "Sun": 1.0,
    "Moon": 1.35,
    "Mercury": 0.95,
    "Venus": 1.0,
    "Mars": 1.1,
    "Jupiter": 1.25,
    "Saturn": 1.3,
    "Rahu": 1.18,
    "Ketu": 1.08,
}


@dataclass(frozen=True)
class TransitPlanet:
    name: str
    symbol: str
    degree: float
    degree_in_sign: float
    speed: float
    retrograde: bool
    rashi_index: int
    rashi: str
    house_from_lagna: int
    house_from_moon: int


def _local_to_utc(dt_local: datetime) -> datetime:
    return dt_local.astimezone(timezone.utc)


def _calc_sidereal_with_speed(jd_ut: float, body: int) -> Tuple[float, float]:
    result = swe.calc_ut(jd_ut, body, FLG | swe.FLG_SPEED)[0]
    lon = float(result[0]) % 360.0
    speed = float(result[3]) if len(result) > 3 else 0.0
    return lon, speed


def get_current_transits(dt_local: datetime, natal_lagna_idx: int, natal_moon_idx: int) -> Dict[str, TransitPlanet]:
    dt_utc = _local_to_utc(dt_local)
    jd_ut = _dt_to_jd_ut(dt_utc)
    out: Dict[str, TransitPlanet] = {}
    for name, symbol, body in PLANETS:
        lon, speed = _calc_sidereal_with_speed(jd_ut, body)
        rashi_idx = _rashi_index(lon)
        out[name] = TransitPlanet(
            name=name,
            symbol=symbol,
            degree=lon,
            degree_in_sign=lon % 30.0,
            speed=speed,
            retrograde=speed < 0,
            rashi_index=rashi_idx,
            rashi=_rashi_name(rashi_idx),
            house_from_lagna=((rashi_idx - natal_lagna_idx) % 12) + 1,
            house_from_moon=((rashi_idx - natal_moon_idx) % 12) + 1,
        )

    rahu_lon, rahu_speed = _calc_sidereal_with_speed(jd_ut, swe.TRUE_NODE)
    rahu_idx = _rashi_index(rahu_lon)
    out["Rahu"] = TransitPlanet(
        name="Rahu",
        symbol="☊",
        degree=rahu_lon,
        degree_in_sign=rahu_lon % 30.0,
        speed=rahu_speed,
        retrograde=rahu_speed < 0,
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
        degree_in_sign=ketu_lon % 30.0,
        speed=rahu_speed,
        retrograde=rahu_speed < 0,
        rashi_index=ketu_idx,
        rashi=_rashi_name(ketu_idx),
        house_from_lagna=((ketu_idx - natal_lagna_idx) % 12) + 1,
        house_from_moon=((ketu_idx - natal_moon_idx) % 12) + 1,
    )
    return out


def aspect_targets(planet: str, source_house: int) -> List[int]:
    offsets = VEDIC_ASPECTS.get(planet, (7,))
    return [((source_house + offset - 2) % 12) + 1 for offset in offsets]


def weekday_ruler(dt_local: datetime) -> str:
    return WEEKDAY_RULERS.get(dt_local.weekday(), "Sun")


def transit_snapshot(transits: Dict[str, TransitPlanet]) -> Dict[str, Dict]:
    return {
        name: {
            "rashi": row.rashi,
            "degree": round(float(row.degree), 2),
            "houseFromLagna": row.house_from_lagna,
            "houseFromMoon": row.house_from_moon,
            "retrograde": bool(row.retrograde),
        }
        for name, row in transits.items()
    }


def transit_signature(transits: Dict[str, TransitPlanet], names: Iterable[str]) -> str:
    parts: List[str] = []
    for name in names:
        row = transits.get(name)
        if not row:
            continue
        parts.append(f"{name}:{row.house_from_lagna}:{int(row.degree_in_sign // 5)}")
    return "|".join(parts)
