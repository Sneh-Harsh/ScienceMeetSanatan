"""Plain-language reading built on top of the chart the engine has already calculated.

Nothing here recalculates a chart: every sentence is chosen from facts the engine returned (which sign is rising, which
planet sits in which house, how strong it is, which dasha is running, which doshas were detected). The wording follows
what traditional Vedic readings (and the free kundli sites) say, in everyday language instead of house numbers."""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from .dasha_engine import _antardashas

SIGN_EN = {
    "Mesha": "Aries", "Vrishabha": "Taurus", "Mithuna": "Gemini", "Karka": "Cancer", "Simha": "Leo", "Kanya": "Virgo",
    "Tula": "Libra", "Vrischika": "Scorpio", "Dhanu": "Sagittarius", "Makara": "Capricorn", "Kumbha": "Aquarius",
    "Meena": "Pisces",
}


def sign_name(sign: str) -> str:
    return f"{sign} ({SIGN_EN[sign]})" if sign in SIGN_EN else str(sign)


# sign -> (how the person comes across, strengths, watch-outs)
SIGN_TRAITS = {
    "Mesha": ("bold, energetic and quick to act", ["courage", "leadership", "a fresh start attitude"], ["impatience", "a short temper"]),
    "Vrishabha": ("calm, loyal and steady", ["patience", "practical thinking", "taste for comfort"], ["stubbornness", "resisting change"]),
    "Mithuna": ("curious, witty and good with words", ["quick learning", "communication", "adaptability"], ["restlessness", "overthinking"]),
    "Karka": ("caring, emotional and protective", ["empathy", "loyalty to family", "strong intuition"], ["mood swings", "holding on to hurt"]),
    "Simha": ("confident, warm and proud", ["leadership", "generosity", "natural charisma"], ["ego", "needing constant appreciation"]),
    "Kanya": ("careful, practical and detail-minded", ["analysis", "service attitude", "discipline"], ["over-criticism", "worrying too much"]),
    "Tula": ("charming, fair-minded and peace-loving", ["diplomacy", "good taste", "a sense of balance"], ["indecision", "avoiding hard conversations"]),
    "Vrischika": ("intense, private and determined", ["deep focus", "willpower", "research ability"], ["jealousy", "holding grudges"]),
    "Dhanu": ("optimistic, free-spirited and honest", ["wisdom", "love of learning and travel", "faith"], ["blunt speech", "taking on too much"]),
    "Makara": ("disciplined, ambitious and responsible", ["hard work", "patience", "long-term planning"], ["being too serious", "slow to relax"]),
    "Kumbha": ("original, friendly and independent", ["fresh ideas", "humanitarian thinking", "loyalty to friends"], ["emotional distance", "stubborn opinions"]),
    "Meena": ("gentle, imaginative and spiritual", ["compassion", "creativity", "intuition"], ["escapism", "being too trusting"]),
}

MOON_MIND = {
    "Mesha": "reacts fast and feels things strongly, then moves on", "Vrishabha": "needs security and comfort to feel calm",
    "Mithuna": "is always thinking, talking and learning", "Karka": "feels deeply and is closely tied to family and home",
    "Simha": "needs respect and warmth to feel happy", "Kanya": "stays alert and likes things in order",
    "Tula": "seeks harmony and dislikes conflict", "Vrischika": "feels very deeply but shows little",
    "Dhanu": "stays hopeful and looks for meaning", "Makara": "stays serious and responsible, even in tough times",
    "Kumbha": "likes freedom and thinks differently from the crowd", "Meena": "is sensitive, dreamy and very intuitive",
}

