"""Plain-language reading (English and Hindi) built on top of the chart the engine has already calculated.

Nothing here recalculates a chart: every sentence is chosen from facts the engine returned (which sign is rising, which
planet sits in which house, how strong it is, which dasha is running, which doshas were detected). Sub-periods
(Antardashas) are described by the *pairing* of the main planet and the sub planet, their houses, their friendship,
the stage inside the chapter and the age range, so no two of them read the same.

Wording follows what traditional Vedic readings say, in everyday language instead of house numbers."""
from __future__ import annotations

import re
from datetime import datetime
from typing import Dict, List, Optional

from .dasha_engine import _antardashas

LANGS = ("en", "hi")

# ----------------------------------------------------------------------------- names
SIGNS = ["Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya", "Tula", "Vrischika", "Dhanu", "Makara", "Kumbha", "Meena"]
SIGN_EN = dict(zip(SIGNS, ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]))
SIGN_HI = dict(zip(SIGNS, ["मेष", "वृषभ", "मिथुन", "कर्क", "सिंह", "कन्या", "तुला", "वृश्चिक", "धनु", "मकर", "कुंभ", "मीन"]))
PLANET_HI = {"Sun": "सूर्य", "Moon": "चंद्र", "Mars": "मंगल", "Mercury": "बुध", "Jupiter": "गुरु", "Venus": "शुक्र", "Saturn": "शनि", "Rahu": "राहु", "Ketu": "केतु"}
NAK_HI = {
    "Ashwini": "अश्विनी", "Bharani": "भरणी", "Krittika": "कृत्तिका", "Rohini": "रोहिणी", "Mrigashira": "मृगशिरा", "Ardra": "आर्द्रा",
    "Punarvasu": "पुनर्वसु", "Pushya": "पुष्य", "Ashlesha": "आश्लेषा", "Magha": "मघा", "Purva Phalguni": "पूर्वा फाल्गुनी",
    "Uttara Phalguni": "उत्तरा फाल्गुनी", "Hasta": "हस्त", "Chitra": "चित्रा", "Swati": "स्वाति", "Vishakha": "विशाखा", "Anuradha": "अनुराधा",
    "Jyeshtha": "ज्येष्ठा", "Mula": "मूल", "Purva Ashadha": "पूर्वाषाढ़ा", "Uttara Ashadha": "उत्तराषाढ़ा", "Shravana": "श्रवण",
    "Dhanishta": "धनिष्ठा", "Shatabhisha": "शतभिषा", "Purva Bhadrapada": "पूर्वभाद्रपद", "Uttara Bhadrapada": "उत्तरभाद्रपद", "Revati": "रेवती",
}
MONTH_HI = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"]
MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
ORD_F_HI = {1: "पहली", 2: "दूसरी", 3: "तीसरी", 4: "चौथी", 5: "पाँचवीं", 6: "छठी", 7: "सातवीं", 8: "आठवीं", 9: "नौवीं"}
ORD_HI = {1: "पहला", 2: "दूसरा", 3: "तीसरा", 4: "चौथा", 5: "पाँचवाँ", 6: "छठा", 7: "सातवाँ", 8: "आठवाँ", 9: "नौवाँ", 10: "दसवाँ", 11: "ग्यारहवाँ", 12: "बारहवाँ"}


def sname(sign: str, lang: str) -> str:
    if lang == "hi":
        return SIGN_HI.get(sign, sign)
    return f"{sign} ({SIGN_EN[sign]})" if sign in SIGN_EN else str(sign)


def pname(planet: str, lang: str) -> str:
    return PLANET_HI.get(planet, planet) if lang == "hi" else planet


def ordinal(n: int, lang: str) -> str:
    if lang == "hi":
        return ORD_HI.get(n, str(n))
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def month_year(iso, lang: str) -> str:
    d = _dt(iso)
    if not d:
        return "-"
    return f"{MONTH_HI[d.month - 1] if lang == 'hi' else MONTH_EN[d.month - 1]} {d.year}"


# ----------------------------------------------------------------------------- content tables
# sign -> (how the person comes across, strengths, watch-outs)
SIGN_TRAITS = {
    "en": {
        "Mesha": ("bold, energetic and quick to act", ["courage", "leadership", "a fresh start attitude"], ["impatience", "a short temper"]),
        "Vrishabha": ("calm, loyal and steady", ["patience", "practical thinking", "taste for comfort"], ["stubbornness", "resisting change"]),
        "Mithuna": ("curious, witty and good with words", ["quick learning", "communication", "adaptability"], ["restlessness", "overthinking"]),
        "Karka": ("caring, emotional and protective", ["empathy", "loyalty to family", "strong intuition"], ["mood swings", "holding on to hurt"]),
        "Simha": ("confident, warm and proud", ["leadership", "generosity", "natural charisma"], ["ego", "needing constant appreciation"]),
        "Kanya": ("careful, practical and detail-minded", ["analysis", "service attitude", "discipline"], ["over-criticism", "worrying too much"]),
        "Tula": ("charming, fair-minded and peace-loving", ["diplomacy", "good taste", "a sense of balance"], ["indecision", "avoiding hard conversations"]),
        "Vrischika": ("intense, private and determined", ["deep focus", "willpower", "research ability"], ["jealousy", "holding grudges"]),
        "Dhanu": ("optimistic, free-spirited and honest", ["wisdom", "love of learning and travel", "faith"], ["blunt speech", "taking on too much"]),
        "Makara": ("disciplined, ambitious and responsible", ["hard work", "patience", "long-term planning"], ["being too serious", "slow to relax"]),
        "Kumbha": ("original, friendly and independent", ["fresh ideas", "humanitarian thinking", "loyalty to friends"], ["emotional distance", "stubborn opinions"]),
        "Meena": ("gentle, imaginative and spiritual", ["compassion", "creativity", "intuition"], ["escapism", "being too trusting"]),
    },
    "hi": {
        "Mesha": ("साहसी, ऊर्जावान और तुरंत कदम उठाने वाले", ["साहस", "नेतृत्व", "नई शुरुआत की हिम्मत"], ["अधीरता", "गुस्सा"]),
        "Vrishabha": ("शांत, भरोसेमंद और स्थिर", ["धैर्य", "व्यावहारिक सोच", "आराम और सुंदरता की पहचान"], ["ज़िद", "बदलाव से बचना"]),
        "Mithuna": ("जिज्ञासु, हाज़िरजवाब और बातचीत में कुशल", ["जल्दी सीखना", "संवाद", "तालमेल बिठाना"], ["बेचैनी", "ज़्यादा सोचना"]),
        "Karka": ("देखभाल करने वाले, भावुक और रक्षक स्वभाव के", ["संवेदना", "परिवार से लगाव", "तेज़ अंतर्ज्ञान"], ["मूड का उतार-चढ़ाव", "पुरानी बातें मन में रखना"]),
        "Simha": ("आत्मविश्वासी, उदार और स्वाभिमानी", ["नेतृत्व", "उदारता", "स्वाभाविक आकर्षण"], ["अहंकार", "हर समय सराहना की चाह"]),
        "Kanya": ("सावधान, व्यावहारिक और बारीकियों पर ध्यान देने वाले", ["विश्लेषण", "सेवा भाव", "अनुशासन"], ["ज़रूरत से ज़्यादा आलोचना", "चिंता"]),
        "Tula": ("आकर्षक, न्यायप्रिय और शांति पसंद", ["कूटनीति", "अच्छी पसंद", "संतुलन की समझ"], ["फैसले में देरी", "कठिन बातचीत से बचना"]),
        "Vrischika": ("गहरे, रहस्यमय और दृढ़ निश्चयी", ["गहरा ध्यान", "इच्छाशक्ति", "शोध क्षमता"], ["ईर्ष्या", "पुरानी शिकायतें पालना"]),
        "Dhanu": ("आशावादी, स्वतंत्र और स्पष्टवादी", ["ज्ञान", "सीखने और यात्रा का शौक", "आस्था"], ["कड़वी सच्चाई बोल देना", "ज़्यादा काम ओढ़ लेना"]),
        "Makara": ("अनुशासित, महत्वाकांक्षी और ज़िम्मेदार", ["कड़ी मेहनत", "धैर्य", "लंबी योजना"], ["ज़रूरत से ज़्यादा गंभीर होना", "आराम न कर पाना"]),
        "Kumbha": ("मौलिक, मिलनसार और स्वतंत्र विचारों वाले", ["नए विचार", "मानवता की सोच", "दोस्तों के प्रति वफ़ादारी"], ["भावनात्मक दूरी", "अपनी राय पर अड़े रहना"]),
        "Meena": ("कोमल, कल्पनाशील और आध्यात्मिक", ["करुणा", "रचनात्मकता", "अंतर्ज्ञान"], ["हकीकत से भागना", "ज़्यादा भरोसा कर लेना"]),
    },
}

MOON_MIND = {
    "en": {
        "Mesha": "reacts fast and feels things strongly, then moves on", "Vrishabha": "needs security and comfort to feel calm",
        "Mithuna": "is always thinking, talking and learning", "Karka": "feels deeply and is closely tied to family and home",
        "Simha": "needs respect and warmth to feel happy", "Kanya": "stays alert and likes things in order",
        "Tula": "seeks harmony and dislikes conflict", "Vrischika": "feels very deeply but shows little",
        "Dhanu": "stays hopeful and looks for meaning", "Makara": "stays serious and responsible, even in tough times",
        "Kumbha": "likes freedom and thinks differently from the crowd", "Meena": "is sensitive, dreamy and very intuitive",
    },
    "hi": {
        "Mesha": "तुरंत प्रतिक्रिया देता है और तीव्रता से महसूस करता है, फिर आगे बढ़ जाता है", "Vrishabha": "शांत रहने के लिए सुरक्षा और आराम चाहता है",
        "Mithuna": "हमेशा सोचता, बोलता और सीखता रहता है", "Karka": "गहराई से महसूस करता है और परिवार व घर से जुड़ा रहता है",
        "Simha": "खुश रहने के लिए सम्मान और अपनापन चाहता है", "Kanya": "सतर्क रहता है और हर चीज़ व्यवस्थित पसंद करता है",
        "Tula": "सामंजस्य चाहता है और टकराव से बचता है", "Vrischika": "बहुत गहराई से महसूस करता है पर कम दिखाता है",
        "Dhanu": "आशावान रहता है और जीवन का अर्थ खोजता है", "Makara": "कठिन समय में भी गंभीर और ज़िम्मेदार बना रहता है",
        "Kumbha": "आज़ादी पसंद करता है और भीड़ से हटकर सोचता है", "Meena": "संवेदनशील, स्वप्निल और बहुत सहज-बोध वाला है",
    },
}

