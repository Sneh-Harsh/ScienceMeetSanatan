from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Tuple

import swisseph as swe

from .calculations import FLG, PLANETS, _dt_to_jd_ut, _parse_birth_datetime, _sidereal_lon


WEALTH_HOUSE_WEIGHTS = {
    2: 1.15,
    5: 1.25,
    8: 0.95,
    9: 1.10,
    10: 1.10,
    11: 1.30,
    12: 0.80,
}

SIGN_LORDS = {
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

DEBILITATION_SIGNS = {
    "Sun": 6,
    "Moon": 7,
    "Mars": 3,
    "Mercury": 11,
    "Jupiter": 9,
    "Venus": 5,
    "Saturn": 0,
    "Rahu": 7,
    "Ketu": 1,
}

OWN_SIGNS = {
    "Sun": {4},
    "Moon": {3},
    "Mars": {0, 7},
    "Mercury": {2, 5},
    "Jupiter": {8, 11},
    "Venus": {1, 6},
    "Saturn": {9, 10},
    "Rahu": {10},
    "Ketu": {7},
}

FRIENDLY_SIGNS = {
    "Sun": {0, 8, 9},
    "Moon": {0, 1, 8},
    "Mars": {4, 3, 8, 11},
    "Mercury": {1, 6},
    "Jupiter": {0, 3, 4, 7},
    "Venus": {2, 9, 10},
    "Saturn": {1, 2, 5, 6},
    "Rahu": {2, 5, 10},
    "Ketu": {7, 8, 11},
}

MALEFIC_PLANETS = {"Mars", "Saturn", "Rahu", "Ketu"}
BENEFIC_PLANETS = {"Jupiter", "Venus", "Mercury", "Moon"}
WEALTH_HOUSES = {2, 5, 9, 10, 11}
LEAKAGE_HOUSES = {8, 12}

INDUSTRY_MAP = {
    "Government Infrastructure": {
        "planets": ["Sun", "Saturn"],
        "houses": [9, 10, 11],
        "rationale": "Government and public-sector work suits you when Sun and Saturn are strong.",
    },
    "Energy & Utilities": {
        "planets": ["Sun", "Saturn", "Mars"],
        "houses": [10, 11, 2],
        "rationale": "Power, oil and energy businesses suit you when Sun, Saturn and Mars are strong.",
    },
    "Consumer Staples & FMCG": {
        "planets": ["Moon", "Venus"],
        "houses": [2, 4, 11],
        "rationale": "Everyday-need businesses (food, household goods) suit you when Moon and Venus are strong.",
    },
    "Hospitality & Travel": {
        "planets": ["Moon", "Venus"],
        "houses": [4, 7, 11, 12],
        "rationale": "Hotels, travel and tourism suit you when Venus and Moon are strong.",
    },
    "Defense & Industrials": {
        "planets": ["Mars", "Saturn", "Sun"],
        "houses": [6, 10, 11],
        "rationale": "Defence and heavy industry suit you when Mars, Saturn and Sun are strong.",
    },
    "Metals, Mining & Materials": {
        "planets": ["Mars", "Saturn"],
        "houses": [8, 10, 11],
        "rationale": "Metals, mining and raw materials suit you when Mars and Saturn are strong.",
    },
    "Financial Services & Brokerage": {
        "planets": ["Mercury", "Jupiter"],
        "houses": [2, 5, 11],
        "rationale": "Broking and financial services suit you when Mercury and Jupiter are strong.",
    },
    "Fintech & Software": {
        "planets": ["Mercury", "Rahu"],
        "houses": [3, 5, 10, 11],
        "rationale": "Software and fintech suit you when Mercury and Rahu are strong.",
    },
    "Banking, Insurance & Asset Management": {
        "planets": ["Jupiter", "Mercury"],
        "houses": [2, 9, 11],
        "rationale": "Banks, insurance and asset management suit you when Jupiter and Mercury are strong.",
    },
    "Education & Knowledge Platforms": {
        "planets": ["Jupiter", "Mercury"],
        "houses": [5, 9, 10],
        "rationale": "Education and online learning suit you when Jupiter and Mercury are strong.",
    },
    "Luxury, Beauty & Lifestyle": {
        "planets": ["Venus", "Moon"],
        "houses": [2, 5, 7, 11],
        "rationale": "Beauty, fashion and lifestyle businesses suit you when Venus and Moon are strong.",
    },
    "Media & Entertainment": {
        "planets": ["Venus", "Mercury", "Rahu"],
        "houses": [3, 5, 7, 11],
        "rationale": "Media and entertainment suit you when Venus, Mercury and Rahu are strong.",
    },
    "Infrastructure, Logistics & Cement": {
        "planets": ["Saturn", "Mercury"],
        "houses": [3, 10, 11],
        "rationale": "Infrastructure and logistics need Saturn's patience and Mercury's planning.",
    },
    "AI, Internet & Emerging Tech": {
        "planets": ["Rahu", "Mercury", "Mars"],
        "houses": [5, 8, 10, 11],
        "rationale": "AI and new-age internet businesses suit you when Rahu, Mercury and Mars are strong.",
    },
    "EV & Advanced Mobility": {
        "planets": ["Rahu", "Mars", "Saturn"],
        "houses": [3, 8, 10, 11],
        "rationale": "Electric vehicles and new mobility need Mars's drive plus Saturn's patience.",
    },
    "Pharma Research & Diagnostics": {
        "planets": ["Ketu", "Sun", "Mercury"],
        "houses": [6, 8, 10],
        "rationale": "Pharma, research and diagnostics suit you when Ketu, Sun and Mercury are strong.",
    },
    "Cybersecurity & Deep Tech": {
        "planets": ["Ketu", "Rahu", "Mercury"],
        "houses": [8, 10, 11],
        "rationale": "Cyber-security and deep-tech suit you when Ketu, Rahu and Mercury are strong.",
    },
}


def _normalize_score(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def _planet_lookup(kundali: Dict) -> Dict[str, Dict]:
    return {str(row.get("planet")): row for row in list(kundali.get("planets") or [])}


def _house_lookup(kundali: Dict) -> Dict[int, Dict]:
    return {int(row.get("house")): row for row in list(kundali.get("houses") or [])}


def _house_lords(kundali: Dict) -> Dict[int, str]:
    lords: Dict[int, str] = {}
    for house in list(kundali.get("houses") or []):
        house_num = int(house.get("house") or 0)
        sign_index = int(house.get("rashi_index") or 0)
        lords[house_num] = SIGN_LORDS.get(sign_index, "Mercury")
    return lords


def _planet_speeds(jd_ut: float) -> Dict[str, float]:
    speeds: Dict[str, float] = {}
    for name, _symbol, body in PLANETS:
        try:
            speeds[name] = float(swe.calc_ut(jd_ut, body, FLG)[0][3])
        except Exception:
            speeds[name] = 0.0
    try:
        speeds["Rahu"] = float(swe.calc_ut(jd_ut, swe.TRUE_NODE, FLG)[0][3])
    except Exception:
        speeds["Rahu"] = 0.0
    speeds["Ketu"] = -speeds["Rahu"]
    return speeds


def _dignity_score(planet: str, sign_index: int) -> float:
    if sign_index == EXALTATION_SIGNS.get(planet):
        return 94.0
    if sign_index == DEBILITATION_SIGNS.get(planet):
        return 28.0
    if sign_index in OWN_SIGNS.get(planet, set()):
        return 84.0
    if sign_index in FRIENDLY_SIGNS.get(planet, set()):
        return 69.0
    return 56.0


def _aspect_bonus(planet: str, target_house: int, planets: Dict[str, Dict]) -> float:
    bonus = 0.0
    for other_name, other in planets.items():
        if other_name == planet:
            continue
        other_house = int(other.get("house") or 0)
        distance = ((other_house - target_house) % 12) + 1
        if distance in {1, 7}:
            bonus += 4.0 if other_name in BENEFIC_PLANETS else -4.0
        elif distance in {5, 9}:
            bonus += 3.0 if other_name in BENEFIC_PLANETS else -2.5
        elif distance in {4, 8}:
            bonus += -3.0 if other_name in MALEFIC_PLANETS else 1.5
    return bonus


def _conjunction_bonus(planet: str, planets: Dict[str, Dict]) -> float:
    row = planets.get(planet) or {}
    degree = float(row.get("degree") or 0.0)
    house = int(row.get("house") or 0)
    bonus = 0.0
    for other_name, other in planets.items():
        if other_name == planet or int(other.get("house") or 0) != house:
            continue
        diff = abs(float(other.get("degree") or 0.0) - degree)
        if diff > 180.0:
            diff = 360.0 - diff
        if diff <= 8.0:
            bonus += 5.0 if other_name in BENEFIC_PLANETS else -4.0
    return bonus


def _house_weight(house: int) -> float:
    if house in WEALTH_HOUSES:
        return 10.0
    if house in LEAKAGE_HOUSES:
        return -8.0
    if house in {1, 3, 4, 6, 7}:
        return 2.5
    return 0.0


def _lordship_weight(planet: str, house_lords: Dict[int, str]) -> float:
    score = 0.0
    for house, lord in house_lords.items():
        if lord != planet:
            continue
        multiplier = WEALTH_HOUSE_WEIGHTS.get(house)
        if multiplier:
            score += (multiplier - 1.0) * 60.0
    return score


def _transit_support_weight(planet: str, transits: Dict[str, object]) -> float:
    row = transits.get(planet)
    if not row:
        return 0.0
    house_lagna = int(getattr(row, "house_from_lagna", 0) or 0)
    house_moon = int(getattr(row, "house_from_moon", 0) or 0)
    bonus = 0.0
    if house_lagna in WEALTH_HOUSES:
        bonus += 6.0
    if house_lagna in LEAKAGE_HOUSES:
        bonus -= 5.0
    if house_moon in {2, 5, 9, 11}:
        bonus += 4.0
    if house_moon in {8, 12}:
        bonus -= 3.0
    return bonus


def compute_planet_strength(planet: str, kundali: Dict, transits: Dict[str, object], dasha: Dict[str, str], transit_jd_ut: float) -> float:
    planets = _planet_lookup(kundali)
    row = planets.get(planet)
    if not row:
        return 45.0

    sign_index = int(row.get("rashi_index") or 0)
    house = int(row.get("house") or 0)
    house_lords = _house_lords(kundali)
    speeds = _planet_speeds(transit_jd_ut)

    score = _dignity_score(planet, sign_index)
    score += _house_weight(house)
    score += _lordship_weight(planet, house_lords)
    score += _aspect_bonus(planet, house, planets)
    score += _conjunction_bonus(planet, planets)
    if speeds.get(planet, 0.0) < 0:
        score -= 3.5 if planet in {"Mercury", "Venus", "Mars", "Jupiter", "Saturn"} else 1.5
    if dasha.get("mahadasha") == planet:
        score += 11.0
    if dasha.get("antardasha") == planet:
        score += 8.0
    score += _transit_support_weight(planet, transits)
    return round(_normalize_score(score), 1)


def _wealth_house_support(kundali: Dict, relevant_houses: List[int]) -> float:
    house_lords = _house_lords(kundali)
    planets = _planet_lookup(kundali)
    boost = 0.0
    for house in relevant_houses:
        multiplier = WEALTH_HOUSE_WEIGHTS.get(house, 1.0)
        lord = house_lords.get(house)
        lord_house = int((planets.get(lord) or {}).get("house") or 0)
        boost += (multiplier - 1.0) * 26.0
        if lord_house in WEALTH_HOUSES:
            boost += 4.0
        if lord_house in LEAKAGE_HOUSES:
            boost -= 5.0
    return boost


def _leakage_penalty(kundali: Dict, dasha: Dict[str, str]) -> Tuple[float, List[str]]:
    planets = _planet_lookup(kundali)
    house_lords = _house_lords(kundali)
    signals: List[str] = []
    penalty = 0.0

    fifth_lord = house_lords.get(5)
    eighth_lord = house_lords.get(8)
    twelfth_lord = house_lords.get(12)
    fifth_row = planets.get(fifth_lord) or {}
    eighth_row = planets.get(eighth_lord) or {}
    twelfth_row = planets.get(twelfth_lord) or {}

    if int(fifth_row.get("house") or 0) in LEAKAGE_HOUSES:
        penalty += 10.0
        signals.append("Speculation is under pressure, so avoid risky bets.")
    if int(eighth_row.get("house") or 0) in {8, 12}:
        penalty += 8.0
        signals.append("Sudden ups and downs are likely.")
    if int(twelfth_row.get("house") or 0) == 12:
        penalty += 6.0
        signals.append("Spending needs control.")
    if dasha.get("mahadasha") in {"Rahu", "Ketu", "Mars"} or dasha.get("antardasha") in {"Rahu", "Ketu", "Mars"}:
        penalty += 7.0
        signals.append("Your running Dasha favours quick changes over slow, steady growth.")
    return penalty, signals


def compute_sector_scores(kundali: Dict, transits: Dict[str, object], dasha: Dict[str, str], current_scores: Dict[str, int], transit_jd_ut: float) -> Tuple[List[Dict], List[Dict], Dict]:
    planets = _planet_lookup(kundali)
    house_lords = _house_lords(kundali)
    planet_strengths = {
        planet: compute_planet_strength(planet, kundali, transits, dasha, transit_jd_ut)
        for planet in ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"]
    }

    leakage_penalty, caution_signals = _leakage_penalty(kundali, dasha)
    sector_rows: List[Dict] = []

    for name, config in INDUSTRY_MAP.items():
        related_planets = config["planets"]
        base = sum(planet_strengths.get(planet, 50.0) for planet in related_planets) / max(len(related_planets), 1)
        house_support = _wealth_house_support(kundali, config["houses"])
        dasha_support = sum(7.5 for planet in related_planets if planet in {dasha["mahadasha"], dasha["antardasha"]})
        transit_support = sum(_transit_support_weight(planet, transits) for planet in related_planets) / max(len(related_planets), 1)
        familiarity_boost = 6.0 if any(int((planets.get(house_lords.get(h)) or {}).get("house") or 0) == 10 for h in config["houses"]) else 0.0
        score = base + house_support + dasha_support + transit_support + familiarity_boost
        if any(house in LEAKAGE_HOUSES for house in config["houses"]):
            score -= leakage_penalty * 0.45
        if any(planet in {"Rahu", "Mars"} for planet in related_planets) and leakage_penalty >= 12:
            score -= 6.0
        if current_scores.get("finance", 50) < 45:
            score -= 4.5
        if current_scores.get("career", 50) > 65 and 10 in config["houses"]:
            score += 3.5
        sector_rows.append(
            {
                "name": name,
                "score": round(_normalize_score(score), 1),
                "rationale": config["rationale"],
                "planets": related_planets,
            }
        )

    ranked = sorted(sector_rows, key=lambda row: row["score"], reverse=True)
    recommended = ranked[:5]
    caution = list(reversed(ranked[-4:]))

    supportive_houses = [house for house, lord in house_lords.items() if int((planets.get(lord) or {}).get("house") or 0) in WEALTH_HOUSES]
    return recommended, caution, {
        "planetStrengths": planet_strengths,
        "supportiveHouses": supportive_houses,
        "cautionSignals": caution_signals,
    }


def _risk_style(recommended: List[Dict], planet_strengths: Dict[str, float], kundali: Dict, current_scores: Dict[str, int], dasha: Dict[str, str]) -> Tuple[str, str]:
    planets = _planet_lookup(kundali)
    house_lords = _house_lords(kundali)
    fifth_lord = house_lords.get(5)
    eighth_lord = house_lords.get(8)
    fifth_strength = planet_strengths.get(fifth_lord, 50.0)
    eighth_strength = planet_strengths.get(eighth_lord, 50.0)
    jupiter = planet_strengths.get("Jupiter", 50.0)
    saturn = planet_strengths.get("Saturn", 50.0)
    mercury = planet_strengths.get("Mercury", 50.0)
    mars = planet_strengths.get("Mars", 50.0)
    rahu = planet_strengths.get("Rahu", 50.0)

    if jupiter >= 68 and saturn >= 58 and current_scores.get("finance", 50) >= 55 and fifth_strength < 60:
        return "Conservative", "Jupiter and Saturn are steady in your chart, so slow and safe investing suits you."
    if mars >= 66 and rahu >= 64 and mercury >= 60 and eighth_strength >= 58 and current_scores.get("finance", 50) >= 55:
        return "Aggressive", "Mars and Rahu are strong in your chart, so you can take more risk, but set strict limits."
    return "Balanced", "Your chart supports a mix of safe and growth investments, so choose carefully."


def _holding_style(risk_style: str, planet_strengths: Dict[str, float], kundali: Dict, dasha: Dict[str, str], caution_signals: List[str]) -> str:
    house_lords = _house_lords(kundali)
    fifth_strength = planet_strengths.get(house_lords.get(5), 50.0)
    eighth_strength = planet_strengths.get(house_lords.get(8), 50.0)
    wealth_pressure = sum(1 for signal in caution_signals if signal)

    if fifth_strength < 48 or eighth_strength < 46 or wealth_pressure >= 2 or dasha.get("mahadasha") in {"Rahu", "Ketu"}:
        return "Avoid direct speculation now"
    if risk_style == "Conservative":
        return "Long-term accumulation"
    if risk_style == "Aggressive":
        return "Tactical / high-volatility only"
    return "Medium-term trend"


def _timing_quality(current_scores: Dict[str, int], recommended: List[Dict], caution_signals: List[str]) -> str:
    average = (current_scores.get("career", 50) + current_scores.get("finance", 50) + current_scores.get("health", 50)) / 3.0
    if average >= 68 and recommended and recommended[0]["score"] >= 72 and len(caution_signals) <= 1:
        return "Strong window"
    if average >= 54 and recommended and recommended[0]["score"] >= 60:
        return "Selective window"
    return "Cautious window"


def _archetype(risk_style: str, recommended: List[Dict], planet_strengths: Dict[str, float]) -> str:
    top_names = {row["name"] for row in recommended[:2]}
    if risk_style == "Conservative":
        return "Wealth Preserver"
    if risk_style == "Aggressive" and any("AI" in name or "EV" in name or "Fintech" in name for name in top_names):
        return "Growth-Tech Investor"
    if any("Luxury" in name or "Consumer" in name or "Hospitality" in name for name in top_names):
        return "Lifestyle & Consumer Investor"
    if planet_strengths.get("Mercury", 50.0) >= 66 and planet_strengths.get("Jupiter", 50.0) >= 62:
        return "Analytical Investor"
    if planet_strengths.get("Mars", 50.0) >= 64 or planet_strengths.get("Saturn", 50.0) >= 66:
        return "Bold Risk-Taker"
    return "Value Builder"


def _confidence_bucket(score: float) -> str:
    if score >= 74:
        return "High"
    if score >= 58:
        return "Moderate"
    return "Cautious"


def _style_meter(label: str) -> int:
    mapping = {
        "Conservative": 32,
        "Balanced": 58,
        "Aggressive": 82,
    }
    return mapping.get(label, 58)


def _timing_meter(label: str) -> int:
    mapping = {
        "Strong window": 78,
        "Selective window": 56,
        "Cautious window": 34,
    }
    return mapping.get(label, 50)


def _wealth_pulse(current_scores: Dict[str, int], confidence_score: float, timing_quality: str, holding_style: str) -> List[Dict]:
    finance = float(current_scores.get("finance", 50))
    career = float(current_scores.get("career", 50))
    health = float(current_scores.get("health", 50))
    conviction = round((finance * 0.45) + (career * 0.35) + (confidence_score * 0.20), 1)
    volatility = round(max(100.0 - confidence_score, 0.0) * 0.7 + max(60.0 - health, 0.0) * 0.3, 1)
    patience = round((confidence_score * 0.35) + (career * 0.25) + (65.0 if "Long-term" in holding_style else 48.0), 1)
    timing = float(_timing_meter(timing_quality))
    return [
        {"label": "Conviction", "score": _normalize_score(conviction), "tone": "gold"},
        {"label": "Timing", "score": _normalize_score(timing), "tone": "blue"},
        {"label": "Patience", "score": _normalize_score(patience), "tone": "copper"},
        {"label": "Volatility", "score": _normalize_score(volatility), "tone": "soft"},
    ]


def _action_points(recommended: List[Dict], caution: List[Dict], holding_style: str, timing_quality: str) -> List[str]:
    points: List[str] = []
    if recommended:
        points.append(f"Start your research with {recommended[0]['name']}, then compare it with {recommended[1]['name'] if len(recommended) > 1 else 'one more sector'}.")
    if holding_style == "Avoid direct speculation now":
        points.append("Invest in small steps (like a SIP) instead of one big entry until the signs improve.")
    elif holding_style == "Long-term accumulation":
        points.append("Build your holdings slowly and avoid switching often.")
    else:
        points.append("Decide your entry and exit in advance; careful choices beat impulse in this period.")
    if caution:
        points.append(f"Keep your exposure small in {caution[0]['name']} for now.")
    if timing_quality == "Strong window":
        points.append("This is a better time to act on your watchlist, but do not put everything in one place.")
    elif timing_quality == "Cautious window":
        points.append("Use this time to review. Keep some cash ready and avoid very risky themes.")
    return points[:4]


def build_wealth_alignment(*, date_str: str, time_str: str, lat: float, lon: float, tz_name: str, kundali: Dict, horoscope: Dict) -> Dict:
    dt_local, _dt_utc, _birth_jd_ut, _ = _parse_birth_datetime(date_str=date_str, time_str=time_str, tz_name=tz_name)
    now_local = datetime.now(dt_local.tzinfo).replace(second=0, microsecond=0)
    current_jd_ut = _dt_to_jd_ut(now_local.astimezone(timezone.utc))
    natal_lagna_idx = next((int(h["rashi_index"]) for h in kundali["houses"] if int(h["house"]) == 1), 0)
    natal_moon = next((p for p in kundali["planets"] if p["planet"] == "Moon"), None)
    natal_moon_idx = int(natal_moon["rashi_index"]) if natal_moon else 0

    from .horoscope_engine import _transit_planets  # local import avoids widening module dependency at import time

    transits = _transit_planets(now_local, natal_lagna_idx, natal_moon_idx)
    current_scores = dict(horoscope.get("daily", {}).get("scores") or {})
    dasha = {
        "mahadasha": str(horoscope.get("daily", {}).get("mahadasha") or ""),
        "antardasha": str(horoscope.get("daily", {}).get("antardasha") or ""),
    }
    recommended, caution, basis = compute_sector_scores(kundali, transits, dasha, current_scores, current_jd_ut)
    risk_style, risk_rationale = _risk_style(recommended, basis["planetStrengths"], kundali, current_scores, dasha)
    holding_style = _holding_style(risk_style, basis["planetStrengths"], kundali, dasha, basis["cautionSignals"])
    timing_quality = _timing_quality(current_scores, recommended, basis["cautionSignals"])

    confidence_score = _normalize_score(
        (
            sum(item["score"] for item in recommended[:3]) / max(len(recommended[:3]), 1)
            + current_scores.get("finance", 50)
            + current_scores.get("career", 50)
        ) / 3.0
        - (len(basis["cautionSignals"]) * 5.0)
    )
    confidence = {
        "score": round(confidence_score, 1),
        "label": _confidence_bucket(confidence_score),
    }
    pulse = _wealth_pulse(current_scores, confidence_score, timing_quality, holding_style)
    action_points = _action_points(recommended, caution, holding_style, timing_quality)

    strongest_planets = sorted(
        basis["planetStrengths"].items(),
        key=lambda item: item[1],
        reverse=True,
    )[:4]

    # --- personalised wording, derived from this chart (the scoring above is unchanged)
    from .astro_facts import FAVOURABLE, Chart, gochar_for, ordinal
    from .krishna_says import DIG_SHORT
    from .krishna_says import PREFIX

    chart = Chart(kundali)
    t_goch = gochar_for(transits, chart)
    facts = []
    for house, label in ((2, "Savings"), (11, "Income and gains"), (5, "Speculation and past merit"), (9, "Luck and fortune")):
        lord = chart.lord_of_house[house]
        facts.append(f"{label}: supported by {lord}, which is {DIG_SHORT[chart.dignity(lord)]} in your chart.")
    lords = {h: chart.lord_of_house[h] for h in (2, 5, 9, 11)}
    for a_h, b_h in ((2, 11), (5, 9), (9, 11), (2, 5), (2, 9), (5, 11)):
        if lords[a_h] != lords[b_h] and chart.sign_idx(lords[a_h]) == chart.sign_idx(lords[b_h]):
            facts.append(f"Dhana Yoga: {lords[a_h]} and {lords[b_h]}, two money planets, are together. This supports earning and saving.")
            break
    jup, sat = t_goch["Jupiter"], t_goch["Saturn"]
    def _stand(g):
        return {"favourable": "good", "blocked": "blocked", "unfavourable": "tough"}[g.status]
    transit_line = (
        f"{PREFIX} Jupiter, the planet of wealth, is {'helping you' if jup.status == 'favourable' else 'not helping much'} right now. "
        f"Saturn {'supports steady effort' if sat.status == 'favourable' else 'asks you to be patient'}. Overall this is a {timing_quality.lower()}."
    )
    dasha_line = f"{PREFIX} You are running {dasha['mahadasha']} Mahadasha and {dasha['antardasha']} Antardasha. This phase puts the focus on {chart.focus_plain(dasha['antardasha'])}, which shapes how you handle money right now."
    top2 = [row["name"] for row in recommended[:2]]
    personal_rationale = f"{PREFIX} {risk_rationale} {' and '.join(top2) if top2 else 'A balanced mix'} {'look' if len(top2) > 1 else 'looks'} best for you right now."
    for row in recommended + caution:
        facts_short = []
        for planet in row["planets"][:3]:
            if planet in ("Rahu", "Ketu"):
                facts_short.append(f"{planet} is active")
            else:
                facts_short.append(f"{planet} is {DIG_SHORT[chart.dignity(planet)]}")
        row["personal"] = f"{PREFIX} {row['rationale']} In your chart: {', '.join(facts_short)}."

    return {
        "archetype": _archetype(risk_style, recommended, basis["planetStrengths"]),
        "riskStyle": risk_style,
        "riskStyleRationale": personal_rationale,
        "holdingStyle": holding_style,
        "timingQuality": timing_quality,
        "confidence": confidence,
        "riskMeter": _style_meter(risk_style),
        "timingMeter": _timing_meter(timing_quality),
        "wealthPulse": pulse,
        "actionPoints": [f"{PREFIX} {point}" for point in action_points],
        "recommendedIndustries": [
            {
                "name": row["name"],
                "score": row["score"],
                "rationale": row["personal"],
            }
            for row in recommended
        ],
        "cautionIndustries": [
            {
                "name": row["name"],
                "score": row["score"],
                "rationale": row["personal"],
            }
            for row in caution
        ],
        "astroBasis": {
            "strongestPlanets": [
                {"planet": planet, "score": score}
                for planet, score in strongest_planets
            ],
            "supportiveHouses": basis["supportiveHouses"],
            "cautionSignals": basis["cautionSignals"],
            "dashaImpact": dasha_line,
            "transitImpact": transit_line,
        },
        "disclaimer": f"{PREFIX} this is a guide based on your kundali, not financial advice. Please do your own research before investing.",
        "wealthFacts": facts,
    }