NAKSHATRA_TRAIT = {
    "Ashwini": "quick, energetic and a natural healer", "Bharani": "strong-willed and able to carry heavy responsibility",
    "Krittika": "sharp, honest and straightforward", "Rohini": "attractive, creative and fond of beauty and comfort",
    "Mrigashira": "curious and always searching", "Ardra": "intense, intelligent and able to rebuild after storms",
    "Punarvasu": "forgiving, optimistic and good at starting over", "Pushya": "caring, wise and nourishing to others",
    "Ashlesha": "perceptive, deep and strategic", "Magha": "dignified and proud of family and heritage",
    "Purva Phalguni": "warm, fun-loving and creative", "Uttara Phalguni": "helpful, reliable and generous",
    "Hasta": "skilled with the hands and clever", "Chitra": "creative with an eye for design",
    "Swati": "independent and flexible, good in business", "Vishakha": "determined and goal-driven",
    "Anuradha": "devoted, friendly and good at cooperation", "Jyeshtha": "protective, capable and natural senior in a group",
    "Mula": "truth-seeking and willing to dig to the root of things", "Purva Ashadha": "confident and persuasive",
    "Uttara Ashadha": "principled and steady in the long run", "Shravana": "a good listener and a keen learner",
    "Dhanishta": "rhythmic, ambitious and resourceful", "Shatabhisha": "private, independent and healing-minded",
    "Purva Bhadrapada": "intense, idealistic and unconventional", "Uttara Bhadrapada": "calm, deep and compassionate",
    "Revati": "kind, protective and gentle with others",
}

PLANET_EN = {"Sun": "Sun", "Moon": "Moon", "Mars": "Mars", "Mercury": "Mercury", "Jupiter": "Jupiter", "Venus": "Venus",
             "Saturn": "Saturn", "Rahu": "Rahu", "Ketu": "Ketu"}
BENEFICS = {"Jupiter", "Venus", "Mercury", "Moon"}
MALEFICS = {"Saturn", "Mars", "Rahu", "Ketu", "Sun"}

PLANET_MEANS = {
    "Sun": "confidence, status and authority", "Moon": "mind, mood and emotional comfort",
    "Mars": "energy, courage and drive", "Mercury": "intelligence, speech and business sense",
    "Jupiter": "wisdom, luck and guidance", "Venus": "love, comfort and the good things in life",
    "Saturn": "discipline, hard work and patience", "Rahu": "ambition, hunger for more and sudden turns",
    "Ketu": "detachment, intuition and letting go",
}

# what each planet's period (dasha) feels like in everyday life
DASHA_FEEL = {
    "Sun": "a period about recognition, responsibility and finding your own direction. Dealings with seniors, government and father figures matter more.",
    "Moon": "a period about emotions, home, mother and peace of mind. Mood swings are possible, and so is real emotional growth.",
    "Mars": "a period of energy, action and ambition. Good for bold moves, property and competition; watch your temper and haste.",
    "Mercury": "a period of learning, communication, business and skills. Good for studies, trade and networking.",
    "Jupiter": "a generally lucky and growing period: wisdom, teachers, children, money and good advice come forward.",
    "Venus": "a period of love, comfort, creativity and material growth. Relationships, vehicles, art and a better lifestyle come into focus.",
    "Saturn": "a period that tests you with hard work and responsibility, and rewards patience. Results come slowly but they last.",
    "Rahu": "a period of big ambition, change and unusual opportunities. Foreign links and technology can help; avoid shortcuts and confusion.",
    "Ketu": "a period of detachment and inner search. Old things fall away, and spiritual interest or a need for solitude may grow.",
}

# the 12 life areas in plain words: (name, what it covers)
AREA = {
    1: ("self and personality", "your body, confidence and the way people see you"),
    2: ("money and family", "savings, speech, food and close family"),
    3: ("courage and effort", "siblings, short travel, skills and self-made progress"),
    4: ("home and peace of mind", "mother, property, vehicles and inner comfort"),
    5: ("learning, children and creativity", "studies, children, romance and intelligence"),
    6: ("daily work and health", "jobs, routines, health habits, debts and competition"),
    7: ("marriage and partnerships", "spouse, business partners and close relationships"),
    8: ("sudden changes and research", "transformation, secrets, inheritance and deep study"),
    9: ("luck and guidance", "fortune, father, teachers, faith and long journeys"),
    10: ("career and reputation", "profession, status and the work you are known for"),
    11: ("gains and friends", "income, networks, big wishes and elder siblings"),
    12: ("rest, expenses and foreign lands", "sleep, spending, spirituality and living far from home"),
}

