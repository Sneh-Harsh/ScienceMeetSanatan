from __future__ import annotations

from typing import Dict, List


def _push(items: List[Dict], *, title: str, why: str, target: str, frequency: str, category: str, confidence: str) -> None:
    items.append(
        {
            "title": title,
            "why": why,
            "target": target,
            "frequency": frequency,
            "category": category,
            "confidence": confidence,
        }
    )


def build_remedies(*, doshas: List[Dict], dasha_experience: Dict, climate: Dict) -> List[Dict]:
    remedies: List[Dict] = []
    current_maha = str((dasha_experience.get("current_mahadasha") or {}).get("planet") or "")
    current_antara = str((dasha_experience.get("current_antardasha") or {}).get("planet") or "")
    pressure = list(climate.get("pressurizing") or [])

    mangal = next((item for item in doshas if item.get("name") == "Mangal Dosha" and item.get("detected")), None)
    shani = next((item for item in doshas if item.get("name") == "Shani Pressure Pattern" and item.get("detected")), None)
    kaal = next((item for item in doshas if item.get("name") == "Kaal Sarp Pattern" and item.get("detected")), None)

    if mangal:
        _push(
            remedies,
            title="Cooling response discipline",
            why="Mars-sensitive partnership houses are active, so the first remedy is to cool reaction speed and reduce unnecessary conflict heat.",
            target="Mars / Mangal pattern",
            frequency="Daily",
            category="Behavioral remedy",
            confidence="High",
        )
        _push(
            remedies,
            title="Hanuman or Kartikeya focus",
            why="A disciplined Mars is better supported through courageous but restrained devotional practice than through suppression.",
            target="Mars / active relationship pressure",
            frequency="Tuesday or Saturday",
            category="Mantra / spiritual focus",
            confidence="Moderate",
        )

    if shani:
        _push(
            remedies,
            title="One non-negotiable routine",
            why="Saturn pressure becomes easier when you remove decision fatigue and hold one consistent stabilizing practice.",
            target="Saturn pressure pattern",
            frequency="Daily",
            category="Daily practice",
            confidence="High",
        )
        _push(
            remedies,
            title="Seva through steadiness",
            why="Saturn often responds better to patient service and humility than to quick ritual escalation.",
            target="Saturn / karmic pressure",
            frequency="Weekly",
            category="Donation / seva",
            confidence="Moderate",
        )

    if kaal:
        _push(
            remedies,
            title="Breath before action",
            why="When the chart compresses experience into a more intense nodal pattern, grounding the nervous system reduces overreaction.",
            target="Rahu-Ketu axis concentration",
            frequency="Daily",
            category="Daily practice",
            confidence="Moderate",
        )

    if current_maha:
        _push(
            remedies,
            title=f"{current_maha} period alignment",
            why=f"The current Mahadasha sets the broader life rhythm, so your remedy should first support {current_maha.lower()} themes consciously rather than fight them.",
            target=f"{current_maha} Mahadasha",
            frequency="Current life phase",
            category="Behavioral remedy",
            confidence="High",
        )

    if current_antara and current_antara != current_maha:
        _push(
            remedies,
            title=f"{current_antara} sub-period adjustment",
            why=f"The present Antardasha changes how the larger period is felt day to day, so the remedy should respond to {current_antara.lower()} triggers directly.",
            target=f"{current_antara} Antardasha",
            frequency="Current sub-period",
            category="Weekly observance",
            confidence="Moderate",
        )

    if pressure:
        strongest = pressure[0]
        _push(
            remedies,
            title="Do not overdo the pressure planet",
            why=f"{strongest.get('planet') or 'A current pressure planet'} is already running hot, so the corrective move is steadiness, not overcompensation.",
            target=f"{strongest.get('planet') or 'Current pressure signature'}",
            frequency="Always",
            category="Do not overdo",
            confidence="High",
        )

    if not remedies:
        _push(
            remedies,
            title="Keep a clean daily rhythm",
            why="When the chart is not under acute pressure, the best remedy is disciplined regularity rather than excessive correction.",
            target="General chart support",
            frequency="Daily",
            category="Daily practice",
            confidence="Moderate",
        )

    ordered_categories = {
        "Daily practice": 0,
        "Weekly observance": 1,
        "Mantra / spiritual focus": 2,
        "Donation / seva": 3,
        "Behavioral remedy": 4,
        "Do not overdo": 5,
    }
    remedies.sort(key=lambda row: ordered_categories.get(str(row.get("category")), 9))
    return remedies[:5]