NAKSHATRA_TRAIT = {
    "en": {
        "Ashwini": "quick, energetic and a natural healer", "Bharani": "strong-willed and able to carry heavy responsibility",
        "Krittika": "sharp, honest and straightforward", "Rohini": "attractive, creative and fond of beauty and comfort",
        "Mrigashira": "curious and always searching", "Ardra": "intense, intelligent and able to rebuild after storms",
        "Punarvasu": "forgiving, optimistic and good at starting over", "Pushya": "caring, wise and nourishing to others",
        "Ashlesha": "perceptive, deep and strategic", "Magha": "dignified and proud of family and heritage",
        "Purva Phalguni": "warm, fun-loving and creative", "Uttara Phalguni": "helpful, reliable and generous",
        "Hasta": "skilled with the hands and clever", "Chitra": "creative with an eye for design",
        "Swati": "independent and flexible, good in business", "Vishakha": "determined and goal-driven",
        "Anuradha": "devoted, friendly and good at cooperation", "Jyeshtha": "protective, capable and a natural senior in a group",
        "Mula": "truth-seeking and willing to dig to the root of things", "Purva Ashadha": "confident and persuasive",
        "Uttara Ashadha": "principled and steady in the long run", "Shravana": "a good listener and a keen learner",
        "Dhanishta": "rhythmic, ambitious and resourceful", "Shatabhisha": "private, independent and healing-minded",
        "Purva Bhadrapada": "intense, idealistic and unconventional", "Uttara Bhadrapada": "calm, deep and compassionate",
        "Revati": "kind, protective and gentle with others",
    },
    "hi": {
        "Ashwini": "तेज़, ऊर्जावान और स्वाभाविक उपचारक", "Bharani": "दृढ़ इच्छाशक्ति वाला और भारी ज़िम्मेदारी उठाने में सक्षम",
        "Krittika": "तेज़, ईमानदार और सीधा", "Rohini": "आकर्षक, रचनात्मक और सुंदरता व सुख-सुविधा पसंद करने वाला",
        "Mrigashira": "जिज्ञासु और हमेशा खोज में रहने वाला", "Ardra": "तीव्र, बुद्धिमान और तूफ़ानों के बाद फिर से खड़ा होने वाला",
        "Punarvasu": "क्षमाशील, आशावादी और दोबारा शुरुआत करने में माहिर", "Pushya": "देखभाल करने वाला, समझदार और दूसरों का पोषण करने वाला",
        "Ashlesha": "सूक्ष्म दृष्टि वाला, गहरा और रणनीतिक", "Magha": "गरिमामय और अपने कुल व परंपरा पर गर्व करने वाला",
        "Purva Phalguni": "गर्मजोशी वाला, हँसमुख और रचनात्मक", "Uttara Phalguni": "मददगार, भरोसेमंद और उदार",
        "Hasta": "हाथों का कुशल और चतुर", "Chitra": "रचनात्मक और डिज़ाइन की अच्छी समझ वाला",
        "Swati": "स्वतंत्र और लचीला, व्यापार में कुशल", "Vishakha": "दृढ़ संकल्प वाला और लक्ष्य पर केंद्रित",
        "Anuradha": "निष्ठावान, मिलनसार और सहयोग में अच्छा", "Jyeshtha": "रक्षक स्वभाव का, सक्षम और समूह में स्वाभाविक बड़ा",
        "Mula": "सच की खोज करने वाला, जो हर बात की जड़ तक जाता है", "Purva Ashadha": "आत्मविश्वासी और प्रभावशाली",
        "Uttara Ashadha": "सिद्धांतवादी और लंबे समय में स्थिर", "Shravana": "अच्छा श्रोता और जिज्ञासु विद्यार्थी",
        "Dhanishta": "लयबद्ध, महत्वाकांक्षी और साधन-संपन्न", "Shatabhisha": "निजी, स्वतंत्र और उपचार की सोच वाला",
        "Purva Bhadrapada": "तीव्र, आदर्शवादी और अलग राह चुनने वाला", "Uttara Bhadrapada": "शांत, गहरा और करुणामय",
        "Revati": "दयालु, संरक्षक और दूसरों के प्रति कोमल",
    },
}

BENEFICS = {"Jupiter", "Venus", "Mercury", "Moon"}
PLANET_MEANS = {
    "en": {"Sun": "confidence, status and authority", "Moon": "mind, mood and emotional comfort", "Mars": "energy, courage and drive",
           "Mercury": "intelligence, speech and business sense", "Jupiter": "wisdom, luck and guidance", "Venus": "love, comfort and the good things in life",
           "Saturn": "discipline, hard work and patience", "Rahu": "ambition, hunger for more and sudden turns", "Ketu": "detachment, intuition and letting go"},
    "hi": {"Sun": "आत्मविश्वास, प्रतिष्ठा और अधिकार", "Moon": "मन, मनोदशा और भावनात्मक सुकून", "Mars": "ऊर्जा, साहस और जोश",
           "Mercury": "बुद्धि, वाणी और व्यापारिक समझ", "Jupiter": "ज्ञान, भाग्य और मार्गदर्शन", "Venus": "प्रेम, सुख-सुविधा और जीवन की अच्छी चीज़ें",
           "Saturn": "अनुशासन, मेहनत और धैर्य", "Rahu": "महत्वाकांक्षा, और-और पाने की भूख व अचानक मोड़", "Ketu": "वैराग्य, अंतर्ज्ञान और छोड़ देना"},
}
PLANET_KEY = {  # a short theme for each planet, used in the sub-period headline
    "en": {"Sun": "identity and authority", "Moon": "mind and home", "Mars": "drive and action", "Mercury": "skill and trade", "Jupiter": "wisdom and growth",
           "Venus": "love and comfort", "Saturn": "discipline and effort", "Rahu": "ambition and change", "Ketu": "detachment and inner life"},
    "hi": {"Sun": "पहचान और अधिकार", "Moon": "मन और घर", "Mars": "साहस और कर्म", "Mercury": "बुद्धि और व्यापार", "Jupiter": "ज्ञान और विस्तार",
           "Venus": "प्रेम और सुख", "Saturn": "मेहनत और अनुशासन", "Rahu": "महत्वाकांक्षा और बदलाव", "Ketu": "वैराग्य और अंतर्मन"},
}
# planet in a house: (a phrase when it helps, a phrase when it presses); the sentence adds "here" / "यहाँ" itself where needed
PLANET_ROLE = {
    "en": {
        "Sun": ("gives confidence and respect in this area", "can bring ego clashes or pressure from authority here"),
        "Moon": ("brings emotional support and popularity here", "makes you more sensitive and moody about this area"),
        "Mars": ("adds courage and energy here", "can bring haste, arguments or heat in this area"),
        "Mercury": ("brings smart thinking and good communication here", "can bring overthinking and scattered focus here"),
        "Jupiter": ("brings luck, wisdom and protection here", "can make you take things too easy or over-promise here"),
        "Venus": ("brings harmony, charm and comfort here", "can bring indulgence or attachment issues here"),
        "Saturn": ("brings slow but lasting results and discipline here", "can bring delays and extra responsibility here"),
        "Rahu": ("brings big ambition and unusual chances here", "can bring confusion, restlessness and hunger for more here"),
        "Ketu": ("brings a detached, spiritual view here", "can bring a feeling of distance or something missing here"),
    },
    "hi": {
        "Sun": ("आत्मविश्वास और सम्मान देता है", "अहंकार के टकराव या अधिकारियों का दबाव ला सकता है"),
        "Moon": ("भावनात्मक सहारा और लोकप्रियता देता है", "इस क्षेत्र में आपको अधिक संवेदनशील और मूडी बना सकता है"),
        "Mars": ("साहस और ऊर्जा बढ़ाता है", "जल्दबाज़ी, बहस या गर्मी ला सकता है"),
        "Mercury": ("तेज़ सोच और अच्छा संवाद देता है", "ज़्यादा सोचने और ध्यान बिखरने का कारण बन सकता है"),
        "Jupiter": ("भाग्य, ज्ञान और सुरक्षा देता है", "ज़रूरत से ज़्यादा आराम से लेने या ज़्यादा वादे करने की ओर ले जा सकता है"),
        "Venus": ("सामंजस्य, आकर्षण और सुख देता है", "भोग-विलास या लगाव की उलझन ला सकता है"),
        "Saturn": ("धीमे पर टिकाऊ परिणाम और अनुशासन देता है", "देरी और अतिरिक्त ज़िम्मेदारी ला सकता है"),
        "Rahu": ("बड़ी महत्वाकांक्षा और अनोखे अवसर देता है", "उलझन, बेचैनी और और-और पाने की भूख ला सकता है"),
        "Ketu": ("अलगाव का आध्यात्मिक नज़रिया देता है", "दूरी या कुछ कमी का एहसास ला सकता है"),
    },
}
DASHA_FEEL = {
    "en": {
        "Sun": "a period about recognition, responsibility and finding your own direction. Dealings with seniors, government and father figures matter more.",
        "Moon": "a period about emotions, home, mother and peace of mind. Mood swings are possible, and so is real emotional growth.",
        "Mars": "a period of energy, action and ambition. Good for bold moves, property and competition; watch your temper and haste.",
        "Mercury": "a period of learning, communication, business and skills. Good for studies, trade and networking.",
        "Jupiter": "a generally lucky and growing period: wisdom, teachers, children, money and good advice come forward.",
        "Venus": "a period of love, comfort, creativity and material growth. Relationships, vehicles, art and a better lifestyle come into focus.",
        "Saturn": "a period that tests you with hard work and responsibility, and rewards patience. Results come slowly but they last.",
        "Rahu": "a period of big ambition, change and unusual opportunities. Foreign links and technology can help; avoid shortcuts and confusion.",
        "Ketu": "a period of detachment and inner search. Old things fall away, and spiritual interest or a need for solitude may grow.",
    },
    "hi": {
        "Sun": "पहचान, ज़िम्मेदारी और अपनी दिशा खोजने का दौर है। वरिष्ठों, सरकार और पिता तुल्य लोगों से जुड़ी बातें ज़्यादा मायने रखती हैं।",
        "Moon": "भावनाओं, घर, माँ और मन की शांति का दौर है। मूड में उतार-चढ़ाव संभव हैं, और सच्चा भावनात्मक विकास भी।",
        "Mars": "ऊर्जा, कर्म और महत्वाकांक्षा का दौर है। साहसिक कदम, संपत्ति और प्रतिस्पर्धा के लिए अच्छा; गुस्से और जल्दबाज़ी से बचें।",
        "Mercury": "सीखने, संवाद, व्यापार और कौशल का दौर है। पढ़ाई, व्यापार और नेटवर्किंग के लिए अच्छा।",
        "Jupiter": "आम तौर पर भाग्यशाली और बढ़ने वाला दौर है: ज्ञान, गुरु, संतान, धन और अच्छी सलाह आगे आती हैं।",
        "Venus": "प्रेम, सुख-सुविधा, रचनात्मकता और भौतिक उन्नति का दौर है। रिश्ते, वाहन, कला और बेहतर जीवनशैली पर ध्यान जाता है।",
        "Saturn": "कड़ी मेहनत और ज़िम्मेदारी से परखने वाला, पर धैर्य को इनाम देने वाला दौर है। परिणाम धीरे आते हैं पर टिकते हैं।",
        "Rahu": "बड़ी महत्वाकांक्षा, बदलाव और अनोखे अवसरों का दौर है। विदेश संपर्क और तकनीक मदद कर सकते हैं; शॉर्टकट और भ्रम से बचें।",
        "Ketu": "वैराग्य और भीतर की खोज का दौर है। पुरानी चीज़ें छूटती हैं, और आध्यात्मिक रुचि या एकांत की चाह बढ़ सकती है।",
    },
}
AREA = {
    "en": {
        1: ("self and personality", "your body, confidence and the way people see you"), 2: ("money and family", "savings, speech, food and close family"),
        3: ("courage and effort", "siblings, short travel, skills and self-made progress"), 4: ("home and peace of mind", "mother, property, vehicles and inner comfort"),
        5: ("learning, children and creativity", "studies, children, romance and intelligence"), 6: ("daily work and health", "jobs, routines, health habits, debts and competition"),
        7: ("marriage and partnerships", "spouse, business partners and close relationships"), 8: ("sudden changes and research", "transformation, secrets, inheritance and deep study"),
        9: ("luck and guidance", "fortune, father, teachers, faith and long journeys"), 10: ("career and reputation", "profession, status and the work you are known for"),
        11: ("gains and friends", "income, networks, big wishes and elder siblings"), 12: ("rest, expenses and foreign lands", "sleep, spending, spirituality and living far from home"),
    },
    "hi": {
        1: ("स्वयं और व्यक्तित्व", "आपका शरीर, आत्मविश्वास और लोग आपको कैसे देखते हैं"), 2: ("धन और परिवार", "बचत, वाणी, भोजन और निकट परिवार"),
        3: ("साहस और प्रयास", "भाई-बहन, छोटी यात्राएँ, कौशल और अपनी मेहनत से प्रगति"), 4: ("घर और मन की शांति", "माँ, संपत्ति, वाहन और भीतर का सुकून"),
        5: ("शिक्षा, संतान और रचनात्मकता", "पढ़ाई, संतान, प्रेम और बुद्धि"), 6: ("दैनिक कार्य और स्वास्थ्य", "नौकरी, दिनचर्या, स्वास्थ्य की आदतें, कर्ज़ और प्रतिस्पर्धा"),
        7: ("विवाह और साझेदारी", "जीवनसाथी, व्यापारिक साझेदार और करीबी रिश्ते"), 8: ("अचानक बदलाव और शोध", "परिवर्तन, रहस्य, विरासत और गहरा अध्ययन"),
        9: ("भाग्य और मार्गदर्शन", "किस्मत, पिता, गुरु, आस्था और लंबी यात्राएँ"), 10: ("करियर और प्रतिष्ठा", "पेशा, पद और जिस काम के लिए आप जाने जाते हैं"),
        11: ("लाभ और मित्र", "आमदनी, नेटवर्क, बड़ी इच्छाएँ और बड़े भाई-बहन"), 12: ("आराम, खर्च और विदेश", "नींद, खर्च, अध्यात्म और घर से दूर रहना"),
    },
}
HOUSE_THEME_HI = {
    1: "स्वयं, जीवन-शक्ति, छवि, और आपकी उपस्थिति दुनिया से कैसे मिलती है।", 2: "बचत, वाणी, पारिवारिक संस्कार और संचित मूल्य।",
    3: "क्रियान्वयन, साहस, संवाद और कौशल-निर्माण।", 4: "मन की शांति, घर, नींव और भावनात्मक आश्रय।",
    5: "रचनात्मकता, बुद्धि, प्रेम और प्रेरित जोखिम।", 6: "काम, अनुशासन, उपचार और वह घर्षण जो निपुणता बनाता है।",
    7: "साझेदारी, अनुबंध, विवाह और आईने जैसे सबक।", 8: "रूपांतरण, संवेदनशीलता, विरासत और अचानक बदलाव।",
    9: "भाग्य, धर्म, आशीर्वाद, गुरु और ऊँची दिशा।", 10: "करियर, सार्वजनिक प्रतिष्ठा, कर्तव्य और दिखाई देने वाला योगदान।",
    11: "लाभ, नेटवर्क, महत्वाकांक्षाएँ और सामूहिक अवसर।", 12: "विश्राम, मुक्ति, आध्यात्मिक एकांत, खर्च और विदेशी स्थान।",
}
TAGS_HI = {"occupied": "ग्रह उपस्थित", "empty but aspected": "खाली पर दृष्ट", "benefic influence": "शुभ प्रभाव", "malefic pressure": "पाप प्रभाव का दबाव",
           "mixed results": "मिश्रित फल", "quiet": "शांत", "supportive": "सहायक"}
