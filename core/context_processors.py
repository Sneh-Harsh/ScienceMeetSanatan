from __future__ import annotations

import json

from django.conf import settings
from django.templatetags.static import static


def _page_type_from_path(path: str) -> str:
    lowered = (path or "").lower()
    if "/library" in lowered:
        return "library"
    if "/quizzes" in lowered or "/quiz" in lowered:
        return "quiz"
    if "/kundali" in lowered:
        return "kundali"
    if "/horoscope" in lowered:
        return "horoscope"
    if "/panchang" in lowered:
        return "panchang"
    return "general"


def donation_context(request):
    upi_id = str(getattr(settings, "DONATION_UPI_ID", "9742024751@ybl") or "9742024751@ybl").strip()
    payee_name = str(getattr(settings, "DONATION_PAYEE_NAME", "Sneh Harsh") or "Sneh Harsh").strip()
    qr_url = str(getattr(settings, "DONATION_QR_URL", "") or "").strip()
    if not qr_url:
        try:
            qr_url = static("images/donation-qr.jpg")
        except ValueError:
            qr_url = ""

    return {
        "donation_upi_id": upi_id,
        "donation_payee_name": payee_name,
        "donation_qr_url": qr_url,
        "donation_is_configured": bool(upi_id and payee_name and qr_url),
        "donation_page_type": _page_type_from_path(getattr(request, "path", "")),
    }


SITE_NAME = "SanatanSeva"
DEFAULT_DESC = (
    "SanatanSeva brings daily Panchang, Kundali, horoscope, a Kindle-style library of aartis, mantras and "
    "scriptures, and trusted pandit booking together in one place."
)

# exact path -> (title, description, index?). Wording follows real Google autocomplete queries from India
# ("aaj ka panchang", "kundali by date of birth", "aarti lyrics in hindi", "rashifal today", ...).
_SEO_PAGES = {
    "/": ("SanatanSeva: Aaj Ka Panchang, Kundali, Rashifal, Aarti Lyrics & Pandit Booking",
          "Aaj ka Panchang, free Kundali by date of birth, daily Rashifal, aarti and chalisa lyrics in Hindi "
          "and English, vrat katha, Gita and Vedas PDFs, and online pandit booking in Patna, Gurugram and Bengaluru.",
          True),
    "/welcome/": ("SanatanSeva: Aaj Ka Panchang, Kundali, Rashifal, Aarti Lyrics & Pandit Booking",
                  "Aaj ka Panchang, free Kundali by date of birth, daily Rashifal, aarti and chalisa lyrics in Hindi "
                  "and English, vrat katha, Gita and Vedas PDFs, and online pandit booking.", True),
    "/panchang/": ("Aaj Ka Panchang (आज का पंचांग): Tithi, Rahu Kaal, Muhurat | SanatanSeva",
                   "आज का पंचांग / Panchang today for your city, Patna, Delhi and more: tithi, nakshatra, yoga, "
                   "karana, sunrise, sunset, Rahu Kaal, Abhijit Muhurat, upcoming festivals, Kharmas and shubh "
                   "vivah muhurat dates.", True),
    "/library/": ("Aarti Lyrics in Hindi, Hanuman Chalisa, Gita & Vedas PDF | SanatanSeva Library",
                  "Read or listen to aarti lyrics in Hindi and English, Hanuman Chalisa, bhajans, mantras, "
                  "Bhagavad Gita, Vedas and Puran PDFs free in a Kindle-style reader. Your place and notes are saved.",
                  True),
    "/horoscope/": ("Aaj Ka Rashifal (आज का राशिफल): Daily Horoscope by Moon Sign | SanatanSeva",
                    "आज का राशिफल: read your daily Vedic horoscope in English for Mesh, Vrishabh, Mithun, Kark, "
                    "Singh, Kanya and every Raashi, based on your Moon sign.", True),
    "/kundali/": ("Free Kundali by Date of Birth: Online Janam Kundali Maker | SanatanSeva",
                  "Make your free Kundali online by date of birth, time and place. Get your lagna chart, "
                  "planets, houses, Raashi and Nakshatra in a clear, interactive janam kundali.", True),
    "/baby-names/": ("Hindu Baby Names: Boy & Girl Names by Deity with Meanings | SanatanSeva",
                     "Find unique Hindu baby boy and girl names inspired by Lord Krishna, Shiva, Ganesha, Rama, "
                     "Durga and Lakshmi, with Sanskrit meanings and the deity behind each name.", True),
    "/quizzes/": ("Dharma Trials: Sanatan Dharma Quiz on Gita, Ramayana & Mahabharat | SanatanSeva",
                  "Test your knowledge of the Gita, Ramayana, Mahabharata, festivals and Hindu traditions with "
                  "fun quizzes and climb the leaderboard.", True),
    "/about/": ("About SanatanSeva | Where Science Meets Sanatan",
                "SanatanSeva is a Bihar-born startup making Sanatan traditions simple, authentic and "
                "accessible with technology.", True),
    "/pandits/": ("Book Pandit Online: Pandit Ji for Puja in Patna, Gurugram & Bengaluru | SanatanSeva",
                  "Book a pandit ji online for Griha Pravesh, Satyanarayan, Rudrabhishek and other pujas in "
                  "Patna, Gurugram and Bengaluru. Tell us your date, charges shared on WhatsApp before you confirm.",
                  True),
    "/astrologers/": ("Chat With Verified Astrologers Online | SanatanSeva",
                      "Talk to verified Vedic astrologers in real time for guidance on career, marriage and "
                      "life decisions.", True),
}

