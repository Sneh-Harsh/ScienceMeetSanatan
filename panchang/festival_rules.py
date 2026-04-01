from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


def _dataset_dir() -> Path:
    return Path(__file__).resolve().parent / "datasets" / "panchang_full_dataset"


def _load_rules() -> Dict[str, List[Dict[str, Any]]]:
    # Cache with file mtimes so edits to dataset are picked up without restarting the server.
    global _RULES_CACHE  # noqa: PLW0603
    out: Dict[str, List[Dict[str, Any]]] = {"core": [], "regional": [], "vrat": []}
    base = _dataset_dir()
    mapping = {
        "core": base / "core_festivals.json",
        "regional": base / "regional_festivals.json",
        "vrat": base / "vrat_rules.json",
    }

    mtimes: Dict[str, float] = {}
    for key, path in mapping.items():
        try:
            mtimes[key] = float(path.stat().st_mtime)
        except Exception:
            mtimes[key] = -1.0

    try:
        cache = _RULES_CACHE  # type: ignore[name-defined]
    except Exception:
        cache = {"mtimes": {}, "data": None}
        _RULES_CACHE = cache  # type: ignore[assignment]

    if cache.get("data") is not None and cache.get("mtimes") == mtimes:
        return cache["data"]

    for key, path in mapping.items():
        try:
            raw = path.read_text(encoding="utf-8")
            data = json.loads(raw) if raw.strip() else []
            if isinstance(data, list):
                out[key] = [x for x in data if isinstance(x, dict)]
        except Exception:
            out[key] = []
    cache["mtimes"] = mtimes
    cache["data"] = out
    return out


def rules_version() -> str:
    """
    Lightweight cache-buster for Panchang day caching.
    Returns a string derived from dataset file mtimes.
    """
    base = _dataset_dir()
    paths = [
        base / "core_festivals.json",
        base / "regional_festivals.json",
        base / "vrat_rules.json",
    ]
    parts: List[str] = []
    for p in paths:
        try:
            parts.append(str(int(p.stat().st_mtime)))
        except Exception:
            parts.append("0")
    return "|".join(parts)


_ICON_BY_NAME = {
    "Diwali": "🪔",
    "Holi": "🎨",
    "Maha Shivaratri": "🕉️",
    "Maha Shivratri": "🕉️",
    "Janmashtami": "🦚",
    "Krishna Janmashtami": "🦚",
    "Ram Navami": "🏹",
    "Ganesh Chaturthi": "🐘",
    "Chhath Puja": "🌅",
    "Pongal": "🌾",
    "Ugadi": "🌺",
    "Chaitra Navratri": "🏺",
    "Sharadiya Navratri": "🏺",
    "Dussehra": "🏹",
    "Makar Sankranti": "🪁",
    "Raksha Bandhan": "🎗️",
    "Karwa Chauth": "🌙",
    "Guru Purnima": "🌕",
    "Kartik Purnima": "🌕",
    "Sharad Purnima": "🌕",
    "Hanuman Jayanti": "🚩",
    "Dhanteras": "🪔",
    "Narak Chaturdashi": "🪔",
    "Govardhan Puja": "⛰️",
    "Bhai Dooj": "🎁",
    "Holika Dahan": "🔥",
    "Pitru Paksha Begins": "🕯️",
    "Vasant Panchami": "🌼",
    "Nag Panchami": "🐍",
    "Akshaya Tritiya": "💰",
    "Anant Chaturdashi": "🪷",
    "Ganga Dussehra": "🌊",
    "Jagannath Rath Yatra": "🛞",
    "Ratha Saptami": "☀️",
    "Devshayani Ekadashi": "✨",
    "Devuthani Ekadashi": "✨",
    "Navratri Begins": "🏺",
    "Sharad Navratri Begins": "🏺",
    "Ekadashi": "✨",
    "Purnima": "🌕",
    "Amavasya": "🌑",
}

_ANIM_BY_NAME = {
    "Diwali": "diya",
    "Holi": "holi",
    "Maha Shivaratri": "shiva",
    "Maha Shivratri": "shiva",
    "Janmashtami": "krishna",
    "Krishna Janmashtami": "krishna",
    "Ram Navami": "rama",
    "Ganesh Chaturthi": "ganesha",
    "Chhath Puja": "sunrise",
    "Pongal": "grain",
    "Ugadi": "kalash",
    "Chaitra Navratri": "kalash",
    "Sharadiya Navratri": "kalash",
    "Navratri Begins": "kalash",
    "Sharad Navratri Begins": "kalash",
    "Dussehra": "rama",
    "Makar Sankranti": "grain",
    "Raksha Bandhan": "spark",
    "Karwa Chauth": "moon",
    "Guru Purnima": "moon",
    "Kartik Purnima": "moon",
    "Sharad Purnima": "moon",
    "Hanuman Jayanti": "spark",
    "Dhanteras": "diya",
    "Narak Chaturdashi": "diya",
    "Govardhan Puja": "glow",
    "Bhai Dooj": "glow",
    "Holika Dahan": "spark",
    "Pitru Paksha Begins": "dark",
    "Vasant Panchami": "glow",
    "Nag Panchami": "glow",
    "Akshaya Tritiya": "glow",
    "Anant Chaturdashi": "glow",
    "Ganga Dussehra": "glow",
    "Jagannath Rath Yatra": "glow",
    "Ratha Saptami": "sunrise",
    "Ekadashi": "spark",
    "Purnima": "moon",
    "Amavasya": "dark",
}