DIGNITY_HI = {"Own sign": "स्वराशि", "Friendly": "मित्र राशि", "Neutral": "सम", "Exalted": "उच्च", "Debilitated": "नीच", "Enemy": "शत्रु राशि", "Moolatrikona": "मूलत्रिकोण", "Navamsa view": "नवांश दृश्य"}

BOOST = {  # what a sub-period tends to open up, by the house the sub-planet sits in
    "en": {1: "visibility, health habits and self-confidence", 2: "savings, speech and family support", 3: "skills, courage and self-made progress",
           4: "home, property and inner calm", 5: "study, creativity and children", 6: "steady work, discipline and clearing debts",
           7: "partnerships, agreements and commitments", 8: "deep research, shared resources and fresh starts", 9: "learning from teachers, travel and good fortune",
           10: "career moves, recognition and responsibility", 11: "income, useful contacts and long-held wishes", 12: "rest, spiritual practice and time away to recharge"},
    "hi": {1: "छवि, स्वास्थ्य की आदतें और आत्मविश्वास", 2: "बचत, वाणी और परिवार का सहारा", 3: "कौशल, साहस और अपनी मेहनत से प्रगति",
           4: "घर, संपत्ति और भीतर की शांति", 5: "पढ़ाई, रचनात्मकता और संतान", 6: "नियमित काम, अनुशासन और कर्ज़ चुकाना",
           7: "साझेदारी, समझौते और प्रतिबद्धताएँ", 8: "गहरा शोध, साझा संसाधन और नई शुरुआत", 9: "गुरुओं से सीख, यात्रा और अच्छा भाग्य",
           10: "करियर में आगे बढ़ना, पहचान और ज़िम्मेदारी", 11: "आमदनी, काम के संपर्क और पुरानी इच्छाओं की पूर्ति", 12: "विश्राम, साधना और ऊर्जा लौटाने के लिए एकांत"},
}
WATCH = {  # what to be careful about, by the same house
    "en": {1: "pushing your body or ego too hard", 2: "careless spending and sharp words at home", 3: "rash decisions and spreading yourself thin",
           4: "restlessness at home and property disputes", 5: "impulsive romance or risky speculation", 6: "burnout and neglecting your health",
           7: "rushed commitments and friction with a partner", 8: "sudden surprises and over-secrecy", 9: "overconfidence and ignoring advice",
           10: "workplace conflict and overwork", 11: "chasing gains or fair-weather friends", 12: "overspending and losing sleep"},
    "hi": {1: "शरीर या अहं पर ज़रूरत से ज़्यादा ज़ोर", 2: "लापरवाह खर्च और घर में तीखे शब्द", 3: "जल्दबाज़ी के फैसले और खुद को बहुत फैला लेना",
           4: "घर में बेचैनी और संपत्ति के विवाद", 5: "आवेग में प्रेम-संबंध या जोखिम भरा सट्टा", 6: "थकान से टूटना और सेहत की अनदेखी",
           7: "जल्दी में किए वादे और साथी से खिंचाव", 8: "अचानक के झटके और ज़रूरत से ज़्यादा गोपनीयता", 9: "अति-आत्मविश्वास और सलाह की अनदेखी",
           10: "कार्यस्थल का टकराव और ज़रूरत से ज़्यादा काम", 11: "लाभ के पीछे भागना या मतलबी दोस्त", 12: "फ़िज़ूलखर्ची और नींद खोना"},
}
CAUTION = {  # extra planet-level caution, used only when the pairing is rough or the planet is weak
    "en": {"Sun": "ego clashes with seniors", "Moon": "mood swings and overthinking", "Mars": "haste and accidents from rushing", "Mercury": "scattered focus and careless words",
           "Jupiter": "over-promising and taking luck for granted", "Venus": "overspending and indulgence", "Saturn": "delays, fatigue and taking on too much",
           "Rahu": "shortcuts and chasing too many things", "Ketu": "withdrawing and feeling disconnected"},
    "hi": {"Sun": "वरिष्ठों से अहं का टकराव", "Moon": "मूड के उतार-चढ़ाव और ज़्यादा सोचना", "Mars": "जल्दबाज़ी और भागदौड़ से दुर्घटना", "Mercury": "बिखरा ध्यान और लापरवाह शब्द",
           "Jupiter": "ज़्यादा वादे करना और भाग्य को हल्के में लेना", "Venus": "फ़िज़ूलखर्ची और भोग", "Saturn": "देरी, थकान और ज़रूरत से ज़्यादा बोझ उठाना",
           "Rahu": "शॉर्टकट और बहुत सारी चीज़ों के पीछे भागना", "Ketu": "अलग-थलग हो जाना और जुड़ाव खोना"},
}

