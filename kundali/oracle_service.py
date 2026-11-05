from __future__ import annotations

import logging

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
ORACLE_SCHEMA_NAME = "oracle_answer"
SUMMARY_SCHEMA_NAME = "horoscope_summary"

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

logger = logging.getLogger(__name__)

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
- Write complete, informative text in every required field.
- Keep each field concise but substantive. Avoid one-line fragments.
- Ground every point in the provided lagna, moon sign, dasha, transits, scores, and active scope summaries.
- Start every text field with "Krishna says:" and speak in that voice, as a wise, kind Vedic astrologer would.
- Use the supplied "why" facts (house lordship, dignity, Gochar from the Moon, dasha) as your evidence, and quote houses and planets exactly as given. Never invent dates; use only the supplied "events".
- Never repeat the same sentence across fields. Each field must add something new.
- Return only valid JSON matching the schema.
""".strip()

SUMMARY_SYSTEM_PROMPT = """
You write premium horoscope summaries for a Vedic astrology product.

Rules:
- Use only the astrology JSON provided.
- Do not invent chart data or timings.
- Be concise, elegant, and emotionally intelligent.
- Write a real summary, not a placeholder.
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


def _http_error_message(error: HTTPError) -> str:
    try:
      body = error.read().decode("utf-8", errors="replace").strip()
    except Exception:
      body = ""
    message = f"OpenAI request failed ({error.code})"
    if body:
        message = f"{message}: {body}"
    elif error.reason:
        message = f"{message}: {error.reason}"
    return message


def _response_format_json_schema(name: str, schema: Dict) -> Dict:
    return {
        "type": "json_schema",
        "json_schema": {
            "name": name,
            "strict": True,
            "schema": schema,
        },
    }


def _compact_planetary_positions(planets: List[Dict]) -> List[Dict]:
    compact: List[Dict] = []
    for planet in list(planets or []):
        compact.append(
            {
                "planet": _safe_text(planet.get("planet")),
                "sign": _safe_text(planet.get("rashi")),
                "house": int(planet.get("house") or 0),
                "degree": round(_as_number(planet.get("degree"), 0.0), 2),
            }
        )
    return compact


def _scope_payload(scope: Dict) -> Dict:
    return {
        "scope": _safe_text(scope.get("scope")),
        "summary": _safe_text(scope.get("summary")),
        "cosmicMessage": _safe_text(scope.get("cosmic_message")),
        "dominantPlanet": _safe_text(scope.get("dominant_planet")),
        "transitHouse": int(scope.get("transit_house") or 0),
        "mahadasha": _safe_text(scope.get("mahadasha")),
        "antardasha": _safe_text(scope.get("antardasha")),
        "scores": scope.get("scores") or {},
        "details": scope.get("details") or {},
        "advice": _safe_text(scope.get("advice")),
        "adviceParts": scope.get("adviceParts") or {},
        "lucky": scope.get("lucky") or {},
        "focus": _safe_text(scope.get("focus")),
        "extraScores": scope.get("extraScores") or {},
        "why": scope.get("why") or {},
        "whyPlain": scope.get("whyPlain") or {},
        "events": [{"when": e.get("when"), "text": e.get("text")} for e in list(scope.get("events") or [])[:8]],
        "opportunities": list(scope.get("opportunities") or []),
        "cautions": list(scope.get("cautions") or []),
        "pratyantar": _safe_text(scope.get("pratyantar")),
        "signals": scope.get("signals") or {},
    }


