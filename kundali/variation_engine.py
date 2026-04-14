from __future__ import annotations

import hashlib
from typing import Iterable, Sequence


OPENING_VARIANTS = {
    "career": [
        "Professional momentum sharpens when your chart pushes effort into visible channels.",
        "The current sky is asking for deliberate, public-facing effort rather than quiet waiting.",
        "Your work axis is live, so progress now comes through responsibility handled cleanly.",
    ],
    "relationships": [
        "Relationship patterns are louder than usual, asking for presence instead of assumption.",
        "Partnership energy is active now, so the quality of dialogue becomes the real turning point.",
        "Connection matters more in this phase, and small relational choices carry more weight than usual.",
    ],
    "finance": [
        "Money patterns are more responsive now, especially where judgment and restraint work together.",
        "Your wealth indicators are active, which makes planning more rewarding than impulsive action.",
        "Financial movement is live in the chart, but the best gains come through measured timing.",
    ],
    "health": [
        "The chart is drawing attention back to energy management and body rhythm.",
        "Vitality becomes the practical center of this phase, so pacing matters more than force.",
        "Health signals are speaking clearly now, especially where routine and recovery are concerned.",
    ],
    "spiritual": [
        "The quieter side of the chart is open, making reflection unusually productive now.",
        "Inner alignment is more available in this phase, especially when outer noise is reduced.",
        "A subtler spiritual undertone runs through this period, drawing you toward insight over reaction.",
    ],
    "emotional": [
        "Your emotional field is especially responsive right now, so pacing and self-observation matter.",
        "The mind is receiving stronger signals in this phase, which makes clarity a practice, not an accident.",
        "Emotional tone is carrying more weight now, and inner steadiness shapes outer outcomes.",
    ],
}

AREA_TEMPLATES = {
    "supportive": [
        "Support gathers around {topic}, especially when you move with patience and clean intent.",
        "This period favors {topic} when you stay measured and do not overcomplicate the signal.",
        "There is constructive movement around {topic}, but it responds best to steadiness rather than urgency.",
    ],
    "mixed": [
        "Results around {topic} are available, but only if effort and timing stay aligned.",
        "The chart shows a mixed field for {topic}: one part is opening while another still needs restraint.",
        "Movement around {topic} is real, yet it becomes reliable only when you avoid overreacting.",
    ],
    "pressured": [
        "Pressure is collecting around {topic}, so restraint is more valuable than force.",
        "This is a heavier cycle for {topic}, and the wiser move is to simplify rather than push.",
        "The signal around {topic} is tense enough that patience becomes part of the remedy.",
    ],
}

ADVICE_VARIANTS = {
    "support": [
        "Lean into the area that is already opening instead of scattering effort.",
        "Work with the supportive current directly and let momentum build in one focused lane.",
        "The best use of this period is disciplined follow-through where the chart is already helping you.",
    ],
    "pressure": [
        "Reduce noise around the stressed house first; relief comes before acceleration.",
        "Protect your energy where the chart shows leakage, then make the next move.",
        "Do less, but do it more cleanly, in the area where the pressure is currently concentrated.",
    ],
}


def stable_choice(options: Sequence[str], key: str) -> str:
    if not options:
        return ""
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    idx = int(digest[:8], 16) % len(options)
    return options[idx]


def choose_opening(area: str, key: str) -> str:
    return stable_choice(OPENING_VARIANTS.get(area, OPENING_VARIANTS["emotional"]), key)


def describe_tone(level: str, topic: str, key: str) -> str:
    return stable_choice(AREA_TEMPLATES.get(level, AREA_TEMPLATES["mixed"]), key).format(topic=topic)


def choose_advice(direction: str, key: str) -> str:
    bank = ADVICE_VARIANTS["pressure" if direction == "pressure" else "support"]
    return stable_choice(bank, key)


def signature_key(parts: Iterable[object]) -> str:
    return "|".join(str(part) for part in parts if part is not None)