FRIENDS = {  # natural friendships (Parashari): planet -> (friends, enemies)
    "Sun": ({"Moon", "Mars", "Jupiter"}, {"Venus", "Saturn"}), "Moon": ({"Sun", "Mercury"}, set()),
    "Mars": ({"Sun", "Moon", "Jupiter"}, {"Mercury"}), "Mercury": ({"Sun", "Venus"}, {"Moon"}),
    "Jupiter": ({"Sun", "Moon", "Mars"}, {"Mercury", "Venus"}), "Venus": ({"Mercury", "Saturn"}, {"Sun", "Moon"}),
    "Saturn": ({"Mercury", "Venus"}, {"Sun", "Moon", "Mars"}),
    "Rahu": ({"Venus", "Saturn", "Mercury"}, {"Sun", "Moon", "Mars"}),   # behaves like Saturn
    "Ketu": ({"Mars", "Venus", "Saturn"}, {"Sun", "Moon"}),             # behaves like Mars
}
KENDRA_TRIKONA = {1, 4, 5, 7, 9, 10}
DUSTHANA = {6, 8, 12}
STRONG_DIGNITY = {"Exalted", "Own sign", "Moolatrikona", "Friendly"}
WEAK_DIGNITY = {"Debilitated", "Enemy"}
COMBUST_ORB = {"Moon": 12, "Mars": 17, "Mercury": 14, "Jupiter": 11, "Venus": 10, "Saturn": 15}

REMEDY = {
    "en": {
        "Sun": dict(mantra="Om Suryaya Namah (108 times at sunrise)", day="Sunday", worship="Lord Surya: offer water to the rising Sun", donate="wheat, jaggery or red cloth", habit="Wake up early and take a few minutes of morning sunlight", gem="Ruby", gem_note="only after a chart check"),
        "Moon": dict(mantra="Om Som Somaya Namah (108 times)", day="Monday", worship="Lord Shiva: offer water or milk on Mondays", donate="rice, milk or white sweets", habit="Keep a fixed sleep time and spend quiet time near water or greenery", gem="Pearl", gem_note="only after a chart check"),
        "Mars": dict(mantra="Om Angarakaya Namah, or Hanuman Chalisa", day="Tuesday", worship="Lord Hanuman", donate="red lentils (masoor dal) or red cloth", habit="Exercise daily and pause before reacting in anger", gem="Red coral", gem_note="only after a chart check"),
        "Mercury": dict(mantra="Om Budhaya Namah (108 times)", day="Wednesday", worship="Lord Ganesha or Lord Vishnu", donate="green moong dal or green vegetables", habit="Read or learn something new daily and keep your speech gentle", gem="Emerald", gem_note="only after a chart check"),
        "Jupiter": dict(mantra="Om Gurave Namah (108 times)", day="Thursday", worship="Lord Vishnu or your Guru", donate="chana dal, turmeric or yellow sweets", habit="Respect teachers and elders and share what you know", gem="Yellow sapphire", gem_note="only after a chart check"),
        "Venus": dict(mantra="Om Shukraya Namah (108 times)", day="Friday", worship="Goddess Lakshmi", donate="rice, sugar or white cloth", habit="Keep your home clean and your relationships honest and kind", gem="Diamond or opal", gem_note="only after a chart check"),
        "Saturn": dict(mantra="Om Sham Shanaishcharaya Namah (108 times)", day="Saturday", worship="Lord Hanuman or Lord Shani", donate="black sesame, mustard oil or a blanket to someone in need", habit="Keep one steady daily routine and treat workers and elders with respect", gem="Blue sapphire", gem_note="never wear it without a careful chart check, as it can backfire"),
        "Rahu": dict(mantra="Om Raam Rahave Namah (108 times)", day="Saturday", worship="Goddess Durga or Lord Shiva", donate="blue or black cloth, or coconut", habit="Limit screen time and late nights; stay away from shortcuts", gem="Hessonite (gomed)", gem_note="only after a chart check"),
        "Ketu": dict(mantra="Om Ketave Namah (108 times)", day="Tuesday or Saturday", worship="Lord Ganesha", donate="a blanket, or feeding a dog", habit="Spend a few minutes in silence or meditation daily", gem="Cat's eye", gem_note="only after a chart check"),
    },
    "hi": {
        "Sun": dict(mantra="ॐ सूर्याय नमः (सूर्योदय पर 108 बार)", day="रविवार", worship="भगवान सूर्य: उगते सूर्य को जल अर्पित करें", donate="गेहूँ, गुड़ या लाल वस्त्र", habit="जल्दी उठें और सुबह कुछ मिनट धूप लें", gem="माणिक्य", gem_note="केवल कुंडली की जाँच के बाद"),
        "Moon": dict(mantra="ॐ सों सोमाय नमः (108 बार)", day="सोमवार", worship="भगवान शिव: सोमवार को जल या दूध चढ़ाएँ", donate="चावल, दूध या सफ़ेद मिठाई", habit="सोने का समय तय रखें और कुछ शांत समय जल या हरियाली के पास बिताएँ", gem="मोती", gem_note="केवल कुंडली की जाँच के बाद"),
        "Mars": dict(mantra="ॐ अंगारकाय नमः, या हनुमान चालीसा", day="मंगलवार", worship="भगवान हनुमान", donate="लाल मसूर की दाल या लाल वस्त्र", habit="रोज़ व्यायाम करें और गुस्से में प्रतिक्रिया देने से पहले रुकें", gem="मूँगा", gem_note="केवल कुंडली की जाँच के बाद"),
        "Mercury": dict(mantra="ॐ बुधाय नमः (108 बार)", day="बुधवार", worship="भगवान गणेश या भगवान विष्णु", donate="हरी मूँग दाल या हरी सब्ज़ियाँ", habit="रोज़ कुछ नया पढ़ें या सीखें और वाणी कोमल रखें", gem="पन्ना", gem_note="केवल कुंडली की जाँच के बाद"),
        "Jupiter": dict(mantra="ॐ गुरवे नमः (108 बार)", day="गुरुवार", worship="भगवान विष्णु या आपके गुरु", donate="चने की दाल, हल्दी या पीली मिठाई", habit="गुरुजनों और बड़ों का सम्मान करें और जो जानते हैं उसे बाँटें", gem="पुखराज", gem_note="केवल कुंडली की जाँच के बाद"),
        "Venus": dict(mantra="ॐ शुक्राय नमः (108 बार)", day="शुक्रवार", worship="देवी लक्ष्मी", donate="चावल, चीनी या सफ़ेद वस्त्र", habit="घर साफ़ रखें और रिश्तों में ईमानदारी व दया रखें", gem="हीरा या ओपल", gem_note="केवल कुंडली की जाँच के बाद"),
        "Saturn": dict(mantra="ॐ शं शनैश्चराय नमः (108 बार)", day="शनिवार", worship="भगवान हनुमान या शनिदेव", donate="काले तिल, सरसों का तेल या किसी ज़रूरतमंद को कंबल", habit="एक नियमित दिनचर्या रखें और कामगारों व बड़ों का सम्मान करें", gem="नीलम", gem_note="बिना सावधानी से कुंडली जाँचे कभी न पहनें, उलटा असर हो सकता है"),
        "Rahu": dict(mantra="ॐ रां राहवे नमः (108 बार)", day="शनिवार", worship="देवी दुर्गा या भगवान शिव", donate="नीला या काला वस्त्र, या नारियल", habit="स्क्रीन समय और देर रात जागना कम करें; शॉर्टकट से दूर रहें", gem="गोमेद", gem_note="केवल कुंडली की जाँच के बाद"),
        "Ketu": dict(mantra="ॐ केतवे नमः (108 बार)", day="मंगलवार या शनिवार", worship="भगवान गणेश", donate="कंबल, या कुत्ते को खाना", habit="रोज़ कुछ मिनट मौन या ध्यान में बिताएँ", gem="लहसुनिया", gem_note="केवल कुंडली की जाँच के बाद"),
    },
}

