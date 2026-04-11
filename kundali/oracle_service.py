from __future__ import annotations

import json
import os
from datetime import datetime
from hashlib import sha1
from typing import Dict, Iterable, List, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from .calculations import build_kundali
from .horoscope_engine import _transit_planets, build_horoscope

DEFAULT_ORACLE_MODEL = "gpt-4.1-mini"

ORACLE_SCHEMA = {
    "type": "object",
    "properties": {
        "directAnswer": {"type": "string"},
        "chartBasis": {"type": "string"},
        "opportunities": {"type": "string"},
        "cautions": {"type": "string"},
        "bestTiming": {"type": "string"},
        "remedy": {"type": "string"},
        "confidence": {"type": "number"},
        "astroBasisUsed": {"type": "array", "items": {"type": "string"}},
        "suggestedFollowUps": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "directAnswer",
        "chartBasis",
        "opportunities",
        "cautions",
        "bestTiming",
        "remedy",
        "confidence",
        "astroBasisUsed",
        "suggestedFollowUps",
    ],
    "additionalProperties": False,
}

ORACLE_SYSTEM_PROMPT = """
You are Ask the Oracle inside a luxury Vedic astrology product.

Rules:
- Use only the astrology JSON provided to you.
- Do not invent birth details, planetary placements, or timing that is not present.
- If signals are mixed, say so clearly.
- Distinguish opportunity, caution, and timing.
- Use warm, wise, premium language without fear-based phrasing.
- Explain the astrological basis in simple human language.
- Never mention being an AI language model.
- Never give medical, legal, or financial certainty.
- Return only valid JSON matching the schema.
""".strip()

SUMMARY_SYSTEM_PROMPT = """
You write premium horoscope summaries for a Vedic astrology product.

Rules:
- Use only the astrology JSON provided.
- Do not invent chart data or timings.
- Be concise, elegant, and emotionally intelligent.
- Return only valid JSON matching the schema.
""".strip()

SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {"type": "string"},
        "summary": {"type": "string"},
        "timingCue": {"type": "string"},
        "dominantPlanet": {"type": "string"},
    },
    "required": ["headline", "summary", "timingCue", "dominantPlanet"],
    "additionalProperties": False,
}


def _openai_api_key() -> str:
    return os.getenv("OPENAI_API_KEY", "").strip()


def _oracle_model() -> str:
    return os.getenv("OPENAI_ORACLE_MODEL", DEFAULT_ORACLE_MODEL).strip() or DEFAULT_ORACLE_MODEL


