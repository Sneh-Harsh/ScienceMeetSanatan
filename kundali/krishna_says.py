"""Personalised "Krishna says" horoscope text and scores.

Every sentence is assembled from a computed fact about *this* chart and *this*
period (house lordship, dignity, Vimshottari Maha/Antar/Pratyantar, Gochar from
the natal Moon with Vedha, Chandra/Tara Bala, Sade Sati, real ingress dates).
A fact is used in at most one block of a reading, so the sections do not repeat.
"""
from __future__ import annotations

import hashlib
import re
import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Sequence, Tuple

from .astro_facts import (
    DUSTHANA, FAVOURABLE, GRAHAS, KENDRA, MOON_FROM_MOON, NATURAL, PLANETS, SIGN, TARA_GOOD, TARA_MEANING, TARA_NAMES, TRIKONA,
    Chart, Gochar, area_name, clock, day_timings, gochar_for, lunations, moon_nak_of, ordinal, sade_sati, scan_events, tara_of, window,
)
from .dasha_levels import levels_at
from .period_engine import PeriodRange, get_period_range, get_period_sample_points, split_year_windows
from .transit_engine import aspect_targets, get_current_transits

PREFIX = "Krishna says:"

AREAS = {
    "emotional": {"houses": [(4, 1.0), (1, 0.4), (5, 0.4)], "karakas": [("Moon", 1.0)]},
    "career": {"houses": [(10, 1.0), (6, 0.5), (11, 0.3)], "karakas": [("Saturn", 0.5), ("Sun", 0.5)]},
    "relationships": {"houses": [(7, 1.0), (5, 0.5)], "karakas": [("Venus", 0.8)]},
    "finance": {"houses": [(2, 1.0), (11, 0.9), (9, 0.3)], "karakas": [("Jupiter", 0.7)]},
    "health": {"houses": [(1, 1.0), (6, 0.6), (8, 0.3)], "karakas": [("Sun", 0.5)]},
    "spiritual": {"houses": [(9, 0.8), (12, 0.6), (8, 0.4)], "karakas": [("Jupiter", 0.6), ("Ketu", 0.5)]},
}
AREA_NOUN = {
    "emotional": "your inner balance", "career": "your work and reputation", "relationships": "your relationships",
    "finance": "your money", "health": "your health and energy", "spiritual": "your inner life",
}
AREA_TITLE = {
    "emotional": "Emotional state", "career": "Career", "relationships": "Relationships",
    "finance": "Money", "health": "Health and energy", "spiritual": "Inner life",
}

PERIOD_WEIGHTS = {
    "daily": {"Moon": 1.6, "Sun": 1.1, "Mercury": 1.1, "Venus": 1.1, "Mars": 1.15, "Jupiter": 0.9, "Saturn": 0.9, "Rahu": 0.95, "Ketu": 0.9},
    "weekly": {"Moon": 1.3, "Sun": 1.15, "Mercury": 1.2, "Venus": 1.15, "Mars": 1.15, "Jupiter": 0.95, "Saturn": 0.95, "Rahu": 1.0, "Ketu": 0.95},
    "monthly": {"Moon": 0.8, "Sun": 1.3, "Mercury": 1.25, "Venus": 1.2, "Mars": 1.2, "Jupiter": 1.05, "Saturn": 1.1, "Rahu": 1.05, "Ketu": 1.0},
    "yearly": {"Moon": 0.3, "Sun": 0.6, "Mercury": 0.6, "Venus": 0.65, "Mars": 0.7, "Jupiter": 1.6, "Saturn": 1.6, "Rahu": 1.35, "Ketu": 1.25},
}
PERIOD_WEIGHTS["specific_year"] = PERIOD_WEIGHTS["yearly"]
LEVEL_WEIGHTS = {
    "daily": {"maha": 9.0, "antar": 7.0, "praty": 4.0},
    "weekly": {"maha": 9.0, "antar": 7.5, "praty": 2.5},
    "monthly": {"maha": 9.0, "antar": 8.0, "praty": 1.5},
    "yearly": {"maha": 9.0, "antar": 8.0, "praty": 0.0},
    "specific_year": {"maha": 9.0, "antar": 8.0, "praty": 0.0},
}

EFFECT = {
    "Sun": {
        "emotional": ("self-confidence and inner warmth rise", "pride and irritability run hot"),
        "career": ("recognition and support from seniors come more easily", "friction with bosses or authority is likely"),
        "relationships": ("pride softens into steady warmth", "ego clashes can spark in close bonds"),
        "finance": ("official or family support helps income", "money matters feel scrutinised or drained"),
        "health": ("vitality and immunity are strong", "heat, fatigue or eye and head strain are possible"),
        "spiritual": ("clarity and purpose feel natural", "ego gets in the way of surrender"),
    },
    "Moon": {
        "emotional": ("the mind is calm and receptive", "moods swing and feelings are easily hurt"),
        "career": ("public-facing work and people skills shine", "focus drifts with the mood"),
        "relationships": ("affection flows easily", "you turn touchy and read too much into things"),
        "finance": ("small steady gains and sensible spending", "mood-driven spending is likely"),
        "health": ("rest and digestion are good", "sleep and digestion need care"),
        "spiritual": ("devotion and calm come easily", "restless thoughts disturb practice"),
    },
    "Mars": {
        "emotional": ("courage and drive lift the spirits", "anger and impatience flare"),
        "career": ("decisive action wins results", "conflict with colleagues and rushed moves are possible"),
        "relationships": ("passion and protectiveness run strong", "arguments and sharp words come easily"),
        "finance": ("bold, well-timed moves pay off", "hasty spending or money disputes are a risk"),
        "health": ("energy and stamina are high", "fevers, cuts and over-exertion need watching"),
        "spiritual": ("discipline and willpower deepen practice", "force and haste get in the way"),
    },
    "Mercury": {
        "emotional": ("the mind is clear and cheerful", "worry and over-thinking run loose"),
        "career": ("communication, negotiation and learning go well", "paperwork slips and mixed messages are possible"),
        "relationships": ("honest conversation clears the air", "misunderstandings come easily"),
        "finance": ("good deals, trade and planning pay", "errors in accounts or hasty contracts are a risk"),
        "health": ("nerves stay steady", "nervous tension and gut or skin sensitivity are possible"),
        "spiritual": ("study and reflection deepen", "the mind chatters and will not settle"),
    },
    "Jupiter": {
        "emotional": ("optimism and a sense of protection return", "complacency or heaviness weighs on the mood"),
        "career": ("mentors, growth and advancement open up", "over-promising or delayed recognition holds you back"),
        "relationships": ("goodwill and commitment grow, and marriage prospects improve", "expectations outgrow reality"),
        "finance": ("income, savings and luck expand", "over-extension and generous spending leak money"),
        "health": ("recovery and general wellbeing improve", "weight, liver and sugar need watching"),
        "spiritual": ("guidance from a teacher or text arrives", "faith is tested by delay"),
    },
    "Venus": {
        "emotional": ("affection and enjoyment soften the mood", "indulgence or longing unsettles you"),
        "career": ("charm, creativity and teamwork help", "distraction and vanity cost focus"),
        "relationships": ("love, harmony and shared comforts grow", "jealousy or neglect strains the bond"),
        "finance": ("comforts, gifts and creative income come easily", "luxury spending runs ahead of income"),
        "health": ("ease, glow and good vitality are felt", "over-indulgence and throat or hormone issues need care"),
        "spiritual": ("devotion through music and beauty deepens", "pleasure distracts from practice"),
    },
    "Saturn": {
        "emotional": ("a steady, mature calm settles in", "heaviness, loneliness and worry press down"),
        "career": ("steady, disciplined effort earns lasting rank", "delays, extra duties and slow recognition test you"),
        "relationships": ("commitment and loyalty deepen", "distance or coldness can creep in as duty crowds out affection"),
        "finance": ("patient saving builds real security", "delays, cutbacks and heavy obligations tighten things"),
        "health": ("a disciplined routine protects you", "stiffness, fatigue and low energy are likely"),
        "spiritual": ("austerity and patience bear fruit", "dryness and doubt creep into practice"),
    },
    "Rahu": {
        "emotional": ("ambition lifts the mood", "anxiety and restlessness build"),
        "career": ("unusual openings, foreign or technical routes appear", "shortcuts and over-ambition create risk"),
        "relationships": ("unconventional or distant connections appear", "confusion or secrecy clouds trust"),
        "finance": ("sudden gains and unusual income are possible", "speculation and hidden costs mislead"),
        "health": ("new or unconventional approaches help", "stress-linked, hard-to-explain complaints are likely"),
        "spiritual": ("curiosity about the unknown grows", "illusion and distraction pull you off course"),
    },
    "Ketu": {
        "emotional": ("detachment brings quiet clarity", "disinterest and hidden worry drain joy"),
        "career": ("you cut clutter and focus on what matters", "motivation dips and work feels pointless"),
        "relationships": ("you let go of what no longer serves", "withdrawal leaves others unsure of you"),
        "finance": ("you simplify and drop wasteful spending", "unexpected losses are possible, or you may lose interest in earning"),
        "health": ("a cleansing, minimalist phase helps", "vague, hard-to-diagnose weakness is possible"),
        "spiritual": ("insight and inner freedom deepen", "a feeling of emptiness or disorientation"),
    },
}
THEME = {
    "Sun": ("recognition, vitality and support from people in authority", "ego clashes, heat and friction with seniors"),
    "Moon": ("a calm mind, comfort and easy connection", "restlessness, sensitivity and mood swings"),
    "Mars": ("courage, energy and decisive wins", "impatience, arguments and over-exertion"),
    "Mercury": ("clear thinking, good deals, study and travel", "miscommunication, paperwork slips and scattered attention"),
    "Jupiter": ("growth, luck, guidance and protection", "over-promising, complacency and delayed blessings"),
    "Venus": ("harmony, affection, comfort and creative flow", "indulgence, relationship friction and overspending"),
    "Saturn": ("steady rewards for patient, honest work", "delay, heavy duties and fatigue, where slow honest effort is the cure"),
    "Rahu": ("bold gains and unusual openings", "confusion, shortcuts that backfire and anxious overreach"),
    "Ketu": ("insight, detachment and freedom from clutter", "disorientation, loss of interest and hidden worries"),
}
PLANET_USE = {
    "Sun": "leadership, recognition and dealings with authority", "Moon": "family, home and emotional healing",
    "Mars": "physical effort, property and tasks that need courage", "Mercury": "talks, deals, study and writing",
    "Jupiter": "learning, advice, children and matters of prosperity", "Venus": "relationships, art and comfort purchases",
    "Saturn": "discipline, long projects and service",
}
PLANET_COLOR = {
    "Sun": "Saffron and copper", "Moon": "Pearl white", "Mars": "Coral red", "Mercury": "Emerald green", "Jupiter": "Turmeric yellow",
    "Venus": "Rose and ivory", "Saturn": "Deep indigo", "Rahu": "Smoky slate", "Ketu": "Warm grey",
}
PLANET_NUMBER = {"Sun": 1, "Moon": 2, "Jupiter": 3, "Rahu": 4, "Mercury": 5, "Venus": 6, "Ketu": 7, "Saturn": 8, "Mars": 9}
PLANET_DAY = {"Sun": "Sunday", "Moon": "Monday", "Mars": "Tuesday", "Mercury": "Wednesday", "Jupiter": "Thursday", "Venus": "Friday", "Saturn": "Saturday"}
LEVEL_NAME = {"maha": "Mahadasha", "antar": "Antardasha", "praty": "Pratyantar"}

