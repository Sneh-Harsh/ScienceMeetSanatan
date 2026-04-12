from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Tuple

from .calculations import _dt_to_jd_ut, _parse_birth_datetime
from .horoscope_engine import _current_antardasha, _find_mahadasha, _transit_planets
from .wealth_alignment import (
    BENEFIC_PLANETS,
    DEBILITATION_SIGNS,
    FRIENDLY_SIGNS,
    MALEFIC_PLANETS,
    OWN_SIGNS,
    SIGN_LORDS,
    WEALTH_HOUSE_WEIGHTS,
    compute_planet_strength,
)


HOUSE_THEMES = {
    1: "Self, vitality, visibility, and how your presence meets the world.",
    2: "Savings, speech, family culture, and stored value.",
    3: "Execution, courage, communication, and skill-building.",
    4: "Inner peace, home, foundations, and emotional shelter.",
    5: "Creativity, intelligence, romance, and inspired risk.",
    6: "Work, discipline, healing, and friction that builds mastery.",
    7: "Partnerships, contracts, marriage, and mirrored lessons.",
    8: "Transformation, vulnerability, inheritance, and sudden shifts.",
    9: "Fortune, dharma, blessings, teachers, and higher direction.",
    10: "Career, public standing, duty, and visible contribution.",
    11: "Gains, networks, ambitions, and collective opportunities.",
    12: "Rest, release, spiritual retreat, expenses, and foreign spaces.",
}

PLANET_TONES = {
    "Sun": "authority, direction, leadership, and recognition",
    "Moon": "mood, adaptability, emotional tides, and belonging",
    "Mars": "drive, competition, courage, and sharp action",
    "Mercury": "analysis, trade, communication, and pattern recognition",
    "Jupiter": "wisdom, protection, opportunity, and expansion",
    "Venus": "love, comfort, aesthetics, agreement, and attraction",
    "Saturn": "discipline, karmic pressure, structure, and endurance",
    "Rahu": "amplification, appetite, disruption, and obsession",
    "Ketu": "detachment, inner refinement, intuition, and reduction",
}

PLANET_GLYPHS = {
    "Sun": "☉",
    "Moon": "☾",
    "Mars": "♂",
    "Mercury": "☿",
    "Jupiter": "♃",
    "Venus": "♀",
    "Saturn": "♄",
    "Rahu": "☊",
    "Ketu": "☋",
}

PLANET_STYLES = {
    "Sun": "sun",
    "Moon": "moon",
    "Mars": "mars",
    "Mercury": "mercury",
    "Jupiter": "jupiter",
    "Venus": "venus",
    "Saturn": "saturn",
    "Rahu": "rahu",
    "Ketu": "ketu",
}

SIGN_LABELS = {
    "Mesha": "Ar",
    "Vrishabha": "Ta",
    "Mithuna": "Ge",
    "Karka": "Cn",
    "Simha": "Le",
    "Kanya": "Vi",
    "Tula": "Li",
    "Vrischika": "Sc",
    "Dhanu": "Sg",
    "Makara": "Cp",
    "Kumbha": "Aq",
    "Meena": "Pi",
}

EXALTATION_SIGNS = {
    "Sun": 0,
    "Moon": 1,
    "Mars": 9,
    "Mercury": 5,
    "Jupiter": 3,
    "Venus": 11,
    "Saturn": 6,
    "Rahu": 1,
    "Ketu": 7,
}


def house_lords(kundali: Dict) -> Dict[int, str]:
    out: Dict[int, str] = {}
    for house in list(kundali.get("houses") or []):
        house_num = int(house.get("house") or 0)
        sign_index = int(house.get("rashi_index") or 0)
        out[house_num] = SIGN_LORDS.get(sign_index, "Mercury")
    return out


def planet_lookup(kundali: Dict) -> Dict[str, Dict]:
    return {str(planet.get("planet")): planet for planet in list(kundali.get("planets") or [])}


def format_degree(value: float) -> str:
    try:
        return f"{float(value):.2f}°"
    except Exception:
        return "—"


def dignity_tag(planet_name: str, sign_index: int) -> str:
    if sign_index == EXALTATION_SIGNS.get(planet_name):
        return "Exalted"
    if sign_index == DEBILITATION_SIGNS.get(planet_name):
        return "Debilitated"
    if sign_index in OWN_SIGNS.get(planet_name, set()):
        return "Own sign"
    if sign_index in FRIENDLY_SIGNS.get(planet_name, set()):
        return "Friendly"
    return "Neutral"


def current_dasha_context(kundali: Dict, dt_local: datetime) -> Dict[str, object]:
    dasha = list(kundali.get("dasha") or [])
    maha = _find_mahadasha(dasha, dt_local) or {}
    antara = _current_antardasha(maha, dt_local) if maha else {"planet": ""}
    return {
        "mahadasha": str(maha.get("planet") or ""),
        "antardasha": str(antara.get("planet") or ""),
        "current_mahadasha": maha,
        "current_antardasha": antara,
    }