_DESC_BY_NAME = {
    "Diwali": "Festival of lights—celebrating the victory of dharma and the return of Shri Rama.",
    "Holi": "Festival of colors—joy, devotion, and the spirit of renewal.",
    "Maha Shivaratri": "Night of Shiva—japa, dhyana, and deep inner stillness.",
    "Janmashtami": "Shri Krishna Janma Utsav—celebrating the birth of Yogeshwara Krishna.",
    "Ram Navami": "Birth of Shri Rama—an ideal of dharma, courage, and compassion.",
    "Ganesh Chaturthi": "Shri Ganesh Utsav—new beginnings, wisdom, and auspiciousness.",
    "Chhath Puja": "Surya upasana—gratitude to the Sun and the sacred rivers.",
    "Pongal": "Harvest thanksgiving—celebration of abundance and nature.",
    "Ugadi": "Lunar new year—fresh start, sankalpa, and new beginnings.",
    "Navratri Begins": "Navratri begins—invoke Shakti, set sankalpa, and start sadhana.",
    "Sharad Navratri Begins": "Sharad Navratri begins—nine nights of Devi upasana and inner strength.",
    "Dussehra": "Vijayadashami—celebrating the victory of good over evil.",
    "Ekadashi": "Vrat day—sattva, japa, and devotion.",
    "Purnima": "Full moon day—auspicious for sadhana and sankalpa.",
    "Amavasya": "New moon day—introspection, tarpan, and spiritual reset.",
}


def _norm_key(s: Any) -> str:
    return "".join(ch for ch in str(s or "").strip().lower() if ch.isalnum())


_MONTH_CANON = {
    # canonical (project output) -> itself
    "chaitra": "Chaitra",
    "vaishakh": "Vaishakh",
    "jyeshtha": "Jyeshtha",
    "ashadh": "Ashadh",
    "shravan": "Shravan",
    "bhadrapad": "Bhadrapad",
    "ashwin": "Ashwin",
    "kartik": "Kartik",
    "margashirsha": "Margashirsha",
    "paush": "Paush",
    "magh": "Magh",
    "phalguna": "Phalguna",
    # common variants (dataset/user spellings)
    "vaisakha": "Vaishakh",
    "vaisakh": "Vaishakh",
    "vaishakha": "Vaishakh",
    "ashadha": "Ashadh",
    "shravana": "Shravan",
    "sravan": "Shravan",
    "bhadrapada": "Bhadrapad",
    "kartika": "Kartik",
    "margshirsha": "Margashirsha",
    "margasirsha": "Margashirsha",
    "margashirsh": "Margashirsha",
    "pausha": "Paush",
    "magha": "Magh",
    "phalgun": "Phalguna",
}


def _norm_month(s: Any) -> str:
    key = _norm_key(s)
    return _MONTH_CANON.get(key, str(s or "").strip())


def _norm_paksha(s: Any) -> str:
    key = _norm_key(s)
    if key.startswith("shukla"):
        return "Shukla"
    if key.startswith("krishna"):
        return "Krishna"
    return str(s or "").strip()


def _norm_tithi(s: Any) -> str:
    key = _norm_key(s)
    if key == "purnima":
        return "Purnima"
    if key == "amavasya":
        return "Amavasya"
    if key == "pratipada":
        return "Pratipada"
    return str(s or "").strip()


_TITHI_ORDER_SHUKLA = [
    "Pratipada",
    "Dwitiya",
    "Tritiya",
    "Chaturthi",
    "Panchami",
    "Shashthi",
    "Saptami",
    "Ashtami",
    "Navami",
    "Dashami",
    "Ekadashi",
    "Dwadashi",
    "Trayodashi",
    "Chaturdashi",
    "Purnima",
]
_TITHI_ORDER_KRISHNA = [
    "Pratipada",
    "Dwitiya",
    "Tritiya",
    "Chaturthi",
    "Panchami",
    "Shashthi",
    "Saptami",
    "Ashtami",
    "Navami",
    "Dashami",
    "Ekadashi",
    "Dwadashi",
    "Trayodashi",
    "Chaturdashi",
    "Amavasya",
]


