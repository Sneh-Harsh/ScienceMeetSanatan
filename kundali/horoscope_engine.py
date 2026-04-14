from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from .calculations import build_kundali
from .live_horoscope_engine import (
    _current_antardasha as _live_current_antardasha,
    _find_mahadasha as _live_find_mahadasha,
    build_personalized_horoscope,
)
from .transit_engine import TransitPlanet, get_current_transits
from .wealth_alignment import build_wealth_alignment


def _transit_planets(dt_local: datetime, natal_lagna_idx: int, natal_moon_idx: int) -> Dict[str, TransitPlanet]:
    return get_current_transits(dt_local, natal_lagna_idx, natal_moon_idx)


def _find_mahadasha(dasha: List[Dict], target_local: datetime) -> Optional[Dict]:
    return _live_find_mahadasha(dasha, target_local)


def _current_antardasha(mahadasha: Dict, target_local: datetime) -> Dict:
    state = _live_current_antardasha(mahadasha, target_local)
    return {"planet": state.antardasha}


def build_horoscope(*, date_str: str, time_str: str, lat: float, lon: float, tz_name: str, specific_year: int = 2026, debug: bool = False) -> Dict:
    kundali = build_kundali(date_str=date_str, time_str=time_str, lat=lat, lon=lon, tz_name=tz_name)
    payload = build_personalized_horoscope(
        date_str=date_str,
        time_str=time_str,
        lat=lat,
        lon=lon,
        tz_name=tz_name,
        specific_year=specific_year,
        debug=debug,
        kundali=kundali,
    )
    payload["wealth_alignment"] = build_wealth_alignment(
        date_str=date_str,
        time_str=time_str,
        lat=lat,
        lon=lon,
        tz_name=tz_name,
        kundali=kundali,
        horoscope=payload,
    )
    return payload
