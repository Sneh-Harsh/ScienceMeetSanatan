from __future__ import annotations

from typing import Dict, List

from .experience_engine import dignity_tag, house_lords, planet_lookup


MANGAL_HOUSES = {1, 2, 4, 7, 8, 12}


def _relative_house(ref_sign_idx, target_sign_idx):
    try:
        a = int(ref_sign_idx)
        b = int(target_sign_idx)
    except Exception:
        return None
    return ((b - a + 12) % 12) + 1


def _planet_in_house(planets: Dict[str, Dict], name: str) -> int | None:
    row = planets.get(name) or {}
    value = row.get("house")
    try:
        return int(value)
    except Exception:
        return None


def _is_all_between(planets: List[Dict], start: float, end: float) -> bool:
    def in_arc(value: float, arc_start: float, arc_end: float) -> bool:
        value = ((value % 360.0) + 360.0) % 360.0
        arc_start = ((arc_start % 360.0) + 360.0) % 360.0
        arc_end = ((arc_end % 360.0) + 360.0) % 360.0
        if arc_start <= arc_end:
            return arc_start <= value <= arc_end
        return value >= arc_start or value <= arc_end

    return all(in_arc(float(item.get("degree") or 0.0), start, end) for item in planets)


def analyze_doshas(kundali: Dict) -> List[Dict]:
    planets = planet_lookup(kundali)
    lords = house_lords(kundali)
    mars = planets.get("Mars") or {}
    moon = planets.get("Moon") or {}
    venus = planets.get("Venus") or {}
    jupiter = planets.get("Jupiter") or {}
    saturn = planets.get("Saturn") or {}
    rahu = planets.get("Rahu") or {}
    ketu = planets.get("Ketu") or {}

    mars_refs: List[str] = []
    lagna_house = _planet_in_house(planets, "Mars")
    moon_house = _relative_house(moon.get("rashi_index"), mars.get("rashi_index"))
    venus_house = _relative_house(venus.get("rashi_index"), mars.get("rashi_index"))
    if lagna_house in MANGAL_HOUSES:
        mars_refs.append(f"Lagna reference places Mars in house {lagna_house}.")
    if moon_house in MANGAL_HOUSES:
        mars_refs.append(f"Moon reference places Mars in house {moon_house}.")
    if venus_house in MANGAL_HOUSES:
        mars_refs.append(f"Venus reference places Mars in house {venus_house}.")
    mangal_hits = len(mars_refs)
    mangal_severity = "none"
    if mangal_hits == 1:
        mangal_severity = "mild"
    elif mangal_hits == 2:
        mangal_severity = "medium"
    elif mangal_hits >= 3:
        mangal_severity = "strong"
    mangal_mitigations = []
    if jupiter and dignity_tag("Jupiter", int(jupiter.get("rashi_index") or 0)) in {"Exalted", "Own sign", "Friendly"}:
        mangal_mitigations.append("Jupiter has supportive dignity, which softens impulsive Mars signatures.")
    seventh_lord = lords.get(7, "")
    if dignity_tag(seventh_lord, int((planets.get(seventh_lord) or {}).get("rashi_index") or 0)) in {"Exalted", "Own sign", "Friendly"}:
        mangal_mitigations.append("The 7th lord is reasonably supported, which reduces relationship strain.")

    classical = [planets.get(name) for name in ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"] if planets.get(name)]
    kaal_detected = False
    if rahu and ketu and len(classical) == 7:
        rahu_lon = float(rahu.get("degree") or 0.0)
        ketu_lon = float(ketu.get("degree") or 0.0)
        kaal_detected = _is_all_between(classical, rahu_lon, ketu_lon) or _is_all_between(classical, ketu_lon, rahu_lon)

    saturn_house = _planet_in_house(planets, "Saturn")
    saturn_from_moon = _relative_house(moon.get("rashi_index"), saturn.get("rashi_index"))
    shani_detected = saturn_house in {1, 4, 7, 8, 10} or saturn_from_moon in {1, 4, 7, 8, 10, 12}
    shani_mitigations = []
    lagna_lord = lords.get(1, "")
    if lagna_lord and dignity_tag(lagna_lord, int((planets.get(lagna_lord) or {}).get("rashi_index") or 0)) in {"Exalted", "Own sign", "Friendly"}:
        shani_mitigations.append("A stronger Lagna lord gives resilience under Saturn pressure.")

    results = [
        {
            "name": "Mangal Dosha",
            "detected": mangal_hits > 0,
            "severity": mangal_severity,
            "whyDetected": " ".join(mars_refs) if mars_refs else "Mars does not trigger the sensitive marriage houses from Lagna, Moon, or Venus references.",
            "likelyThemes": "Can intensify impatience, conflict style, or heat in close partnerships if other supports are weak.",
            "mitigatingFactors": mangal_mitigations or ["No strong mitigating factor stands out beyond chart-wide maturity and timing."],
            "confidence": "High" if mangal_hits >= 2 else "Moderate" if mangal_hits == 1 else "Low",
        },
        {
            "name": "Kaal Sarp Pattern",
            "detected": kaal_detected,
            "severity": "medium" if kaal_detected else "none",
            "whyDetected": "All seven classical planets fall within the Rahu-Ketu arc." if kaal_detected else "The classical planets are not locked entirely within the Rahu-Ketu axis.",
            "likelyThemes": "When active, this can create intensity, compulsive focus, and periods of feeling that life is concentrated around fewer themes.",
            "mitigatingFactors": ["This pattern should never be read in isolation; benefic strength and dasha support can reduce its intensity."],
            "confidence": "Moderate" if kaal_detected else "Low",
        },
        {
            "name": "Shani Pressure Pattern",
            "detected": shani_detected,
            "severity": "medium" if shani_detected else "none",
            "whyDetected": "Saturn is placed in or influencing a sensitive house pattern from Lagna or Moon." if shani_detected else "Saturn is not strongly pressing the classic sensitive houses right now.",
            "likelyThemes": "Can show as delay, emotional heaviness, duty overload, or a longer road to results.",
            "mitigatingFactors": shani_mitigations or ["Steady routines and patient action usually reduce Saturn-related pressure more effectively than force."],
            "confidence": "Moderate" if shani_detected else "Low",
        },
    ]
    return results