# planet -> (when it helps in a house, when it presses). Used as: "{Planet} here {phrase}".
PLANET_ROLE = {
    "Sun": ("gives confidence and respect in this area", "can bring ego clashes or pressure from authority here"),
    "Moon": ("brings emotional support and popularity here", "makes you more sensitive and moody about this area"),
    "Mars": ("adds courage and energy here", "can bring haste, arguments or heat in this area"),
    "Mercury": ("brings smart thinking and good communication here", "can bring overthinking and scattered focus here"),
    "Jupiter": ("brings luck, wisdom and protection here", "can make you take things too easy or over-promise here"),
    "Venus": ("brings harmony, charm and comfort here", "can bring indulgence or attachment issues here"),
    "Saturn": ("brings slow but lasting results and discipline here", "can bring delays and extra responsibility here"),
    "Rahu": ("brings big ambition and unusual chances here", "can bring confusion, restlessness and hunger for more here"),
    "Ketu": ("brings a detached, spiritual view here", "can bring a feeling of distance or something missing here"),
}

STRONG_DIGNITY = {"Exalted", "Own sign", "Moolatrikona", "Friendly"}
WEAK_DIGNITY = {"Debilitated", "Enemy"}

# combustion orbs (degrees from the Sun)
COMBUST_ORB = {"Moon": 12, "Mars": 17, "Mercury": 14, "Jupiter": 11, "Venus": 10, "Saturn": 15}

# remedies, taken from the traditional practice described by mainstream Vedic sources
REMEDY = {
    "Sun": dict(mantra="Om Suryaya Namah (108 times at sunrise)", day="Sunday", worship="Lord Surya: offer water to the rising Sun",
                donate="wheat, jaggery or red cloth", habit="Wake up early and take a few minutes of morning sunlight", gem="Ruby", gem_note="only after a chart check"),
    "Moon": dict(mantra="Om Som Somaya Namah (108 times)", day="Monday", worship="Lord Shiva: offer water or milk on Mondays",
                 donate="rice, milk or white sweets", habit="Keep a fixed sleep time and spend quiet time near water or greenery", gem="Pearl", gem_note="only after a chart check"),
    "Mars": dict(mantra="Om Angarakaya Namah, or Hanuman Chalisa", day="Tuesday", worship="Lord Hanuman",
                 donate="red lentils (masoor dal) or red cloth", habit="Exercise daily and pause before reacting in anger", gem="Red coral", gem_note="only after a chart check"),
    "Mercury": dict(mantra="Om Budhaya Namah (108 times)", day="Wednesday", worship="Lord Ganesha or Lord Vishnu",
                    donate="green moong dal or green vegetables", habit="Read or learn something new daily and keep your speech gentle", gem="Emerald", gem_note="only after a chart check"),
    "Jupiter": dict(mantra="Om Gurave Namah (108 times)", day="Thursday", worship="Lord Vishnu or your Guru",
                    donate="chana dal, turmeric or yellow sweets", habit="Respect teachers and elders and share what you know", gem="Yellow sapphire", gem_note="only after a chart check"),
    "Venus": dict(mantra="Om Shukraya Namah (108 times)", day="Friday", worship="Goddess Lakshmi",
                  donate="rice, sugar or white cloth", habit="Keep your home clean and your relationships honest and kind", gem="Diamond or opal", gem_note="only after a chart check"),
    "Saturn": dict(mantra="Om Sham Shanaishcharaya Namah (108 times)", day="Saturday", worship="Lord Hanuman or Lord Shani",
                   donate="black sesame, mustard oil or a blanket to someone in need", habit="Keep one steady daily routine and treat workers and elders with respect",
                   gem="Blue sapphire", gem_note="never wear it without a careful chart check, as it can backfire"),
    "Rahu": dict(mantra="Om Raam Rahave Namah (108 times)", day="Saturday", worship="Goddess Durga or Lord Shiva",
                 donate="blue or black cloth, or coconut", habit="Limit screen time and late nights; stay away from shortcuts", gem="Hessonite (gomed)", gem_note="only after a chart check"),
    "Ketu": dict(mantra="Om Ketave Namah (108 times)", day="Tuesday or Saturday", worship="Lord Ganesha",
                 donate="a blanket, or feeding a dog", habit="Spend a few minutes in silence or meditation daily", gem="Cat's eye", gem_note="only after a chart check"),
}