# sentences
TX = {
    "en": {
        "rising": "Your rising sign (Lagna) is {sign}. People usually see you as {trait}.",
        "moon": "Your Moon sign is {sign}: inside, your mind {mind}.",
        "nak": "Your birth star (Nakshatra) is {nak}{pada}, which is linked with being {trait}.",
        "pada": ", pada {n}", "strong_planet": "strong {p} ({means})", "care_planet": "{p} needs care ({means})",
        "combust": "{p} is very close to the Sun, so its results can feel dimmed or overshadowed (this is called combustion).",
        "headline": "{lagna} rising, {moon} Moon, {nak} star",
        "snap_rising": "Rising sign", "snap_moon": "Moon sign", "snap_star": "Birth star", "snap_cur": "Current period", "snap_cur_sub": "Mahadasha - Antardasha",
        "snap_strong": "Strongest planet", "snap_care": "Needs care", "snap_pada": "Pada {n}",
        "verdict": {"strong": "Strong", "balanced": "Balanced", "care": "Needs care"},
        "area_titles": {"love": "Love & marriage", "career": "Career & status", "money": "Money & savings", "health": "Health & energy", "family": "Home & family", "learning": "Education & children"},
        "area_intro": {"love": "This looks at your partner and close relationships.", "career": "This looks at your profession, reputation and daily work.",
                       "money": "This looks at your income, savings and gains.", "health": "This looks at your body, energy and health habits.",
                       "family": "This looks at your home, mother and peace of mind.", "learning": "This looks at your studies, children and luck."},
        "area_sum": {"strong": "{intro} Overall this area looks well supported in your chart.", "balanced": "{intro} This area has a good mix of support and challenge.",
                     "care": "{intro} This area asks for extra effort and patience in your chart, but it can improve with the right habits."},
        "area_label": "{name} ({ord} house)", "in_area": "In your {label}: {line}",
        "line_weak": "{p} is in a weaker state here, so its help is limited and it {presses}.",
        "line_good": "{p} {helps}.", "line_good_strong": "{p} {helps}. It sits very comfortably, which makes the effect stronger.",
        "line_mixed": "{p} {presses}, but handled with patience it also teaches you a lot.",
        "lord": "The planet that rules your {area} is {lord}. It sits in your {where}, which {tone}.",
        "lord_ok": "supports this area", "lord_bad": "puts this area under some pressure, so it needs patience",
        "empty": "Your {label} has no planets in it, so it stays calm and runs on its own.",
        "tip": "A simple support: {habit}.",
        "phase_title": "{m} Mahadasha, {a} Antardasha",
        "gist_maha": "You are in the {m} chapter until {end}: {feel}",
        "do": "Work with the clean side of {m}: timing, discipline, and conscious repetition.",
        "caution": "Do not let the pressure of your {area} make every decision reactive.",
        "tone": {"supportive": "Supportive", "mixed": "Mixed", "challenging": "Needs patience"},
        "tone_adj": {"supportive": "supportive", "mixed": "mixed", "challenging": "demanding"},
        "maha_meaning": "{m} chapter, ages {a} to {b} ({n}): {feel}",
        "maha_where": " In your chart {m} sits in your {area}",
        "maha_rules": ", and it rules your {areas}, so those matters carry this chapter.",
        "maha_end": ".",
        "e_theme": "This stretch connects {km} with {ks}.", "e_theme_self": "This is the heart of the {m} chapter: {km}.",
        "e_focus": "The {m} chapter keeps working on your {am}, while {s} brings your {as_} into the picture.",
        "e_same_house": "Both {m} and {s} sit in your {area}, so that part of life is under a double spotlight.",
        "e_rules": "{s} also rules your {areas}, so those parts of life get switched on.",
        "e_self": "This is {m}'s own sub-period: the purest, most direct taste of the whole chapter.",
        "rel_friend": "{s} is a natural friend of {m}, so the two work together rather than against each other.",
        "rel_enemy": "{s} and {m} are natural rivals, so progress can feel mixed or slower; patience pays off.",
        "rel_neutral": "{s} and {m} are neutral to each other, so results depend mostly on how you use the time.",
        "str_strong": "{s} is strong in your chart, so its results tend to arrive more easily.",
        "str_weak": "{s} is a little weak in your chart, so results can be delayed and benefit from the remedies in this report.",
        "e_timing": "It runs from age {a} to {b} ({n}) and is sub-period {i} of 9 in the {m} chapter: {stage}.",
        "stage_first": "it sets the tone for the whole chapter", "stage_early": "an early stretch, where the chapter's themes are taking shape",
        "stage_late": "a later stretch, where the results of earlier efforts start to show", "stage_last": "it closes the chapter and hands over to {nxt}",
        "next_chapter": "the next chapter", "and": " and ",
        "summary": "A {tone_adj} stretch: {s} brings {means} into your {area}.",
        "headline_pair": "{m} – {s}: {tone}", "years": "{y} yr", "months": "{n} mo", "under_month": "< 1 mo",
        "r_maha": "{p} is running your main life period, so supporting it helps the whole chapter.",
        "r_antar": "{p} controls your current sub-period (until {end}), so it shapes this stretch.",
        "r_pressure": "{p} is under some pressure in your chart ({means}), so it benefits from a little support.",
        "r_dosha": "This supports the {dosha} that was found in your chart.",
        "r_intro": "These are traditional, gentle practices. They are chosen from the planets that matter most in your chart right now. Pick one or two you can keep up, because steady habits matter more than doing everything.",
        "r_disclaimer": "Remedies are traditional beliefs and are not a substitute for medical, legal or financial advice. Please do not buy or wear a gemstone only because of an online reading; speak to a trusted astrologer who has examined your full chart first.",
        "method": "How this is worked out: dates come from the Vimshottari system based on your Moon's nakshatra. Each sub-period is described using the friendship between the two planets, where the sub-planet sits in your chart, the houses it rules, and how strong it is. These are traditional indications, not guarantees.",
        "d_mangal": ("Mars placement (Mangal Dosha)", "Mars is placed in a spot that traditionally adds heat, impatience or friction in close relationships, especially marriage.",
                     "Many people have it. It is usually softened by other planets, and by mature, calm handling of arguments. Many sites advise matching charts with a partner rather than worrying alone."),
        "d_kaal": ("Kaal Sarp pattern", "All main planets sit on one side of the Rahu-Ketu line, which can make life feel concentrated around a few themes, with ups and downs.",
                   "It is not a verdict on your life; strong benefic planets and good dasha periods reduce its effect."),
        "d_shani": ("Saturn pressure (Shani)", "Saturn influences a sensitive spot in your chart, which can bring delays, extra responsibility or a longer road to results.",
                    "Saturn rewards steady effort: results come later, but they last."),
        "conf": {"High": "High", "Moderate": "Moderate", "Low": "Low"},
        "climate": "{m} Mahadasha with {a} Antardasha is lighting up your {area}, while your chart stays in a {state} state.",
        "stable": "stable", "sensitive": "sensitive",
    },
    "hi": {
        "rising": "आपका लग्न (उदय राशि) {sign} है। लोग आपको आम तौर पर {trait} समझते हैं।",
        "moon": "आपकी चंद्र राशि {sign} है: भीतर से आपका मन {mind}।",
        "nak": "आपका जन्म नक्षत्र {nak}{pada} है, जो {trait} होने से जुड़ा माना जाता है।",
        "pada": ", चरण {n}", "strong_planet": "मज़बूत {p} ({means})", "care_planet": "{p} को ध्यान चाहिए ({means})",
        "combust": "{p} सूर्य के बहुत पास है, इसलिए इसके फल फीके या दबे हुए लग सकते हैं (इसे अस्त होना कहते हैं)।",
        "headline": "{lagna} लग्न, {moon} चंद्र राशि, {nak} नक्षत्र",
        "snap_rising": "लग्न", "snap_moon": "चंद्र राशि", "snap_star": "जन्म नक्षत्र", "snap_cur": "चल रही दशा", "snap_cur_sub": "महादशा - अंतर्दशा",
        "snap_strong": "सबसे मज़बूत ग्रह", "snap_care": "ध्यान चाहिए", "snap_pada": "चरण {n}",
        "verdict": {"strong": "मज़बूत", "balanced": "संतुलित", "care": "ध्यान दें"},
        "area_titles": {"love": "प्रेम और विवाह", "career": "करियर और प्रतिष्ठा", "money": "धन और बचत", "health": "स्वास्थ्य और ऊर्जा", "family": "घर और परिवार", "learning": "शिक्षा और संतान"},
        "area_intro": {"love": "यह आपके जीवनसाथी और करीबी रिश्तों को देखता है।", "career": "यह आपके पेशे, प्रतिष्ठा और रोज़ के काम को देखता है।",
                       "money": "यह आपकी आमदनी, बचत और लाभ को देखता है।", "health": "यह आपके शरीर, ऊर्जा और स्वास्थ्य की आदतों को देखता है।",
                       "family": "यह आपके घर, माँ और मन की शांति को देखता है।", "learning": "यह आपकी पढ़ाई, संतान और भाग्य को देखता है।"},
        "area_sum": {"strong": "{intro} कुल मिलाकर इस क्षेत्र को आपकी कुंडली में अच्छा सहारा मिल रहा है।", "balanced": "{intro} इस क्षेत्र में सहारा और चुनौती का अच्छा मिश्रण है।",
                     "care": "{intro} आपकी कुंडली में इस क्षेत्र को अतिरिक्त प्रयास और धैर्य चाहिए, पर सही आदतों से यह बेहतर हो सकता है।"},
        "area_label": "{name} ({ord} भाव)", "in_area": "आपके {label} में: {line}",
        "line_weak": "{p} यहाँ कमज़ोर स्थिति में है, इसलिए इसकी मदद सीमित रहती है और यह {presses}।",
        "line_good": "{p} यहाँ {helps}।", "line_good_strong": "{p} यहाँ {helps}। यह बहुत सहज स्थिति में है, जिससे असर और मज़बूत होता है।",
        "line_mixed": "{p} यहाँ {presses}, पर धैर्य से सँभालने पर यह बहुत कुछ सिखाता भी है।",
        "lord": "आपके {area} का स्वामी ग्रह {lord} है। वह आपके {where} में बैठा है, जो {tone}।",
        "lord_ok": "इस क्षेत्र को सहारा देता है", "lord_bad": "इस क्षेत्र पर कुछ दबाव डालता है, इसलिए धैर्य चाहिए",
        "empty": "आपके {label} में कोई ग्रह नहीं है, इसलिए यह शांत रहता है और अपने ढंग से चलता है।",
        "tip": "एक सरल सहारा: {habit}।",
        "phase_title": "{m} महादशा, {a} अंतर्दशा",
        "gist_maha": "आप {end} तक {m} महादशा में हैं: यह {feel}",
        "do": "{m} के सकारात्मक पक्ष के साथ चलें: समय का ध्यान, अनुशासन और सोच-समझकर दोहराव।",
        "caution": "अपने {area} के दबाव में हर फ़ैसला प्रतिक्रिया में न लें।",
        "tone": {"supportive": "अनुकूल", "mixed": "मिला-जुला", "challenging": "धैर्य ज़रूरी"},
        "tone_adj": {"supportive": "अनुकूल", "mixed": "मिला-जुला", "challenging": "कठिन"},
        "maha_meaning": "{m} महादशा, आयु {a} से {b} वर्ष ({n}): यह {feel}",
        "maha_where": " आपकी कुंडली में {m} आपके {area} में है",
        "maha_rules": ", और यह आपके {areas} का स्वामी है, इसलिए वही विषय इस महादशा को आगे ले जाते हैं।",
        "maha_end": "।",
        "e_theme": "यह दौर {km} को {ks} से जोड़ता है।", "e_theme_self": "यह {m} महादशा का केंद्र है: {km}।",
        "e_focus": "{m} महादशा आपके {am} पर काम करती रहती है, जबकि {s} आपके {as_} को सामने लाता है।",
        "e_same_house": "{m} और {s} दोनों आपके {area} में हैं, इसलिए जीवन का यह हिस्सा दोहरी रोशनी में है।",
        "e_rules": "{s} आपके {areas} का भी स्वामी है, इसलिए जीवन के वे हिस्से सक्रिय हो जाते हैं।",
        "e_self": "यह {m} की अपनी अंतर्दशा है: पूरी महादशा का सबसे सीधा, शुद्ध स्वाद।",
        "rel_friend": "{s} और {m} स्वाभाविक मित्र हैं, इसलिए दोनों साथ मिलकर काम करते हैं, एक-दूसरे के खिलाफ़ नहीं।",
        "rel_enemy": "{s} और {m} स्वाभाविक शत्रु हैं, इसलिए प्रगति मिली-जुली या धीमी लग सकती है; धैर्य का फल मिलता है।",
        "rel_neutral": "{s} और {m} एक-दूसरे के प्रति सम हैं, इसलिए परिणाम इस पर निर्भर करते हैं कि आप समय का कैसे उपयोग करते हैं।",
        "str_strong": "आपकी कुंडली में {s} मज़बूत है, इसलिए इसके फल अपेक्षाकृत आसानी से मिलते हैं।",
        "str_weak": "आपकी कुंडली में {s} थोड़ा कमज़ोर है, इसलिए फल देर से मिल सकते हैं और इस रिपोर्ट के उपायों से लाभ होगा।",
        "e_timing": "यह आयु {a} से {b} वर्ष ({n}) तक चलती है और {m} महादशा की 9 में से {i} अंतर्दशा है: {stage}।",
        "stage_first": "यह पूरी महादशा का स्वर तय करती है", "stage_early": "शुरुआती दौर, जब महादशा के विषय आकार ले रहे होते हैं",
        "stage_late": "बाद का दौर, जब पहले के प्रयासों के परिणाम दिखने लगते हैं", "stage_last": "यह महादशा को समेटकर {nxt} को कमान सौंपती है",
        "next_chapter": "अगली महादशा", "and": " और ",
        "summary": "{tone_adj} दौर: {s} आपके {area} में {means} लाता है।",
        "headline_pair": "{m} – {s}: {tone}", "years": "{y} वर्ष", "months": "{n} माह", "under_month": "1 माह से कम",
        "r_maha": "{p} आपकी मुख्य जीवन-अवधि चला रहा है, इसलिए इसे सहारा देने से पूरी महादशा को लाभ मिलता है।",
        "r_antar": "{p} आपकी चल रही अंतर्दशा ({end} तक) का स्वामी है, इसलिए यह इस दौर को आकार देता है।",
        "r_pressure": "आपकी कुंडली में {p} पर कुछ दबाव है ({means}), इसलिए थोड़े सहारे से इसे लाभ होगा।",
        "r_dosha": "यह आपकी कुंडली में मिले {dosha} को सहारा देता है।",
        "r_intro": "ये पारंपरिक, सौम्य अभ्यास हैं। इन्हें आपकी कुंडली के अभी सबसे महत्वपूर्ण ग्रहों के आधार पर चुना गया है। एक-दो ऐसे चुनें जिन्हें आप निभा सकें, क्योंकि सब कुछ करने से ज़्यादा नियमितता मायने रखती है।",
        "r_disclaimer": "उपाय पारंपरिक मान्यताएँ हैं और चिकित्सा, कानूनी या वित्तीय सलाह का विकल्प नहीं हैं। कृपया केवल ऑनलाइन रीडिंग के आधार पर रत्न न खरीदें या पहनें; पहले किसी भरोसेमंद ज्योतिषी से अपनी पूरी कुंडली दिखवाएँ।",
        "method": "यह कैसे निकाला गया: तिथियाँ आपके चंद्र नक्षत्र पर आधारित विंशोत्तरी पद्धति से आती हैं। हर अंतर्दशा का वर्णन दोनों ग्रहों की मित्रता, उप-ग्रह की कुंडली में स्थिति, उसके स्वामित्व वाले भाव और उसकी शक्ति के आधार पर है। ये पारंपरिक संकेत हैं, गारंटी नहीं।",
        "d_mangal": ("मंगल की स्थिति (मांगलिक दोष)", "मंगल ऐसी जगह है जहाँ परंपरा के अनुसार निकट संबंधों, खासकर विवाह में गर्मी, अधीरता या खिंचाव बढ़ सकता है।",
                     "यह कई लोगों में होता है। अक्सर अन्य ग्रह इसे हल्का कर देते हैं, और शांत व परिपक्व ढंग से बहस सँभालने से भी। कई साइटें अकेले चिंता करने के बजाय साथी की कुंडली से मिलान की सलाह देती हैं।"),
        "d_kaal": ("कालसर्प योग", "सभी मुख्य ग्रह राहु-केतु रेखा के एक ओर हैं, जिससे जीवन कुछ ही विषयों पर केंद्रित और उतार-चढ़ाव वाला लग सकता है।",
                   "यह आपके जीवन का फ़ैसला नहीं है; मज़बूत शुभ ग्रह और अच्छी दशाएँ इसका असर घटाती हैं।"),
        "d_shani": ("शनि का दबाव", "शनि आपकी कुंडली के एक संवेदनशील स्थान को प्रभावित करता है, जिससे देरी, अतिरिक्त ज़िम्मेदारी या परिणाम तक लंबा रास्ता हो सकता है।",
                    "शनि स्थिर प्रयास को इनाम देता है: परिणाम देर से आते हैं पर टिकते हैं।"),
        "conf": {"High": "उच्च", "Moderate": "मध्यम", "Low": "कम"},
        "climate": "{m} महादशा और {a} अंतर्दशा आपके {area} को सक्रिय कर रही हैं, जबकि आपकी कुंडली {state} अवस्था में है।",
        "stable": "स्थिर", "sensitive": "संवेदनशील",
    },
}