_FAQS = {
    "/panchang/": [
        ("What is Panchang?", "Panchang is the Hindu almanac. It lists the five limbs of the day: tithi, vaar (weekday), nakshatra, yoga and karana, along with sunrise, sunset and auspicious or inauspicious timings."),
        ("What is Rahu Kaal and why do people avoid it?", "Rahu Kaal is a daily period of about 90 minutes considered inauspicious for starting new work. Its time changes with sunrise, so it differs by city and by weekday."),
        ("What is Abhijit Muhurat?", "Abhijit Muhurat is a short, auspicious window around midday that many people use for important tasks when no other muhurat is available."),
        ("Is the Panchang accurate for my city?", "Allow location access or search for your city. Sunrise, tithi and nakshatra timings are calculated from your latitude and longitude, so Patna, Delhi and Bengaluru all show their own times."),
        ("Where can I see upcoming festivals and vivah dates?", "This page lists upcoming festivals, Kharmas dates and shubh vivah muhurat dates for the year."),
    ],
    "/kundali/": [
        ("How do I make a Kundali by date of birth online for free?", "Enter your name, date, exact time and place of birth. The generator calculates the planetary positions and draws your janam kundali instantly."),
        ("Why is the exact birth time important?", "The Lagna (ascendant) changes roughly every two hours, and all twelve houses depend on it. A few minutes' error can shift the chart."),
        ("What is Lagna, Raashi and Nakshatra?", "Lagna is the rising sign at birth, Raashi is the zodiac sign of your Moon, and Nakshatra is the lunar mansion your Moon was in. Together they shape a Vedic chart."),
        ("Is the Kundali generator free?", "Yes. You can generate your Kundali without paying."),
    ],
    "/horoscope/": [
        ("What is Rashifal?", "Rashifal is the daily horoscope for each of the twelve Raashis, based on the position of the Moon and planetary transits."),
        ("How do I find my Raashi?", "Your Raashi is the zodiac sign your Moon was in at birth. Generate your Kundali with your date, time and place of birth to see it."),
        ("Is this horoscope based on Sun sign or Moon sign?", "Vedic rashifal uses the Moon sign, which can differ from the Western Sun sign."),
    ],
    "/baby-names/": [
        ("How do I choose a Hindu baby name?", "Many families pick a name from the starting syllable of the child's Nakshatra, or a name inspired by a deity. Browse names by deity here and check the meaning before you decide."),
        ("Can I find boy and girl names?", "Yes. Switch between boy and girl names and pick a deity to see Sanskrit names with their meanings."),
        ("Do the names come with meanings?", "Each name lists its meaning and the deity it is connected to."),
    ],
}