def _transit_context(*, date_str: str, time_str: str, tz_name: str, kundali: Dict) -> Tuple[datetime, float, Dict[str, object]]:
    dt_local, _dt_utc, _birth_jd_ut, _ = _parse_birth_datetime(date_str=date_str, time_str=time_str, tz_name=tz_name)
    now_local = datetime.now(dt_local.tzinfo).replace(second=0, microsecond=0)
    current_jd_ut = _dt_to_jd_ut(now_local.astimezone(timezone.utc))
    natal_lagna_idx = next((int(h["rashi_index"]) for h in kundali["houses"] if int(h["house"]) == 1), 0)
    natal_moon = next((p for p in kundali["planets"] if p["planet"] == "Moon"), None)
    natal_moon_idx = int(natal_moon["rashi_index"]) if natal_moon else 0
    transits = _transit_planets(now_local, natal_lagna_idx, natal_moon_idx)
    return now_local, current_jd_ut, transits


def _aspect_targets(planet_name: str, house_num: int) -> List[int]:
    steps = [7]
    if planet_name == "Mars":
        steps.extend([4, 8])
    elif planet_name == "Jupiter":
        steps.extend([5, 9])
    elif planet_name == "Saturn":
        steps.extend([3, 10])
    elif planet_name in {"Rahu", "Ketu"}:
        steps.extend([5, 9])
    return [((house_num + step - 2) % 12) + 1 for step in steps]


def _house_aspects(kundali: Dict) -> Dict[int, List[Dict[str, str]]]:
    aspects = {house: [] for house in range(1, 13)}
    for planet in list(kundali.get("planets") or []):
        house_num = int(planet.get("house") or 0)
        name = str(planet.get("planet") or "")
        if not house_num or not name:
            continue
        for target in _aspect_targets(name, house_num):
            aspects[target].append({"planet": name, "tone": "support" if name in BENEFIC_PLANETS else "pressure"})
    return aspects


