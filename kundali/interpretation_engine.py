from __future__ import annotations

from typing import Dict, List, Tuple

from .variation_engine import choose_advice, choose_opening, describe_tone, signature_key


HOUSE_TOPICS = {
    1: "self-definition, confidence, and vitality",
    2: "wealth, speech, and family stability",
    3: "effort, courage, and communication",
    4: "home, emotional grounding, and inner peace",
    5: "creativity, romance, and inspired intelligence",
    6: "competition, health, and disciplined correction",
    7: "partnership, contracts, and relational clarity",
    8: "volatility, surrender, and deep transformation",
    9: "fortune, mentors, and dharmic direction",
    10: "career, visibility, and karma in action",
    11: "gains, networks, and long-range fulfillment",
    12: "rest, release, retreat, and spiritual distance",
}

AREA_HOUSE_MAP = {
    "emotional": (1, 4, 5, 12),
    "career": (2, 6, 10, 11),
    "relationships": (5, 7, 11),
    "finance": (2, 5, 9, 11),
    "health": (1, 6, 8, 12),
    "spiritual": (8, 9, 12),
}

PLANET_COLORS = {
    "Sun": "Radiant Gold",
    "Moon": "Moonlit Pearl",
    "Mars": "Carmine Ember",
    "Mercury": "Emerald Mist",
    "Jupiter": "Saffron Gold",
    "Venus": "Rose Quartz",
    "Saturn": "Indigo Steel",
    "Rahu": "Electric Blue",
    "Ketu": "Smoky Silver",
}

PLANET_TIMES = {
    "Sun": "7:12 AM",
    "Moon": "8:24 PM",
    "Mars": "11:18 AM",
    "Mercury": "10:36 AM",
    "Jupiter": "1:24 PM",
    "Venus": "6:18 PM",
    "Saturn": "4:42 PM",
    "Rahu": "2:48 PM",
    "Ketu": "5:36 AM",
}


def score_to_tone(score: float) -> str:
    if score >= 66:
        return "supportive"
    if score <= 42:
        return "pressured"
    return "mixed"


def build_lucky_elements(*, dominant_planets: List[str], active_houses: List[int], weekday_ruler: str) -> Dict[str, object]:
    lead = dominant_planets[0] if dominant_planets else weekday_ruler
    seed = sum(active_houses[:3] or [1]) + len(dominant_planets) + len(weekday_ruler)
    return {
        "color": PLANET_COLORS.get(lead, "Saffron Gold"),
        "number": (seed % 9) + 1,
        "time": PLANET_TIMES.get(lead, "9:12 AM"),
    }


def build_personalized_advice(*, support_house: int, pressure_house: int, dominant_planets: List[str], variation_key: str) -> str:
    support_topic = HOUSE_TOPICS.get(support_house, "the area that is opening")
    pressure_topic = HOUSE_TOPICS.get(pressure_house, "the area that needs restraint")
    dominant = dominant_planets[0] if dominant_planets else "Moon"
    direction = "pressure" if pressure_house in {6, 8, 12} else "support"
    stem = choose_advice(direction, variation_key)
    return f"{stem} Let {dominant} guide how you handle {support_topic}, while staying measured around {pressure_topic}."


def _life_area_text(area: str, score: float, key: str) -> str:
    topic = {
        "emotional": "emotional steadiness and inner tone",
        "career": "career movement and practical responsibility",
        "relationships": "partnerships and meaningful exchanges",
        "finance": "financial judgment and gain patterns",
        "health": "energy, body rhythm, and recovery",
        "spiritual": "inner reflection and subtle alignment",
    }.get(area, area)
    tone = score_to_tone(score)
    line = describe_tone(tone, topic, key)
    follow_up = {
        "emotional": "Notice what calms the mind quickly versus what prolongs inner noise.",
        "career": "Visible progress comes more from consistency than from one dramatic move.",
        "relationships": "The quality of response matters more than the speed of response now.",
        "finance": "Measured decisions outperform emotional or speculative choices in this phase.",
        "health": "Routine, rest, and recovery habits have a stronger effect than usual right now.",
        "spiritual": "Silence, reflection, and simplification carry more value than external stimulation.",
    }.get(area, "")
    return f"Krishna says: {line} {follow_up}".strip()