PRACTICE = {
    "emotional": {
        "supportive": ["Use the calm to settle a conversation you have been postponing.", "Spend the steadier hours on what restores you; it compounds."],
        "mixed": ["Keep the evening quiet and avoid replying while upset.", "Notice what lifts your mood fastest and do that first."],
        "pressured": ["Sleep on big emotional decisions.", "Protect your sleep and cut down noise; the mind is more sensitive than usual."],
    },
    "career": {
        "supportive": ["Put your most visible task early in the day.", "Ask, pitch or submit: timing is on your side."],
        "mixed": ["Finish one pending task before starting another.", "Double-check details before sending anything important."],
        "pressured": ["Avoid confrontations at work; document things and stay patient.", "Do the routine well and postpone risky moves."],
    },
    "relationships": {
        "supportive": ["Make time for the person who matters; a sincere talk lands well.", "Say the kind thing out loud."],
        "mixed": ["Listen first and respond later.", "Clarify instead of assuming, and keep expectations realistic."],
        "pressured": ["Skip arguments about old issues; choose calm over being right.", "Give space rather than forcing a discussion."],
    },
    "finance": {
        "supportive": ["A good time to plan, review and invest in skills, though impulse bets still do not pay.", "Follow up on money owed or payments pending."],
        "mixed": ["Plan your spending and avoid lending on impulse.", "Compare options twice before paying."],
        "pressured": ["Delay big purchases and risky investments; protect savings.", "Track expenses closely and avoid new commitments."],
    },
    "health": {
        "supportive": ["Build on it with a regular routine and some outdoor movement.", "A good time to begin a gentle exercise or food habit."],
        "mixed": ["Keep meals and sleep regular and do not overdo it.", "Moderate exercise suits you better than extremes."],
        "pressured": ["Rest more, drive carefully and see a doctor if small symptoms persist.", "Avoid over-exertion and skipped meals."],
    },
    "spiritual": {
        "supportive": ["A few quiet minutes of mantra or reading will go deep now.", "A good time to learn from a teacher or a sacred text."],
        "mixed": ["Keep practice short and regular rather than long.", "Journaling helps you tell intuition from worry."],
        "pressured": ["Simplify, and sit in silence before reacting.", "Do not force insight; steady practice is enough."],
    },
}
LEADS = {
    "supportive": ["{when} favours {noun}.", "{when}, the signs lean in favour of {noun}."],
    "mixed": ["{when} gives {noun} a mixed signal.", "{when}, expect mixed signals around {noun}."],
    "pressured": ["{when}, go gently with {noun}.", "{when} asks for patience with {noun}."],
}
WHEN = {"daily": "Today", "weekly": "This week", "monthly": "This month", "yearly": "This year", "specific_year": "This year"}


def _remedies() -> Dict:
    from .plain_language import REMEDY  # lazy: avoids a circular import with the horoscope engine

    return REMEDY["en"]


def _pick(options: Sequence[str], key: str) -> str:
    return options[int(hashlib.sha256(key.encode()).hexdigest()[:8], 16) % len(options)]


def tone_of(score: float) -> str:
    return "supportive" if score >= 62 else "pressured" if score <= 45 else "mixed"


@dataclass
class Ev:
    area: str
    key: str
    mag: float
    planet: str
    kind: str  # natal | dasha | transit | aspect | bala
    text: str
    short: str
    positive: bool
    timely: bool = True
    level: str = ""
    topic: str = ""
    tech: str = ""


@dataclass
class Ctx:
    chart: Chart
    period: str
    ref: datetime
    samples: List[Tuple[datetime, Dict, Dict[str, Gochar]]]
    levels: List[Dict]
    evs: List[Ev] = field(default_factory=list)
    said: set = field(default_factory=set)
    why_plain: Dict = field(default_factory=dict)


# ----------------------------------------------------------------------------- evidence builders

DIG_PHRASE = {"exalted": "very strong (exalted)", "own": "strong (in its own sign)", "friendly": "comfortable (in a friend's sign)", "neutral": "average", "enemy": "uneasy (in an enemy's sign)", "debilitated": "weak (debilitated)"}
DIG_SHORT = {"exalted": "very strong", "own": "strong", "friendly": "comfortable", "neutral": "average", "enemy": "uneasy", "debilitated": "weak"}
FAST = {"Moon", "Sun", "Mercury", "Venus", "Mars"}
HOUSE_PLAIN = {h: None for h in range(1, 13)}


def _hn(house: int) -> str:
    """'4th house (home & peace of mind)'"""
    return f"{ordinal(house)} house ({area_name(house).replace(' and ', ' & ')})"


def _where(ch: Chart, planet: str) -> str:
    return f"in {ch.sign_name(planet)}, in your {ordinal(ch.house_of(planet))} house"


def _cap(text: str) -> str:
    return text[:1].upper() + text[1:]


def _natal_ev(ch: Chart, area: str, house: int, weight: float) -> Ev:
    lord = ch.lord_of_house[house]
    q = ch.quality(lord)
    vip = lord in ch.viparita() and house in DUSTHANA
    invert = area == "health" and house in (6, 8)
    tech = f"Your {_hn(house)} is ruled by {lord}, which is {DIG_PHRASE[ch.dignity(lord)]} {_where(ch, lord)}."
    if vip:
        text, mag, pos = f"Problems around {AREA_NOUN[area]} tend to fade over time.", abs(q) * 5.0 * weight + 2.0, True
        tech += " This forms Viparita Raja Yoga: problems in this area tend to fade over time."
    elif invert:
        mag = -q * 8.0 * weight * 0.6
        pos = mag > 0
        text = "Health problems usually stay mild for you." if pos else "Health problems can repeat, so take regular care."
    else:
        mag = q * 8.0 * weight
        pos = q >= 0
        n_ = AREA_NOUN[area]
        text = (f"Your chart gives {n_} a strong base." if q >= 0.35 else f"Your chart gives {n_} a steady base." if q >= 0.0
                else f"Your chart asks for extra effort with {n_}." if q >= -0.35 else f"Take extra care with {n_}; it is a sensitive area in your chart.")
    short = text.rstrip(".")
    return Ev(area, f"natal:{house}", mag, lord, "natal", text, short, pos, timely=False, topic=f"vip:{lord}" if vip else "", tech=tech)