def build_kundali_experience(*, date_str: str, time_str: str, lat: float, lon: float, tz_name: str, kundali: Dict) -> Dict:
    now_local, current_jd_ut, transits = _transit_context(date_str=date_str, time_str=time_str, tz_name=tz_name, kundali=kundali)
    dasha = current_dasha_context(kundali, now_local)
    planets = planet_lookup(kundali)
    lords = house_lords(kundali)
    aspects = _house_aspects(kundali)
    strengths = {
        planet: compute_planet_strength(planet, kundali, transits, dasha, current_jd_ut)
        for planet in ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"]
    }

    house_details = {}
    heatmap: List[Dict] = []
    for house in list(kundali.get("houses") or []):
        house_num = int(house.get("house") or 0)
        sign = str(house.get("rashi") or "—")
        sign_idx = int(house.get("rashi_index") or 0)
        ruler = lords.get(house_num, "Mercury")
        occupants = [planets.get(name) for name in list(house.get("planets") or []) if planets.get(name)]
        aspect_rows = aspects.get(house_num, [])
        support_count = sum(1 for row in aspect_rows if row["tone"] == "support") + sum(1 for row in occupants if str(row.get("planet")) in BENEFIC_PLANETS)
        pressure_count = sum(1 for row in aspect_rows if row["tone"] == "pressure") + sum(1 for row in occupants if str(row.get("planet")) in MALEFIC_PLANETS)
        tags: List[str] = []
        if occupants:
            tags.append("occupied")
        elif aspect_rows:
            tags.append("empty but aspected")
        if support_count and not pressure_count:
            tags.append("benefic influence")
        elif pressure_count and not support_count:
            tags.append("malefic pressure")
        elif support_count and pressure_count:
            tags.append("mixed results")
        house_score = 26.0
        if occupants:
            house_score += sum(strengths.get(str(row.get("planet")), 50.0) for row in occupants) / max(len(occupants), 1) * 0.32
        house_score += strengths.get(ruler, 50.0) * 0.44
        if dasha["mahadasha"] == ruler:
            house_score += 12.0
        if dasha["antardasha"] == ruler:
            house_score += 8.0
        for transit in transits.values():
            transit_house = int(getattr(transit, "house_from_lagna", 0) or 0)
            if transit_house == house_num:
                planet_name = str(getattr(transit, "name", "") or "")
                house_score += 6.0 if planet_name in BENEFIC_PLANETS else -4.0
        house_score = max(8.0, min(100.0, house_score))
        tone = "quiet"
        if house_score >= 72:
            tone = "support"
        elif house_score >= 54:
            tone = "active"
        elif pressure_count >= support_count + 1:
            tone = "stress"
        heatmap.append(
            {
                "house": house_num,
                "score": round(house_score, 1),
                "tone": tone,
                "label": HOUSE_THEMES[house_num],
            }
        )
        house_details[str(house_num)] = {
            "house": house_num,
            "sign": sign,
            "signLabel": SIGN_LABELS.get(sign, sign[:2]),
            "signRuler": ruler,
            "theme": HOUSE_THEMES[house_num],
            "tags": tags,
            "supportiveAspects": [row["planet"] for row in aspect_rows if row["tone"] == "support"],
            "pressuringAspects": [row["planet"] for row in aspect_rows if row["tone"] == "pressure"],
            "planets": [
                {
                    "planet": str(row.get("planet")),
                    "glyph": PLANET_GLYPHS.get(str(row.get("planet")), ""),
                    "style": PLANET_STYLES.get(str(row.get("planet")), "neutral"),
                    "sign": str(row.get("rashi") or "—"),
                    "house": int(row.get("house") or 0),
                    "degree": format_degree(row.get("degree_in_sign")),
                    "dignity": dignity_tag(str(row.get("planet")), int(row.get("rashi_index") or sign_idx)),
                    "strength": round(strengths.get(str(row.get("planet")), 50.0), 1),
                }
                for row in occupants
            ],
        }

    sorted_planets = sorted(strengths.items(), key=lambda item: item[1], reverse=True)
    supportive = []
    pressurizing = []
    for name, score in sorted_planets[:4]:
        row = planets.get(name) or {}
        supportive.append(
            {
                "planet": name,
                "glyph": PLANET_GLYPHS.get(name, ""),
                "style": PLANET_STYLES.get(name, "neutral"),
                "score": round(score, 1),
                "house": int(row.get("house") or 0),
                "sign": str(row.get("rashi") or "—"),
                "reason": f"{name} is currently carrying cleaner dignity or dasha support in your chart.",
            }
        )
    for name, score in sorted(sorted_planets[-3:], key=lambda item: item[1]):
        row = planets.get(name) or {}
        pressurizing.append(
            {
                "planet": name,
                "glyph": PLANET_GLYPHS.get(name, ""),
                "style": PLANET_STYLES.get(name, "neutral"),
                "score": round(100.0 - score, 1),
                "house": int(row.get("house") or 0),
                "sign": str(row.get("rashi") or "—"),
                "reason": f"{name} is asking for more discipline because its natal position is carrying pressure now.",
            }
        )

    lagna_house = next((h for h in list(kundali.get("houses") or []) if int(h.get("house") or 0) == 1), {})
    lagna_lord = lords.get(1, "Sun")
    stability_score = round(
        max(
            18.0,
            min(
                98.0,
                (strengths.get(lagna_lord, 50.0) * 0.38)
                + (strengths.get("Jupiter", 50.0) * 0.22)
                + (strengths.get("Venus", 50.0) * 0.16)
                + (60.0 if int(lagna_house.get("house") or 1) == 1 else 48.0) * 0.24,
            ),
        ),
        1,
    )
    sensitivity_score = round(
        max(
            12.0,
            min(
                96.0,
                100.0
                - (
                    (strengths.get("Saturn", 50.0) * 0.18)
                    + (strengths.get("Mars", 50.0) * 0.12)
                    + (strengths.get("Rahu", 50.0) * 0.18)
                    + (strengths.get(dasha["mahadasha"], 50.0) * 0.28)
                    + (strengths.get(dasha["antardasha"], 50.0) * 0.24)
                ),
            ),
        ),
        1,
    )

    dasha_list = list(kundali.get("dasha") or [])
    current_maha = dasha.get("current_mahadasha") or {}
    current_index = next((idx for idx, item in enumerate(dasha_list) if str(item.get("planet")) == str(current_maha.get("planet")) and str(item.get("start")) == str(current_maha.get("start"))), 0)
    fading = dasha_list[current_index - 1] if current_index > 0 else None
    next_shift = dasha_list[current_index + 1] if current_index + 1 < len(dasha_list) else None

    return {
        "house_details": house_details,
        "planetary_climate": {
            "supportive": supportive,
            "pressurizing": pressurizing,
            "stability_score": stability_score,
            "sensitivity_score": sensitivity_score,
            "summary": f"{dasha['mahadasha']} Mahadasha with {dasha['antardasha']} Antardasha is lighting up the houses of {HOUSE_THEMES.get(int((planets.get(dasha['mahadasha']) or {}).get('house') or 1), 'personal activation').lower()} while keeping your chart in a {('stable' if stability_score >= 65 else 'sensitive')} state.",
        },
        "house_heatmap": heatmap,
        "phase_shift": {
            "fading": str((fading or {}).get("planet") or "Previous cycle"),
            "active": str(current_maha.get("planet") or dasha["mahadasha"] or "Current cycle"),
            "next": str((next_shift or {}).get("planet") or "Future cycle"),
            "transition_date": str((next_shift or {}).get("start") or ""),
        },
    }
