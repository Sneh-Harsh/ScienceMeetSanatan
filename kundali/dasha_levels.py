"""Vimshottari sub-periods (Antardasha / Pratyantar) with correct proportions.

A Mahadasha always lasts its full nominal length (Sun 6y, Moon 10y, ...). The
Mahadasha running at birth is only the *balance* of that length, so its
sub-periods must be cut from the nominal start (balance end minus full length)
and then clipped to the balance - not squeezed into the remaining time.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Optional

from .calculations import VIMSHOTTARI_ORDER, VIMSHOTTARI_YEARS

DAY_YEAR = 365.25


def _iso(value: datetime) -> str:
    return value.isoformat(timespec="seconds")


def _split(planet: str, nominal_start: datetime, nominal_days: float, clip_start: datetime, clip_end: datetime) -> List[Dict]:
    order_start = VIMSHOTTARI_ORDER.index(planet)
    order = VIMSHOTTARI_ORDER[order_start:] + VIMSHOTTARI_ORDER[:order_start]
    out: List[Dict] = []
    cursor = nominal_start
    for sub in order:
        days = nominal_days * VIMSHOTTARI_YEARS[sub] / 120.0
        nxt = cursor + timedelta(days=days)
        if nxt > clip_start and cursor < clip_end:
            s, e = max(cursor, clip_start), min(nxt, clip_end)
            out.append({
                "planet": sub,
                "start": _iso(s),
                "end": _iso(e),
                "years": round((e - s).days / 365.2425, 2),
                "nominal_start": cursor,
                "nominal_days": days,
            })
        cursor = nxt
    return out


def _bounds(maha: Dict):
    start = datetime.fromisoformat(str(maha["start"]))
    end = datetime.fromisoformat(str(maha["end"]))
    nominal_days = VIMSHOTTARI_YEARS[str(maha["planet"])] * DAY_YEAR
    nominal_start = start if (end - start).total_seconds() / 86400.0 >= nominal_days - 1.0 else end - timedelta(days=nominal_days)
    return start, end, nominal_start, nominal_days


def antardashas(maha: Dict) -> List[Dict]:
    planet = str(maha.get("planet") or "")
    if planet not in VIMSHOTTARI_ORDER:
        return []
    start, end, nominal_start, nominal_days = _bounds(maha)
    return _split(planet, nominal_start, nominal_days, start, end)


def pratyantars(antar: Dict, clip_start: Optional[datetime] = None) -> List[Dict]:
    s = datetime.fromisoformat(str(antar["start"]))
    e = datetime.fromisoformat(str(antar["end"]))
    return _split(str(antar["planet"]), antar["nominal_start"], antar["nominal_days"], clip_start or s, e)


def _find(rows: List[Dict], moment: datetime) -> Optional[Dict]:
    for row in rows:
        if datetime.fromisoformat(row["start"]) <= moment < datetime.fromisoformat(row["end"]):
            return row
    return rows[-1] if rows else None


def levels_at(kundali: Dict, moment: datetime) -> Dict:
    """Maha / Antar / Pratyantar running at ``moment`` plus the next Antar."""
    mahas = [m for m in kundali.get("dasha", []) if m.get("start") and m.get("end")]
    maha = None
    for m in mahas:
        if datetime.fromisoformat(m["start"]) <= moment < datetime.fromisoformat(m["end"]):
            maha = m
            break
    if maha is None:
        maha = mahas[0] if moment < datetime.fromisoformat(mahas[0]["start"]) else mahas[-1]
    antars = antardashas(maha)
    antar = _find(antars, moment)
    praty = _find(pratyantars(antar), moment) if antar else None
    nxt = None
    if antar:
        idx = antars.index(antar)
        if idx + 1 < len(antars):
            nxt = antars[idx + 1]
        else:
            later = [m for m in mahas if datetime.fromisoformat(m["start"]) >= datetime.fromisoformat(maha["end"])]
            if later:
                nxt = {"planet": later[0]["planet"], "start": later[0]["start"], "new_maha": True}
    return {"maha": maha, "antar": antar, "praty": praty, "next_antar": nxt}