def _oracle_prompt_context(astro_context: Dict) -> Dict:
    horoscope = astro_context.get("horoscope") or {}
    return {
        "profile": astro_context.get("profile") or {},
        "chartIdentity": {
            "lagna": _safe_text(astro_context.get("lagna")),
            "moonSign": _safe_text(astro_context.get("moonSign")),
            "sunSign": _safe_text(astro_context.get("sunSign")),
            "nakshatra": _safe_text(astro_context.get("nakshatra")),
            "nakshatraPada": _safe_text(astro_context.get("nakshatraPada")),
            "ayanamsa": _safe_text(astro_context.get("ayanamsa")),
        },
        "timing": {
            "mahadasha": _safe_text(astro_context.get("mahadasha")),
            "antardasha": _safe_text(astro_context.get("antardasha")),
            "cautionFlags": list(astro_context.get("cautionFlags") or []),
        },
        "natalPlanets": _compact_planetary_positions(astro_context.get("planetaryPositions") or []),
        "currentTransits": astro_context.get("currentTransits") or {},
        "yearlyTransits": astro_context.get("yearlyTransits") or {},
        "luckyElements": astro_context.get("luckyElements") or {},
        "activeScopes": {
            "daily": _scope_payload(horoscope.get("daily") or {}),
            "weekly": _scope_payload(horoscope.get("weekly") or {}),
            "monthly": _scope_payload(horoscope.get("monthly") or {}),
            "yearly": _scope_payload(horoscope.get("yearly") or {}),
            "specificYear": _scope_payload(horoscope.get("specific_year") or {}),
        },
    }


def _summary_prompt_context(astro_context: Dict, scope_key: str) -> Dict:
    horoscope = astro_context.get("horoscope") or {}
    scope = horoscope.get(scope_key) or horoscope.get("daily") or {}
    return {
        "profile": astro_context.get("profile") or {},
        "chartIdentity": {
            "lagna": _safe_text(astro_context.get("lagna")),
            "moonSign": _safe_text(astro_context.get("moonSign")),
            "sunSign": _safe_text(astro_context.get("sunSign")),
            "nakshatra": _safe_text(astro_context.get("nakshatra")),
            "nakshatraPada": _safe_text(astro_context.get("nakshatraPada")),
        },
        "timing": {
            "mahadasha": _safe_text(scope.get("mahadasha") or astro_context.get("mahadasha")),
            "antardasha": _safe_text(scope.get("antardasha") or astro_context.get("antardasha")),
            "dominantPlanet": _safe_text(scope.get("dominant_planet")),
            "transitHouse": int(scope.get("transit_house") or 0),
        },
        "summary": _scope_payload(scope),
        "cautionFlags": list(astro_context.get("cautionFlags") or []),
        "luckyElements": astro_context.get("luckyElements") or {},
    }


def _validate_required_text_fields(parsed: Dict, fields: List[str]) -> None:
    missing = [field for field in fields if not _safe_text(parsed.get(field))]
    if missing:
        raise ValueError(f"OpenAI returned empty required fields: {', '.join(missing)}")


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
        "kundali": kundali,
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


AREA_KEYWORDS = (
    ("relationships", ("marri", "marry", "relationship", "love", "partner", "spouse", "wife", "husband", "romance", "boyfriend", "girlfriend", "breakup")),
    ("career", ("career", "job", "work", "business", "promotion", "salary", "office", "boss", "profession", "startup")),
    ("finance", ("money", "finance", "wealth", "income", "invest", "debt", "loan", "savings", "property", "stock")),
    ("health", ("health", "energy", "body", "sleep", "illness", "disease", "fitness", "tired", "weight")),
    ("emotional", ("mind", "emotion", "anxiety", "anxious", "sad", "mood", "peace", "stress", "feel", "lonely", "overthink")),
    ("spiritual", ("spiritual", "meditat", "mantra", "purpose", "dharma", "karma", "faith", "god", "puja")),
)
LONG_RANGE = ("marri", "marry", "move", "relocate", "abroad", "settle", "invest", "buy", "change job", "switch", "business", "startup", "when will", "future")


def _focus_domain(question: str) -> str:
    lowered = question.lower()
    for area, words in AREA_KEYWORDS:
        if any(word in lowered for word in words):
            return area
    return "general"


def _pick_scope(question: str, astro_context: Dict) -> tuple:
    lowered = question.lower()
    horoscope = astro_context["horoscope"]
    year = str(astro_context["profile"]["specificYear"])
    if "today" in lowered or "tonight" in lowered or "tomorrow" in lowered:
        return "daily", horoscope["daily"]
    if "week" in lowered:
        return "weekly", horoscope["weekly"]
    if "month" in lowered:
        return "monthly", horoscope["monthly"]
    if "year" in lowered or year in lowered:
        return "specific_year", horoscope["specific_year"]
    if any(word in lowered for word in LONG_RANGE):
        return "yearly", horoscope["yearly"]
    return "monthly", horoscope["monthly"]


