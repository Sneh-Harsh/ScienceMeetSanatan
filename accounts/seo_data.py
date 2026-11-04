"""Content for the search landing pages: city Panchang, festivals, katha and Gita shlokas."""
from __future__ import annotations

import json
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path

from django.utils.text import slugify

BASE = Path(__file__).resolve().parent.parent

# slug -> (English, Hindi, lat, lon, state)
PANCHANG_CITIES = {
    "delhi": ("Delhi", "दिल्ली", 28.6139, 77.2090, "Delhi"),
    "patna": ("Patna", "पटना", 25.5941, 85.1376, "Bihar"),
    "mumbai": ("Mumbai", "मुंबई", 19.0760, 72.8777, "Maharashtra"),
    "kolkata": ("Kolkata", "कोलकाता", 22.5726, 88.3639, "West Bengal"),
    "bengaluru": ("Bengaluru", "बेंगलुरु", 12.9716, 77.5946, "Karnataka"),
    "hyderabad": ("Hyderabad", "हैदराबाद", 17.3850, 78.4867, "Telangana"),
    "chennai": ("Chennai", "चेन्नई", 13.0827, 80.2707, "Tamil Nadu"),
    "lucknow": ("Lucknow", "लखनऊ", 26.8467, 80.9462, "Uttar Pradesh"),
    "varanasi": ("Varanasi", "वाराणसी", 25.3176, 82.9739, "Uttar Pradesh"),
    "jaipur": ("Jaipur", "जयपुर", 26.9124, 75.7873, "Rajasthan"),
    "ahmedabad": ("Ahmedabad", "अहमदाबाद", 23.0225, 72.5714, "Gujarat"),
    "pune": ("Pune", "पुणे", 18.5204, 73.8567, "Maharashtra"),
    "gurugram": ("Gurugram", "गुरुग्राम", 28.4595, 77.0266, "Haryana"),
    "ranchi": ("Ranchi", "रांची", 23.3441, 85.3096, "Jharkhand"),
    "bhopal": ("Bhopal", "भोपाल", 23.2599, 77.4126, "Madhya Pradesh"),
    "indore": ("Indore", "इंदौर", 22.7196, 75.8577, "Madhya Pradesh"),
    "chandigarh": ("Chandigarh", "चंडीगढ़", 30.7333, 76.7794, "Chandigarh"),
    "ayodhya": ("Ayodhya", "अयोध्या", 26.7922, 82.1998, "Uttar Pradesh"),
    "gaya": ("Gaya", "गया", 24.7914, 85.0002, "Bihar"),
    "muzaffarpur": ("Muzaffarpur", "मुज़फ़्फ़रपुर", 26.1209, 85.3647, "Bihar"),
}

TITHI_HI = {
    "Pratipada": "प्रतिपदा", "Dwitiya": "द्वितीया", "Tritiya": "तृतीया", "Chaturthi": "चतुर्थी",
    "Panchami": "पंचमी", "Shashthi": "षष्ठी", "Saptami": "सप्तमी", "Ashtami": "अष्टमी", "Navami": "नवमी",
    "Dashami": "दशमी", "Ekadashi": "एकादशी", "Dwadashi": "द्वादशी", "Trayodashi": "त्रयोदशी",
    "Chaturdashi": "चतुर्दशी", "Purnima": "पूर्णिमा", "Amavasya": "अमावस्या",
}
NAKSHATRA_HI = {
    "Ashwini": "अश्विनी", "Bharani": "भरणी", "Krittika": "कृत्तिका", "Rohini": "रोहिणी", "Mrigashira": "मृगशिरा",
    "Ardra": "आर्द्रा", "Punarvasu": "पुनर्वसु", "Pushya": "पुष्य", "Ashlesha": "आश्लेषा", "Magha": "मघा",
    "Purva Phalguni": "पूर्वा फाल्गुनी", "Uttara Phalguni": "उत्तरा फाल्गुनी", "Hasta": "हस्त", "Chitra": "चित्रा",
    "Swati": "स्वाति", "Vishakha": "विशाखा", "Anuradha": "अनुराधा", "Jyeshtha": "ज्येष्ठा", "Mula": "मूल",
    "Purva Ashadha": "पूर्वाषाढ़ा", "Uttara Ashadha": "उत्तराषाढ़ा", "Shravana": "श्रवण", "Dhanishta": "धनिष्ठा",
    "Shatabhisha": "शतभिषा", "Purva Bhadrapada": "पूर्वभाद्रपद", "Uttara Bhadrapada": "उत्तरभाद्रपद", "Revati": "रेवती",
}
PAKSHA_HI = {"Shukla Paksha": "शुक्ल पक्ष", "Krishna Paksha": "कृष्ण पक्ष"}
MONTH_HI = {
    "Chaitra": "चैत्र", "Vaishakha": "वैशाख", "Jyeshtha": "ज्येष्ठ", "Ashadha": "आषाढ़", "Shravana": "श्रावण",
    "Bhadrapada": "भाद्रपद", "Ashwin": "आश्विन", "Ashvin": "आश्विन", "Kartik": "कार्तिक", "Margashirsha": "मार्गशीर्ष",
    "Pausha": "पौष", "Magha": "माघ", "Phalguna": "फाल्गुन",
}
WEEKDAY_HI = ["सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"]


