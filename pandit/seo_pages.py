"""Search landing pages: "pandit for <puja> in <city>" and "pandit in <city>".

Wording follows what people actually type into Google ("pandit for griha pravesh in Patna", "online pandit
booking in Patna", "pandit ji for puja"). Each puja has its own copy so the pages are not near-duplicates.
No prices are quoted: the site confirms complete charges on WhatsApp before a booking.
"""

CITIES = {
    "patna": {"name": "Patna", "state": "Bihar", "areas": "Boring Road, Kankarbagh, Rajendra Nagar, Patliputra, Danapur, Bailey Road and nearby areas"},
    "gurugram": {"name": "Gurugram", "state": "Haryana", "areas": "DLF Phases, Sohna Road, Golf Course Road, Sushant Lok, Palam Vihar and nearby sectors"},
    "bengaluru": {"name": "Bengaluru", "state": "Karnataka", "areas": "Whitefield, Koramangala, HSR Layout, Indiranagar, Electronic City, Marathahalli and nearby areas"},
}

# slug -> (booking-form name, display title, search phrase, what it is, when/why, what we help with)
PUJAS = {
    "griha-pravesh": (
        "Griha Pravesh Puja", "Griha Pravesh Puja", "griha pravesh",
        "Griha Pravesh is the housewarming ceremony performed before a family begins living in a new home, to invite positive energy and the blessings of Lord Ganesha, the Navagrahas and Vastu Purusha.",
        "It is done on an auspicious date and muhurat, usually with Ganesh puja, Kalash sthapana, Navagraha puja, havan and the traditional entry with milk boiled in the new kitchen.",
        "shubh muhurat for your date, a pandit who knows the full vidhi, and a samagri list so nothing is missed",
    ),
    "satyanarayan": (
        "Satyanarayan Puja", "Satyanarayan Puja", "satyanarayan puja",
        "Satyanarayan Puja is the worship of Lord Vishnu as Satyanarayan, performed with the Satyanarayan Katha for prosperity, gratitude and family well-being.",
        "Families commonly hold it on Purnima, after a wedding, a new job or a new home, and on any day they wish to give thanks. The katha has five adhyays.",
        "a pandit for the puja and katha, the puja samagri list and a convenient time for your family",
    ),
    "rudrabhishek": (
        "Rudrabhishek", "Rudrabhishek Puja", "rudrabhishek",
        "Rudrabhishek is the ritual bathing of the Shiva Linga with milk, water, honey and other offerings while the Rudram is chanted, to seek the blessings of Lord Shiva.",
        "It is popular on Mondays, Pradosh, Mahashivratri and during Shravan, and for peace, health and relief from planetary obstacles.",
        "a pandit trained in Rudri path, a suitable day and a clear samagri list",
    ),
    "ganesh": (
        "Ganesh Puja", "Ganesh Puja", "ganesh puja",
        "Ganesh Puja honours Lord Ganesha, the remover of obstacles, and is performed before any new beginning.",
        "It is done before weddings, business launches and housewarmings, on Ganesh Chaturthi and on Sankashti Chaturthi.",
        "a pandit for the vidhi, the right date and the samagri you will need",
    ),
    "lakshmi": (
        "Lakshmi Puja", "Lakshmi Puja", "lakshmi puja",
        "Lakshmi Puja is the worship of Goddess Lakshmi for wealth, prosperity and a happy home. Many families and shops also perform it for a new business or financial year.",
        "It is most widely performed on Diwali evening, and also on Fridays and Sharad Purnima.",
        "a pandit for the pradosh-kaal muhurat on Diwali, plus samagri and vidhi guidance",
    ),
    "navagraha": (
        "Navagraha Shanti", "Navagraha Shanti Puja", "navagraha shanti puja",
        "Navagraha Shanti is the worship of the nine planets to reduce the troublesome effects shown in a Kundali and to invite balance and calm.",
        "It is often advised during a difficult dasha or transit, before important life events, or as part of other ceremonies.",
        "a pandit who can follow your Kundali's recommendation, a suitable date and the samagri list",
    ),
    "vastu-shanti": (
        "Vastu Shanti", "Vastu Shanti Puja", "vastu shanti puja",
        "Vastu Shanti is performed to remove Vastu doshas and to harmonise the energies of a home, shop or office.",
        "It is done before moving in, after construction or renovation, or when a space feels unsettled.",
        "a pandit for the vidhi and havan, the right muhurat and the samagri list",
    ),
    "bhoomi-pujan": (
        "Bhoomi Puja", "Bhoomi Pujan", "bhoomi pujan",
        "Bhoomi Pujan is the ground-breaking ceremony before construction, seeking the blessings of Mother Earth and the deities of the directions.",
        "It is done on an auspicious date before the foundation is dug, for a house, shop or factory.",
        "a pandit for the vidhi, an auspicious date and the samagri you need",
    ),
}