def _cap(text: str) -> str:
    text = _safe_text(text)
    return text[:1].upper() + text[1:]


def _krishna(text: str) -> str:
    text = _safe_text(text)
    if not text:
        return ""
    return text if text.lower().startswith("krishna says") else f"Krishna says: {_cap(text)}"


def _strip_voice(text: str) -> str:
    text = _safe_text(text)
    low = text.lower()
    if low.startswith("krishna says:"):
        return text[len("krishna says:"):].strip()
    return text


DOMAIN_WINDOW = {"relationships": (7, ("Venus", "Jupiter")), "career": (10, ("Saturn", "Sun")), "finance": (2, ("Jupiter",)), "health": (1, ()), "emotional": (4, ("Moon",)), "spiritual": (9, ("Jupiter", "Ketu"))}


def _sentences(items) -> str:
    return " ".join(_cap(i).rstrip(".") + "." for i in items if i)


def _fallback_oracle_answer(question: str, astro_context: Dict) -> Dict:
    domain = _focus_domain(question)
    key, scope = _pick_scope(question, astro_context)
    details = scope.get("details") or {}
    why = scope.get("why") or {}
    extra = scope.get("extraScores") or {}
    scores = scope.get("scores") or {}
    signals = (scope.get("signals") or {}).get(domain) or {}
    area_scores = {"relationships": scores.get("love"), "career": scores.get("career"), "finance": scores.get("finance"), "health": scores.get("health"), "emotional": extra.get("emotional"), "spiritual": extra.get("spiritual")}
    label = {"relationships": "relationships", "career": "career", "finance": "money", "health": "health", "emotional": "your emotional life", "spiritual": "your inner life", "general": "life in general"}[domain]
    when = {"daily": "today", "weekly": "this week", "monthly": "this month", "yearly": "this year", "specific_year": f"in {astro_context['profile']['specificYear']}"}[key]

    if domain == "general":
        direct = _krishna(f"{_strip_voice(scope.get('focus') or '')} {_cap(_strip_voice(scope.get('headline') or scope.get('cosmic_message') or ''))}")
        basis_lines = [_strip_voice(scope.get("summary") or "")]
        score = int(sum(v for v in area_scores.values() if v) / max(len([v for v in area_scores.values() if v]), 1))
    else:
        text = details.get(domain) or (scope.get("spiritualNote") if domain == "spiritual" else "") or scope.get("summary") or ""
        direct = _krishna(_strip_voice(text))
        basis_lines = list((scope.get("whyPlain") or {}).get(domain) or why.get(domain) or [])[:3]
        score = int(area_scores.get(domain) or 50)

    chart_basis = _krishna(_sentences(basis_lines) or scope.get("summary") or "")
    help_lines = signals.get("help") if domain != "general" else list(scope.get("opportunities") or [])[:2]
    care_lines = signals.get("care") if domain != "general" else list(scope.get("cautions") or [])[:2]
    said = " ".join(basis_lines + [direct]).lower()
    help_lines = [x for x in (help_lines or []) if x.rstrip(".").lower() not in said]
    care_lines = [x for x in (care_lines or []) if x.rstrip(".").lower() not in said]
    opportunities = _krishna(_sentences(help_lines) or "No single opening dominates here; steady effort is rewarded.")
    cautions = _krishna(_sentences(care_lines) or "No heavy caution stands out here; just avoid overreach.")
    advice = scope.get("adviceParts") or {}
    timing_text = _strip_voice(advice.get("timing") or "")
    windows = []
    if domain in DOMAIN_WINDOW and key in ("monthly", "yearly", "specific_year"):
        from .krishna_says import timing_windows

        house, karakas = DOMAIN_WINDOW[domain]
        try:
            kundali = astro_context["kundali"]
            windows = timing_windows(kundali, house, karakas, datetime.now(ZoneInfo(astro_context["profile"]["timezone"])))
        except Exception:
            windows = []
    best_timing = _krishna(" ".join(filter(None, [(" ".join(["Good periods for this:", _sentences(windows)]) if windows else ""), _cap(timing_text)])))
    remedy = _krishna(_strip_voice((scope.get("areaRemedy") or {}).get(domain) or advice.get("posture") or advice.get("headline") or scope.get("advice") or ""))
    basis_used = [f"Lagna • {astro_context['lagna']}", f"Moon Sign • {astro_context['moonSign']}", f"Nakshatra • {astro_context['nakshatra']}",
                  f"Running period • {scope.get('mahadasha')} / {scope.get('antardasha')}" + (f" / {scope['pratyantar']}" if scope.get("pratyantar") else "")]
    for t in ("Jupiter", "Saturn"):
        row = (astro_context.get("currentTransits") or {}).get(t)
        if row:
            basis_used.append(f"{t} transit • {row['rashi']}, house {row['houseFromMoon']} from Moon")
    confidence = round(max(0.45, min(0.9, 0.5 + (score - 50.0) / 100.0 + (int(scope.get("confidence") or 60) - 60) / 200.0)), 2)
    return {
        "directAnswer": direct,
        "chartBasis": chart_basis,
        "opportunities": opportunities,
        "cautions": cautions,
        "bestTiming": best_timing,
        "remedy": remedy,
        "confidence": confidence,
        "astroBasisUsed": basis_used,
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


def _openai_chat_json(*, system_prompt: str, user_payload: Dict, user_identifier: str, schema_name: str, schema: Dict) -> Dict:
    api_key = _openai_api_key()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured.")
    payload = {
        "model": _oracle_model(),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ],
        "response_format": _response_format_json_schema(schema_name, schema),
        "temperature": 0.45,
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
    try:
        with urlopen(request, timeout=40) as response:
            raw = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise RuntimeError(_http_error_message(error)) from error
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
            "astroContext": _oracle_prompt_context(astro_context),
            "history": _history_digest(history),
        },
        user_identifier=user_identifier,
        schema_name=ORACLE_SCHEMA_NAME,
        schema=ORACLE_SCHEMA,
    )
    _validate_required_text_fields(parsed, ["directAnswer", "chartBasis", "opportunities", "cautions", "bestTiming", "remedy"])
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