def _safe_text(value: object, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text or fallback


def _as_number(value: object, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return fallback


def build_astro_context(*, date_str: str, time_str: str, lat: float, lon: float, tz_name: str, specific_year: int) -> Dict:
    kundali = build_kundali(date_str=date_str, time_str=time_str, lat=lat, lon=lon, tz_name=tz_name)
    horoscope = build_horoscope(
        date_str=date_str,
        time_str=time_str,
        lat=lat,
        lon=lon,
        tz_name=tz_name,
        specific_year=specific_year,
    )

    tz = ZoneInfo(tz_name)
    now_local = datetime.now(tz=tz).replace(second=0, microsecond=0)
    natal_lagna_idx = next((int(h["rashi_index"]) for h in kundali["houses"] if int(h["house"]) == 1), 0)
    natal_moon = next((p for p in kundali["planets"] if p["planet"] == "Moon"), None)
    natal_moon_idx = int(natal_moon["rashi_index"]) if natal_moon else 0

    current_transits = _transit_planets(now_local, natal_lagna_idx, natal_moon_idx)
    year_probe = datetime(specific_year, 7, 1, 12, 0, tzinfo=tz)
    yearly_transits = _transit_planets(year_probe, natal_lagna_idx, natal_moon_idx)

    caution_flags: List[str] = []
    daily_scores = horoscope["daily"]["scores"]
    if int(daily_scores.get("health", 0)) < 45:
        caution_flags.append("Energy is running lower than ideal, so pace and recovery matter.")
    if int(daily_scores.get("finance", 0)) < 45:
        caution_flags.append("Financial decisions need extra patience right now.")
    if horoscope["daily"]["dominant_planet"] in {"Saturn", "Rahu", "Ketu"}:
        caution_flags.append("The current dominant planet favors measured action over haste.")

    summary_signals = {
        "daily": horoscope["daily"]["summary"],
        "weekly": horoscope["weekly"]["summary"],
        "monthly": horoscope["monthly"]["summary"],
        "yearly": horoscope["yearly"]["summary"],
        "specificYear": horoscope["specific_year"]["summary"],
    }

    remedies = [
        horoscope["daily"]["advice"],
        f"Lucky color: {horoscope['daily']['lucky']['color']}",
        f"Lucky time: {horoscope['daily']['lucky']['time']}",
    ]

    return {
        "profile": {
            "date": date_str,
            "time": time_str,
            "latitude": lat,
            "longitude": lon,
            "timezone": tz_name,
            "specificYear": specific_year,
        },
        "lagna": kundali["lagna"],
        "moonSign": horoscope["natal"]["moon_sign"],
        "sunSign": horoscope["natal"]["sun_sign"],
        "nakshatra": horoscope["natal"]["nakshatra"],
        "nakshatraPada": horoscope["natal"]["nakshatra_pada"],
        "ayanamsa": kundali["ayanamsa"],
        "planetaryPositions": kundali["planets"],
        "dasha": kundali["dasha"],
        "mahadasha": horoscope["daily"]["mahadasha"],
        "antardasha": horoscope["daily"]["antardasha"],
        "currentTransits": {
            name: {
                "rashi": row.rashi,
                "houseFromLagna": row.house_from_lagna,
                "houseFromMoon": row.house_from_moon,
                "degree": round(float(row.degree), 2),
            }
            for name, row in current_transits.items()
        },
        "yearlyTransits": {
            name: {
                "rashi": row.rashi,
                "houseFromLagna": row.house_from_lagna,
                "houseFromMoon": row.house_from_moon,
                "degree": round(float(row.degree), 2),
            }
            for name, row in yearly_transits.items()
        },
        "summarySignals": summary_signals,
        "scores": horoscope["daily"]["scores"],
        "remedies": remedies,
        "cautionFlags": caution_flags,
        "luckyElements": horoscope["daily"]["lucky"],
        "horoscope": horoscope,
    }


def get_suggested_prompts(astro_context: Dict) -> List[str]:
    scores = astro_context.get("scores", {})
    prompts = [
        "What should I focus on this month?",
        "Why has my emotional energy felt heavier lately?",
    ]
    if int(scores.get("career", 0) or 0) < 55:
        prompts.append("Why is career feeling delayed right now?")
    else:
        prompts.append("How can I use my current career momentum wisely?")
    if int(scores.get("love", 0) or 0) < 55:
        prompts.append("Is this period asking for patience in relationships?")
    else:
        prompts.append("Is this a supportive phase for love and commitment?")
    prompts.append(f"Should I make a major move in {astro_context['profile']['specificYear']}?")
    return prompts[:5]


def _history_digest(history: Optional[Iterable[Dict]]) -> List[Dict]:
    digest: List[Dict] = []
    for item in list(history or [])[-4:]:
        question = _safe_text(item.get("question"))
        answer = _safe_text(item.get("directAnswer"))
        if question and answer:
            digest.append({"question": question, "answer": answer})
    return digest


def _confidence_from_context(astro_context: Dict) -> float:
    scores = astro_context.get("scores", {})
    values = [int(v) for v in scores.values() if isinstance(v, (int, float))]
    if not values:
        return 0.64
    avg = sum(values) / len(values)
    return round(max(0.45, min(0.92, 0.5 + (avg - 50.0) / 120.0)), 2)


def _focus_domain(question: str) -> str:
    lowered = question.lower()
    if any(token in lowered for token in ("career", "job", "work", "business", "promotion")):
        return "career"
    if any(token in lowered for token in ("marriage", "relationship", "love", "partner")):
        return "love"
    if any(token in lowered for token in ("health", "energy", "stress", "body")):
        return "health"
    if any(token in lowered for token in ("money", "finance", "wealth", "income")):
        return "finance"
    return "general"


def _fallback_oracle_answer(question: str, astro_context: Dict) -> Dict:
    horoscope = astro_context["horoscope"]
    focus = _focus_domain(question)
    period = horoscope["daily"]
    if "year" in question.lower() or str(astro_context["profile"]["specificYear"]) in question:
        period = horoscope["specific_year"]
    elif any(token in question.lower() for token in ("month", "monthly")):
        period = horoscope["monthly"]
    elif any(token in question.lower() for token in ("week", "weekly")):
        period = horoscope["weekly"]

    score_map = period["scores"]
    focus_score = int(score_map.get(focus, 0) or 0) if focus in score_map else int(sum(score_map.values()) / max(len(score_map), 1))
    tone = "supportive" if focus_score >= 68 else "mixed" if focus_score >= 48 else "cautious"
    confidence = _confidence_from_context(astro_context)
    direct = (
        f"Krishna says, this is a {tone} phase for your question. "
        f"The chart is not pointing toward randomness; it is showing a pattern shaped by {period['dominant_planet']} "
        f"and your {period['mahadasha']} / {period['antardasha']} timing."
    )
    chart_basis = (
        f"Your Lagna is {astro_context['lagna']}, your Moon sign is {astro_context['moonSign']}, and the active timing is "
        f"{period['mahadasha']} Mahadasha with {period['antardasha']} Antardasha. "
        f"The current transit pressure is running through house {period['transit_house']} from the Moon, which is why this theme feels personal."
    )
    opportunities = (
        f"The stronger opening here is in {period['dominant_planet']} matters: {period['summary']} "
        f"Your {focus} score for this period is {focus_score}/100, so progress comes through steady, aligned choices rather than force."
    )
    cautions = (
        f"What needs watching is overreach. {period['advice']} "
        f"{' '.join(astro_context.get('cautionFlags', [])[:2])}".strip()
    )
    best_timing = (
        f"Use the more favorable rhythm around {period['lucky']['time']} and when your mind feels settled, "
        f"rather than acting inside emotional peaks. For the broader year lens, {horoscope['specific_year']['summary']}"
    )
    remedy = (
        f"A gentle remedy is to work with {period['lucky']['color']} energy, keep your schedule clear around one key decision point, "
        f"and follow this guidance: {period['advice']}"
    )
    astro_basis_used = [
        f"Lagna • {astro_context['lagna']}",
        f"Moon Sign • {astro_context['moonSign']}",
        f"Nakshatra • {astro_context['nakshatra']}",
        f"Mahadasha • {period['mahadasha']}",
        f"Antardasha • {period['antardasha']}",
        f"Transit House • {period['transit_house']}",
        f"Dominant Planet • {period['dominant_planet']}",
    ]
    return {
        "directAnswer": direct,
        "chartBasis": chart_basis,
        "opportunities": opportunities,
        "cautions": cautions,
        "bestTiming": best_timing,
        "remedy": remedy,
        "confidence": confidence,
        "astroBasisUsed": astro_basis_used,
        "suggestedFollowUps": get_suggested_prompts(astro_context),
    }


def _parse_json_from_text(text: str) -> Optional[Dict]:
    text = _safe_text(text)
    if not text:
        return None
    candidates = [text]
    if "```" in text:
        candidates.extend(part.strip() for part in text.split("```") if "{" in part and "}" in part)
    for candidate in candidates:
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start == -1 or end == -1 or end <= start:
            continue
        try:
            return json.loads(candidate[start : end + 1])
        except Exception:
            continue
    return None


def _openai_chat_json(*, system_prompt: str, user_payload: Dict, user_identifier: str) -> Dict:
    api_key = _openai_api_key()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured.")
    payload = {
        "model": _oracle_model(),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.7,
        "user": user_identifier,
    }
    request = Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urlopen(request, timeout=40) as response:
        raw = json.loads(response.read().decode("utf-8"))
    text = _safe_text(raw.get("choices", [{}])[0].get("message", {}).get("content"))
    parsed = _parse_json_from_text(text)
    if not parsed:
        raise ValueError("OpenAI returned an unreadable JSON payload.")
    return parsed


def _call_openai(question: str, astro_context: Dict, history: Optional[List[Dict]], user_identifier: str) -> Dict:
    parsed = _openai_chat_json(
        system_prompt=ORACLE_SYSTEM_PROMPT,
        user_payload={
            "question": question,
            "astroContext": astro_context,
            "history": _history_digest(history),
        },
        user_identifier=user_identifier,
    )
    return {
        "directAnswer": _safe_text(parsed.get("directAnswer")),
        "chartBasis": _safe_text(parsed.get("chartBasis")),
        "opportunities": _safe_text(parsed.get("opportunities")),
        "cautions": _safe_text(parsed.get("cautions")),
        "bestTiming": _safe_text(parsed.get("bestTiming")),
        "remedy": _safe_text(parsed.get("remedy")),
        "confidence": max(0.0, min(1.0, _as_number(parsed.get("confidence"), _confidence_from_context(astro_context)))),
        "astroBasisUsed": [str(item).strip() for item in list(parsed.get("astroBasisUsed") or []) if str(item).strip()] or [
            f"Lagna • {astro_context['lagna']}",
            f"Moon Sign • {astro_context['moonSign']}",
            f"Nakshatra • {astro_context['nakshatra']}",
            f"Mahadasha • {astro_context['mahadasha']}",
            f"Antardasha • {astro_context['antardasha']}",
        ],
        "suggestedFollowUps": [str(item).strip() for item in list(parsed.get("suggestedFollowUps") or []) if str(item).strip()] or get_suggested_prompts(astro_context),
    }


def ask_oracle(*, question: str, astro_context: Dict, history: Optional[List[Dict]] = None, user_identifier: str = "oracle-user") -> Dict:
    question = _safe_text(question)
    if not question:
        raise ValueError("Question is required.")
    return _call_openai(question, astro_context, history, user_identifier)


def _fallback_summary(astro_context: Dict, scope_key: str) -> Dict:
    horoscope = astro_context["horoscope"]
    scope = horoscope.get(scope_key) or horoscope["daily"]
    return {
        "headline": scope.get("cosmic_message") or "Your chart is speaking in a quieter, more precise way right now.",
        "summary": scope.get("summary") or "",
        "timingCue": f"Use the stronger rhythm around {scope.get('lucky', {}).get('time', 'your calmer hours')}.",
        "dominantPlanet": scope.get("dominant_planet") or "Moon",
    }


def generate_personalized_summary(*, astro_context: Dict, scope_key: str, user_identifier: str = "oracle-user") -> Dict:
    scope_key = _safe_text(scope_key, "daily").lower()
    if scope_key not in {"daily", "weekly", "monthly", "yearly", "specific_year"}:
        scope_key = "daily"
    parsed = _openai_chat_json(
        system_prompt=SUMMARY_SYSTEM_PROMPT,
        user_payload={
            "scope": scope_key,
            "astroContext": astro_context,
            "target": "Create a premium personalized summary for the requested horoscope scope using only this astrology data.",
        },
        user_identifier=user_identifier,
    )
    return {
        "headline": _safe_text(parsed.get("headline")),
        "summary": _safe_text(parsed.get("summary")),
        "timingCue": _safe_text(parsed.get("timingCue")),
        "dominantPlanet": _safe_text(parsed.get("dominantPlanet")),
    }


def profile_fingerprint(profile: Dict) -> str:
    raw = json.dumps(profile, sort_keys=True, ensure_ascii=False)
    return sha1(raw.encode("utf-8")).hexdigest()[:16]
