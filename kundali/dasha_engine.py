from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List

from .calculations import VIMSHOTTARI_ORDER, VIMSHOTTARI_YEARS, _parse_birth_datetime
from .experience_engine import HOUSE_THEMES, PLANET_TONES, current_dasha_context, house_lords, planet_lookup


def _age_in_years(start: datetime, dt_local: datetime) -> float:
    return max((start - dt_local).days / 365.2425, 0.0)


def _birth_dt(date_str: str, time_str: str, tz_name: str) -> datetime:
    dt_local, _dt_utc, _birth_jd_ut, _ = _parse_birth_datetime(date_str=date_str, time_str=time_str, tz_name=tz_name)
    return dt_local


def _ruled_houses(planet_name: str, lords: Dict[int, str]) -> List[int]:
    return [house for house, lord in lords.items() if lord == planet_name]


def _antardashas(maha: Dict) -> List[Dict]:
    maha_name = str(maha.get("planet") or "")
    if maha_name not in VIMSHOTTARI_ORDER:
        return []
    start = datetime.fromisoformat(str(maha.get("start")))
    end = datetime.fromisoformat(str(maha.get("end")))
    total_seconds = max((end - start).total_seconds(), 1.0)
    order_start = VIMSHOTTARI_ORDER.index(maha_name)
    order = VIMSHOTTARI_ORDER[order_start:] + VIMSHOTTARI_ORDER[:order_start]
    out: List[Dict] = []
    cursor = start
    for planet in order:
        fraction = (VIMSHOTTARI_YEARS[planet] / 120.0)
        duration = total_seconds * fraction
        next_cursor = cursor + timedelta(seconds=duration)
        out.append(
            {
                "planet": planet,
                "start": cursor.isoformat(timespec="seconds"),
                "end": next_cursor.isoformat(timespec="seconds"),
                "years": round((next_cursor - cursor).days / 365.2425, 2),
            }
        )
        cursor = next_cursor
    if out:
        out[-1]["end"] = end.isoformat(timespec="seconds")
        out[-1]["years"] = round((end - datetime.fromisoformat(str(out[-1]["start"]))).days / 365.2425, 2)
    return out


def _summary_for_period(planet_name: str, sub_name: str, kundali: Dict) -> Dict:
    planets = planet_lookup(kundali)
    lords = house_lords(kundali)
    planet_row = planets.get(planet_name) or {}
    sub_row = planets.get(sub_name) or {}
    planet_house = int(planet_row.get("house") or 1)
    sub_house = int(sub_row.get("house") or planet_house)
    ruled = _ruled_houses(planet_name, lords)
    sub_ruled = _ruled_houses(sub_name, lords)
    period_tone = f"{planet_name} is foregrounding {PLANET_TONES.get(planet_name, 'core themes')} through house {planet_house}."
    return {
        "headline": f"{planet_name} period with {sub_name} sub-cycle",
        "periodTone": period_tone,
        "growthThemes": [
            f"Growth comes through house {planet_house}: {HOUSE_THEMES.get(planet_house, 'life experience')}",
            f"Ruled houses {', '.join(str(h) for h in ruled) if ruled else '—'} become more visible.",
        ],
        "pressureThemes": [
            f"{sub_name} can intensify house {sub_house} matters: {HOUSE_THEMES.get(sub_house, 'current pressure')}",
            f"Watch how ruled houses {', '.join(str(h) for h in sub_ruled) if sub_ruled else '—'} ask for balance.",
        ],
        "relationships": f"Relationship dynamics improve when {planet_name.lower()} themes are expressed with maturity, not urgency.",
        "career": f"Career direction is shaped by how house {planet_house} translates into visible action and responsibility.",
        "money": f"Money flow follows the houses ruled by {planet_name}; steadier results come from planning, not force.",
        "health": f"Energy rises when {sub_name.lower()} is not overdriven. Rhythm matters more than intensity in this period.",
        "spiritualTheme": f"{planet_name} asks for refinement through {PLANET_TONES.get(planet_name, 'inner work')}.",
        "caution": f"Do not let the pressure of house {sub_house} make every decision reactive.",
        "advice": f"Work with the clean side of {planet_name}: timing, discipline, and conscious repetition.",
    }


def build_dasha_experience(*, date_str: str, time_str: str, tz_name: str, kundali: Dict) -> Dict:
    birth_dt = _birth_dt(date_str, time_str, tz_name)
    now_dt = datetime.now(birth_dt.tzinfo).replace(second=0, microsecond=0)
    dasha_list = list(kundali.get("dasha") or [])
    current = current_dasha_context(kundali, now_dt)
    current_maha = current.get("current_mahadasha") or {}
    current_antardasha = current.get("current_antardasha") or {}

    timeline = []
    for maha in dasha_list[:9]:
        start = datetime.fromisoformat(str(maha.get("start")))
        end = datetime.fromisoformat(str(maha.get("end")))
        age_start = round(_age_in_years(start, birth_dt), 1)
        age_end = round(_age_in_years(end, birth_dt), 1)
        summary = _summary_for_period(str(maha.get("planet") or ""), str(current_antardasha.get("planet") or maha.get("planet") or ""), kundali)
        timeline.append(
            {
                "planet": str(maha.get("planet") or ""),
                "start": str(maha.get("start") or ""),
                "end": str(maha.get("end") or ""),
                "years": float(maha.get("years") or 0),
                "ageStart": age_start,
                "ageEnd": age_end,
                "isCurrent": str(maha.get("planet") or "") == str(current_maha.get("planet") or "") and str(maha.get("start") or "") == str(current_maha.get("start") or ""),
                "summary": summary,
            }
        )

    maha_antardashas = _antardashas(current_maha) if current_maha else []
    current_sub = next(
        (
            item
            for item in maha_antardashas
            if datetime.fromisoformat(str(item.get("start"))) <= now_dt <= datetime.fromisoformat(str(item.get("end")))
        ),
        maha_antardashas[0] if maha_antardashas else {},
    )
    current_summary = _summary_for_period(
        str(current_maha.get("planet") or ""),
        str(current_sub.get("planet") or current_antardasha.get("planet") or current_maha.get("planet") or ""),
        kundali,
    )

    return {
        "current_mahadasha": current_maha,
        "current_antardasha": current_sub,
        "current_summary": current_summary,
        "timeline": timeline,
        "timeline_caption": "Your Vimshottari sequence translated into a living timing instrument.",
        "why_now": f"This phase feels the way it does because {current_maha.get('planet') or 'the current Mahadasha lord'} is setting the life direction while {current_sub.get('planet') or current_antardasha.get('planet') or 'the active sub-period'} decides the immediate texture.",
    }