def hi(table: dict, key: str) -> str:
    return table.get(key, key)


def _t(iso: str | None) -> str:
    if not iso:
        return "-"
    try:
        return datetime.fromisoformat(iso).strftime("%I:%M %p").lstrip("0")
    except Exception:
        return "-"


def city_panchang(city_key: str, day: date | None = None) -> dict:
    from django.core.cache import cache

    from panchang.calculations import build_panchang

    name, name_hi, lat, lon, state = PANCHANG_CITIES[city_key]
    day = day or datetime.now().date()
    key = f"seo::panchang::{city_key}::{day.isoformat()}"
    data = cache.get(key)
    if data is None:
        data = build_panchang(date=day.isoformat(), lat=lat, lon=lon, tz_name="Asia/Kolkata", at=None)
        cache.set(key, data, 6 * 3600)
    rows = {
        "sunrise": _t(data.get("sunrise")), "sunset": _t(data.get("sunset")),
        "rahu": f"{_t(data.get('rahu_start'))} to {_t(data.get('rahu_end'))}",
        "abhijit": f"{_t(data.get('abhijit_start'))} to {_t(data.get('abhijit_end'))}",
        "tithi_end": _t(data.get("tithi_end")), "nak_end": _t(data.get("nak_end")),
    }
    return {
        "city": name, "city_hi": name_hi, "state": state, "day": day, "weekday": day.strftime("%A"),
        "weekday_hi": WEEKDAY_HI[day.weekday()], "date_long": day.strftime("%-d %B %Y"),
        "tithi": data.get("tithi"), "paksha": data.get("paksha"), "nakshatra": data.get("nakshatra"),
        "month": data.get("month"), "samvat": data.get("vikram_samvat"), "festivals": [f.get("name") if isinstance(f, dict) else f for f in (data.get("festivals_detail") or data.get("festivals") or [])],
        "t": rows, "raw": data,
    }


@lru_cache(maxsize=1)
def festivals() -> list[dict]:
    """One entry per festival per year, de-duplicated (Navratri spans many dates: keep the first)."""
    out, seen = [], set()
    root = BASE / "panchang" / "datasets" / "resolved_core_festivals"
    for fp in sorted(root.glob("*.json")):
        try:
            rows = json.loads(fp.read_text(encoding="utf-8"))
        except Exception:
            continue
        year = fp.stem
        for r in rows:
            name = r.get("name")
            if not name or not r.get("date"):
                continue
            slug = f"{slugify(name)}-{year}"
            if slug in seen:
                continue
            seen.add(slug)
            out.append({**r, "slug": slug, "year": int(year) if year.isdigit() else None})
    return out


def festival(slug: str) -> dict | None:
    return next((f for f in festivals() if f["slug"] == slug), None)


@lru_cache(maxsize=1)
def katha() -> dict:
    data = json.loads((BASE / "pandit" / "static" / "pandit" / "pooja" / "kathas.json").read_text(encoding="utf-8"))
    return {k["id"]: k for k in data["kathas"]}


