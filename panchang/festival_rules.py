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


def _matches_core(rule: Dict[str, Any], *, tithi: str, paks