def _karaka_natal_ev(ch: Chart, area: str, karaka: str, w: float) -> Ev:
    q = ch.quality(karaka)
    quality_word = "strong" if q >= 0.35 else "steady" if q >= 0 else "weak" if q >= -0.35 else "very sensitive"
    text = f"The natural support for {AREA_NOUN[area]} is {quality_word} in your chart."
    tech = f"{karaka} is the natural planet for {AREA_NOUN[area]}. In your chart it is {DIG_PHRASE[ch.dignity(karaka)]} {_where(ch, karaka)}."
    return Ev(area, f"natal:karaka:{karaka}", q * 4.0 * w, karaka, "natal", text, text.rstrip("."), q >= 0, timely=False, tech=tech)


def _links(ch: Chart, planet: str, area: str) -> List[str]:
    cfg = AREAS[area]
    out = []
    for house, _w in cfg["houses"]:
        if house in ch.owned[planet]:
            out.append(f"rules your {_hn(house)}")
        elif ch.house_of(planet) == house:
            out.append(f"sits in your {_hn(house)}")
    if not out:
        for karaka, _w in cfg["karakas"]:
            if karaka == planet:
                out.append(f"is the natural planet for {AREA_NOUN[area]}")
    return out


def _dasha_ev(ch: Chart, area: str, level: str, planet: str, mag: float) -> Ev:
    q = ch.quality(planet)
    links = _links(ch, planet, area)
    vip = planet in ch.viparita()
    noun = AREA_NOUN[area]
    if vip:
        text = f"Your current life phase may start with some struggle around {noun}, but it turns in your favour."
    elif q > 0.25:
        text = f"Your current life phase is good for {noun}."
    elif q < -0.25:
        text = f"Your current life phase tests {noun}, so be patient."
    else:
        text = f"Your current life phase keeps {noun} in focus."
    tech = f"You are running {planet} {LEVEL_NAME[level]}. {planet} {' and '.join(links[:2]) or 'affects this area'}."
    return Ev(area, f"dasha:{level}:{planet}", mag, planet, "dasha", text, text.rstrip("."), q > 0.0 or vip, level=level, topic=f"vip:{planet}" if vip else "", tech=tech)


def _status_clause(g: Gochar, area: str) -> Tuple[str, bool]:
    pos, neg = EFFECT[g.planet][area]
    if g.status == "favourable":
        return f"This is a good position for you, so {pos}.", True
    if g.status == "blocked":
        return f"This is normally a good position, but {g.blocker} is blocking it, so the benefit is small.", False
    return f"This is a tough position for you, so {neg}.", False


def _status_word(g: Gochar) -> str:
    return {"favourable": "good", "blocked": "blocked", "unfavourable": "tough"}[g.status]


def _plain_effect(g: Gochar, area: str) -> Tuple[str, bool]:
    pos, neg = EFFECT[g.planet][area]
    if g.status == "favourable":
        text, positive = f"{_cap(pos)}.", True
    elif g.status == "blocked":
        text, positive = f"A good chance around {AREA_NOUN[area]} is slow to show up, so keep trying.", False
    else:
        text, positive = f"{_cap(neg)}.", False
    if g.retrograde and g.planet in GRAHAS and g.planet not in ("Sun", "Moon") and area in ("career", "finance", "relationships"):
        text += " Results may come slower than expected."
    return text, positive


def _transit_ev(area: str, g: Gochar, mag: float) -> Ev:
    text, positive = _plain_effect(g, area)
    clause, _ = _status_clause(g, area)
    retro = " (retrograde, so results are slower)" if g.retrograde and g.planet in GRAHAS and g.planet not in ("Sun", "Moon") else ""
    tech = f"{g.planet}{retro} is in your {_hn(g.house_lagna)} and in the {ordinal(g.house_moon)} house from your birth Moon: a {_status_word(g)} position. {clause}"
    short = text.split(".")[0]
    return Ev(area, f"transit:{g.planet}", mag, g.planet, "transit", text, short, positive, tech=tech)


def _aspect_ev(area: str, g: Gochar, target: int, mag: float) -> Ev:
    n = ((target - g.house_lagna) % 12) + 1
    text, positive = _plain_effect(g, area)
    clause, _ = _status_clause(g, area)
    tech = f"{g.planet} in your {ordinal(g.house_lagna)} house aspects your {_hn(target)} with its {ordinal(n)}-house aspect; it is in the {ordinal(g.house_moon)} house from your birth Moon: a {_status_word(g)} position. {clause}"
    return Ev(area, f"aspect:{g.planet}:{target}", mag, g.planet, "aspect", text, text.split(".")[0], positive, tech=tech)


# ----------------------------------------------------------------------------- scoring


def _dasha_effect(ch: Chart, planet: str, area: str) -> Tuple[float, float]:
    cfg = AREAS[area]
    strength = 0.0
    for house, w in cfg["houses"]:
        if house in ch.owned[planet]:
            strength += w
        if ch.house_of(planet) == house:
            strength += 0.7 * w
    for karaka, w in cfg["karakas"]:
        if karaka == planet:
            strength += 0.5 * w
    strength = min(1.0, strength)
    return strength * ch.quality(planet), strength


def _score_area(ctx: Ctx, area: str) -> float:
    ch, cfg = ctx.chart, AREAS[area]
    total = 0.0
    n = max(len(ctx.samples), 1)

    # 1. natal promise
    natal = 0.0
    for idx, (house, w) in enumerate(cfg["houses"][:2]):
        ev = _natal_ev(ch, area, house, 1.0 if idx == 0 else 0.5)
        ctx.evs.append(ev)
        natal += ev.mag
    for k_idx, (karaka, w) in enumerate(cfg["karakas"]):
        natal += ch.quality(karaka) * 4.0 * w
        if k_idx == 0:
            ctx.evs.append(_karaka_natal_ev(ch, area, karaka, w))
    primary = cfg["houses"][0][0]
    for occ in ch.occupants(primary):
        natal += NATURAL[occ] * 2.5
    total += max(-14.0, min(14.0, natal))

    # 2. running dasha, averaged over the period
    weights = LEVEL_WEIGHTS[ctx.period]
    seen: Dict[str, float] = {}
    for lv in ctx.levels:
        for level in ("maha", "antar", "praty"):
            row = lv.get(level)
            if not row or weights[level] == 0:
                continue
            eff, strength = _dasha_effect(ch, row["planet"], area)
            if strength <= 0:
                continue
            seen[f"{level}:{row['planet']}"] = seen.get(f"{level}:{row['planet']}", 0.0) + eff * weights[level] / len(ctx.levels)
    dasha_total = 0.0
    for key, mag in seen.items():
        level, planet = key.split(":")
        dasha_total += mag
        if abs(mag) >= 0.9:
            ctx.evs.append(_dasha_ev(ch, area, level, planet, mag))
    total += max(-18.0, min(18.0, dasha_total))

    # 3. transits: house from Lagna, Gochar from the Moon (with Vedha), and aspects
    pw = PERIOD_WEIGHTS[ctx.period]
    houses = dict(cfg["houses"])
    t_acc: Dict[str, float] = {}
    t_ref: Dict[str, Tuple[Gochar, int]] = {}
    for _, transits, goch in ctx.samples:
        for name in PLANETS:
            g = goch[name]
            nat = NATURAL[name]
            sign = {"favourable": 1.0, "blocked": -0.15, "unfavourable": -0.8 if nat < 0 else -0.45}[g.status]
            base = 0.7 * sign + 0.3 * nat
            if g.house_lagna in houses:
                k = f"transit:{name}"
                t_acc[k] = t_acc.get(k, 0.0) + houses[g.house_lagna] * pw[name] * 6.5 * base / n
                t_ref[k] = (g, 0)
            for target in aspect_targets(name, g.house_lagna):
                if target in houses and target != g.house_lagna:
                    k = f"aspect:{name}:{target}"
                    t_acc[k] = t_acc.get(k, 0.0) + houses[target] * pw[name] * 3.2 * base / n
                    t_ref[k] = (g, target)
        for karaka, w in cfg["karakas"]:
            g = goch[karaka]
            k = f"transit:{karaka}"
            mag = {"favourable": 3.0, "blocked": -0.5, "unfavourable": -2.4}[g.status] * w * pw[karaka] / n
            t_acc[k] = t_acc.get(k, 0.0) + mag
            t_ref.setdefault(k, (g, 0))
    t_total = 0.0
    for key, mag in t_acc.items():
        t_total += mag
        if abs(mag) < 0.8:
            continue
        g, target = t_ref[key]
        if g.planet == "Moon" and ctx.period != "daily":
            continue  # the Moon is too quick to describe a week, month or year
        ctx.evs.append(_transit_ev(area, g, mag) if key.startswith("transit:") else _aspect_ev(area, g, target, mag))
    total += max(-22.0, min(22.0, t_total))

    # 4. Moon-day factors for the short scopes
    if ctx.period in ("daily", "weekly"):
        bala = _bala_total(ctx)
        factor = {"emotional": 1.5, "health": 1.0}.get(area, 0.6)
        total += bala * factor * (1.0 if ctx.period == "daily" else 0.6)
    return 50.0 + total * 0.95