# (id, reference, sanskrit, hindi meaning, english meaning)
GITA = [
    ("2-47", "Chapter 2, Verse 47",
     "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥",
     "तुम्हारा अधिकार केवल कर्म करने में है, उसके फलों में कभी नहीं। इसलिए तुम कर्म के फल का कारण मत बनो और न ही कर्म न करने में तुम्हारी आसक्ति हो।",
     "You have a right to perform your duty, but never to its fruits. Do not let the fruit of action be your motive, and do not be attached to inaction."),
    ("2-20", "Chapter 2, Verse 20",
     "न जायते म्रियते वा कदाचिन्नायं भूत्वा भविता वा न भूयः।\nअजो नित्यः शाश्वतोऽयं पुराणो न हन्यते हन्यमाने शरीरे॥",
     "यह आत्मा न कभी जन्म लेती है और न मरती है। यह न पहले थी और न फिर होगी, ऐसा भी नहीं है। यह अजन्मा, नित्य, शाश्वत और पुरातन है; शरीर के मारे जाने पर भी यह नहीं मारी जाती।",
     "The soul is never born and never dies. It did not come into being, nor will it ever cease to be. It is unborn, eternal, ever-existing and ancient; it is not slain when the body is slain."),
    ("2-14", "Chapter 2, Verse 14",
     "मात्रास्पर्शास्तु कौन्तेय शीतोष्णसुखदुःखदाः।\nआगमापायिनोऽनित्यास्तांस्तितिक्षस्व भारत॥",
     "हे कुन्तीपुत्र! इन्द्रियों और विषयों के संयोग से सर्दी-गर्मी और सुख-दुःख मिलते हैं। वे आने-जाने वाले और अनित्य हैं, इसलिए हे भारत! उन्हें सहन करो।",
     "O son of Kunti, contact of the senses with their objects gives cold and heat, pleasure and pain. They come and go and are impermanent; bear them patiently, O Bharata."),
    ("4-7", "Chapter 4, Verse 7",
     "यदा यदा हि धर्मस्य ग्लानिर्भवति भारत।\nअभ्युत्थानमधर्मस्य तदात्मानं सृजाम्यहम्॥",
     "हे भारत! जब-जब धर्म की हानि और अधर्म की वृद्धि होती है, तब-तब मैं अपने रूप को प्रकट करता हूँ।",
     "Whenever righteousness declines and unrighteousness rises, O Bharata, I manifest myself."),
    ("4-8", "Chapter 4, Verse 8",
     "परित्राणाय साधूनां विनाशाय च दुष्कृताम्।\nधर्मसंस्थापनार्थाय सम्भवामि युगे युगे॥",
     "साधुओं की रक्षा, दुष्टों के विनाश और धर्म की स्थापना के लिए मैं युग-युग में प्रकट होता हूँ।",
     "To protect the good, to destroy the wicked and to re-establish dharma, I appear age after age."),
    ("3-35", "Chapter 3, Verse 35",
     "श्रेयान्स्वधर्मो विगुणः परधर्मात्स्वनुष्ठितात्।\nस्वधर्मे निधनं श्रेयः परधर्मो भयावहः॥",
     "अच्छी तरह आचरण किए गए दूसरे के धर्म से गुणरहित अपना धर्म श्रेष्ठ है। अपने धर्म में मरना भी कल्याणकारी है, दूसरे का धर्म भय देने वाला है।",
     "One's own duty, even if imperfect, is better than another's duty well performed. Death in one's own duty is better; another's duty brings fear."),
    ("6-5", "Chapter 6, Verse 5",
     "उद्धरेदात्मनात्मानं नात्मानमवसादयेत्।\nआत्मैव ह्यात्मनो बन्धुरात्मैव रिपुरात्मनः॥",
     "मनुष्य को चाहिए कि अपने द्वारा अपना उद्धार करे, अपना पतन न करे; क्योंकि आप ही अपना मित्र है और आप ही अपना शत्रु।",
     "Lift yourself by your own mind and do not let yourself sink; for the mind alone is one's friend, and the mind alone is one's enemy."),
    ("18-66", "Chapter 18, Verse 66",
     "सर्वधर्मान्परित्यज्य मामेकं शरणं व्रज।\nअहं त्वां सर्वपापेभ्यो मोक्षयिष्यामि मा शुचः॥",
     "सब धर्मों को छोड़कर तू केवल मेरी शरण में आ जा। मैं तुझे सब पापों से मुक्त कर दूँगा, तू शोक मत कर।",
     "Abandon all varieties of duty and take refuge in Me alone. I will free you from all sins; do not grieve."),
    ("9-22", "Chapter 9, Verse 22",
     "अनन्याश्चिन्तयन्तो मां ये जनाः पर्युपासते।\nतेषां नित्याभियुक्तानां योगक्षेमं वहाम्यहम्॥",
     "जो लोग अनन्य भाव से मेरा चिन्तन करते हुए मेरी उपासना करते हैं, उन नित्य मुझमें लगे हुए भक्तों का योगक्षेम मैं स्वयं वहन करता हूँ।",
     "To those who worship Me with undivided devotion, ever steadfast, I carry what they lack and preserve what they have."),
    ("2-62", "Chapter 2, Verse 62",
     "ध्यायतो विषयान्पुंसः सङ्गस्तेषूपजायते।\nसङ्गात्सञ्जायते कामः कामात्क्रोधोऽभिजायते॥",
     "विषयों का चिन्तन करने वाले पुरुष की उनमें आसक्ति हो जाती है, आसक्ति से कामना और कामना से क्रोध उत्पन्न होता है।",
     "Dwelling on sense objects, a person develops attachment to them; from attachment springs desire, and from desire anger arises."),
]