def _dt(value) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(str(value))
    except Exception:
        return None


def _planets_by_name(kundali: Dict) -> Dict[str, Dict]:
    return {p.get("planet"): p for p in kundali.get("planets", []) if p.get("planet")}


def _detail_planets(kundali: Dict) -> Dict[str, Dict]:
    out = {}
    for house in (kundali.get("experience") or {}).get("house_details", {}).values():
        for p in house.get("planets", []):
            out[p.get("planet")] = p
    return out


def _house_lord(kundali: Dict, house: int) -> str:
    return str(((kundali.get("experience") or {}).get("house_details", {}).get(str(house)) or {}).get("signRuler") or "")


def _heat(kundali: Dict, house: int) -> float:
    for row in (kundali.get("experience") or {}).get("house_heatmap", []):
        if int(row.get("house", 0)) == house:
            return float(row.get("score", 60))
    return 60.0


def _ordinal(n: int) -> str:
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def _area_label(house: int) -> str:
    return f"{AREA[house][0]} ({_ordinal(house)} house)"


def _planet_line(planet: str, detail: Dict, house: int) -> str:
    helps, presses = PLANET_ROLE[planet]
    dignity = (detail or {}).get("dignity", "")
    strength = float((detail or {}).get("strength", 60))
    benefic = planet in BENEFICS
    weak = dignity in WEAK_DIGNITY or strength < 50
    strong = dignity in STRONG_DIGNITY or strength >= 75
    if weak:
        return f"{planet} is in a weaker state here, so its help is limited and it {presses}."
    if benefic or (strong and planet in {"Saturn", "Mars", "Sun"}):
        extra = " It sits very comfortably, which makes the effect stronger." if strong else ""
        return f"{planet} {helps}.{extra}"
    return f"{planet} {presses}, but handled with patience it also teaches you a lot."


def _combust(kundali: Dict) -> List[str]:
    planets = _planets_by_name(kundali)
    sun = planets.get("Sun")
    notes = []
    if not sun:
        return notes
    for name, orb in COMBUST_ORB.items():
        p = planets.get(name)
        if not p:
            continue
        diff = abs((float(p["degree"]) - float(sun["degree"]) + 180) % 360 - 180)
        if diff <= orb:
            notes.append(f"{name} is very close to the Sun, so its results can feel dimmed or overshadowed (this is called combustion).")
    return notes


def plainify(text: str) -> str:
    """Swap 'house 11' style wording from the engine for the everyday name of that area of life."""
    import re

    return re.sub(r"\bhouses? (\d{1,2})\b", lambda m: f"your {AREA[int(m.group(1))][0]}" if 1 <= int(m.group(1)) <= 12 else m.group(0), text or "")


def _verdict(score: float):
    if score >= 80:
        return "strong", "Strong"
    if score >= 65:
        return "balanced", "Balanced"
    return "care", "Needs care"