def parse(slug: str):
    """'griha-pravesh-in-patna' -> (puja_key, city_key) or None."""
    if "-in-" not in slug:
        return None
    puja, city = slug.rsplit("-in-", 1)
    return (puja, city) if puja in PUJAS and city in CITIES else None


def all_slugs():
    return [f"{p}-in-{c}" for p in PUJAS for c in CITIES]


def landing(puja_key: str, city_key: str) -> dict:
    form_name, display, phrase, what, when, help_ = PUJAS[puja_key]
    city = CITIES[city_key]
    cn = city["name"]
    faqs = [
        (f"How do I book a pandit for {phrase} in {cn}?",
         f"Fill the short request form on this page with your puja, date and area in {cn}. We coordinate a suitable pandit, check availability for your date and share the complete charges on WhatsApp before you confirm."),
        (f"Which areas of {cn} do you cover?",
         f"We help families in {city['areas']}. If your locality is not listed, send your request anyway and we will confirm."),
        (f"What is {display}?", what),
        (f"When is {display} usually performed?", when),
        ("Will I know the charges before booking?",
         "Yes. The complete charges are shared on WhatsApp before you confirm, so there are no surprises."),
    ]
    return {
        "puja_key": puja_key, "city_key": city_key, "puja": form_name, "display": display, "city": cn,
        "title": f"Pandit for {display} in {cn} | Book Pandit Ji Online | SanatanSeva",
        "description": f"Book a pandit for {phrase} in {cn}, {city['state']}. Tell us your date and area, we coordinate a suitable pandit ji and share the complete charges on WhatsApp before you confirm.",
        "h1": f"Pandit for {display} in {cn}",
        "intro": f"{what} SanatanSeva helps you find a suitable pandit ji in {cn} with {help_}.",
        "faqs": faqs,
    }


def city_landing(city_key: str) -> dict:
    city = CITIES[city_key]
    cn = city["name"]
    faqs = [
        (f"How can I book a pandit in {cn} online?",
         f"Send a request with your puja, date and area. We coordinate a suitable pandit ji in {cn}, check availability and share the complete charges on WhatsApp before you confirm."),
        (f"Which pujas can a pandit do in {cn}?",
         "Griha Pravesh, Satyanarayan, Rudrabhishek, Ganesh and Lakshmi puja, Navagraha and Vastu Shanti, Bhoomi Pujan, havan, naamkaran, mundan and vivah ceremonies."),
        (f"Which areas of {cn} are covered?", f"{city['areas']}."),
    ]
    return {
        "puja_key": "", "city_key": city_key, "puja": "", "display": "", "city": cn,
        "title": f"Pandit in {cn} | Book Pandit Ji for Puja Online | SanatanSeva",
        "description": f"Book a pandit ji in {cn} for puja, havan and sanskar. Griha Pravesh, Satyanarayan, Rudrabhishek and more: tell us your date and area, charges shared on WhatsApp before you confirm.",
        "h1": f"Book a Pandit in {cn}",
        "intro": f"Looking for a pandit ji in {cn}? Tell us about your puja and we coordinate a suitable pandit, check availability and share the complete charges before you confirm.",
        "faqs": faqs,
    }