# engine strings that the engine only writes in English
ENGINE_HI = {
    "Jupiter has supportive dignity, which softens impulsive Mars signatures.": "गुरु की स्थिति सहायक है, जो मंगल के आवेगी प्रभाव को नरम करती है।",
    "The 7th lord is reasonably supported, which reduces relationship strain.": "सातवें भाव के स्वामी को ठीक-ठाक सहारा मिला है, जिससे रिश्तों का तनाव घटता है।",
    "No strong mitigating factor stands out beyond chart-wide maturity and timing.": "पूरी कुंडली की परिपक्वता और समय के अलावा कोई खास कम करने वाला कारक नहीं दिखता।",
    "This pattern should never be read in isolation; benefic strength and dasha support can reduce its intensity.": "इस योग को कभी अकेले नहीं देखना चाहिए; शुभ ग्रहों का बल और दशा का सहारा इसकी तीव्रता घटा सकते हैं।",
    "A stronger Lagna lord gives resilience under Saturn pressure.": "मज़बूत लग्नेश शनि के दबाव में सहनशक्ति देता है।",
    "Steady routines and patient action usually reduce Saturn-related pressure more effectively than force.": "स्थिर दिनचर्या और धैर्यपूर्ण कर्म आम तौर पर ज़ोर-ज़बरदस्ती से बेहतर शनि का दबाव घटाते हैं।",
    "Mars does not trigger the sensitive marriage houses from Lagna, Moon, or Venus references.": "लग्न, चंद्र या शुक्र से मंगल विवाह के संवेदनशील भावों को सक्रिय नहीं करता।",
    "All seven classical planets fall within the Rahu-Ketu arc.": "सातों शास्त्रीय ग्रह राहु-केतु के बीच के अर्क में हैं।",
    "The classical planets are not locked entirely within the Rahu-Ketu axis.": "शास्त्रीय ग्रह पूरी तरह राहु-केतु अक्ष के भीतर बंद नहीं हैं।",
    "Saturn is placed in or influencing a sensitive house pattern from Lagna or Moon.": "शनि लग्न या चंद्र से किसी संवेदनशील भाव-स्थिति में है या उसे प्रभावित करता है।",
    "Saturn is not strongly pressing the classic sensitive houses right now.": "शनि अभी शास्त्रीय संवेदनशील भावों को ज़्यादा दबा नहीं रहा।",
}
REF_HI = {"Lagna": "लग्न", "Moon": "चंद्र", "Venus": "शुक्र"}
DAILY_HI = {  # engine "everyday practice" cards that are not about a planet already covered by a planet card
    "One non-negotiable routine": ("एक अटल दिनचर्या", "निर्णय की थकान हटाकर एक नियमित स्थिर अभ्यास रखने से शनि का दबाव आसान हो जाता है।"),
    "Cooling response discipline": ("शांत प्रतिक्रिया का अनुशासन", "मंगल से जुड़े साझेदारी वाले क्षेत्र सक्रिय हैं, इसलिए पहला उपाय प्रतिक्रिया की गर्मी घटाना और अनावश्यक टकराव कम करना है।"),
    "Breath before action": ("कर्म से पहले श्वास", "जब कुंडली अनुभव को ज़्यादा तीव्र नोडल पैटर्न में समेटती है, तब तंत्रिका तंत्र को शांत करने से अति-प्रतिक्रिया घटती है।"),
}
FREQ_HI = {"Daily": "रोज़", "Weekly": "साप्ताहिक", "Always": "हमेशा", "Tuesday or Saturday": "मंगलवार या शनिवार"}
KIND_HI = {"Behavioral remedy": "व्यवहार का उपाय", "Daily practice": "रोज़ का अभ्यास", "Do not overdo": "अति न करें"}
DAILY_ICON = {"Daily practice": "☀", "Weekly observance": "☾", "Mantra / spiritual focus": "ॐ", "Donation / seva": "♡", "Behavioral remedy": "✦", "Do not overdo": "✦"}


# ----------------------------------------------------------------------------- helpers
def _dt(value) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(str(value))
    except Exception:
        return None


def _planets_by_name(kundali: Dict) -> Dict[str, Dict]:
    return {p.get("planet"): p for p in kundali.get("planets", []) if p.get("planet")}


def _detail_planets(kundali: Dict) -> Dict[str, Dict]:
    out = {}
    for house in (kundali.get("experience") or {}).get("house_details", {}).values():
        for p in house.get("planets", []):
            out[p.get("planet")] = p
    return out


def _house_lord(kundali: Dict, house: int) -> str:
    return str(((kundali.get("experience") or {}).get("house_details", {}).get(str(house)) or {}).get("signRuler") or "")


def _heat(kundali: Dict, house: int) -> float:
    for row in (kundali.get("experience") or {}).get("house_heatmap", []):
        if int(row.get("house", 0)) == house:
            return float(row.get("score", 60))
    return 60.0


def _ruled_houses(kundali: Dict, planet: str) -> List[int]:
    out = []
    for h, info in ((kundali.get("experience") or {}).get("house_details") or {}).items():
        if info.get("signRuler") == planet:
            out.append(int(h))
    return sorted(out)


def _birth(kundali: Dict) -> Optional[datetime]:
    return _dt((kundali.get("input") or {}).get("datetime_local"))