def build_scope_narrative(
    *,
    scope_label: str,
    period_label: str,
    dominant_planets: List[str],
    active_houses: List[int],
    support_houses: List[int],
    pressure_houses: List[int],
    area_scores: Dict[str, int],
    dasha: Dict[str, str],
    transit_summary: str,
    date_range_label: str,
    variation_key: str,
) -> Dict[str, object]:
    primary_area = max(("career", "relationships", "finance", "health", "emotional", "spiritual"), key=lambda key: area_scores.get(key, 0))
    dominant = dominant_planets[0] if dominant_planets else "Moon"
    support_house = support_houses[0] if support_houses else active_houses[0]
    pressure_house = pressure_houses[0] if pressure_houses else active_houses[-1]
    opening = choose_opening(primary_area, signature_key([variation_key, "opening"]))
    summary = (
        f"Krishna says: {opening} {transit_summary} "
        f"{scope_label} emphasis is strongest around house {support_house} and house {pressure_house}, "
        f"while {dasha['mahadasha']} / {dasha['antardasha']} timing keeps this period personally relevant and distinct in your chart."
    )
    if period_label:
        summary = f"{period_label} {summary}"

    details = {
        "emotional": _life_area_text("emotional", area_scores.get("emotional", 50), signature_key([variation_key, "emotional"])),
        "career": _life_area_text("career", area_scores.get("career", 50), signature_key([variation_key, "career"])),
        "relationships": _life_area_text("relationships", area_scores.get("relationships", 50), signature_key([variation_key, "relationships"])),
        "finance": _life_area_text("finance", area_scores.get("finance", 50), signature_key([variation_key, "finance"])),
        "health": _life_area_text("health", area_scores.get("health", 50), signature_key([variation_key, "health"])),
    }
    cautions = [
        f"Pressure is concentrating around house {pressure_house}, which governs {HOUSE_TOPICS.get(pressure_house, 'a sensitive area')}.",
        f"{dasha['antardasha']} can make reactions sharper if you move too quickly.",
    ]
    opportunities = [
        f"House {support_house} is more cooperative now, opening room in {HOUSE_TOPICS.get(support_house, 'a stronger life area')}.",
        f"{dominant} is one of the leading planets in this {scope_label.lower()} cycle, so aligned effort tends to show results faster.",
    ]
    return {
        "headline": f"Krishna says: {dominant} leads the {scope_label.lower()} field through {primary_area}.",
        "summary": summary,
        "details": details,
        "advice": "Krishna says: " + build_personalized_advice(
            support_house=support_house,
            pressure_house=pressure_house,
            dominant_planets=dominant_planets,
            variation_key=signature_key([variation_key, "advice"]),
        ),
        "spiritualNote": _life_area_text("spiritual", area_scores.get("spiritual", 50), signature_key([variation_key, "spiritual"])),
        "opportunities": opportunities,
        "cautions": cautions,
        "confidence": max(46, min(92, int((sum(area_scores.values()) / max(len(area_scores), 1)) * 0.92))),
        "dateRange": date_range_label,
    }


def weighted_area_scores(house_activation: Dict[int, Dict[str, float]]) -> Dict[str, int]:
    scores: Dict[str, int] = {}
    for area, houses in AREA_HOUSE_MAP.items():
        total = 0.0
        for house in houses:
            row = house_activation.get(house, {"support": 0.0, "pressure": 0.0})
            total += 52.0 + row.get("support", 0.0) * 0.8 - row.get("pressure", 0.0) * 0.85 + row.get("score", 0.0) * 0.1
        average = total / max(len(houses), 1)
        scores[area] = max(8, min(96, int(round(average))))
    return scores


def rank_houses(house_activation: Dict[int, Dict[str, float]]) -> Tuple[List[int], List[int], List[int]]:
    active = sorted(house_activation.keys(), key=lambda house: house_activation[house]["score"], reverse=True)
    support = sorted(house_activation.keys(), key=lambda house: house_activation[house]["support"], reverse=True)
    pressure = sorted(house_activation.keys(), key=lambda house: house_activation[house]["pressure"], reverse=True)
    return active[:4], support[:3], pressure[:3]