def _bala_total(ctx: Ctx) -> float:
    ch = ctx.chart
    acc = 0.0
    for _, transits, goch in ctx.samples:
        hm = goch["Moon"].house_moon
        chandra = 5.0 if hm in FAVOURABLE["Moon"] else -5.0
        if hm == 8:
            chandra = -8.0
        tara = tara_of(moon_nak_of(transits), ch.birth_nak)
        acc += chandra + (3.0 if tara in TARA_GOOD else -3.0)
    return acc / max(len(ctx.samples), 1)


# ----------------------------------------------------------------------------- text blocks

DASHA_REL = {
    "daily": {"maha": 0.45, "antar": 0.7, "praty": 1.35},
    "weekly": {"maha": 0.55, "antar": 1.0, "praty": 1.1},
    "monthly": {"maha": 0.7, "antar": 1.1, "praty": 1.0},
    "yearly": {"maha": 1.15, "antar": 1.2, "praty": 1.0},
    "specific_year": {"maha": 1.15, "antar": 1.2, "praty": 1.0},
}
FAST_REL = {"daily": (1.5, 0.8), "weekly": (1.3, 0.95), "monthly": (1.15, 1.0), "yearly": (0.5, 1.5), "specific_year": (0.5, 1.5)}


def _relevance(e: Ev, period: str, seed: str) -> float:
    if e.kind == "dasha":
        r = DASHA_REL[period].get(e.level, 1.0)
    elif e.kind in ("transit", "aspect"):
        fast, slow = FAST_REL[period]
        r = fast if e.planet in FAST else slow
    elif e.kind == "event":
        r = 1.6
    else:
        r = 0.55
    jitter = 0.92 + 0.16 * (int(hashlib.sha256((seed + e.key).encode()).hexdigest()[:6], 16) / 0xFFFFFF)
    return abs(e.mag) * r * jitter


def _join(parts: List[str]) -> str:
    parts = [p.strip().rstrip(".") for p in parts if p]
    return ". ".join(p[0].upper() + p[1:] for p in parts) + ("." if parts else "")


def _pick_evs(evs: List[Ev], used: set, period: str, seed: str, tone: str, count: int = 2) -> List[Ev]:
    ranked = sorted(evs, key=lambda e: _relevance(e, period, seed), reverse=True)
    out: List[Ev] = []
    planets: set = set()

    def available(strict: bool, want: Optional[bool]):
        for e in ranked:
            if e in out or e.key in used or (e.topic and e.topic in used):
                continue
            if strict and e.planet in planets:
                continue
            if want is not None and e.positive != want:
                continue
            return e
        return None

    first_want = {"supportive": True, "pressured": False}.get(tone)
    plan = []
    if tone == "mixed":
        plan = [None, "opposite"]
    elif tone == "supportive":
        plan = [True, True]
    else:
        plan = [False, False]
    for slot in plan:
        if len(out) == count:
            break
        if slot == "opposite":
            want = (not out[0].positive) if out else None
        else:
            want = slot
        pick = available(True, want) or available(False, want) or available(True, None) or available(False, None)
        if not pick:
            break
        out.append(pick)
        planets.add(pick.planet)
        used.add(pick.key)
        if pick.topic:
            used.add(pick.topic)
    return out


def _area_block(ctx: Ctx, area: str, score: float, used: set) -> Tuple[str, List[str]]:
    mine = [e for e in ctx.evs if e.area == area]
    tone = tone_of(score)
    seed = f"{ctx.chart.lagna}|{ctx.chart.moon_idx}|{ctx.period}|{ctx.ref.date()}|{area}"
    chosen = _pick_evs(mine, used, ctx.period, seed, tone, 2)
    sentences = []
    for e in chosen:
        for part in re.split(r"(?<=[.])\s+", e.text):
            norm = part.strip().lower()
            if norm and norm not in ctx.said:
                ctx.said.add(norm)
                sentences.append(part)
    lead = _pick(LEADS[tone], seed + "L").format(when=WHEN[ctx.period], noun=AREA_NOUN[area])
    practice = _pick(PRACTICE[area][tone], seed + "P")
    body = f"{PREFIX} {lead} {_join(sentences)} {practice}"
    ranked_all = sorted(mine, key=lambda e: abs(e.mag), reverse=True)[:4]
    why = [e.tech or e.text for e in ranked_all]
    ctx.why_plain[area] = [e.text for e in ranked_all]
    return body, why



# ----------------------------------------------------------------------------- scope frames


TARA_PLAIN = {
    1: "you feel sensitive, so take it easy", 2: "gains and good support", 3: "avoid risks and shortcuts", 4: "safe and protective",
    5: "some friction is likely", 6: "your effort pays off", 7: "energy drains, so keep plans light", 8: "friendly and supportive", 9: "very supportive",
}


def _word(g: Gochar) -> str:
    return {"favourable": "good for you", "blocked": "held back", "unfavourable": "tough for you"}[g.status]


def _fmt_date(dt: datetime) -> str:
    return f"{dt.day} {dt.strftime('%b')}"


def _day_word(when: datetime, ref: datetime) -> str:
    delta = (when.date() - ref.date()).days
    return "today" if delta == 0 else "tomorrow" if delta == 1 else f"on {when.strftime('%A')}"


def _fmt_day(dt: datetime) -> str:
    return f"{dt.strftime('%a')} {dt.day} {dt.strftime('%b')}"


def _running(ch: Chart, lv: Dict) -> str:
    return f"{lv['maha']['planet']} Mahadasha, {lv['antar']['planet']} Antardasha" + (f", {lv['praty']['planet']} Pratyantar" if lv.get("praty") else "")


def _antar_line(ch: Chart, lv: Dict, ref: datetime, with_next: bool = True) -> str:
    a, m = lv["antar"], lv["maha"]
    end = datetime.fromisoformat(a["end"])
    txt = f"You are running {m['planet']} Mahadasha and {a['planet']} Antardasha (until {_fmt_date(end)} {end.year}). This phase puts the focus on {ch.focus_plain(a['planet'])}"
    nxt = lv.get("next_antar")
    if with_next and nxt:
        start = datetime.fromisoformat(nxt["start"])
        txt += f". {nxt['planet']} {'Mahadasha' if nxt.get('new_maha') else 'Antardasha'} starts on {_fmt_date(start)} {start.year}"
    return txt