def _area_block(kundali: Dict, key: str, title: str, icon: str, houses: List[int], intro: str, tip_planet: str) -> Dict:
    details = (kundali.get("experience") or {}).get("house_details", {})
    dplanets = _detail_planets(kundali)
    planets = _planets_by_name(kundali)
    helps: List[str] = []
    watch: List[str] = []
    for h in houses:
        info = details.get(str(h)) or {}
        for p in info.get("planets", []):
            line = _planet_line(p["planet"], p, h)
            weak = p.get("dignity") in WEAK_DIGNITY or float(p.get("strength", 60)) < 50
            good = (p["planet"] in BENEFICS or p.get("dignity") in STRONG_DIGNITY or float(p.get("strength", 60)) >= 75) and not weak
            (helps if good else watch).append(f"In your {_area_label(h)}: {line}")
        lord = _house_lord(kundali, h)
        if lord and lord in planets:
            lp = planets[lord]
            lstr = float((dplanets.get(lord) or {}).get("strength", 60))
            where = int(lp["house"])
            tone = "supports this area" if lstr >= 60 else "puts this area under some pressure, so it needs patience"
            line = f"The planet that rules your {AREA[h][0]} is {lord}. It sits in your {_area_label(where)}, which {tone}."
            (helps if lstr >= 60 else watch).append(line)
        if not info.get("planets"):
            helps.append(f"Your {_area_label(h)} has no planets in it, so it stays calm and runs on its own.")
    score = sum(_heat(kundali, h) for h in houses) / len(houses)
    code, label = _verdict(score)
    summary = {
        "strong": f"{intro} Overall this area looks well supported in your chart.",
        "balanced": f"{intro} This area has a good mix of support and challenge.",
        "care": f"{intro} This area asks for extra effort and patience in your chart, but it can improve with the right habits.",
    }[code]
    return {"id": key, "title": title, "icon": icon, "verdict": code, "verdict_label": label, "score": round(score), "summary": summary,
            "helps": helps[:3], "watch": watch[:3], "tip": f"A simple support: {REMEDY[tip_planet]['habit'].rstrip('.')}."}


def _dasha_full(kundali: Dict, now: datetime) -> List[Dict]:
    rows = []
    planets = _planets_by_name(kundali)
    for maha in kundali.get("dasha", []):
        start, end = _dt(maha.get("start")), _dt(maha.get("end"))
        if not start or not end:
            continue
        current = start <= now < end
        subs = []
        for a in _antardashas(maha):
            s, e = _dt(a["start"]), _dt(a["end"])
            subs.append({**a, "isCurrent": bool(s and e and s <= now < e),
                         "progress": max(0, min(100, round((now - s).total_seconds() / max((e - s).total_seconds(), 1) * 100))) if s and e and s <= now < e else (100 if e and now >= e else 0)})
        lord = maha.get("planet")
        house = int((planets.get(lord) or {}).get("house", 0) or 0)
        meaning = f"{lord} period: {DASHA_FEEL.get(lord, '')}"
        if house:
            meaning += f" In your chart {lord} sits in the area of {AREA[house][0]}, so that part of life is highlighted."
        total = max((end - start).total_seconds(), 1)
        rows.append({"planet": lord, "start": maha["start"], "end": maha["end"], "years": maha.get("years"), "isCurrent": current,
                     "isPast": now >= end, "progress": max(0, min(100, round((now - start).total_seconds() / total * 100))),
                     "meaning": meaning, "antardashas": subs})
    return rows


def _remedy_card(planet: str, why: str) -> Dict:
    r = REMEDY[planet]
    return {"planet": planet, "why": why, "mantra": r["mantra"], "day": r["day"], "worship": r["worship"], "donate": r["donate"],
            "habit": r["habit"], "gem": {"name": r["gem"], "note": r["gem_note"]}}