VOICE_FIELDS = ("directAnswer", "chartBasis", "opportunities", "cautions", "bestTiming", "remedy")


def _enforce_voice(answer: Dict) -> Dict:
    for field_name in VOICE_FIELDS:
        text = _safe_text(answer.get(field_name))
        if text and not text.lower().startswith("krishna says"):
            answer[field_name] = f"Krishna says: {text}"
    return answer


def ask_oracle(*, question: str, astro_context: Dict, history: Optional[List[Dict]] = None, user_identifier: str = "oracle-user") -> Dict:
    question = _safe_text(question)
    if not question:
        raise ValueError("Question is required.")
    if _openai_api_key():
        try:
            return _enforce_voice(_call_openai(question, astro_context, history, user_identifier))
        except Exception:
            logger.exception("Oracle model call failed; answering from the personalised reading instead")
    return _fallback_oracle_answer(question, astro_context)


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
            "astroContext": _summary_prompt_context(astro_context, scope_key),
            "target": "Create a premium personalized summary for the requested horoscope scope using only this astrology data.",
        },
        user_identifier=user_identifier,
        schema_name=SUMMARY_SCHEMA_NAME,
        schema=SUMMARY_SCHEMA,
    )
    _validate_required_text_fields(parsed, ["headline", "summary", "timingCue", "dominantPlanet"])
    return {
        "headline": _safe_text(parsed.get("headline")),
        "summary": _safe_text(parsed.get("summary")),
        "timingCue": _safe_text(parsed.get("timingCue")),
        "dominantPlanet": _safe_text(parsed.get("dominantPlanet")),
    }


def profile_fingerprint(profile: Dict) -> str:
    raw = json.dumps(profile, sort_keys=True, ensure_ascii=False)
    return sha1(raw.encode("utf-8")).hexdigest()[:16]
