from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, List


_CACHE: Dict[str, object] = {"mtime": None, "data": {}}


def _festivals_path() -> Path:
    return Path(__file__).with_name("festivals.json")


def _load_festivals_file() -> Dict[str, List[str]]:
    path = _festivals_path()
    if not path.exists():
        return {}
    try:
        raw = path.read_text(encoding="utf-8")
        j = json.loads(raw) if raw.strip() else {}
        if isinstance(j, dict):
            out: Dict[str, List[str]] = {}
            for k, v in j.items():
                if isinstance(k, str) and isinstance(v, list):
                    out[k] = [str(x) for x in v]
            return out
        return {}
    except Exception:
        return {}


def get_festivals_for_date(date_str: str) -> List[str]:
    """
    Returns a list of festival names for the given YYYY-MM-DD date.
    Data source: panchang/festivals.json (user-editable).
    """
    path = _festivals_path()
    try:
        mtime = os.path.getmtime(path) if path.exists() else None
    except Exception:
        mtime = None

    if _CACHE["mtime"] != mtime:
        _CACHE["mtime"] = mtime
        _CACHE["data"] = _load_festivals_file()

    data = _CACHE.get("data") or {}
    if not isinstance(data, dict):
        return []
    v = data.get(date_str, [])
    if isinstance(v, list):
        return [str(x) for x in v]
    return []