def build_reading(kundali: Dict, now: Optional[datetime] = None) -> Dict:
    now = now or datetime.now().astimezone()
    lagna = str(kundali.get("lagna") or "")
    planets = _planets_by_name(kundali)
    dplanets = _detail_planets(kundali)
    moon = planets.get("Moon", {})
    moon_sign = str(moon.get("rashi") or "")
    nak = str(kundali.get("nakshatra") or "")
    pada = kundali.get("nakshatra_pada")
    exp = kundali.get("experience") or {}
    climate = exp.get("planetary_climate") or {}

    # ---- personality
    lt = SIGN_TRAITS.get(lagna)
    paragraphs = []
    if lt:
        paragraphs.append(f"Your rising sign (Lagna) is {sign_name(lagna)}. People usually see you as {lt[0]}.")
    if moon_sign in MOON_MIND:
        paragraphs.append(f"Your Moon sign is {sign_name(moon_sign)}: inside, your mind {MOON_MIND[moon_sign]}.")
    if nak in NAKSHATRA_TRAIT:
        paragraphs.append(f"Your birth star (Nakshatra) is {nak}{f', pada {pada}' if pada else ''}, which is linked with being {NAKSHATRA_TRAIT[nak]}.")
    strongest = sorted(climate.get("supportive", []), key=lambda r: -float(r.get("score", 0)))[:3]
    careful = sorted(climate.get("pressurizing", []), key=lambda r: float(r.get("score", 0)))[:3]
    strengths = list(lt[1]) if lt else []
    watch = list(lt[2]) if lt else []
    for row in strongest[:2]:
        strengths.append(f"strong {row['planet']} ({PLANET_MEANS[row['planet']]})")
    for row in careful[:2]:
        watch.append(f"{row['planet']} needs care ({PLANET_MEANS[row['planet']]})")

    snapshot = [
        {"label": "Rising sign", "value": SIGN_EN.get(lagna, lagna), "sub": lagna},
        {"label": "Moon sign", "value": SIGN_EN.get(moon_sign, moon_sign), "sub": moon_sign},
        {"label": "Birth star", "value": nak, "sub": f"Pada {pada}" if pada else ""},
    ]
    maha = (kundali.get("dasha_experience") or {}).get("current_mahadasha") or {}
    anta = (kundali.get("dasha_experience") or {}).get("current_antardasha") or {}
    if maha:
        snapshot.append({"label": "Current period", "value": f"{maha.get('planet')} - {anta.get('planet', '')}", "sub": "Mahadasha - Antardasha"})
    if strongest:
        snapshot.append({"label": "Strongest planet", "value": strongest[0]["planet"], "sub": PLANET_MEANS[strongest[0]["planet"]]})
    if careful:
        snapshot.append({"label": "Needs care", "value": careful[0]["planet"], "sub": PLANET_MEANS[careful[0]["planet"]]})

    personality = {"headline": f"{SIGN_EN.get(lagna, lagna)} rising, {SIGN_EN.get(moon_sign, moon_sign)} Moon, {nak} star",
                   "paragraphs": paragraphs, "strengths": strengths[:5], "watch": watch[:4], "notes": _combust(kundali)}

    # ---- life areas
    areas = [
        _area_block(kundali, "love", "Love & marriage", "♡", [7], "This looks at your partner and close relationships.", "Venus"),
        _area_block(kundali, "career", "Career & status", "✦", [10, 6], "This looks at your profession, reputation and daily work.", "Saturn"),
        _area_block(kundali, "money", "Money & savings", "◈", [2, 11], "This looks at your income, savings and gains.", "Jupiter"),
        _area_block(kundali, "health", "Health & energy", "✚", [1, 6], "This looks at your body, energy and health habits.", "Sun"),
        _area_block(kundali, "family", "Home & family", "⌂", [4, 2], "This looks at your home, mother and peace of mind.", "Moon"),
        _area_block(kundali, "learning", "Education & children", "✎", [5, 9], "This looks at your studies, children and luck.", "Mercury"),
    ]

    # ---- current phase
    de = kundali.get("dasha_experience") or {}
    full = _dasha_full(kundali, now)
    phase = {}
    if maha:
        mp, ap = maha.get("planet"), anta.get("planet")
        mh = int((planets.get(mp) or {}).get("house", 0) or 0)
        ah = int((planets.get(ap) or {}).get("house", 0) or 0)
        paras = [f"You are in the {mp} Mahadasha, the main chapter of your life right now. It is {DASHA_FEEL.get(mp, '')}"]
        if mh:
            paras.append(f"In your chart {mp} sits in the area of {AREA[mh][0]}, so this chapter keeps bringing {AREA[mh][1]} into focus.")
        if ap:
            paras.append(f"Inside it, the {ap} Antardasha (sub-period) colours the day-to-day: it is {DASHA_FEEL.get(ap, '')}")
            if ah:
                paras.append(f"{ap} sits in your {AREA[ah][0]} area, so expect that area to feel active until the sub-period ends.")
        summ = de.get("current_summary") or {}
        phase = {"title": f"{mp} Mahadasha, {ap} Antardasha", "paragraphs": paras,
                 "maha": maha, "antar": anta, "next_change": (kundali.get("experience") or {}).get("phase_shift", {}),
                 "do": [plainify(x) for x in [summ.get("advice")] if x], "caution": plainify(summ.get("caution", ""))}
        cur = next((r for r in full if r["isCurrent"]), None)
        if cur:
            phase["progress"] = cur["progress"]
            sub = next((s for s in cur["antardashas"] if s["isCurrent"]), None)
            phase["antar_progress"] = sub["progress"] if sub else 0

    # ---- doshas, in plain words
    PLAIN = {
        "Mangal Dosha": ("Mars placement (Mangal Dosha)",
                         "Mars is placed in a spot that traditionally adds heat, impatience or friction in close relationships, especially marriage.",
                         "Many people have it. It is usually softened by other planets, and by mature, calm handling of arguments. Many sites advise matching charts with a partner rather than worrying alone."),
        "Kaal Sarp Pattern": ("Kaal Sarp pattern",
                              "All main planets sit on one side of the Rahu-Ketu line, which can make life feel concentrated around a few themes, with ups and downs.",
                              "It is not a verdict on your life; strong benefic planets and good dasha periods reduce its effect."),
        "Shani Pressure Pattern": ("Saturn pressure (Shani)",
                                   "Saturn influences a sensitive spot in your chart, which can bring delays, extra responsibility or a longer road to results.",
                                   "Saturn rewards steady effort: results come later, but they last."),
    }
    doshas = []
    for d in kundali.get("dosha_analysis", []):
        plain = PLAIN.get(d.get("name"), (d.get("name"), d.get("likelyThemes", ""), ""))
        planet = {"Mangal Dosha": "Mars", "Shani Pressure Pattern": "Saturn", "Kaal Sarp Pattern": "Rahu"}.get(d.get("name"), "")
        doshas.append({"name": d.get("name"), "plain_name": plain[0], "detected": bool(d.get("detected")), "level": d.get("severity", "none"),
                       "what": plain[1], "comfort": plain[2], "technical": d.get("whyDetected", ""),
                       "softeners": list(d.get("mitigatingFactors", [])), "confidence": d.get("confidence", ""),
                       "remedy_planet": planet if d.get("detected") else ""})

    # ---- remedies: current dasha lords first, then planets under pressure, then planets behind detected doshas
    order: List[tuple] = []
    if maha.get("planet"):
        order.append((maha["planet"], f"{maha['planet']} is running your main life period, so supporting it helps the whole chapter."))
    if anta.get("planet") and anta["planet"] != maha.get("planet"):
        order.append((anta["planet"], f"{anta['planet']} controls your current sub-period, so it shapes the next year or two."))
    for row in careful:
        order.append((row["planet"], f"{row['planet']} is under some pressure in your chart ({PLANET_MEANS[row['planet']]}), so it benefits from a little support."))
    for d in doshas:
        if d["remedy_planet"]:
            order.append((d["remedy_planet"], f"This supports the {d['plain_name']} that was found in your chart."))
    seen, cards = set(), []
    for planet, why in order:
        if planet in seen or planet not in REMEDY:
            continue
        seen.add(planet)
        cards.append(_remedy_card(planet, why))
        if len(cards) == 4:
            break

    engine_icons = {"Daily practice": "☀", "Weekly observance": "☾", "Mantra / spiritual focus": "ॐ", "Donation / seva": "♡", "Behavioral remedy": "✦"}
    engine_items = [{"title": plainify(r.get("title") or ""), "why": plainify(r.get("why") or "").replace("partnership houses", "relationship areas").replace("triggers", "effects"), "when": r.get("frequency"), "kind": r.get("category"),
                     "icon": engine_icons.get(r.get("category"), "✦")} for r in kundali.get("remedies_analysis", [])]

    remedies = {
        "intro": "These are traditional, gentle practices. They are chosen from the planets that matter most in your chart right now. Pick one or two you can keep up, because steady habits matter more than doing everything.",
        "planets": cards, "daily": engine_items,
        "disclaimer": "Remedies are traditional beliefs and are not a substitute for medical, legal or financial advice. Please do not buy or wear a gemstone only because of an online reading; speak to a trusted astrologer who has examined your full chart first.",
    }

    return {"snapshot": snapshot, "personality": personality, "areas": areas, "phase": phase, "doshas": doshas,
            "remedies": remedies, "dasha": full}