def _tithi_pos(tithi: str, paksha: str) -> Optional[int]:
    t = _norm_tithi(tithi)
    p = _norm_paksha(paksha)
    order = _TITHI_ORDER_SHUKLA if p == "Shukla" else _TITHI_ORDER_KRISHNA if p == "Krishna" else None
    if not order:
        return None
    try:
        return order.index(t)
    except ValueError:
        return None


def _matches_core(rule: Dict[str, Any], *, tithi: str, paksha: str, month: str) -> bool:
    # Supports single-day and range rules (start_tithi/end_tithi).
    if rule.get("month") is not None and _norm_month(rule.get("month")) != _norm_month(month):
        return False
    if rule.get("paksha") is not None and _norm_paksha(rule.get("paksha")) != _norm_paksha(paksha):
        return False

    if rule.get("tithi") is not None:
        return _norm_tithi(rule.get("tithi")) == _norm_tithi(tithi)

    if rule.get("start_tithi") is not None and rule.get("end_tithi") is not None:
        pos = _tithi_pos(tithi, paksha)
        start = _tithi_pos(str(rule.get("start_tithi")), str(rule.get("paksha") or paksha))
        end = _tithi_pos(str(rule.get("end_tithi")), str(rule.get("paksha") or paksha))
        if pos is None or start is None or end is None:
            return False
        return start <= pos <= end

    return False


def _matches(rule: Dict[str, Any], *, tithi: str, paksha: str, month: str, nakshatra: str) -> bool:
    for k, v in (("tithi", tithi), ("paksha", paksha), ("month", month), ("nakshatra", nakshatra)):
        rv = rule.get(k)
        if rv is None:
            continue
        if k == "paksha":
            if _norm_paksha(rv) != _norm_paksha(v):
                return False
        elif k == "month":
            if _norm_month(rv) != _norm_month(v):
                return False
        elif k == "tithi":
            if _norm_tithi(rv) != _norm_tithi(v):
                return False
        else:
            if _norm_key(rv) and _norm_key(rv) != _norm_key(v):
                return False
    return True


