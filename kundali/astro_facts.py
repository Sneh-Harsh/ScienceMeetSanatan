"""Classical Jyotish facts used by the personalised horoscope.

Everything here is derived from the generated chart plus Swiss-Ephemeris
positions: planetary dignity, functional nature for the Lagna, Gochar from the
natal Moon (with Vedha), Chandra Bala, Tara Bala, Sade Sati, ingress/station
dates, and day timings (Hora, Rahu Kaal, Abhijit) from real sunrise/sunset.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import swisseph as swe

from .calculations import FLG, NAKSHATRA, RASHI, VIMSHOTTARI_ORDER, _dt_to_jd_ut, _rashi_index

SIGN = [r["sa"] for r in RASHI]
PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"]
GRAHAS = PLANETS[:7]

SIGN_LORD = {0: "Mars", 1: "Venus", 2: "Mercury", 3: "Moon", 4: "Sun", 5: "Mercury", 6: "Venus", 7: "Mars", 8: "Jupiter", 9: "Saturn", 10: "Saturn", 11: "Jupiter"}
OWN_SIGNS = {"Sun": {4}, "Moon": {3}, "Mars": {0, 7}, "Mercury": {2, 5}, "Jupiter": {8, 11}, "Venus": {1, 6}, "Saturn": {9, 10}}
EXALT = {"Sun": 0, "Moon": 1, "Mars": 9, "Mercury": 5, "Jupiter": 3, "Venus": 11, "Saturn": 6}
DEBIL = {"Sun": 6, "Moon": 7, "Mars": 3, "Mercury": 11, "Jupiter": 9, "Venus": 5, "Saturn": 0}

NATURAL = {"Sun": -0.45, "Moon": 0.55, "Mars": -0.8, "Mercury": 0.5, "Jupiter": 1.0, "Venus": 0.9, "Saturn": -0.8, "Rahu": -0.75, "Ketu": -0.55}

# Gochar (transit) from the natal Moon: houses counted from the Moon sign that are favourable.
FAVOURABLE = {
    "Sun": {3, 6, 10, 11},
    "Moon": {1, 3, 6, 7, 10, 11},
    "Mars": {3, 6, 11},
    "Mercury": {2, 4, 6, 8, 10, 11},
    "Jupiter": {2, 5, 7, 9, 11},
    "Venus": {1, 2, 3, 4, 5, 8, 9, 11, 12},
    "Saturn": {3, 6, 11},
    "Rahu": {3, 6, 11},
    "Ketu": {3, 6, 11},
}
# Vedha: a favourable house is "blocked" if another planet sits in the matching house (from the Moon).
VEDHA = {
    "Sun": {3: 9, 6: 12, 10: 4, 11: 5},
    "Moon": {1: 5, 3: 9, 6: 12, 7: 2, 10: 4, 11: 8},
    "Mars": {3: 12, 6: 9, 11: 5},
    "Mercury": {2: 5, 4: 3, 6: 9, 8: 1, 10: 8, 11: 12},
    "Jupiter": {2: 12, 5: 4, 7: 3, 9: 10, 11: 8},
    "Venus": {1: 8, 2: 7, 3: 1, 4: 10, 5: 9, 8: 5, 9: 11, 11: 6, 12: 3},
    "Saturn": {3: 12, 6: 9, 11: 5},
    "Rahu": {3: 12, 6: 9, 11: 5},
    "Ketu": {3: 12, 6: 9, 11: 5},
}
VEDHA_EXEMPT = {frozenset(("Sun", "Saturn")), frozenset(("Moon", "Mercury"))}

# What the transiting Moon does, by house counted from the natal Moon (Chandra Gochar).
MOON_FROM_MOON = {
    1: ("steady and comfortable", True),
    2: ("tight on money, and your words may come out sharp", False),
    3: ("brave and productive", True),
    4: ("restless, with a wish to rest at home", False),
    5: ("full of overthinking, so avoid big decisions", False),
    6: ("good for clearing problems and improving health", True),
    7: ("warm with people and good for partnerships", True),
    8: ("low and inward (Ashtama Chandra), so finish old work rather than start new", False),
    9: ("slow, with doubts and small delays", False),
    10: ("successful at work, and you get noticed for it", True),
    11: ("rewarding, with gains and helpful friends", True),
    12: ("tiring, with extra expenses, so rest well", False),
}

TARA_NAMES = ["Janma", "Sampat", "Vipat", "Kshema", "Pratyari", "Sadhaka", "Vadha", "Mitra", "Ati-Mitra"]
TARA_GOOD = {2, 4, 6, 8, 9}
TARA_MEANING = {
    1: "Janma (birth star): you feel sensitive, so take it easy",
    2: "Sampat (wealth): gains and good support",
    3: "Vipat (danger): avoid risks and shortcuts",
    4: "Kshema (well-being): safe and protective",
    5: "Pratyari (obstacle): some friction is likely",
    6: "Sadhaka (achievement): your effort pays off",
    7: "Vadha (loss): energy drains, so keep plans light",
    8: "Mitra (friend): friendly and supportive",
    9: "Ati-Mitra (best friend): very supportive",
}

WEEKDAY_LORD = ["Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Sun"]  # Monday..Sunday
HORA_ORDER = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"]
RAHU_KAAL_SLOT = {0: 2, 1: 7, 2: 5, 3: 6, 4: 4, 5: 3, 6: 8}  # Mon..Sun -> eighth of the day (1-based)

KENDRA = {1, 4, 7, 10}
TRIKONA = {1, 5, 9}
DUSTHANA = {6, 8, 12}


def _pl():
    # imported lazily: plain_language pulls in the dasha/experience engines, which import the horoscope engine
    from . import plain_language

    return plain_language


def ordinal(n: int) -> str:
    n = int(n)
    if 10 <= n % 100 <= 20:
        return f"{n}th"
    return f"{n}{ {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th') }"


def area_name(house: int) -> str:
    return _pl().AREA["en"][int(house)][0]


# --------------------------------------------------------------------------- chart


class Chart:
    def __init__(self, kundali: Dict):
        self.k = kundali
        self.lagna = int(next(h["rashi_index"] for h in kundali["houses"] if int(h["house"]) == 1))
        self.p: Dict[str, Dict] = {str(r["planet"]): r for r in kundali["planets"]}
        self.moon_idx = int(self.p["Moon"]["rashi_index"])
        self.sun_idx = int(self.p["Sun"]["rashi_index"])
        self.moon_nak = int(float(self.p["Moon"]["degree"]) // (360.0 / 27.0)) % 27
        self.moon_nak_name = NAKSHATRA[self.moon_nak]
        self.moon_nak_lord = VIMSHOTTARI_ORDER[self.moon_nak % 9]
        self.birth_nak = self.moon_nak
        self.sign_of_house = {h: (self.lagna + h - 1) % 12 for h in range(1, 13)}
        self.lord_of_house = {h: SIGN_LORD[s] for h, s in self.sign_of_house.items()}
        self.owned: Dict[str, List[int]] = {n: [] for n in PLANETS}
        for h, lord in self.lord_of_house.items():
            self.owned[lord].append(h)

    # ----- positions
    def house_of(self, planet: str) -> int:
        return int(self.p[planet]["house"])

    def sign_idx(self, planet: str) -> int:
        return int(self.p[planet]["rashi_index"])

    def sign_name(self, planet: str) -> str:
        return SIGN[self.sign_idx(planet)]

    def occupants(self, house: int) -> List[str]:
        return [n for n in PLANETS if self.house_of(n) == house]

    # ----- dignity / functional nature
    def dignity(self, planet: str) -> str:
        if planet in ("Rahu", "Ketu"):
            return "neutral"
        idx = self.sign_idx(planet)
        if EXALT.get(planet) == idx:
            return "exalted"
        if DEBIL.get(planet) == idx:
            return "debilitated"
        if idx in OWN_SIGNS.get(planet, set()):
            return "own"
        lord = SIGN_LORD[idx]
        friends, enemies = _pl().FRIENDS[planet]
        if lord in friends:
            return "friendly"
        if lord in enemies:
            return "enemy"
        return "neutral"

    def functional(self, planet: str) -> float:
        """-3..+3: how helpful the planet is *for this Lagna* from the houses it rules."""
        if planet in ("Rahu", "Ketu"):
            disp = SIGN_LORD[self.sign_idx(planet)]
            return 0.5 * self.functional(disp)
        score = 0.0
        for h in self.owned[planet]:
            if h in (1, 5, 9):
                score += 2.0 if h != 1 else 1.4
            elif h in (4, 7, 10):
                score += 0.9 if NATURAL[planet] < 0 else 0.5
            elif h == 11 or h == 3:
                score -= 0.5
            elif h == 2:
                score += 0.0
            elif h in (6, 12):
                score -= 1.6 if planet not in ("Sun", "Moon") else 0.4
            elif h == 8:
                score -= 1.9 if planet not in ("Sun", "Moon") else 0.3
        return max(-3.0, min(3.0, score))

    def viparita(self) -> Dict[str, int]:
        """Lords of the 6th/8th/12th that sit in a dusthana: Viparita Raja Yoga (Harsha/Sarala/Vimala)."""
        out: Dict[str, int] = {}
        for h in (6, 8, 12):
            lord = self.lord_of_house[h]
            if lord not in ("Rahu", "Ketu") and self.house_of(lord) in DUSTHANA:
                out.setdefault(lord, h)
        return out

    def quality(self, planet: str) -> float:
        """-1..+1 overall quality of a planet in *this* chart (nature + dignity + placement)."""
        q = 0.4 * self.functional(planet) / 3.0 * 2.0
        q += {"exalted": 0.5, "own": 0.4, "friendly": 0.2, "neutral": 0.0, "enemy": -0.25, "debilitated": -0.5}[self.dignity(planet)]
        house = self.house_of(planet)
        if house in KENDRA or house in TRIKONA:
            q += 0.15
        if house in DUSTHANA:
            q -= 0.2 if planet in ("Mars", "Saturn", "Rahu", "Sun") else 0.3
        if planet in ("Rahu", "Ketu"):
            q = q * 0.6 - 0.1
        if planet in self.viparita():
            q += 0.55  # a dusthana lord in a dusthana: its difficulties turn into strengths
        return max(-1.0, min(1.0, q))

    def role(self, planet: str) -> str:
        """Short plain-language description of what the planet rules for this person."""
        owned = self.owned.get(planet) or []
        if planet in ("Rahu", "Ketu"):
            disp = SIGN_LORD[self.sign_idx(planet)]
            return f"acts through {disp} (the lord of the sign it sits in)"
        if not owned:
            return "rules no house"
        parts = [f"{ordinal(h)} ({area_name(h)})" for h in owned]
        return "rules your " + " and ".join(parts)

    def role_plain(self, planet: str) -> str:
        """e.g. 'looks after your 3rd house (courage & effort) and 6th house (daily work & health)'."""
        owned = self.owned.get(planet) or []
        if planet in ("Rahu", "Ketu"):
            return f"acts like {SIGN_LORD[self.sign_idx(planet)]} for you"
        if not owned:
            return "does not rule any house for you"
        parts = [f"{ordinal(h)} house ({area_name(h).replace(' and ', ' & ')})" for h in owned]
        return "looks after your " + " and ".join(parts)

    def focus_plain(self, planet: str) -> str:
        """The life areas a planet's period brings into focus, e.g. 'courage & effort and daily work & health'."""
        houses = self.owned.get(planet) or [self.house_of(planet)]
        return " and ".join(area_name(h).replace(" and ", " & ") for h in houses)

    def role_short(self, planet: str) -> str:
        owned = self.owned.get(planet) or []
        if planet in ("Rahu", "Ketu"):
            return f"acts through {SIGN_LORD[self.sign_idx(planet)]}"
        if not owned:
            return "rules no house"
        return "rules your " + " and ".join(ordinal(h) for h in owned) + (" house" if len(owned) == 1 else " houses")

    def yogakaraka(self, planet: str) -> bool:
        owned = set(self.owned.get(planet) or [])
        return bool(owned & {4, 7, 10}) and bool(owned & {5, 9})

    # ----- natal yogas (a few classical ones)
    def yogas(self) -> List[Tuple[str, str]]:
        out: List[Tuple[str, str]] = []
        jup_from_moon = ((self.sign_idx("Jupiter") - self.moon_idx) % 12) + 1
        if jup_from_moon in KENDRA and self.dignity("Jupiter") != "debilitated":
            out.append(("Gaja Kesari Yoga", "Jupiter is in a strong house from your Moon: this gives wisdom, protection and a good name"))
        if self.sign_idx("Sun") == self.sign_idx("Mercury"):
            out.append(("Budha-Aditya Yoga", "Sun and Mercury are together: this sharpens your intelligence and speech"))
        if self.sign_idx("Moon") == self.sign_idx("Mars"):
            out.append(("Chandra-Mangala Yoga", "Moon and Mars are together: this gives drive and earning power"))
        name = {6: "Harsha Yoga", 8: "Sarala Yoga", 12: "Vimala Yoga"}
        for planet, h in self.viparita().items():
            out.append((name[h], f"{planet}, lord of your {ordinal(h)} house, sits in a difficult house: this Viparita Raja Yoga turns early struggle into strength"))
        kendra_lords = {self.lord_of_house[h] for h in (4, 7, 10)}
        trikona_lords = {self.lord_of_house[h] for h in (5, 9)}
        for a in kendra_lords:
            for b in trikona_lords:
                if a != b and self.sign_idx(a) == self.sign_idx(b):
                    out.append(("Raja Yoga", f"{a} and {b} are together: a classical combination for rise in status"))
                    return out
        return out