_FAQS_HI = {
    "/kundali/": [
        ("जन्म तिथि से मुफ़्त कुंडली ऑनलाइन कैसे बनाएँ?", "अपना नाम, तारीख, सही समय और जन्म स्थान भरें। जनरेटर ग्रहों की स्थिति निकालकर तुरंत आपकी जन्म कुंडली बना देता है।"),
        ("जन्म का सही समय क्यों ज़रूरी है?", "लग्न लगभग हर दो घंटे में बदलता है और बारहों भाव उसी पर निर्भर हैं। कुछ मिनट की चूक भी कुंडली बदल सकती है।"),
        ("लग्न, राशि और नक्षत्र क्या हैं?", "लग्न जन्म के समय उदय होती राशि है, राशि वह राशि है जिसमें आपका चंद्रमा था, और नक्षत्र चंद्रमा का नक्षत्र। मिलकर ये वैदिक कुंडली का आधार बनते हैं।"),
        ("क्या कुंडली जनरेटर मुफ़्त है?", "हाँ। बिना भुगतान किए आप अपनी कुंडली बना सकते हैं।"),
    ],
}

_CATEGORY_SEO = {
    "aartis": ("Aarti Lyrics in Hindi & English: Ganesh, Shiv, Hanuman, Durga", "Read aarti lyrics in Hindi and English or listen with audio. Ganesh aarti, Shiv aarti, Hanuman aarti, Durga aarti and more."),
    "bhajans": ("Bhajan Lyrics in Hindi: Krishna, Ram & Hari Bhajans", "Read bhajan lyrics in Hindi and listen online: Krishna, Rama and Vishnu bhajans."),
    "mantras": ("Mantras with Meaning in Hindi & Sanskrit", "Read powerful mantras with lyrics in Hindi and Sanskrit and listen to them online."),
    "chalisas": ("Chalisa Lyrics in Hindi: Hanuman Chalisa, Durga Chalisa", "Read chalisa lyrics in Hindi and listen online, including Hanuman Chalisa and Durga Chalisa."),
    "gita": ("Bhagavad Gita PDF in Hindi & English: Read Online Free", "Read the Bhagavad Gita online free in Hindi and English, including Gita Press and Sadhak Sanjeevani."),
    "vedas": ("Vedas PDF in Hindi: Rigveda, Samveda, Yajurveda, Atharvaveda", "Read the four Vedas online free as PDF: Rigveda, Samveda, Yajurveda and Atharvaveda."),
    "purans": ("Puran PDF in Hindi: Agni, Bhagwat, Bhavishya & Brahma Puran", "Read the Puranas online free as PDF: Agni, Bhagwat, Bhavishya, Brahma and more."),
    "books": ("Hindu Books Online: Ramcharitmanas, Ramayan & Mahabharat", "Read Ramcharitmanas, Ramayan and Mahabharat online free."),
}
_LYRIC_CATEGORIES = {"Aartis", "Bhajans", "Mantras", "Chalisas"}

_NOINDEX_PREFIXES = (
    "/login", "/logout", "/profile", "/wallet", "/admin", "/api", "/oauth", "/reset-password",
    "/pandits/dashboard", "/astrologer-dashboard", "/astrologers/chat", "/library/file", "/library/cover",
)


def _og_key(path: str) -> str:
    for prefix, key in (("/panchang", "panchang"), ("/hi/panchang", "panchang"), ("/library", "library"), ("/aartis", "library"),
                        ("/pandit", "pandit"), ("/kundali", "kundali"), ("/horoscope", "horoscope"),
                        ("/festivals", "festival"), ("/katha", "katha"), ("/gita", "gita"), ("/baby-names", "babynames")):
        if path.startswith(prefix):
            return key
    return "default"