def festivals_for_day(
    *,
    date_str: Optional[str] = None,
    tithi: str,
    paksha: str,
    month: str,
    nakshatra: str,
    # Optional time-rule snapshots (festival exceptions)
    tithi_sunset: Optional[str] = None,
    paksha_sunset: Optional[str] = None,
    tithi_nishita: Optional[str] = None,
    paksha_nishita: Optional[str] = None,
    tithi_midnight: Optional[str] = None,
    paksha_midnight: Optional[str] = None,
    tithi_prev_sunrise: Optional[str] = None,
    paksha_prev_sunrise: Optional[str] = None,
    tithi_next_sunrise: Optional[str] = None,
    paksha_next_sunrise: Optional[str] = None,
    tithi_moonrise: Optional[str] = None,
    paksha_moonrise: Optional[str] = None,
    sankranti_to_signs: Optional[List[int]] = None,
    month_is_adhik: Optional[bool] = None,
    sun_sign_today: Optional[int] = None,
    sun_sign_yesterday: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Returns a list of matched festivals with metadata (icon/description/animation key).
    Matching is rule-based and derived from Panchang fields (no hardcoded dates).
    """
    rules = _load_rules()
    matched: List[Tuple[str, Dict[str, Any]]] = []

    # Default time rule: tithi/paksha at sunrise (most festivals)
    def pick_snapshot(time_rule: str) -> Tuple[str, str]:
        tr = _norm_key(time_rule)
        if tr in ("sunset", "evening"):
            return (tithi_sunset or tithi, paksha_sunset or paksha)
        if tr in ("midnight",):
            return (tithi_midnight or tithi_nishita or tithi, paksha_midnight or paksha_nishita or paksha)
        if tr in ("nishita", "night"):
            return (tithi_nishita or tithi, paksha_nishita or paksha)
        if tr in ("moonrise",):
            return (tithi_moonrise or tithi, paksha_moonrise or paksha)
        return (tithi, paksha)

    # Festival-specific time rules (definition, not dates)
    TIME_RULE_BY_NAME = {
        "Krishna Janmashtami": "midnight",
        "Maha Shivratri": "night",
        "Holika Dahan": "sunset",
        "Karwa Chauth": "moonrise",
    }

    # Core (tithi/paksha/month/nakshatra)
    for rule in rules.get("core", []):
        # Solar core festival(s)
        if _norm_key(rule.get("calendar")) == "solar":
            name = str(rule.get("name") or "").strip()
            if name == "Makar Sankranti":
                # Sun enters Capricorn (sidereal sign index 9)
                if sankranti_to_signs and 9 in sankranti_to_signs:
                    matched.append(("core", rule))
            continue

        if month_is_adhik:
            # Most festivals are not observed in Adhik Maas (shift to the next "normal" month).
            continue

        name = str(rule.get("name") or "").strip()
        tr = TIME_RULE_BY_NAME.get(name, "sunrise")
        tt, pp = pick_snapshot(tr)

        # Ekadashi edge-cases (Drik-style):
        # - Double (vriddhi) Ekadashi: if Ekadashi exists at sunrise on two consecutive days,
        #   mark only the 2nd day (today is skipped if tomorrow is also Ekadashi).
        # - Skipped Ekadashi at sunrise: if Ekadashi doesn't appear at sunrise on any day in the paksha,
        #   it is observed on the next day's sunrise (usually Dwadashi / Mahadwadashi).
        if tr == "sunrise" and _norm_tithi(rule.get("tithi")) == "Ekadashi":
            tt_norm = _norm_tithi(tt)
            pp_norm = _norm_paksha(pp)
            next_t = _norm_tithi(tithi_next_sunrise) if tithi_next_sunrise else None
            next_p = _norm_paksha(paksha_next_sunrise) if paksha_next_sunrise else None
            prev_t = _norm_tithi(tithi_prev_sunrise) if tithi_prev_sunrise else None
            prev_p = _norm_paksha(paksha_prev_sunrise) if paksha_prev_sunrise else None

            # Prefer 2nd day when Ekadashi spans two sunrises.
            if tt_norm == "Ekadashi" and next_t == "Ekadashi" and next_p == pp_norm:
                continue

            # Skipped-at-sunrise: Dashami -> Dwadashi transition across sunrises.
            if tt_norm == "Dwadashi" and prev_t == "Dashami" and prev_p == pp_norm:
                tt = "Ekadashi"

        if _matches_core(rule, tithi=tt, paksha=pp, month=month):
            enriched = dict(rule)
            enriched["time_rule"] = tr
            matched.append(("core", enriched))

    # Vrat rules
    for rule in rules.get("vrat", []):
        # Avoid overly-broad rules (some datasets only include month+paksha for naming).
        if "tithi" in rule or "start_tithi" in rule or "end_tithi" in rule or "nakshatra" in rule:
            if _matches(rule, tithi=tithi, paksha=paksha, month=month, nakshatra=nakshatra):
                matched.append(("vrat", rule))

    # Regional rules: only those that contain lunar conditions (e.g., Chhath Puja)
    for rule in rules.get("regional", []):
        # Fixed-date rules (Gregorian) - format expected: "MM-DD" or "YYYY-MM-DD"
        if date_str and rule.get("fixed_date"):
            fd = str(rule.get("fixed_date")).strip()
            if len(fd) == 5 and date_str[5:] == fd:
                matched.append(("regional", rule))
                continue
            if len(fd) == 10 and date_str == fd:
                matched.append(("regional", rule))
                continue
        if "tithi" in rule or "month" in rule or "paksha" in rule or "nakshatra" in rule:
            if _matches(rule, tithi=tithi, paksha=paksha, month=month, nakshatra=nakshatra):
                matched.append(("regional", rule))
        else:
            # typed rules
            rtype = rule.get("type")
            if rtype == "lunar_new_year":
                if month == "Chaitra" and paksha == "Shukla Paksha" and tithi == "Pratipada":
                    matched.append(("regional", rule))
            elif rtype == "solar":
                # Minimal solar support: Makara Sankranti / Pongal (Sun enters Capricorn)
                if str(rule.get("name")) == "Pongal" and sun_sign_today is not None and sun_sign_yesterday is not None:
                    if sun_sign_today == 9 and sun_sign_yesterday != 9:
                        matched.append(("regional", rule))

    # Derived (rule-based) festivals for better coverage
    if month == "Chaitra" and paksha == "Shukla Paksha" and tithi == "Pratipada":
        matched.append(("derived", {"name": "Navratri Begins"}))
    if month == "Ashwin" and paksha == "Shukla Paksha" and tithi == "Pratipada":
        matched.append(("derived", {"name": "Sharad Navratri Begins"}))
    if month == "Ashwin" and paksha == "Shukla Paksha" and tithi == "Dashami":
        matched.append(("derived", {"name": "Dussehra"}))

    # Normalize + attach metadata
    out: List[Dict[str, Any]] = []
    seen = set()
    for source, r in matched:
        name = str(r.get("name") or "").strip()
        if not name or name in seen:
            continue
        seen.add(name)
        out.append(
            {
                "name": name,
                "icon": _ICON_BY_NAME.get(name, "🎉"),
                "description": _DESC_BY_NAME.get(name, "Auspicious day in the Sanatan calendar."),
                "anim": _ANIM_BY_NAME.get(name, "glow"),
                "source": source,
                "time_rule": r.get("time_rule"),
                "region": r.get("region"),
            }
        )
    return out