def _frame_daily(ctx: Ctx, lat: float, lon: float) -> Dict:
    ch = ctx.chart
    ref = ctx.ref
    transits = get_current_transits(ref, ch.lagna, ch.moon_idx)
    goch = gochar_for(transits, ch)
    moon = goch["Moon"]
    hm = moon.house_moon
    phrase, ok = MOON_FROM_MOON[hm]
    tara = tara_of(moon_nak_of(transits), ch.birth_nak)
    lv = ctx.levels[0]
    timings = day_timings(ref, lat, lon)
    head = f"{PREFIX} Today feels {phrase}."
    weekday_lord = timings["weekday_lord"] if timings else None
    summary_parts = [
        f"{_antar_line(ch, lv, ref, with_next=False)}",
        f"Your mind is on {area_name(moon.house_lagna).replace(' and ', ' & ')} today",
        f"Your Tara Bala is {TARA_NAMES[tara - 1]}: {TARA_PLAIN[tara]}",
    ]
    if lv.get("praty"):
        pe = datetime.fromisoformat(lv['praty']['end'])
        summary_parts.insert(1, f"The smaller {lv['praty']['planet']} Pratyantar (until {_fmt_date(pe)}{'' if pe.year == ref.year else ' ' + str(pe.year)}) sets your daily mood")
    summary = f"{PREFIX} {_join(summary_parts)}"
    events = []
    # Moon ingress later today / tomorrow
    nxt = [e for e in scan_events(["Moon"], ref, ref + timedelta(hours=60), step_hours=3) if e["kind"] == "ingress"]
    if nxt:
        e = nxt[0]
        h2 = ((e["sign_idx"] - ch.moon_idx) % 12) + 1
        ph2, ok2 = MOON_FROM_MOON[h2]
        events.append({"when": f"{_fmt_day(e['when'])}, {clock(e['when'])}", "text": f"The mood changes: it turns {ph2}.", "tone": "good" if ok2 else "care"})
    tiles = [
        {"label": "Moon today", "value": f"{moon.sign}", "note": phrase.split(",")[0]},
        {"label": "Chandra Bala", "value": "Strong" if hm in FAVOURABLE["Moon"] and hm != 8 else "Weak", "note": "take care today" if hm == 8 else ("good for you" if ok else "take care today")},
        {"label": "Tara Bala", "value": f"{TARA_NAMES[tara - 1]}", "note": "supportive" if tara in TARA_GOOD else "go slowly"},
        {"label": "Running period", "value": f"{lv['maha']['planet']} › {lv['antar']['planet']}", "note": f"{lv['praty']['planet']} Pratyantar" if lv.get("praty") else ""},
    ]
    extra = []
    if nxt:
        e = nxt[0]
        h2 = ((e["sign_idx"] - ch.moon_idx) % 12) + 1
        ph2, ok2 = MOON_FROM_MOON[h2]
        extra.append(("emotional", f"From {clock(e['when'])} {_day_word(e['when'], ref)} the mood turns {ph2}", ok2, "Moon"))
    return {"headline": head, "summary": summary, "events": events, "tiles": tiles, "timings": timings, "moon_ok": ok, "extra": extra}


def _sample_at(ctx: Ctx, moment: datetime):
    best = min(ctx.samples, key=lambda s: abs((s[0] - moment).total_seconds()))
    return best[1], best[2]