def seo(request):
    from django.conf import settings as dj

    path = getattr(request, "path", "/") or "/"
    root = str(getattr(dj, "SITE_URL", "") or "").rstrip("/")
    if not root:
        proto = request.headers.get("x-forwarded-proto", "").split(",")[0].strip() or request.scheme
        root = f"{proto}://{request.get_host()}"

    title, desc, indexable = _SEO_PAGES.get(path, (f"{SITE_NAME} | Science Meets Sanatan", DEFAULT_DESC, True))
    og_type, jsonld_extra = "website", None
    faq, faq_visible = _FAQS.get(path, []), True

    if path.startswith("/library/collections/"):
        slug = path.rstrip("/").rsplit("/", 1)[-1]
        label = slug.replace("-", " ").title()
        known = _CATEGORY_SEO.get(slug)
        title = f"{known[0] if known else label} | {SITE_NAME}"
        desc = known[1] if known else f"Browse {label} in the SanatanSeva library: read online or listen, free."
    elif path not in _SEO_PAGES and path.startswith(("/library/", "/aartis/")) and not path.startswith(("/library/file", "/library/cover")):
        try:
            from accounts.library_data import get_library_item

            item = get_library_item(path.strip("/").split("/")[-1])
        except Exception:
            item = None
        if item:
            name = item.get("name") or "Library"
            cat = item.get("category") or ""
            deity = str(item.get("deity") or "").strip()
            if cat in _LYRIC_CATEGORIES:
                title = f"{name} Lyrics in Hindi & English | Read & Listen | {SITE_NAME}"
                fallback = f"{name} lyrics in Hindi and English with audio" + (f", dedicated to {deity}" if deity else "") + ". Read or listen online free."
            else:
                title = f"{name} PDF in Hindi: Read Online Free | {SITE_NAME}"
                fallback = f"Read {name} online free" + (f" ({deity})" if deity else "") + " in a Kindle-style reader. Your place, highlights and notes are saved."
            desc = str(item.get("description") or item.get("summary") or "").strip()[:155] or fallback
            og_type = "article"
            path = f"/library/{item['slug']}/"
            if cat in _LYRIC_CATEGORIES:
                jsonld_extra = {"@context": "https://schema.org", "@type": "MusicComposition", "name": name,
                                "inLanguage": "hi", "url": root + path, "isAccessibleForFree": True,
                                "lyrics": {"@type": "CreativeWork", "inLanguage": "hi",
                                           "text": str((item.get("languages") or {}).get("hindi") or "")[:3000]}}
                if item.get("singer"):
                    jsonld_extra["recordedAs"] = {"@type": "MusicRecording", "name": name,
                                                  "byArtist": {"@type": "Person", "name": item["singer"]}}
            else:
                jsonld_extra = {"@context": "https://schema.org", "@type": "Book", "name": name,
                                "inLanguage": "hi", "url": root + path, "isAccessibleForFree": True}
    elif path.startswith(("/pandit-for-", "/pandit-in-")):
        try:
            from pandit import seo_pages

            slug = path.strip("/")
            slug = slug[len("pandit-for-"):] if slug.startswith("pandit-for-") else slug[len("pandit-"):]
            parsed = seo_pages.parse(slug)
            data = seo_pages.landing(*parsed) if parsed else (
                seo_pages.city_landing(slug[3:]) if slug.startswith("in-") and slug[3:] in seo_pages.CITIES else None)
            if data:
                jsonld_extra = {"@context": "https://schema.org", "@type": "Service", "serviceType": data["display"] or "Pandit booking",
                                "name": data["h1"], "description": data["description"],
                                "areaServed": {"@type": "City", "name": data["city"]},
                                "provider": {"@type": "Organization", "name": SITE_NAME, "url": root + "/"},
                                "url": root + path}
                title, desc = data["title"], data["description"]
                faq, faq_visible = data["faqs"], False  # the page already shows its questions
        except Exception:
            pass
    elif path.startswith("/pandits/") and path not in _SEO_PAGES and path != "/pandits/dashboard/":
        title, desc = f"Pandit Profile | {SITE_NAME}", "Pandit profile on SanatanSeva: services, languages and cities."
    elif path.startswith("/astrologers/") and path not in _SEO_PAGES and "/chat/" not in path:
        title, desc = f"Astrologer Profile | {SITE_NAME}", "Verified Vedic astrologer on SanatanSeva."

    breadcrumbs, alternates, event_jsonld = [], [], ""
    try:
        from accounts import seo_data as sd

        parts = [x for x in path.strip("/").split("/") if x]
        home = ("Home", "/")
        if parts[:1] == ["panchang"] and len(parts) == 2 and parts[1] in sd.PANCHANG_CITIES:
            c = sd.PANCHANG_CITIES[parts[1]]
            title = f"Aaj Ka Panchang {c[0]} ({c[1]}): Today Tithi, Rahu Kaal, Nakshatra | {SITE_NAME}"
            desc = f"Today's Panchang for {c[0]}, {c[4]}: tithi, nakshatra, sunrise, sunset, Rahu Kaal and Abhijit Muhurat, calculated for {c[0]}. आज का पंचांग {c[1]}."
            breadcrumbs = [home, ("Panchang", "/panchang/"), (c[0], path)]
            alternates = [("en-IN", path), ("hi-IN", f"/hi/panchang/{parts[1]}/"), ("x-default", path)]
        elif parts[:2] == ["hi", "panchang"] and len(parts) == 3 and parts[2] in sd.PANCHANG_CITIES:
            c = sd.PANCHANG_CITIES[parts[2]]
            title = f"आज का पंचांग {c[1]}: आज की तिथि, राहु काल, नक्षत्र | {SITE_NAME}"
            desc = f"{c[1]} का आज का पंचांग: तिथि, नक्षत्र, सूर्योदय, सूर्यास्त, राहु काल और अभिजीत मुहूर्त। Aaj ka panchang {c[0]}."
            breadcrumbs = [home, ("पंचांग", "/panchang/"), (c[1], path)]
            alternates = [("hi-IN", path), ("en-IN", f"/panchang/{parts[2]}/"), ("x-default", f"/panchang/{parts[2]}/")]
        elif parts == ["festivals"]:
            title = f"Hindu Festival Dates 2026 & 2027: Vrat, Puja & Tithi Calendar | {SITE_NAME}"
            desc = "Dates of Diwali, Holi, Navratri, Chhath, Ekadashi and other Hindu festivals for 2026 and 2027 with tithi, paksha and Hindu month."
            breadcrumbs = [home, ("Festivals", path)]
        elif parts[:1] == ["festivals"] and len(parts) == 2:
            f = sd.festival(parts[1])
            if f:
                from datetime import date as _d

                pretty = _d.fromisoformat(f["date"]).strftime("%-d %B %Y")
                title = f"{f['name']} {f['year']} Date: {pretty} | Tithi & Puja | {SITE_NAME}"
                desc = f"{f['name']} {f['year']} is on {pretty} ({f['paksha']} {f['tithi']}, {f['month']} month). Date, tithi and puja details."
                breadcrumbs = [home, ("Festivals", "/festivals/"), (f"{f['name']} {f['year']}", path)]
                ev = {"@context": "https://schema.org", "@type": "Event", "name": f"{f['name']} {f['year']}",
                      "startDate": f["date"], "endDate": f.get("endDate") or f["date"],
                      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
                      "eventStatus": "https://schema.org/EventScheduled",
                      "location": {"@type": "Place", "name": "India", "address": {"@type": "PostalAddress", "addressCountry": "IN"}},
                      "description": f"{f['name']} {f['year']}: {f['paksha']} {f['tithi']}, {f['month']}.",
                      "organizer": {"@type": "Organization", "name": SITE_NAME, "url": root + "/"}, "url": root + path}
                event_jsonld = json.dumps(ev, ensure_ascii=False).replace("<", "\\u003c")
        elif parts == ["katha"]:
            title = f"Vrat Katha in Hindi: Satyanarayan, Ekadashi, Kartik Purnima | {SITE_NAME}"
            desc = "Read vrat katha in Sanskrit with Hindi translation, free: Satyanarayan Katha, Prabodhini Ekadashi, Bhai Dooj, Kartik Purnima and Vaikuntha Chaturdashi."
            breadcrumbs = [home, ("Vrat Katha", path)]
        elif parts[:1] == ["katha"] and len(parts) == 2 and parts[1] in sd.katha():
            k = sd.katha()[parts[1]]
            title = f"{k['title']['hi']} in Hindi ({k['title']['en']}) | Read Online | {SITE_NAME}"
            desc = f"{k['title']['hi']}: {k['summary']['hi']}"[:158]
            breadcrumbs = [home, ("Vrat Katha", "/katha/"), (k["title"]["en"], path)]
        elif parts == ["gita-shlok"]:
            title = f"Gita Shlok in Hindi with Meaning: Famous Bhagavad Gita Verses | {SITE_NAME}"
            desc = "Famous Bhagavad Gita shlokas in Sanskrit with Hindi and English meaning: karmanyevadhikaraste, yada yada hi dharmasya and more."
            breadcrumbs = [home, ("Gita Shlok", path)]
        elif parts[:1] == ["gita-shlok"] and len(parts) == 2:
            g = next((x for x in sd.GITA if x[0] == parts[1]), None)
            if g:
                title = f"Bhagavad Gita {g[1].replace('Chapter ', 'Chapter ')} Shlok in Hindi with Meaning | {SITE_NAME}"
                desc = f"{g[2].splitlines()[0]} अर्थ: {g[3]}"[:158]
                breadcrumbs = [home, ("Gita Shlok", "/gita-shlok/"), (g[1], path)]
        elif parts[:1] in (["panchang"], ["library"], ["kundali"], ["horoscope"], ["baby-names"], ["quizzes"], ["about"], ["pandits"], ["astrologers"]) and len(parts) == 1:
            breadcrumbs = [home, (_SEO_PAGES[path][0].split(":")[0].split("|")[0].strip()[:40], path)]
        elif path.startswith(("/pandit-for-", "/pandit-in-")):
            breadcrumbs = [home, ("Book a Pandit", "/pandits/"), (title.split("|")[0].strip(), path)]
        elif parts[:2] == ["library", "collections"] and len(parts) == 3:
            breadcrumbs = [home, ("Library", "/library/"), (title.split("|")[0].strip(), path)]
        elif parts[:1] == ["library"] and len(parts) == 2 and parts[1] not in ("file", "cover") and og_type == "article":
            breadcrumbs = [home, ("Library", "/library/"), (title.split("|")[0].strip()[:60], path)]
    except Exception:
        breadcrumbs, alternates, event_jsonld = [], [], ""

    if path.startswith(_NOINDEX_PREFIXES):
        indexable = False

    try:
        from accounts.seo_data import PANCHANG_CITIES

        seo_cities = [(k, v[0], v[1]) for k, v in PANCHANG_CITIES.items()]
    except Exception:
        seo_cities = []

    return {"seo_cities": seo_cities, "seo": {
        "title": title,
        "description": desc,
        "canonical": root + path,
        "url": root + path,
        "root": root,
        "image": root + static(f"images/og/{_og_key(path)}.png"),
        "robots": "index, follow, max-image-preview:large" if indexable else "noindex, nofollow",
        "indexable": indexable,
        "og_type": og_type,
        "site_name": SITE_NAME,
        "breadcrumbs": breadcrumbs,
        "breadcrumb_jsonld": json.dumps({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": label, "item": root + url} for i, (label, url) in enumerate(breadcrumbs)
        ]}, ensure_ascii=False).replace("<", "\\u003c") if breadcrumbs else "",
        "alternates": [(lang, root + url) for lang, url in alternates],
        "event_jsonld": event_jsonld,
        "faq": faq if faq_visible else [],
        "faq_hi": _FAQS_HI.get(path, []) if faq_visible else [],
        "faq_jsonld": json.dumps({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq
        ]}, ensure_ascii=False).replace("<", "\\u003c") if faq else "",
        "jsonld_extra": (json.dumps(jsonld_extra).replace("<", "\\u003c") if jsonld_extra else ""),
    }}
