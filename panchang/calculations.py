from __future__ import annotations

from dataclasses import dataclass
from datetime import date as Date, datetime, timedelta
from functools import lru_cache
from math import cos, pi
from typing import Callable, Dict, Optional, Tuple
from zoneinfo import ZoneInfo

import swisseph as swe

from .festivals import get_festivals_for_date
from .festival_rules import festivals_for_day

# ----------------------------
# Sidereal settings (Lahiri)
# ----------------------------
swe.set_sid_mode(swe.SIDM_LAHIRI, 0, 0)

FLG = swe.FLG_SWIEPH | swe.FLG_SIDEREAL


TITHI_NAMES = [
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

NAKSHATRA_NAMES = [
    "Ashwini",
    "Bharani",
    "Krittika",
    "Rohini",
    "Mrigashirsha",
    "Ardra",
    "Punarvasu",
    "Pushya",
    "Ashlesha",
    "Magha",
    "Purva Phalguni",
    "Uttara Phalguni",
    "Hasta",
    "Chitra",
    "Swati",
    "Vishakha",
    "Anuradha",
    "Jyeshtha",
    "Mula",
    "Purva Ashadha",
    "Uttara Ashadha",
    "Shravana",
    "Dhanishta",
    "Shatabhisha",
    "Purva Bhadrapada",
    "Uttara Bhadrapada",
    "Revati",
]

# Amanta month naming by Sun's sidereal sign at Amavasya (new moon)
# Sun sign: 0 Aries ... 11 Pisces
AMANTA_MONTH_BY_SUN_SIGN = [
    "Vaishakh",     # Aries
    "Jyeshtha",     # Taurus
    "Ashadh",       # Gemini
    "Shravan",      # Cancer
    "Bhadrapad",    # Leo
    "Ashwin",       # Virgo
    "Kartik",       # Libra
    "Margashirsha", # Scorpio
    "Paush",        # Sagittarius
    "Magh",         # Capricorn
    "Phalguna",     # Aquarius
    "Chaitra",      # Pisces
]


def _dt_to_jd_utc(dt_utc: datetime) -> float:
    hour = dt_utc.hour + dt_utc.minute / 60 + dt_utc.second / 3600 + dt_utc.microsecond / 3_600_000_000
    return swe.julday(dt_utc.year, dt_utc.month, dt_utc.day, hour)


def _jd_to_dt_local(jd_ut: float, tz: ZoneInfo) -> datetime:
    y, m, d, h = swe.revjul(jd_ut)
    hours = float(h)
    hh = int(hours)
    mm = int((hours - hh) * 60)
    ss = int(round((((hours - hh) * 60) - mm) * 60))
    if ss >= 60:
        ss -= 60
        mm += 1
    if mm >= 60:
        mm -= 60
        hh += 1
    dt_utc = datetime(int(y), int(m), int(d), 0, 0, 0, tzinfo=ZoneInfo("UTC")) + timedelta(hours=hh, minutes=mm, seconds=ss)
    return dt_utc.astimezone(tz)


def _sun_moon_sidereal_longitudes(jd_ut: float) -> Tuple[float, float]:
    sun = swe.calc_ut(jd_ut, swe.SUN, FLG)[0][0] % 360.0
    moon = swe.calc_ut(jd_ut, swe.MOON, FLG)[0][0] % 360.0
    return sun, moon


def _tithi_index(jd_ut: float) -> int:
    sun, moon = _sun_moon_sidereal_longitudes(jd_ut)
    diff = (moon - sun) % 360.0
    return int(diff // 12.0)  # 0..29


def _nakshatra_index(jd_ut: float) -> int:
    _, moon = _sun_moon_sidereal_longitudes(jd_ut)
    return int((moon % 360.0) // (360.0 / 27.0))  # 0..26


def _paksha_from_tithi_index(idx: int) -> str:
    return "Shukla Paksha" if idx < 15 else "Krishna Paksha"


def _moon_phase_fraction(jd_ut: float) -> Tuple[float, bool]:
    sun, moon = _sun_moon_sidereal_longitudes(jd_ut)
    diff = (moon - sun) % 360.0
    # illumination fraction: 0 new, 1 full
    frac = (1.0 - cos(diff * pi / 180.0)) / 2.0
    waxing = diff <= 180.0
    return max(0.0, min(1.0, frac)), waxing


def _find_bracket(jd_center: float, state_fn: Callable[[float], int], target_state: int, direction: int) -> Tuple[float, float]:
    """
    Find a time bracket [a,b] where the integer state changes from target_state.
    direction: +1 forward, -1 backward
    """
    step = 1.0 / 24.0  # 1 hour
    limit_days = 7
    a = jd_center
    s = state_fn(a)
    if s != target_state:
        return jd_center, jd_center
    for _ in range(int(limit_days * 24)):
        b = a + direction * step
        sb = state_fn(b)
        if sb != target_state:
            return (a, b) if a < b else (b, a)
        a = b
    raise RuntimeError("Could not bracket transition within limit.")


def _binary_search_transition(jd_lo: float, jd_hi: float, state_fn: Callable[[float], int], target_state: int, tol_minutes: float = 1.0) -> float:
    tol = tol_minutes / 1440.0
    lo, hi = jd_lo, jd_hi
    # Ensure lo is target_state and hi is different (or vice versa)
    for _ in range(80):
        if hi - lo <= tol:
            return (lo + hi) / 2.0
        mid = (lo + hi) / 2.0
        sm = state_fn(mid)
        if sm == target_state:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2.0


def _find_start_end(jd_ref: float, state_fn: Callable[[float], int]) -> Tuple[int, float, float]:
    """
    For the integer state at jd_ref:
      - find start time (previous boundary)
      - find end time (next boundary)
    Returns: (state, start_jd, end_jd)
    """
    current = state_fn(jd_ref)

    # End (forward)
    lo_f, hi_f = _find_bracket(jd_ref, state_fn, current, direction=+1)
    end_jd = _binary_search_transition(lo_f, hi_f, state_fn, current, tol_minutes=1.0)

    # Start (backward): find bracket where state changes into current
    lo_b, hi_b = _find_bracket(jd_ref, state_fn, current, direction=-1)
    # Here, hi_b is closer to jd_ref and is current; lo_b is before boundary (not current)
    start_jd = _binary_search_transition(lo_b, hi_b, state_fn, state_fn(lo_b), tol_minutes=1.0)
    # start_jd found is time where previous state ends; so start of current is just after it
    # For minute-level reporting, use that boundary itself.
    return current, start_jd, end_jd


def _sun_sidereal_sign_index(jd_ut: float) -> int:
    sun = swe.calc_ut(jd_ut, swe.SUN, FLG)[0][0] % 360.0
    return int(sun // 30.0)  # 0..11


def _find_previous_amavasya(jd_ref: float) -> float:
    """
    Find most recent Amavasya boundary before jd_ref (tithi index 29 -> 0 transition).
    We locate the end time of tithi 29 that is before jd_ref.
    """
    # Walk backwards until we encounter an Amavasya tithi (index 29). From there, compute the
    # 29->0 transition (new moon). If that transition is still *after* jd_ref (i.e. jd_ref lies
    # inside the same Amavasya tithi), keep searching further back for the previous month's Amavasya.
    jd = jd_ref
    for _ in range(60 * 24):  # up to 60 days in hours (safe window)
        if _tithi_index(jd) == 29:
            lo, hi = _find_bracket(jd, _tithi_index, 29, direction=+1)
            ama_end = _binary_search_transition(lo, hi, _tithi_index, 29, tol_minutes=1.0)
            if ama_end <= jd_ref:
                return ama_end

            # We're inside the current Amavasya (boundary after jd_ref). Jump before its start
            # and continue searching for the *previous* Amavasya boundary.
            lo_b, hi_b = _find_bracket(jd, _tithi_index, 29, direction=-1)
            ama_start = _binary_search_transition(lo_b, hi_b, _tithi_index, _tithi_index(lo_b), tol_minutes=1.0)
            jd = ama_start - 1.0 / 24.0
            continue

        jd -= 1.0 / 24.0
    raise RuntimeError("Could not find previous Amavasya.")


def _rise_set(jd_ut_start: float, lat: float, lon: float, event_flag: int) -> float:
    geopos = (lon, lat, 0.0)
    res = swe.rise_trans(jd_ut_start, swe.SUN, event_flag, geopos, 1013.25, 15.0, swe.FLG_SWIEPH)
    return float(res[1][0])


def _moon_rise(jd_ut_start: float, lat: float, lon: float) -> Optional[float]:
    geopos = (lon, lat, 0.0)
    try:
        res = swe.rise_trans(jd_ut_start, swe.MOON, swe.CALC_RISE, geopos, 1013.25, 15.0, swe.FLG_SWIEPH)
        return float(res[1][0])
    except Exception:
        return None


def _next_day_sunrise(local_day: Date, tz: ZoneInfo, lat: float, lon: float) -> float:
    sunrise_jd, _ = _sunrise_sunset(local_day + timedelta(days=1), tz, lat, lon)
    return sunrise_jd


def _sankranti_to_signs_between(jd_start: float, jd_end: float) -> Tuple[List[int], List[float]]:
    """
    Detect sidereal sankranti(s) between jd_start and jd_end (UT).
    Returns (to_sign_indices, transition_jds) where to_sign is the sign after transition.
    """
    to_signs: List[int] = []
    times: List[float] = []
    step = 6.0 / 24.0
    jd = jd_start
    cur = _sun_sidereal_sign_index(jd_start)
    while jd < jd_end:
        jd2 = min(jd + step, jd_end)
        s2 = _sun_sidereal_sign_index(jd2)
        if s2 != cur:
            # bracket transition and search
            lo, hi = (jd, jd2) if jd < jd2 else (jd2, jd)
            t = _binary_search_transition(lo, hi, _sun_sidereal_sign_index, cur, tol_minutes=0.5)
            to_sign = _sun_sidereal_sign_index(t + (1.0 / 1440.0))
            to_signs.append(int(to_sign))
            times.append(float(t))
            cur = s2
            jd = t + 1.0 / 24.0
            continue
        jd = jd2
    return to_signs, times


def _find_next_amavasya(jd_ref: float) -> float:
    """
    Find next Amavasya boundary after jd_ref (tithi index 29 -> 0 transition end of tithi 29).
    """
    jd = jd_ref
    for _ in range(40 * 24):  # up to 40 days forward in hours
        if _tithi_index(jd) == 29:
            lo, hi = _find_bracket(jd, _tithi_index, 29, direction=+1)
            return _binary_search_transition(lo, hi, _tithi_index, 29, tol_minutes=1.0)
        jd += 1.0 / 24.0
    raise RuntimeError("Could not find next Amavasya.")

def _amanta_month_base_at_amavasya(jd_amavasya: float) -> str:
    sun_sign = _sun_sidereal_sign_index(jd_amavasya)
    return AMANTA_MONTH_BY_SUN_SIGN[int(sun_sign)]


def _amanta_month_interval_info(jd_amavasya_start: float) -> Tuple[str, str, float, float, int]:
    """
    Compute Adhik/Kshay for one Amanta lunation (Amavasya -> next Amavasya):
      - Adhik: 0 sankranti between the two Amavasya boundaries
      - Kshay: >=2 sankranti between the two Amavasya boundaries (rare)
    Returns: (month_base, month_type, start_jd, end_jd, sankranti_count)
    """
    jd_start = jd_amavasya_start
    jd_end = _find_next_amavasya(jd_start + 0.5)
    to_signs, _times = _sankranti_to_signs_between(jd_start, jd_end)
    sank_count = len(to_signs)
    if sank_count == 0:
        mtype = "Adhik"
    elif sank_count >= 2:
        mtype = "Kshay"
    else:
        mtype = "Nija"
    return _amanta_month_base_at_amavasya(jd_start), mtype, jd_start, jd_end, sank_count


def _sunrise_sunset(local_day: Date, tz: ZoneInfo, lat: float, lon: float) -> Tuple[float, float]:
    # Start search from local midnight converted to UTC JD
    local_midnight = datetime(local_day.year, local_day.month, local_day.day, 0, 0, 0, tzinfo=tz)
    jd_start = _dt_to_jd_utc(local_midnight.astimezone(ZoneInfo("UTC")))
    sunrise_jd = _rise_set(jd_start, lat, lon, swe.CALC_RISE)
    sunset_jd = _rise_set(jd_start, lat, lon, swe.CALC_SET)
    return sunrise_jd, sunset_jd


def _rahu_kaal(sunrise_local: datetime, sunset_local: datetime) -> Tuple[datetime, datetime]:
    weekday = sunrise_local.weekday()  # Mon=0 ... Sun=6
    segment_by_weekday = {
        0: 2,  # Monday
        1: 7,  # Tuesday
        2: 5,  # Wednesday
        3: 6,  # Thursday
        4: 4,  # Friday
        5: 3,  # Saturday
        6: 8,  # Sunday
    }
    seg = segment_by_weekday[weekday]
    day_len = (sunset_local - sunrise_local).total_seconds()
    part = day_len / 8.0
    start = sunrise_local + timedelta(seconds=(seg - 1) * part)
    end = start + timedelta(seconds=part)
    return start, end


def _abhijit_muhurat(sunrise_local: datetime, sunset_local: datetime) -> Tuple[datetime, datetime]:
    # Daytime has 15 muhurtas; Abhijit is the 8th muhurta (sunrise + 7*muhurta to +8*muhurta)
    day_len = (sunset_local - sunrise_local).total_seconds()
    if day_len <= 0:
        return sunrise_local, sunrise_local
    muhurta = day_len / 15.0
    start = sunrise_local + timedelta(seconds=7 * muhurta)
    end = start + timedelta(seconds=muhurta)
    return start, end


def build_panchang(*, date: Optional[str], lat: float, lon: float, tz_name: str, at: Optional[str] = None) -> Dict:
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")
        tz_name = "UTC"
    dt_local: datetime
    jd_ref: float

    # Reference instant:
    # - If `at` is provided, compute Panchang for that exact moment (updates tithi/nakshatra as time passes).
    # - Else if `date` is provided, compute the day's Panchang at sunrise (traditional).
    # - Else, compute for "now" in the requested timezone.
    if at:
        at_norm = at.replace("Z", "+00:00")
        dt_local = datetime.fromisoformat(at_norm)
        if dt_local.tzinfo is None:
            dt_local = dt_local.replace(tzinfo=tz)
        else:
            dt_local = dt_local.astimezone(tz)
        local_day = dt_local.date()
        jd_ref = _dt_to_jd_utc(dt_local.astimezone(ZoneInfo("UTC")))
    elif date:
        y, m, d = (int(x) for x in date.split("-"))
        local_day = Date(y, m, d)
        # Panchang values typically computed for the day at sunrise
        sunrise_jd, sunset_jd = _sunrise_sunset(local_day, tz, lat, lon)
        sunrise_local = _jd_to_dt_local(sunrise_jd, tz)
        sunset_local = _jd_to_dt_local(sunset_jd, tz)
        dt_local = sunrise_local
        jd_ref = sunrise_jd
    else:
        dt_local = datetime.now(tz)
        local_day = dt_local.date()
        jd_ref = _dt_to_jd_utc(dt_local.astimezone(ZoneInfo("UTC")))

    # If we didn't compute sunrise/sunset above (i.e. `at` or "now"), compute them for the local day.
    if "sunrise_local" not in locals():
        sunrise_jd, sunset_jd = _sunrise_sunset(local_day, tz, lat, lon)
        sunrise_local = _jd_to_dt_local(sunrise_jd, tz)
        sunset_local = _jd_to_dt_local(sunset_jd, tz)

    t_idx, t_start, t_end = _find_start_end(jd_ref, _tithi_index)
    n_idx, n_start, n_end = _find_start_end(jd_ref, _nakshatra_index)

    paksha = _paksha_from_tithi_index(t_idx)
    tithi_name = TITHI_NAMES[t_idx]
    nak_name = NAKSHATRA_NAMES[n_idx]

    moon_phase, moon_waxing = _moon_phase_fraction(jd_ref)

    # Hindu lunar month (Purnimanta naming; Adhik/Kshay computed per Amanta lunations).
    #
    # Purnimanta month name is tied to the upcoming Shukla Paksha month:
    # - If today is Shukla Paksha: use the Amanta month that began at the previous Amavasya.
    # - If today is Krishna Paksha: use the Amanta month that will begin at the next Amavasya.
    #
    # This correctly handles Adhik months where consecutive Amavasya can share the same month base.
    ama_prev = _find_previous_amavasya(jd_ref)
    base_cur, type_cur, start_cur, end_cur, sank_cur = _amanta_month_interval_info(ama_prev)
    ama_next = end_cur
    base_next, type_next, start_next, end_next, sank_next = _amanta_month_interval_info(ama_next)

    if paksha == "Shukla Paksha":
        month_base = base_cur
        month_type = type_cur
        month_start_jd, month_end_jd, sankranti_count = start_cur, end_cur, sank_cur
    else:
        month_base = base_next
        month_type = type_next
        month_start_jd, month_end_jd, sankranti_count = start_next, end_next, sank_next

    month_is_adhik = month_type == "Adhik"
    month_is_kshay = month_type == "Kshay"
    month_name = f"Adhik {month_base}" if month_is_adhik else month_base

    rahu_start, rahu_end = _rahu_kaal(sunrise_local, sunset_local)
    abhijit_start, abhijit_end = _abhijit_muhurat(sunrise_local, sunset_local)

    date_str = str(local_day)

    sun_sign_today = _sun_sidereal_sign_index(jd_ref)
    sun_sign_yesterday = _sun_sidereal_sign_index(jd_ref - 1.0)

    # Festival time-rule snapshots (computed for the local day)
    # - sunset-based festivals
    tithi_sunset = TITHI_NAMES[_tithi_index(sunset_jd)]
    paksha_sunset = _paksha_from_tithi_index(_tithi_index(sunset_jd))

    # - nishita (mid-night of the *astronomical night*) between sunset and next sunrise
    sunrise_next_jd = _next_day_sunrise(local_day, tz, lat, lon)
    nishita_jd = (sunset_jd + sunrise_next_jd) / 2.0
    tithi_nishita = TITHI_NAMES[_tithi_index(nishita_jd)]
    paksha_nishita = _paksha_from_tithi_index(_tithi_index(nishita_jd))

    # - sunrise adjacency (for skipped/double tithi rules)
    sunrise_prev_jd, _sunset_prev_jd = _sunrise_sunset(local_day - timedelta(days=1), tz, lat, lon)
    tithi_prev_sunrise = TITHI_NAMES[_tithi_index(sunrise_prev_jd)]
    paksha_prev_sunrise = _paksha_from_tithi_index(_tithi_index(sunrise_prev_jd))
    tithi_next_sunrise = TITHI_NAMES[_tithi_index(sunrise_next_jd)]
    paksha_next_sunrise = _paksha_from_tithi_index(_tithi_index(sunrise_next_jd))

    # - midnight snapshot (00:00 local time of the night after today's sunset)
    local_midnight = datetime(local_day.year, local_day.month, local_day.day, 0, 0, 0, tzinfo=tz)
    local_midnight_next = local_midnight + timedelta(days=1)
    jd_midnight_next = _dt_to_jd_utc(local_midnight_next.astimezone(ZoneInfo("UTC")))
    tithi_midnight = TITHI_NAMES[_tithi_index(jd_midnight_next)]
    paksha_midnight = _paksha_from_tithi_index(_tithi_index(jd_midnight_next))

    # - moonrise-based festivals (best-effort; moonrise after sunset)
    moonrise_jd = _moon_rise(sunset_jd, lat, lon)
    tithi_moonrise = TITHI_NAMES[_tithi_index(moonrise_jd)] if moonrise_jd else None
    paksha_moonrise = _paksha_from_tithi_index(_tithi_index(moonrise_jd)) if moonrise_jd else None

    # - sankranti(s) during sunrise->next sunrise window (solar festivals)
    sank_to, _sank_times = _sankranti_to_signs_between(sunrise_jd, sunrise_next_jd)

    festivals_detail = festivals_for_day(
        date_str=date_str,
        tithi=tithi_name,
        paksha=paksha,
        month=month_base,
        nakshatra=nak_name,
        tithi_sunset=tithi_sunset,
        paksha_sunset=paksha_sunset,
        tithi_nishita=tithi_nishita,
        paksha_nishita=paksha_nishita,
        tithi_midnight=tithi_midnight,
        paksha_midnight=paksha_midnight,
        tithi_prev_sunrise=tithi_prev_sunrise,
        paksha_prev_sunrise=paksha_prev_sunrise,
        tithi_next_sunrise=tithi_next_sunrise,
        paksha_next_sunrise=paksha_next_sunrise,
        tithi_moonrise=tithi_moonrise,
        paksha_moonrise=paksha_moonrise,
        sankranti_to_signs=list(sank_to),
        month_is_adhik=bool(month_is_adhik),
        sun_sign_today=sun_sign_today,
        sun_sign_yesterday=sun_sign_yesterday,
    )

    manual_festivals = get_festivals_for_date(date_str)
    for name in manual_festivals:
        norm = str(name).strip().lower()
        if any(str(f.get("name") or "").strip().lower() == norm for f in festivals_detail):
            continue
        festivals_detail.append(
            {
                "name": str(name).strip(),
                "icon": "🎉",
                "description": "Festival day.",
                "anim": "glow",
                "source": "manual",
            }
        )

    festivals = [str(f.get("name")) for f in festivals_detail if f.get("name")]

    vikram_samvat = _vikram_samvat_year(local_day, tz, lat, lon, tz_name)

    return {
        # required fields
        "tithi": tithi_name,
        "tithi_start": _jd_to_dt_local(t_start, tz).isoformat(timespec="seconds"),
        "tithi_end": _jd_to_dt_local(t_end, tz).isoformat(timespec="seconds"),
        "nakshatra": nak_name,
        "nak_start": _jd_to_dt_local(n_start, tz).isoformat(timespec="seconds"),
        "nak_end": _jd_to_dt_local(n_end, tz).isoformat(timespec="seconds"),
        "paksha": paksha,
        "month": month_name,
        "month_base": month_base,
        "month_type": month_type,
        "month_start": _jd_to_dt_local(month_start_jd, tz).isoformat(timespec="seconds"),
        "month_end": _jd_to_dt_local(month_end_jd, tz).isoformat(timespec="seconds"),
        "sankranti_count": int(sankranti_count),
        "month_is_adhik": bool(month_is_adhik),
        "month_is_kshay": bool(month_is_kshay),
        "moon_phase": float(moon_phase),  # 0..1
        # extra for premium dashboard
        "moon_waxing": bool(moon_waxing),
        "sunrise": sunrise_local.isoformat(timespec="seconds"),
        "sunset": sunset_local.isoformat(timespec="seconds"),
        "rahu_start": rahu_start.isoformat(timespec="seconds"),
        "rahu_end": rahu_end.isoformat(timespec="seconds"),
        "abhijit_start": abhijit_start.isoformat(timespec="seconds"),
        "abhijit_end": abhijit_end.isoformat(timespec="seconds"),
        "festivals": festivals,
        "festivals_detail": festivals_detail,
        "vikram_samvat": int(vikram_samvat),
        "location": {"lat": lat, "lon": lon, "tz": tz_name},
        "date": date_str,
    }


@lru_cache(maxsize=4096)
def build_panchang_for_date(*, date: str, lat_r: float, lon_r: float, tz_name: str, rules_version: str = "") -> Dict:
    """
    Cached day-panchang at sunrise (used heavily by month calendar).
    Cache key uses rounded lat/lon to avoid fragmentation.
    `rules_version` is used as a cache-buster when festival datasets change.
    """
    return build_panchang(date=date, lat=float(lat_r), lon=float(lon_r), tz_name=tz_name, at=None)


@lru_cache(maxsize=256)
def _vikram_samvat_start_date(g_year: int, lat_r: float, lon_r: float, tz_name: str) -> Date:
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")
        tz_name = "UTC"

    # Rule: Vikram Samvat year changes on Chaitra Shukla Pratipada (Hindu/Nav Varsha),
    # which begins immediately after the spring Amavasya (new moon), typically in March–April.
    #
    # Important: a sunrise-only scan can MISS Pratipada when it starts after sunrise and ends before
    # the next sunrise. So we detect the Amavasya→Pratipada boundary (tithi index 29 -> 0) and then
    # select the *spring* boundary date.
    #
    # Heuristic window (India practice): Nav Varsha usually falls ~mid-March to mid-April.
    local_start = datetime(g_year, 3, 1, 0, 0, 0, tzinfo=tz)
    local_end = datetime(g_year, 5, 1, 0, 0, 0, tzinfo=tz)
    jd_start = _dt_to_jd_utc(local_start.astimezone(ZoneInfo("UTC")))
    jd_end = _dt_to_jd_utc(local_end.astimezone(ZoneInfo("UTC")))

    candidates: list[Date] = []

    jd = jd_start
    step = 6.0 / 24.0  # 6 hours
    while jd < jd_end:
        if _tithi_index(jd) == 29:
            lo, hi = _find_bracket(jd, _tithi_index, 29, direction=+1)
            amavasya_end = _binary_search_transition(lo, hi, _tithi_index, 29, tol_minutes=0.5)
            candidates.append(_jd_to_dt_local(amavasya_end, tz).date())
            jd = amavasya_end + 1.0  # jump past this Amavasya
            continue
        jd += step

    # Prefer the boundary that falls inside the expected Nav Varsha window.
    window_start = Date(g_year, 3, 15)
    window_end = Date(g_year, 4, 20)
    in_window = [d for d in candidates if window_start <= d <= window_end]
    if in_window:
        return min(in_window)

    # Otherwise, fall back to the earliest candidate after March 10.
    fallback_start = Date(g_year, 3, 10)
    after = [d for d in candidates if d >= fallback_start]
    if after:
        return min(after)

    # Last resort
    return Date(g_year, 4, 1)


def _vikram_samvat_year(local_day: Date, tz: ZoneInfo, lat: float, lon: float, tz_name: str) -> int:
    lat_r = round(float(lat), 2)
    lon_r = round(float(lon), 2)
    start_date = _vikram_samvat_start_date(local_day.year, lat_r, lon_r, tz_name)
    base = local_day.year + 57
    return base if local_day >= start_date else base - 1