def _age(birth: Optional[datetime], when: Optional[datetime]) -> int:
    if not birth or not when:
        return 0
    try:
        return max(0, int((when - birth).total_seconds() // (365.2425 * 86400)))
    except Exception:
        return 0


def _span(start, end, T: Dict) -> str:
    a, b = _dt(start), _dt(end)
    if not a or not b:
        return ""
    months = round((b - a).days / 30.4375)
    y, m = divmod(months, 12)
    parts = ([T["years"].format(y=y)] if y else []) + ([T["months"].format(n=m)] if m else [])
    return " ".join(parts) or T["under_month"]


def plainify(text: str) -> str:
    """Swap 'house 11' style wording from the engine for the everyday name of that area of life."""
    return re.sub(r"\bhouses? (\d{1,2})\b", lambda m: f"your {AREA['en'][int(m.group(1))][0]}" if 1 <= int(m.group(1)) <= 12 else m.group(0), text or "")


def _verdict(score: float):
    if score >= 80:
        return "strong"
    if score >= 65:
        return "balanced"
    return "care"


def _join(items: List[str], T: Dict) -> str:
    """Area names already contain 'and', so list them in quotes: “a and b” and “c and d”."""
    q = [f"\u201c{x}\u201d" for x in items]
    return T["and"].join(q)


def _semi(items: List[str]) -> str:
    return "; ".join(i for i in items if i)


def _combust(kundali: Dict, lang: str) -> List[str]:
    planets = _planets_by_name(kundali)
    sun = planets.get("Sun")
    notes = []
    if not sun:
        return notes
    for name, orb in COMBUST_ORB.items():
        p = planets.get(name)
        if not p:
            continue
        diff = abs((float(p["degree"]) - float(sun["degree"]) + 180) % 360 - 180)
        if diff <= orb:
            notes.append(TX[lang]["combust"].format(p=pname(name, lang)))
    return notes


def _relation(maha: str, sub: str) -> str:
    if maha == sub:
        return "same"
    friends, enemies = FRIENDS.get(maha, (set(), set()))
    return "friend" if sub in friends else ("enemy" if sub in enemies else "neutral")


def _lbl(lang: str, house: int) -> str:
    return TX[lang]["area_label"].format(name=AREA[lang][house][0], ord=ordinal(house, lang))


def _planet_line(planet: str, detail: Dict, lang: str):
    """(sentence, is_positive)"""
    T = TX[lang]
    helps, presses = PLANET_ROLE[lang][planet]
    p = pname(planet, lang)
    dignity = (detail or {}).get("dignity", "")
    strength = float((detail or {}).get("strength", 60))
    weak = dignity in WEAK_DIGNITY or strength < 50
    strong = dignity in STRONG_DIGNITY or strength >= 75
    if weak:
        return T["line_weak"].format(p=p, presses=presses), False
    if planet in BENEFICS or strong:
        return (T["line_good_strong"] if strong else T["line_good"]).format(p=p, helps=helps), True
    return T["line_mixed"].format(p=p, presses=presses), False


def _area_block(kundali: Dict, lang: str, key: str, icon: str, houses: List[int], tip_planet: str) -> Dict:
    T = TX[lang]
    details = (kundali.get("experience") or {}).get("house_details", {})
    dplanets = _detail_planets(kundali)
    planets = _planets_by_name(kundali)
    helps: List[str] = []
    watch: List[str] = []
    for h in houses:
        info = details.get(str(h)) or {}
        for p in info.get("planets", []):
            line, good = _planet_line(p["planet"], p, lang)
            (helps if good else watch).append(T["in_area"].format(label=_lbl(lang, h), line=line))
        lord = _house_lord(kundali, h)
        if lord and lord in planets:
            lstr = float((dplanets.get(lord) or {}).get("strength", 60))
            where = int(planets[lord]["house"])
            line = T["lord"].format(area=AREA[lang][h][0], lord=pname(lord, lang), where=_lbl(lang, where), tone=T["lord_ok"] if lstr >= 60 else T["lord_bad"])
            (helps if lstr >= 60 else watch).append(line)
        if not info.get("planets"):
            helps.append(T["empty"].format(label=_lbl(lang, h)))
    score = sum(_heat(kundali, h) for h in houses) / len(houses)
    code = _verdict(score)
    summary = T["area_sum"][code].format(intro=T["area_intro"][key])
    habit = REMEDY[lang][tip_planet]["habit"].rstrip(".।")
    return {"id": key, "title": T["area_titles"][key], "icon": icon, "verdict": code, "verdict_label": T["verdict"][code], "score": round(score),
            "summary": summary, "helps": helps[:3], "watch": watch[:3], "tip": T["tip"].format(habit=habit)}


# ----------------------------------------------------------------------------- sub-periods (Antardashas)
def antardasha_effect(kundali: Dict, maha: str, sub: str, lang: str = "en", index: int = 1, start=None, end=None, next_maha: Optional[str] = None) -> Dict:
    """How one sub-period lands in THIS chart. The text is built from the pairing (main planet + sub planet), their houses,
    their friendship, the stage inside the chapter and the age range, so no two read the same."""
    T = TX[lang]
    planets = _planets_by_name(kundali)
    detail = _detail_planets(kundali)
    p_s, p_m = planets.get(sub) or {}, planets.get(maha) or {}
    h_s, h_m = int(p_s.get("house", 0) or 0), int(p_m.get("house", 0) or 0)
    d = detail.get(sub) or {}
    strength, dignity = float(d.get("strength", 60)), d.get("dignity", "")
    ruled = _ruled_houses(kundali, sub)
    rel = _relation(maha, sub)

    score = (1 if sub in BENEFICS else -1)
    strong = dignity in STRONG_DIGNITY or strength >= 75
    weak = dignity in WEAK_DIGNITY or strength < 50
    score += 1 if strong else (-1 if weak else 0)
    score += {"friend": 1, "enemy": -1}.get(rel, 0)
    if h_s in KENDRA_TRIKONA:
        score += 1
    elif h_s in DUSTHANA:
        score -= 1
    if any(h in KENDRA_TRIKONA for h in ruled):
        score += 1
    tone = "supportive" if score >= 2 else ("challenging" if score <= -1 else "mixed")
    M, S = pname(maha, lang), pname(sub, lang)

    lines = [T["e_theme_self"].format(m=M, km=PLANET_KEY[lang][maha]) if maha == sub else T["e_theme"].format(km=PLANET_KEY[lang][maha], ks=PLANET_KEY[lang][sub])]
    if h_s and h_m and maha != sub:
        if h_s == h_m:
            lines.append(T["e_same_house"].format(m=M, s=S, area=AREA[lang][h_s][0]))
        else:
            lines.append(T["e_focus"].format(m=M, s=S, am=AREA[lang][h_m][0], as_=AREA[lang][h_s][0]))
    extra = [h for h in ruled if h != h_s][:2]
    if extra:
        lines.append(T["e_rules"].format(s=S, areas=_join([AREA[lang][h][0] for h in extra], T)))
    lines.append(T["e_self"].format(m=M) if rel == "same" else T["rel_" + rel].format(s=S, m=M))
    if strong:
        lines.append(T["str_strong"].format(s=S))
    elif weak:
        lines.append(T["str_weak"].format(s=S))

    birth = _birth(kundali)
    s_dt, e_dt = _dt(start), _dt(end)
    if s_dt and e_dt:
        if index == 1:
            stage = T["stage_first"]
        elif index == 9:
            stage = T["stage_last"].format(nxt=pname(next_maha, lang) if next_maha else T["next_chapter"])
        else:
            stage = T["stage_early"] if index <= 4 else T["stage_late"]
        lines.append(T["e_timing"].format(a=_age(birth, s_dt), b=_age(birth, e_dt), n=_span(start, end, T), i=(index if lang == "en" else ORD_F_HI[index]), m=M, stage=stage))

    good = [BOOST[lang][h_s]] if h_s else []
    for h in ([h_m] if h_m and h_m != h_s and maha != sub else []) + extra:   # the chapter's own focus first: it changes with the main planet
        if BOOST[lang][h] not in good:
            good.append(BOOST[lang][h])
    careful_parts = [WATCH[lang][h_s]] if h_s else []
    if maha != sub and h_m and h_m != h_s and tone != "supportive":
        careful_parts.append(WATCH[lang][h_m])
    if rel == "enemy" or weak:
        careful_parts.append(CAUTION[lang][sub])
    summary = T["summary"].format(tone_adj=T["tone_adj"][tone], s=S, means=PLANET_MEANS[lang][sub], area=AREA[lang][h_s][0] if h_s else "")
    return {"tone": tone, "tone_label": T["tone"][tone], "relation": rel, "house": h_s, "strength": round(strength),
            "headline": T["headline_pair"].format(m=M, s=S, tone=T["tone"][tone].lower() if lang == "en" else T["tone"][tone]),
            "summary": summary, "text": lines, "good_for": good[:2], "careful": _semi(careful_parts), "score": score}


def _dasha_full(kundali: Dict, now: datetime, lang: str) -> List[Dict]:
    T = TX[lang]
    rows = []
    planets = _planets_by_name(kundali)
    birth = _birth(kundali)
    mahas = [m for m in kundali.get("dasha", []) if _dt(m.get("start")) and _dt(m.get("end"))]
    for i, maha in enumerate(mahas):
        start, end = _dt(maha.get("start")), _dt(maha.get("end"))
        current = start <= now < end
        lord = maha.get("planet")
        nxt = mahas[i + 1]["planet"] if i + 1 < len(mahas) else None
        subs = []
        for idx, a in enumerate(_antardashas(maha), start=1):
            s, e = _dt(a["start"]), _dt(a["end"])
            cur = bool(s and e and s <= now < e)
            subs.append({**a, "effect": antardasha_effect(kundali, lord, a["planet"], lang, idx, a["start"], a["end"], nxt), "isCurrent": cur, "isPast": bool(e and now >= e),
                         "span": _span(a["start"], a["end"], T), "ageStart": _age(birth, s), "ageEnd": _age(birth, e),
                         "progress": max(0, min(100, round((now - s).total_seconds() / max((e - s).total_seconds(), 1) * 100))) if cur else (100 if e and now >= e else 0)})
        house = int((planets.get(lord) or {}).get("house", 0) or 0)
        ruled = [h for h in _ruled_houses(kundali, lord) if h != house][:2]
        meaning = T["maha_meaning"].format(m=pname(lord, lang), a=_age(birth, start), b=_age(birth, end), n=_span(maha["start"], maha["end"], T), feel=DASHA_FEEL[lang][lord])
        if house:
            meaning += T["maha_where"].format(m=pname(lord, lang), area=AREA[lang][house][0])
            meaning += T["maha_rules"].format(areas=_join([AREA[lang][h][0] for h in ruled], T)) if ruled else T["maha_end"]
        total = max((end - start).total_seconds(), 1)
        rows.append({"planet": lord, "start": maha["start"], "end": maha["end"], "years": maha.get("years"), "isCurrent": current, "isPast": now >= end,
                     "span": _span(maha["start"], maha["end"], T), "ageStart": _age(birth, start), "ageEnd": _age(birth, end),
                     "progress": max(0, min(100, round((now - start).total_seconds() / total * 100))), "meaning": meaning, "antardashas": subs})
    return rows


def _remedy_card(planet: str, why: str, lang: str) -> Dict:
    r = REMEDY[lang][planet]
    return {"planet": planet, "why": why, "mantra": r["mantra"], "day": r["day"], "worship": r["worship"], "donate": r["donate"],
            "habit": r["habit"], "gem": {"name": r["gem"], "note": r["gem_note"]}}


def _tr_soft(text: str, lang: str) -> str:
    return ENGINE_HI.get(text, text) if lang == "hi" else text


def _tr_technical(text: str, lang: str) -> str:
    if lang != "hi":
        return text

    def one(sentence: str) -> str:
        sentence = sentence.strip()
        m = re.match(r"^(Lagna|Moon|Venus) reference places Mars in house (\d+)\.$", sentence)
        if m:
            return f"{REF_HI[m.group(1)]} से मंगल {ORD_HI.get(int(m.group(2)), m.group(2))} भाव में है।"
        return ENGINE_HI.get(sentence, sentence)

    return " ".join(one(p) for p in re.split(r"(?<=\.)\s+", text.strip()) if p)


# ----------------------------------------------------------------------------- main entry
def build_reading(kundali: Dict, now: Optional[datetime] = None, lang: str = "en") -> Dict:
    lang = lang if lang in LANGS else "en"
    T = TX[lang]
    now = now or datetime.now().astimezone()
    lagna = str(kundali.get("lagna") or "")
    planets = _planets_by_name(kundali)
    moon_sign = str((planets.get("Moon") or {}).get("rashi") or "")
    nak = str(kundali.get("nakshatra") or "")
    pada = kundali.get("nakshatra_pada")
    exp = kundali.get("experience") or {}
    climate = exp.get("planetary_climate") or {}
    nak_name = NAK_HI.get(nak, nak) if lang == "hi" else nak
    M5 = PLANET_MEANS[lang]

    lt = SIGN_TRAITS[lang].get(lagna)
    paragraphs = []
    if lt:
        paragraphs.append(T["rising"].format(sign=sname(lagna, lang), trait=lt[0]))
    if moon_sign in MOON_MIND[lang]:
        paragraphs.append(T["moon"].format(sign=sname(moon_sign, lang), mind=MOON_MIND[lang][moon_sign]))
    if nak in NAKSHATRA_TRAIT[lang]:
        paragraphs.append(T["nak"].format(nak=nak_name, pada=T["pada"].format(n=pada) if pada else "", trait=NAKSHATRA_TRAIT[lang][nak]))
    strongest = sorted(climate.get("supportive", []), key=lambda r: -float(r.get("score", 0)))[:3]
    careful = sorted(climate.get("pressurizing", []), key=lambda r: float(r.get("score", 0)))[:3]
    strengths = list(lt[1]) if lt else []
    watch = list(lt[2]) if lt else []
    for row in strongest[:2]:
        strengths.append(T["strong_planet"].format(p=pname(row["planet"], lang), means=M5[row["planet"]]))
    for row in careful[:2]:
        watch.append(T["care_planet"].format(p=pname(row["planet"], lang), means=M5[row["planet"]]))

    sign_label = (lambda s: SIGN_HI.get(s, s)) if lang == "hi" else (lambda s: SIGN_EN.get(s, s))
    snapshot = [
        {"label": T["snap_rising"], "value": sign_label(lagna), "sub": lagna if lang == "en" else ""},
        {"label": T["snap_moon"], "value": sign_label(moon_sign), "sub": moon_sign if lang == "en" else ""},
        {"label": T["snap_star"], "value": nak_name, "sub": T["snap_pada"].format(n=pada) if pada else ""},
    ]
    de = kundali.get("dasha_experience") or {}
    maha, anta = de.get("current_mahadasha") or {}, de.get("current_antardasha") or {}
    if maha:
        snapshot.append({"label": T["snap_cur"], "value": f"{pname(maha.get('planet'), lang)} - {pname(anta.get('planet', ''), lang)}", "sub": T["snap_cur_sub"]})
    if strongest:
        snapshot.append({"label": T["snap_strong"], "value": pname(strongest[0]["planet"], lang), "sub": M5[strongest[0]["planet"]]})
    if careful:
        snapshot.append({"label": T["snap_care"], "value": pname(careful[0]["planet"], lang), "sub": M5[careful[0]["planet"]]})

    personality = {"headline": T["headline"].format(lagna=sign_label(lagna), moon=sign_label(moon_sign), nak=nak_name),
                   "paragraphs": paragraphs, "strengths": strengths[:5], "watch": watch[:4], "notes": _combust(kundali, lang)}

    areas = [
        _area_block(kundali, lang, "love", "♡", [7], "Venus"), _area_block(kundali, lang, "career", "✦", [10, 6], "Saturn"),
        _area_block(kundali, lang, "money", "◈", [2, 11], "Jupiter"), _area_block(kundali, lang, "health", "✚", [1, 6], "Sun"),
        _area_block(kundali, lang, "family", "⌂", [4, 2], "Moon"), _area_block(kundali, lang, "learning", "✎", [5, 9], "Mercury"),
    ]

    full = _dasha_full(kundali, now, lang)
    phase: Dict = {}
    if maha:
        mp, ap = maha.get("planet"), anta.get("planet")
        mh = int((planets.get(mp) or {}).get("house", 0) or 0)
        ah = int((planets.get(ap) or {}).get("house", 0) or 0)
        cur = next((r for r in full if r["isCurrent"]), None)
        cur_sub = next((s for s in (cur or {}).get("antardashas", []) if s["isCurrent"]), None)
        feel_first = re.split(r"(?<=[.।])\s", DASHA_FEEL[lang][mp])[0]
        phase = {"title": T["phase_title"].format(m=pname(mp, lang), a=pname(ap, lang)), "maha": maha, "antar": anta,
                 "gist_maha": T["gist_maha"].format(m=pname(mp, lang), end=month_year(maha.get("end"), lang), feel=feel_first),
                 "gist_antar": cur_sub["effect"]["summary"] if cur_sub else "",
                 "next_change": exp.get("phase_shift", {}),
                 "do": [T["do"].format(m=pname(mp, lang))],
                 "caution": T["caution"].format(area=AREA[lang][ah or mh or 1][0]),
                 "antar_effect": cur_sub["effect"] if cur_sub else None}
        if cur:
            phase["progress"] = cur["progress"]
            phase["antar_progress"] = cur_sub["progress"] if cur_sub else 0

    plain = {"Mangal Dosha": ("d_mangal", "Mars"), "Kaal Sarp Pattern": ("d_kaal", "Rahu"), "Shani Pressure Pattern": ("d_shani", "Saturn")}
    doshas = []
    for d in kundali.get("dosha_analysis", []):
        key, planet = plain.get(d.get("name"), (None, ""))
        pn, what, comfort = T[key] if key else (d.get("name"), d.get("likelyThemes", ""), "")
        doshas.append({"name": d.get("name"), "plain_name": pn, "detected": bool(d.get("detected")), "level": d.get("severity", "none"), "what": what, "comfort": comfort,
                       "technical": _tr_technical(d.get("whyDetected", ""), lang), "softeners": [_tr_soft(x, lang) for x in d.get("mitigatingFactors", [])],
                       "confidence": T["conf"].get(d.get("confidence", ""), d.get("confidence", "")), "remedy_planet": planet if d.get("detected") else ""})

    order: List[tuple] = []
    if maha.get("planet"):
        order.append((maha["planet"], T["r_maha"].format(p=pname(maha["planet"], lang))))
    if anta.get("planet") and anta["planet"] != maha.get("planet"):
        order.append((anta["planet"], T["r_antar"].format(p=pname(anta["planet"], lang), end=month_year(anta.get("end"), lang))))
    for row in careful:
        order.append((row["planet"], T["r_pressure"].format(p=pname(row["planet"], lang), means=M5[row["planet"]])))
    for d in doshas:
        if d["remedy_planet"]:
            order.append((d["remedy_planet"], T["r_dosha"].format(dosha=d["plain_name"])))
    seen, cards = set(), []
    for planet, why in order:
        if planet in seen or planet not in REMEDY[lang]:
            continue
        seen.add(planet)
        cards.append(_remedy_card(planet, why, lang))
        if len(cards) == 4:
            break

    # everyday practices from the engine, minus the ones that only repeat a planet card above
    daily = []
    for r in kundali.get("remedies_analysis", []):
        if r.get("category") in ("Mantra / spiritual focus", "Donation / seva", "Weekly observance"):
            continue
        title, why = r.get("title") or "", r.get("why") or ""
        if re.search(r" period alignment$| sub-period adjustment$", title):
            continue
        kind, freq = r.get("category"), r.get("frequency")
        if lang == "hi":
            if title in DAILY_HI:
                title, why = DAILY_HI[title]
            elif title == "Do not overdo the pressure planet":
                pm = re.match(r"^(\w+) is already running hot", why)
                title = "दबाव वाले ग्रह पर ज़्यादा ज़ोर न दें"
                why = f"{pname(pm.group(1), 'hi') if pm else 'दबाव वाला ग्रह'} पहले से तनाव में है, इसलिए सुधार का रास्ता स्थिरता है, अति-क्षतिपूर्ति नहीं।"
            kind, freq = KIND_HI.get(kind, kind), FREQ_HI.get(freq, freq)
        else:
            title, why = plainify(title), plainify(why)
        daily.append({"title": title, "why": why, "when": freq, "kind": kind, "icon": DAILY_ICON.get(r.get("category"), "✦")})

    remedies = {"intro": T["r_intro"], "planets": cards, "daily": daily, "disclaimer": T["r_disclaimer"]}

    maha_house = int((planets.get(maha.get("planet")) or {}).get("house", 1) or 1) if maha else 1
    stable = float(climate.get("stability_score", 0)) >= 65
    climate_summary = T["climate"].format(m=pname(maha.get("planet", ""), lang), a=pname(anta.get("planet", ""), lang), area=AREA[lang][maha_house][0],
                                          state=T["stable"] if stable else T["sensitive"]) if maha else ""
    return {"lang": lang, "snapshot": snapshot, "personality": personality, "areas": areas, "phase": phase, "doshas": doshas, "remedies": remedies,
            "dasha": full, "method": T["method"], "climate_summary": climate_summary,
            "house_themes": HOUSE_THEME_HI if lang == "hi" else {}, "tags": TAGS_HI if lang == "hi" else {}, "dignity": DIGNITY_HI if lang == "hi" else {}}