def _frame_weekly(ctx: Ctx, rng: PeriodRange) -> Dict:
    ch = ctx.chart
    days = []
    for i in range(7):
        d = rng.start + timedelta(days=i, hours=12)
        transits = get_current_transits(d, ch.lagna, ch.moon_idx)
        goch = gochar_for(transits, ch)
        hm = goch["Moon"].house_moon
        tara = tara_of(moon_nak_of(transits), ch.birth_nak)
        rating = (1 if hm in FAVOURABLE["Moon"] and hm != 8 else -1) + (1 if tara in TARA_GOOD else -1)
        days.append({"date": d, "sign": goch["Moon"].sign, "hm": hm, "tara": tara, "rating": rating, "goch": goch})
    best = [d for d in days if d["rating"] == max(x["rating"] for x in days)]
    worst = [d for d in days if d["rating"] == min(x["rating"] for x in days)]
    lv = ctx.levels[len(ctx.levels) // 2]
    b, w = best[0], worst[-1]
    head = f"{PREFIX} Your best day this week is {_fmt_day(b['date'])} and the day to take it easy is {_fmt_day(w['date'])}."
    if b["rating"] == w["rating"]:
        head = f"{PREFIX} The Moon treats you evenly this week, so your running Dasha matters more than the daily mood."
    fast = []
    for p in ("Mars", "Mercury", "Venus", "Sun"):
        g = days[3]["goch"][p]
        pass
    best_txt = " or ".join(_fmt_day(d["date"]).split(" ")[0] for d in best[:2])
    worst_txt = " and ".join(_fmt_day(d["date"]).split(" ")[0] for d in worst[:2])
    tone_txt = f"Your good days are {best_txt}, and {worst_txt} need extra care" if best[0]["rating"] != worst[0]["rating"] else "The days feel fairly even"
    summary = f"{PREFIX} {_join([_antar_line(ch, lv, rng.start, with_next=False), tone_txt])}"
    events = []
    for d in days:
        ph, ok = MOON_FROM_MOON[d["hm"]]
        events.append({"when": _fmt_day(d["date"]), "text": f"The day feels {ph}.", "tone": "good" if d["rating"] > 0 else "care" if d["rating"] < 0 else "mid"})
    tiles = [
        {"label": "Best day", "value": _fmt_day(b["date"]).split(" ")[0], "note": "your best day"},
        {"label": "Go gently", "value": _fmt_day(w["date"]).split(" ")[0], "note": "take it easy"},
        {"label": "Running period", "value": f"{lv['maha']['planet']} › {lv['antar']['planet']}", "note": f"{lv['praty']['planet']} Pratyantar" if lv.get("praty") else ""},
        {"label": "Saturn", "value": days[3]["goch"]["Saturn"].sign, "note": _word(days[3]["goch"]["Saturn"])},
    ]
    extra = []
    if b["rating"] != w["rating"]:
        ph_b, _ = MOON_FROM_MOON[b["hm"]]
        ph_w, _ = MOON_FROM_MOON[w["hm"]]
        extra.append(("emotional", f"{_fmt_day(b['date'])} is your best day of the week: it feels {ph_b}", True, "Moon"))
        extra.append(("emotional", f"{_fmt_day(w['date'])} needs care, as feelings run closer to the surface: it feels {ph_w}", False, "Moon"))
        low_tara = [d for d in days if d["tara"] not in TARA_GOOD]
        if low_tara:
            d = low_tara[0]
            extra.append(("health", f"Your energy may dip on {_fmt_day(d['date'])}: {TARA_PLAIN[d['tara']]}", False, "Moon"))
        good_tara = [d for d in days if d["tara"] in TARA_GOOD and d["rating"] >= 0]
        if good_tara:
            d = good_tara[-1]
            extra.append(("health", f"{_fmt_day(d['date'])} is a good day to start a healthy routine or see a doctor: {TARA_PLAIN[d['tara']]}", True, "Moon"))
    return {"headline": head, "summary": summary, "events": events, "tiles": tiles, "best_days": best, "worst_days": worst, "extra": extra}


def _frame_monthly(ctx: Ctx, rng: PeriodRange) -> Dict:
    ch = ctx.chart
    mid = rng.start + (rng.end - rng.start) / 2
    transits = get_current_transits(mid, ch.lagna, ch.moon_idx)
    goch = gochar_for(transits, ch)
    sun = goch["Sun"]
    lv = ctx.levels[len(ctx.levels) // 2]
    ev = scan_events(["Sun", "Mercury", "Venus", "Mars"], rng.start, rng.end, step_hours=12)
    ev = [e for e in ev if e["kind"] == "ingress" or e["planet"] in ("Mercury", "Venus", "Mars")]
    events = []
    for e in ev:
        hm = ((e["sign_idx"] - ch.moon_idx) % 12) + 1
        hl = ((e["sign_idx"] - ch.lagna) % 12) + 1
        fav = hm in FAVOURABLE[e["planet"]]
        pos, neg = THEME[e["planet"]]
        if e["kind"] == "ingress":
            events.append({"when": _fmt_day(e["when"]), "text": f"{PP[e['planet']]} turns to {area_name(hl).replace(' and ', ' & ')}. {'A good' if fav else 'A tough'} time for you: {pos if fav else neg}.", "tone": "good" if fav else "care", "house": hl, "planet": e["planet"]})
        else:
            events.append({"when": _fmt_day(e["when"]), "text": f"{PP[e['planet']]} turns {'retrograde' if e['retro'] else 'direct'}: " + ("slow down, review and redo before moving ahead." if e["retro"] else "stuck matters start moving again."), "tone": "care" if e["retro"] else "good", "house": hl, "planet": e["planet"]})
    for lun in lunations(rng.start, rng.end):
        hl = ((lun["sign_idx"] - ch.lagna) % 12) + 1
        events.append({"when": _fmt_day(lun["when"]), "text": f"{'New' if lun['kind'] == 'new' else 'Full'} Moon in the area of {area_name(hl).replace(' and ', ' & ')}: " + ("a good time to set goals here." if lun["kind"] == "new" else "matters here come to a head or become clear."), "tone": "mid", "house": hl, "planet": "Moon"})
    events = _sorted_events(events, rng.start)[:8]
    head = f"{PREFIX} This month your energy and attention go to {area_name(sun.house_lagna).replace(' and ', ' & ')}."
    summary = f"{PREFIX} {_join([_antar_line(ch, lv, rng.start), 'Check the key dates below for the best days to act'])}"
    tiles = [
        {"label": "Sun this month", "value": sun.sign, "note": area_name(sun.house_lagna).replace(" and ", " & ")},
        {"label": "Mars", "value": goch["Mars"].sign, "note": _word(goch["Mars"])},
        {"label": "Running period", "value": f"{lv['maha']['planet']} › {lv['antar']['planet']}", "note": ""},
        {"label": "Saturn", "value": goch["Saturn"].sign, "note": _word(goch["Saturn"])},
    ]
    return {"headline": head, "summary": summary, "events": events, "tiles": tiles}


def _frame_year(ctx: Ctx, rng: PeriodRange, label: str) -> Dict:
    ch = ctx.chart
    start, end = rng.start, rng.end
    evs = scan_events(["Jupiter", "Saturn", "Rahu"], start, end, step_hours=24)
    events = []
    for e in evs:
        hm = ((e["sign_idx"] - ch.moon_idx) % 12) + 1
        hl = ((e["sign_idx"] - ch.lagna) % 12) + 1
        p = e["planet"]
        fav = hm in FAVOURABLE[p]
        pos, neg = THEME[p]
        sign = SIGN[e["sign_idx"]]
        if e["kind"] == "ingress":
            name = "Rahu and Ketu change signs (Rahu enters " + sign + ")" if p == "Rahu" else f"{p} enters {sign}"
            events.append({"when": _fmt_day(e["when"]), "text": f"{'Rahu and Ketu change places' if p == 'Rahu' else PP[p] + ' changes sign'}, bringing focus to {area_name(hl).replace(' and ', ' & ')}. {'A good' if fav else 'A tough'} time for you: {pos if fav else neg}.", "tone": "good" if fav else "care", "planet": p, "house": hl})
        else:
            events.append({"when": _fmt_day(e["when"]), "text": f"{PP[p]} turns {'retrograde' if e['retro'] else 'direct'} ({area_name(hl).replace(' and ', ' & ')}): " + ("these matters slow down and get revisited." if e["retro"] else "these matters move forward again."), "tone": "care" if e["retro"] else "good", "planet": p, "house": hl})
    # dasha changes inside the year
    changes = _dasha_changes(ch, start, end)
    for c in changes:
        events.append({"when": _fmt_day(c["when"]), "text": c["text"], "tone": "mid", "planet": c["planet"]})
    events = _sorted_events(events, start)
    first = ctx.samples[0][2]
    mid = ctx.samples[len(ctx.samples) // 2][2]
    last = ctx.samples[-1][2]
    ss = [sade_sati(s[1], ch) for s in (ctx.samples[0], ctx.samples[len(ctx.samples) // 2], ctx.samples[-1])]
    active = [s for s in ss if s["active"]]
    sade_text = f"{active[-1]['kind']}: {active[-1]['phase']}" if active else "Not active"
    lv = ctx.levels[len(ctx.levels) // 2]
    jup = mid["Jupiter"]
    sat = mid["Saturn"]
    head = f"{PREFIX} {_year_headline(ch, label, start, evs)}"
    parts = [_antar_line(ch, lv, rng.start)]
    if active:
        parts.append(f"{active[-1]['kind']} is on: a long period of slow, steady growth and clearing out what is not solid")
    parts.append(f"Rahu and Ketu pull you between ambition ({area_name(mid['Rahu'].house_lagna).replace(' and ', ' & ')}) and letting go ({area_name(mid['Ketu'].house_lagna).replace(' and ', ' & ')})")
    summary = f"{PREFIX} {_join(parts)}"
    tiles = [
        {"label": "Jupiter", "value": jup.sign, "note": _word(jup)},
        {"label": "Saturn", "value": sat.sign, "note": _word(sat)},
        {"label": "Sade Sati", "value": sade_text, "note": ""},
        {"label": "Running period", "value": f"{lv['maha']['planet']} › {lv['antar']['planet']}", "note": ""},
    ]
    return {"headline": head, "summary": summary, "events": events[:10], "tiles": tiles}


PP = {
    "Sun": "Sun (confidence)", "Moon": "Moon (mind)", "Mars": "Mars (energy)", "Mercury": "Mercury (communication)", "Jupiter": "Jupiter (luck)",
    "Venus": "Venus (love & comfort)", "Saturn": "Saturn (discipline)", "Rahu": "Rahu (ambition)", "Ketu": "Ketu (detachment)",
}


def _year_headline(ch: Chart, label: str, start: datetime, evs: List[Dict]) -> str:
    from .calculations import _rashi_index
    from .astro_facts import lon_speed

    bits = []
    for planet, role in (("Jupiter", "luck"), ("Saturn", "discipline")):
        first = _rashi_index(lon_speed(planet, start)[0])
        areas = [area_name(((first - ch.lagna) % 12) + 1).replace(" and ", " & ")]
        for e in evs:
            if e["kind"] == "ingress" and e["planet"] == planet:
                a = area_name(((e["sign_idx"] - ch.lagna) % 12) + 1).replace(" and ", " & ")
                if a != areas[-1]:
                    areas.append(a)
        bits.append(f"{planet} ({role}) {'stays on ' + areas[0] if len(areas) == 1 else 'moves through ' + ', '.join(areas[:-1]) + ' and ' + areas[-1]}")
    return f"In {label}, {bits[0]}, and {bits[1]}."


def _path(ch: Chart, planet: str, start: datetime, evs: List[Dict]) -> str:
    from .calculations import _rashi_index
    from .astro_facts import lon_speed

    first = _rashi_index(lon_speed(planet, start)[0])
    signs = [first]
    for e in evs:
        if e["kind"] == "ingress" and e["planet"] == planet and e["sign_idx"] != signs[-1]:
            signs.append(e["sign_idx"])
    if len(signs) == 1:
        h_l = ((first - ch.lagna) % 12) + 1
        h_m = ((first - ch.moon_idx) % 12) + 1
        return f"{planet} stays in {SIGN[first]} (your {ordinal(h_l)} house)"
    text = f"{planet} moves from {SIGN[signs[0]]} into {SIGN[signs[1]]}"
    seen = {signs[0], signs[1]}
    for idx in signs[2:]:
        text += f", then {'back into' if idx in seen else 'into'} {SIGN[idx]}"
        seen.add(idx)
    return text


def _dasha_changes(ch: Chart, start: datetime, end: datetime) -> List[Dict]:
    from .dasha_levels import antardashas

    out = []
    for m in ch.k.get("dasha", []):
        ms, me = datetime.fromisoformat(m["start"]), datetime.fromisoformat(m["end"])
        if me < start or ms > end:
            continue
        if start <= ms <= end and ms > datetime.fromisoformat(ch.k["dasha"][0]["start"]):
            out.append({"when": ms, "planet": m["planet"], "text": f"A new Mahadasha starts ({m['planet']}): the main theme of your life for the next {m.get('years') and round(float(m['years']))} years changes to {ch.focus_plain(m['planet'])}."})
        for a in antardashas(m):
            as_ = datetime.fromisoformat(a["start"])
            if start <= as_ <= end and a["start"] != m["start"]:
                out.append({"when": as_, "planet": a["planet"], "text": f"A new phase starts ({a['planet']} Antardasha): the focus moves to {ch.focus_plain(a['planet'])}."})
    return out


def AREA_NOUN_FOR_PLANET(ch: Chart, planet: str) -> str:
    houses = ch.owned.get(planet) or [ch.house_of(planet)]
    return area_name(houses[0]) if houses else "life"


def _sorted_events(events: List[Dict], start: datetime) -> List[Dict]:
    def key(e):
        try:
            return datetime.strptime(f"{e['when']} {start.year}", "%a %d %b %Y")
        except Exception:
            return start
    return sorted(events, key=key)


# ----------------------------------------------------------------------------- remedy / lucky


def _lucky_planet(ctx: Ctx, goch: Dict[str, Gochar], weekday_lord: Optional[str]) -> Tuple[str, str]:
    ch = ctx.chart
    lv = ctx.levels[len(ctx.levels) // 2]
    best, best_score, why = "Jupiter", -99.0, ""
    for p in GRAHAS:
        s = ch.quality(p) * 3.0
        g = goch[p]
        s += 2.0 if g.status == "favourable" else -1.0 if g.status == "unfavourable" else 0.0
        if p == lv["maha"]["planet"]:
            s += 2.5
        if p == lv["antar"]["planet"]:
            s += 1.8
        if p == weekday_lord:
            s += 0.8
        if s > best_score:
            best, best_score = p, s
    g = goch[best]
    reasons = []
    if ch.quality(best) > 0.15:
        reasons.append(f"it is {DIG_SHORT[ch.dignity(best)]} in your chart")
    if g.status == "favourable":
        reasons.append("it is moving well right now")
    if best == lv["maha"]["planet"]:
        reasons.append("it leads your current life phase (Mahadasha)")
    elif best == lv["antar"]["planet"]:
        reasons.append("it leads your current sub-phase (Antardasha)")
    if not reasons:
        return best, "it is the steadiest planet in your chart at this time"
    return best, (", ".join(reasons[:-1]) + (", and " if len(reasons) > 2 else " and ") + reasons[-1]) if len(reasons) > 1 else reasons[0]


def _pressure_planet(ctx: Ctx) -> Optional[str]:
    acc: Dict[str, float] = {}
    for e in ctx.evs:
        if e.mag < 0 and e.timely:
            acc[e.planet] = acc.get(e.planet, 0.0) + e.mag
    if acc:
        p, v = min(acc.items(), key=lambda kv: kv[1])
        if v <= -1.5 and p in _remedies():
            return p
    lv = ctx.levels[len(ctx.levels) // 2]
    weakest = min((lv["maha"]["planet"], lv["antar"]["planet"]), key=lambda p: ctx.chart.quality(p))
    if ctx.chart.quality(weakest) < -0.05:
        return weakest
    return None


DONATE_FIX = {"Ketu": "a blanket, or food for a stray dog"}


def _remedy(ctx: Ctx, pressure: Optional[str], lucky: str, timings: Optional[Dict], scope_label: str) -> Dict:
    rem = _remedies()
    planet = pressure or lucky
    r = rem[planet]
    habit = r["habit"].rstrip(".")
    habit = habit[0].lower() + habit[1:]
    donate = DONATE_FIX.get(planet, r["donate"])
    if pressure:
        headline = f"{PREFIX} {planet} needs attention {scope_label}: {habit}."
        posture = f"{PREFIX} To calm {planet}, chant \"{r['mantra']}\" on {r['day']} and donate {donate}. Worship: {r['worship']}."
    else:
        headline = f"{PREFIX} Nothing in your chart is pressing hard {scope_label}, so build on {planet}: {habit}."
        posture = f"{PREFIX} To strengthen {planet}, chant \"{r['mantra']}\" on {r['day']}. Worship: {r['worship']}."
    return {"headline": headline, "posture": posture, "planet": planet}


def _timing_discipline(period: str, frame: Dict, lucky: str) -> str:
    t = frame.get("timings")
    if period == "daily" and t:
        hora = next((h for h in t["horas"] if h["planet"] == lucky and h["end"] > frame["_ref"]), None) or next((h for h in t["horas"] if h["planet"] == lucky), None)
        pieces = [f"Avoid starting anything new during Rahu Kaal ({window(*t['rahu_kaal'])})"]
        if hora:
            pieces.append(f"{lucky}'s hora ({window(hora['start'], hora['end'])}) is good for {PLANET_USE.get(lucky, 'your goals')}")
        pieces.append(f"Abhijit Muhurta ({window(*t['abhijit'])}) is a good time to start something important")
        return f"{PREFIX} " + _join(pieces)
    if period == "weekly":
        b = frame.get("best_days") or []
        w = frame.get("worst_days") or []
        bits = []
        if b:
            bits.append("Plan important work on " + " or ".join(_fmt_day(d["date"]).split(" ")[0] for d in b[:2]))
        if w:
            bits.append("Take it easy on " + " and ".join(_fmt_day(d["date"]).split(" ")[0] for d in w[:2]))
        return f"{PREFIX} " + (_join(bits) if bits else "work to a steady routine through the week.")
    ev = [e for e in frame.get("events", []) if e["tone"] == "good"]
    care = [e for e in frame.get("events", []) if e["tone"] == "care"]
    bits = []
    if ev:
        bits.append(f"Good dates to act on: {', '.join(e['when'] for e in ev[:3])}")
    if care:
        bits.append(f"Be careful around: {', '.join(e['when'] for e in care[:3])}")
    return f"{PREFIX} " + (_join(bits) if bits else "No sharp turning points stand out, so steady effort wins.")


# ----------------------------------------------------------------------------- public API


def _lucky_short(period: str, planet: str, timings: Optional[Dict], ref: datetime, lat: float, lon: float) -> str:
    if period == "daily" and timings:
        hora = next((h for h in timings["horas"] if h["planet"] == planet and h["end"] > ref), None)
        if hora:
            return f"{clock(hora['start'])} ({planet} hora)"
        tomorrow = day_timings(ref + timedelta(days=1), lat, lon)
        hora = next((h for h in (tomorrow or {}).get("horas", []) if h["planet"] == planet), None)
        if hora:
            return f"Tomorrow {clock(hora['start'])} ({planet} hora)"
    return f"{PLANET_DAY.get(planet, 'Thursday')}s"


def _lucky_time(period: str, planet: str, timings: Optional[Dict], ref: datetime, lat: float, lon: float) -> str:
    if period == "daily" and timings:
        hora = next((h for h in timings["horas"] if h["planet"] == planet and h["end"] > ref), None)
        if hora:
            return f"{planet} hora, {window(hora['start'], hora['end'])}"
        tomorrow = day_timings(ref + timedelta(days=1), lat, lon)
        hora = next((h for h in (tomorrow or {}).get("horas", []) if h["planet"] == planet), None)
        if hora:
            return f"{planet} hora tomorrow, {window(hora['start'], hora['end'])}"
    return f"{PLANET_DAY.get(planet, 'Thursday')}s, in {planet}'s hora"


def build_krishna_scope(*, kundali: Dict, period_type: str, reference_dt: datetime, selected_year: Optional[int], lat: float, lon: float) -> Dict:
    ch = Chart(kundali)
    rng = get_period_range(period_type, reference_dt, selected_year)
    points = get_period_sample_points(rng)
    samples = []
    for dt in points:
        t = get_current_transits(dt, ch.lagna, ch.moon_idx)
        samples.append((dt, t, gochar_for(t, ch)))
    levels = [levels_at(kundali, dt) for dt in points]
    ctx = Ctx(chart=ch, period=period_type, ref=reference_dt, samples=samples, levels=levels)

    scores = {a: _score_area(ctx, a) for a in AREAS}
    area_scores = {a: int(round(max(18.0, min(93.0, v)))) for a, v in scores.items()}

    if period_type == "daily":
        frame = _frame_daily(ctx, lat, lon)
    elif period_type == "weekly":
        frame = _frame_weekly(ctx, rng)
    elif period_type == "monthly":
        frame = _frame_monthly(ctx, rng)
    else:
        label = str(rng.start.year)
        frame = _frame_year(ctx, rng, label)
    frame["_ref"] = reference_dt

    for idx, ev in enumerate(frame.get("events", [])):
        house = ev.get("house")
        if not house or ev.get("planet") == "Moon" and ev.get("when") is None:
            continue
        for area, cfg in AREAS.items():
            weight = dict(cfg["houses"]).get(house)
            if not weight:
                continue
            good = ev.get("tone") == "good"
            ctx.evs.append(Ev(area, f"event:{idx}", (3.4 if good else -3.4) * weight, ev.get("planet", ""), "event", f"{ev['when']}: {ev['text'].rstrip('.')}", f"{ev['when']}: {ev['text'].rstrip('.')}", good))
    for idx, (area, text, good, planet) in enumerate(frame.get("extra", [])):
        ctx.evs.append(Ev(area, f"extra:{idx}", 4.2 if good else -4.2, planet, "event", text, re.split(r":\s|\.\s", text)[0].rstrip("."), good))

    used: set = {"transit:Moon"}
    for lv in levels:
        used.add(f"dasha:antar:{lv['antar']['planet']}")
        if period_type in ("daily", "weekly"):
            used.add(f"dasha:maha:{lv['maha']['planet']}")
    details, why = {}, {}
    for area in ("emotional", "career", "relationships", "finance", "health", "spiritual"):
        details[area], why[area] = _area_block(ctx, area, area_scores[area], used)

    # strongest / weakest lanes
    ranked = sorted(area_scores.items(), key=lambda kv: kv[1], reverse=True)
    best_area, worst_area = ranked[0][0], ranked[-1][0]

    timings = frame.get("timings") if period_type == "daily" else day_timings(reference_dt, lat, lon)
    mid_goch = ctx.samples[len(ctx.samples) // 2][2]
    weekday_lord = timings["weekday_lord"] if timings else None
    lucky_planet, lucky_why = _lucky_planet(ctx, mid_goch, weekday_lord)
    pressure = _pressure_planet(ctx)
    scope_label = {"daily": "today", "weekly": "this week", "monthly": "this month", "yearly": "this year", "specific_year": "this year"}[period_type]
    remedy = _remedy(ctx, pressure, lucky_planet, timings, scope_label)

    # dominant planet: the one carrying the most weight in this period's evidence
    weight_by_planet: Dict[str, float] = {}
    for e in ctx.evs:
        if e.timely:
            weight_by_planet[e.planet] = weight_by_planet.get(e.planet, 0.0) + abs(e.mag)
    dominant = max(weight_by_planet.items(), key=lambda kv: kv[1])[0] if weight_by_planet else lucky_planet

    # opportunities / cautions (one fact per line, not reused from the detail blocks wording)
    # side lists use only facts the analysis blocks did not already say
    timely = [e for e in ctx.evs if e.timely and not (e.planet == "Moon" and period_type != "daily")
              and e.key not in used and e.text.strip().lower() not in ctx.said and not any(p_.strip().lower() in ctx.said for p_ in re.split(r"(?<=[.])\s+", e.text))]
    pos = sorted([e for e in timely if e.positive], key=lambda e: abs(e.mag), reverse=True)
    neg = sorted([e for e in timely if not e.positive], key=lambda e: abs(e.mag), reverse=True)

    def _short_list(items):
        out, seen_ = [], set()
        for e in _dedupe(items):
            txt = f"{e.short[0].upper()}{e.short[1:]}."
            if txt not in seen_ and txt.lower() not in ctx.said:
                seen_.add(txt)
                out.append(txt)
        return out[:3]

    opportunities = _short_list(pos)
    cautions = _short_list(neg)

    signals = {}
    for area in AREAS:
        mine = sorted([e for e in ctx.evs if e.area == area and not (e.planet == "Moon" and period_type != "daily")], key=lambda e: abs(e.mag), reverse=True)
        signals[area] = {
            "help": [e.short for e in _dedupe([e for e in mine if e.positive])[:2]],
            "care": [e.short for e in _dedupe([e for e in mine if not e.positive])[:2]],
        }
    area_remedy = {}
    for area, cfg in AREAS.items():
        negs = sorted([e for e in ctx.evs if e.area == area and not e.positive and e.timely and e.planet in _remedies()], key=lambda e: e.mag)
        planet = negs[0].planet if negs else cfg["karakas"][0][0]
        area_remedy[area] = _remedy(ctx, planet if negs else None, planet, None, scope_label)["posture"]

    all_mag = sorted((abs(e.mag) for e in ctx.evs if e.timely), reverse=True)[:8]
    clarity = int(max(52, min(90, 46 + sum(all_mag) * 0.9)))

    when = {"daily": "Today", "weekly": "This week", "monthly": "This month", "yearly": "This year", "specific_year": "This year"}[period_type]
    low = {"emotional": "your emotional state", "career": "career", "relationships": "relationships", "finance": "money", "health": "health and energy", "spiritual": "your inner life"}
    focus = f"{PREFIX} {when} your strongest area is {low[best_area]}. Put your main effort there and keep {low[worst_area]} simple."
    lv_mid = levels[len(levels) // 2]
    lucky = {
        "color": PLANET_COLOR[lucky_planet],
        "number": PLANET_NUMBER[lucky_planet],
        "time": _lucky_time(period_type, lucky_planet, timings, reference_dt, lat, lon),
        "timeShort": _lucky_short(period_type, lucky_planet, timings, reference_dt, lat, lon),
        "planet": lucky_planet,
        "why": f"{PREFIX} {lucky_planet} is your luckiest planet {scope_label}: {lucky_why}.",
        "useFor": PLANET_USE[lucky_planet],
    }
    advice = {
        "headline": remedy["headline"],
        "timing": _timing_discipline(period_type, frame, lucky_planet),
        "posture": remedy["posture"],
    }
    key_transits = {}
    for name in PLANETS:
        g = mid_goch[name]
        key_transits[name] = {"rashi": g.sign, "houseFromLagna": g.house_lagna, "houseFromMoon": g.house_moon, "retrograde": g.retrograde, "gochar": g.status}

    return {
        "headline": frame["headline"],
        "cosmic_message": frame["headline"],
        "summary": frame["summary"],
        "focus": focus,
        "details": {k: v for k, v in details.items() if k != "spiritual"},
        "spiritualNote": details["spiritual"],
        "scores": {"love": area_scores["relationships"], "career": area_scores["career"], "health": area_scores["health"], "finance": area_scores["finance"]},
        "extraScores": {"emotional": area_scores["emotional"], "spiritual": area_scores["spiritual"]},
        "why": {k: why[k] for k in why},
        "whyPlain": ctx.why_plain,
        "advice": advice["headline"],
        "adviceParts": advice,
        "lucky": lucky,
        "events": frame["events"],
        "timing": frame["tiles"],
        "opportunities": opportunities,
        "cautions": cautions,
        "confidence": clarity,
        "dominant_planet": dominant,
        "mahadasha": lv_mid["maha"]["planet"],
        "antardasha": lv_mid["antar"]["planet"],
        "pratyantar": (lv_mid.get("praty") or {}).get("planet", ""),
        "keyTransits": key_transits,
        "bestArea": best_area,
        "worstArea": worst_area,
        "signals": signals,
        "areaRemedy": area_remedy,
    }


def _dedupe(evs: List[Ev]) -> List[Ev]:
    seen, out = set(), []
    for e in evs:
        if e.key in seen:
            continue
        seen.add(e.key)
        out.append(e)
    return out


def build_natal_note(kundali: Dict, now: datetime) -> Dict:
    ch = Chart(kundali)
    lagna_lord = ch.lord_of_house[1]
    lv = levels_at(kundali, now)
    q = ch.quality(lagna_lord)
    ruler = ("gives you confidence and drive" if q >= 0.35 else "gives you a steady, balanced nature" if q >= 0 else "means you build confidence step by step")
    parts = [
        f"Your Lagna is {SIGN[ch.lagna]} and your Moon sign is {SIGN[ch.moon_idx]} ({ch.moon_nak_name} nakshatra)",
        f"Your chart ruler {lagna_lord} is {DIG_SHORT[ch.dignity(lagna_lord)]}, which {ruler}",
    ]
    yogas = ch.yogas()
    if yogas:
        parts.append(f"{yogas[0][0]}: {yogas[0][1]}")
    parts.append(f"You are running {lv['maha']['planet']} Mahadasha and {lv['antar']['planet']} Antardasha, which puts the focus on {ch.focus_plain(lv['antar']['planet'])}")
    return {"note": f"{PREFIX} {_join(parts)}", "yogas": [{"name": n, "meaning": m} for n, m in yogas], "lagnaLord": lagna_lord}


def timing_windows(kundali: Dict, house: int, karakas: Sequence[str], now: datetime, years: int = 5) -> List[str]:
    """Upcoming periods that classically support the life area of ``house``."""
    from .astro_facts import lon_speed, scan_events
    from .calculations import _rashi_index
    from .dasha_levels import antardashas

    ch = Chart(kundali)
    end = now + timedelta(days=int(365.25 * years))
    topic = area_name(house).replace(" and ", " & ")
    relevant = {ch.lord_of_house[house], *ch.occupants(house), *karakas}
    out: List[str] = []
    for m in kundali.get("dasha", []):
        ms, me = datetime.fromisoformat(m["start"]), datetime.fromisoformat(m["end"])
        if me < now or ms > end:
            continue
        for a in antardashas(m):
            s_, e_ = datetime.fromisoformat(a["start"]), datetime.fromisoformat(a["end"])
            if e_ < now or s_ > end or a["planet"] not in relevant:
                continue
            out.append(f"{_fmt_date(max(s_, now))} {max(s_, now).year} to {_fmt_date(e_)} {e_.year} ({a['planet']} Antardasha) is a good period for {topic}")
    evs = scan_events(["Jupiter"], now, end, step_hours=24)
    marks = [(now, _rashi_index(lon_speed("Jupiter", now)[0]))] + [(e["when"], e["sign_idx"]) for e in evs if e["kind"] == "ingress"]
    spans: List[List] = []
    for i, (t0, sign) in enumerate(marks):
        t1 = marks[i + 1][0] if i + 1 < len(marks) else end
        hj = ((sign - ch.lagna) % 12) + 1
        if (house - hj) % 12 in (0, 4, 6, 8):
            if spans and spans[-1][2] == sign and (t0 - spans[-1][1]).days <= 3:
                spans[-1][1] = t1
            else:
                spans.append([t0, t1, sign])
    for t0, t1, _sign in spans:
        out.append(f"{_fmt_date(t0)} {t0.year} to {_fmt_date(t1)} {t1.year}: Jupiter (luck) supports {topic}")
    return out[:4]