# --------------------------------------------------------------------------- gochar


@dataclass
class Gochar:
    planet: str
    house_moon: int
    house_lagna: int
    sign: str
    retrograde: bool
    status: str  # favourable | blocked | unfavourable
    blocker: Optional[str] = None


def gochar_for(transits: Dict, chart: Chart) -> Dict[str, Gochar]:
    out: Dict[str, Gochar] = {}
    for name in PLANETS:
        row = transits[name]
        h = int(row.house_from_moon)
        status = "favourable" if h in FAVOURABLE[name] else "unfavourable"
        blocker = None
        if status == "favourable" and name in GRAHAS:
            target = VEDHA.get(name, {}).get(h)
            if target:
                for other in GRAHAS:
                    if other == name or frozenset((name, other)) in VEDHA_EXEMPT:
                        continue
                    if int(transits[other].house_from_moon) == target:
                        status, blocker = "blocked", other
                        break
        out[name] = Gochar(name, h, int(row.house_from_lagna), row.rashi, bool(row.retrograde), status, blocker)
    return out


def tara_of(moon_transit_nak: int, birth_nak: int) -> int:
    n = ((moon_transit_nak - birth_nak) % 27) + 1
    return (n % 9) or 9


def moon_nak_of(transits: Dict) -> int:
    return int(float(transits["Moon"].degree) // (360.0 / 27.0)) % 27


def sade_sati(transits: Dict, chart: Chart) -> Dict:
    h = int(transits["Saturn"].house_from_moon)
    if h in (12, 1, 2):
        phase = {12: "rising (first) phase", 1: "peak (middle) phase", 2: "setting (last) phase"}[h]
        return {"active": True, "kind": "Sade Sati", "phase": phase, "house": h}
    if h == 4:
        return {"active": True, "kind": "Kantaka Shani (small Saturn period)", "phase": "4th from Moon", "house": h}
    if h == 8:
        return {"active": True, "kind": "Ashtama Shani (small Saturn period)", "phase": "8th from Moon", "house": h}
    return {"active": False, "kind": "", "phase": "", "house": h}


# --------------------------------------------------------------------------- ephemeris scans

_BODY = {"Sun": swe.SUN, "Moon": swe.MOON, "Mars": swe.MARS, "Mercury": swe.MERCURY, "Jupiter": swe.JUPITER, "Venus": swe.VENUS, "Saturn": swe.SATURN, "Rahu": swe.TRUE_NODE}


def lon_speed(name: str, dt: datetime) -> Tuple[float, float]:
    jd = _dt_to_jd_ut(dt.astimezone(timezone.utc))
    base = "Rahu" if name in ("Rahu", "Ketu") else name
    res = swe.calc_ut(jd, _BODY[base], FLG | swe.FLG_SPEED)[0]
    lon, speed = float(res[0]) % 360.0, float(res[3])
    if name == "Ketu":
        lon = (lon + 180.0) % 360.0
    return lon, speed


def _bisect(fn, a: datetime, b: datetime, hours: float = 1.0) -> datetime:
    while (b - a).total_seconds() > hours * 3600:
        mid = a + (b - a) / 2
        if fn(a) == fn(mid):
            a = mid
        else:
            b = mid
    return b


def scan_events(names: List[str], start: datetime, end: datetime, step_hours: int = 24) -> List[Dict]:
    """Sign changes and direction changes (stations) between start and end."""
    events: List[Dict] = []
    for name in names:
        t = start
        prev_sign = _rashi_index(lon_speed(name, t)[0])
        prev_retro = lon_speed(name, t)[1] < 0
        while t < end:
            nxt = min(t + timedelta(hours=step_hours), end)
            sign = _rashi_index(lon_speed(name, nxt)[0])
            retro = lon_speed(name, nxt)[1] < 0
            if sign != prev_sign:
                when = _bisect(lambda x: _rashi_index(lon_speed(name, x)[0]), t, nxt)
                events.append({"kind": "ingress", "planet": name, "when": when, "sign_idx": sign, "retro": retro})
                prev_sign = sign
            if retro != prev_retro and name not in ("Rahu", "Ketu", "Sun", "Moon"):
                when = _bisect(lambda x: lon_speed(name, x)[1] < 0, t, nxt)
                events.append({"kind": "station", "planet": name, "when": when, "retro": retro, "sign_idx": _rashi_index(lon_speed(name, when)[0])})
                prev_retro = retro
            t = nxt
    events.sort(key=lambda e: e["when"])
    return events


def lunations(start: datetime, end: datetime) -> List[Dict]:
    """New and full moons (Sun-Moon elongation 0 / 180) in the window."""
    out: List[Dict] = []

    def elong(x: datetime) -> float:
        return (lon_speed("Moon", x)[0] - lon_speed("Sun", x)[0]) % 360.0

    t = start
    prev = elong(t)
    while t < end:
        nxt = min(t + timedelta(hours=6), end)
        cur = elong(nxt)
        for target, kind in ((0.0, "new"), (180.0, "full")):
            a, b = (prev - target) % 360.0, (cur - target) % 360.0
            if a > 300.0 and b < 60.0:  # crossed the target going forward
                when = _bisect(lambda x: ((elong(x) - target) % 360.0) < 180.0, t, nxt, hours=0.5)
                out.append({"kind": kind, "when": when, "sign_idx": _rashi_index(lon_speed("Moon", when)[0])})
        prev = cur
        t = nxt
    return out


# --------------------------------------------------------------------------- day timings


def day_timings(day: datetime, lat: float, lon: float) -> Optional[Dict]:
    """Sunrise, sunset, Hora list, Rahu Kaal and Abhijit for the local date of ``day``."""
    tz = day.tzinfo
    local_midnight = day.replace(hour=0, minute=0, second=0, microsecond=0)
    jd0 = _dt_to_jd_ut(local_midnight.astimezone(timezone.utc))
    try:
        r1 = swe.rise_trans(jd0, swe.SUN, swe.CALC_RISE, (lon, lat, 0.0), 0.0, 0.0, swe.FLG_SWIEPH)
        r2 = swe.rise_trans(jd0, swe.SUN, swe.CALC_SET, (lon, lat, 0.0), 0.0, 0.0, swe.FLG_SWIEPH)
    except Exception:
        return None
    if r1[0] != 0 or r2[0] != 0:
        return None

    def to_dt(jd: float) -> datetime:
        base = datetime(2000, 1, 1, 12, tzinfo=timezone.utc) + timedelta(days=jd - 2451545.0)
        return base.astimezone(tz)

    rise, sset = to_dt(r1[1][0]), to_dt(r2[1][0])
    if sset <= rise:
        sset += timedelta(days=1)
    weekday = day.weekday()
    span = (sset - rise) / 12
    start_idx = HORA_ORDER.index(WEEKDAY_LORD[weekday])
    horas = []
    for i in range(12):
        horas.append({"planet": HORA_ORDER[(start_idx + i) % 7], "start": rise + span * i, "end": rise + span * (i + 1)})
    eighth = (sset - rise) / 8
    slot = RAHU_KAAL_SLOT[weekday]
    rahu = (rise + eighth * (slot - 1), rise + eighth * slot)
    fifteenth = (sset - rise) / 15
    abhijit = (rise + fifteenth * 7, rise + fifteenth * 8)
    return {"sunrise": rise, "sunset": sset, "horas": horas, "rahu_kaal": rahu, "abhijit": abhijit, "weekday_lord": WEEKDAY_LORD[weekday]}


def clock(dt: datetime) -> str:
    return dt.strftime("%I:%M %p").lstrip("0")


def window(a: datetime, b: datetime) -> str:
    return f"{clock(a)} to {clock(b)}"
