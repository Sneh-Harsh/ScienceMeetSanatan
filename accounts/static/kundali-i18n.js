/* Kundali: one place for every on-page word in English and Hindi.
   Elements carry data-i18n="key" (text), data-i18n-html, data-i18n-ph (placeholder) or data-i18n-aria; KI.t() serves scripts. */
(function () {
  "use strict";

  var STR = {
    en: {
      pill: "Vedic astrology · free",
      title_html: "Your Janma Kundali,<br><em>beautifully decoded.</em>",
      lede: "Enter your birth details and see your birth chart, planets, dasha timeline and doshas in seconds. Clear, interactive and in English or हिंदी.",
      feat1: "North & South chart", feat1s: "D1 Rashi + D9 Navamsa", feat2: "Nakshatra & Dasha", feat2s: "Vimshottari timeline", feat3: "Doshas & remedies", feat3s: "Plain-language guidance",
      step1: "Birth details", step2: "Your chart", step3: "Dasha & doshas",
      note: "Lahiri ayanamsha · whole-sign houses · computed with Swiss Ephemeris",
      form_title: "Birth details", form_hint: "The exact time matters: the ascendant changes about every two hours.",
      dob: "Date of birth", tob: "Time of birth (24h)", place: "Place of birth", place_ph: "Search city, town or village", place_hint: "Type your birthplace and pick it from the list.", tz: "Timezone",
      use_current: "Use current location", today: "Today", horoscope: "See Horoscope", generate: "Generate my Kundali", loading: "Calibrating your destiny map…",
      d1: "D1 (Rashi)", d9: "D9 (Navamsa)", north: "North Indian", south: "South Indian", footer: "Made with devotion", lang_label: "Language",
      app_chart: "Chart", app_reading: "Reading", app_life: "Life", app_dasha: "Dasha", app_dosha: "Doshas", app_remedies: "Remedies", app_planets: "Planets", app_sky: "Sky",
      sections: "Kundali sections", scroll_l: "Scroll left", scroll_r: "Scroll right",
      /* page script */
      raashi: "Moon sign", place_lbl: "Place", tz_lbl: "Timezone", active_cycle: "Active Cycle", aligning: "Aligning", location_syncing: "Location syncing",
      phase_kicker: "Past / Present / Next Shift", phase_title: "Timing transition", fading: "Fading", active: "Active", next: "Next",
      next_window: "Next major transition window begins around {d}.", phase_empty: "Generate the chart to reveal the timing shift panel.",
      climate_kicker: "Planetary Climate", climate_title: "Support vs pressure now", chart_stability: "Chart stability", period_sensitivity: "Period sensitivity",
      supporting: "Supporting planets", pressurizing: "Pressurizing planets", climate_empty: "Generate the chart to inspect current support and pressure.",
      heat_title: "House Focus Map", heat_empty: "Generate the chart to reveal which houses are most activated now.",
      ruler: "Ruler", support: "Support", pressure: "Pressure", dignity_neutral: "Neutral", no_planets_found: "No planets found.",
      legend_support: "Support", legend_pressure: "Pressure", legend_selected: "Selected",
      d1_title: "D1 · Rashi", d9_title: "D9 · Navamsa", north_title: "North Indian", south_title: "South Indian",
      err_dt: "Please enter date and time of birth.", err_place: "Please search for your place of birth.", hint_search_first: "Search for your place of birth first.",
      no_match_list: "No matching place found. Try a nearby city.", no_match: "No match. Try the nearest big city.", pick_place: "Pick your birthplace from the list.", searching: "Searching…",
      place_failed: "Place search failed.", no_geo: "Your browser can't share its location. Search for your place instead.", locating: "Locating…", finding_loc: "Finding your location…",
      finding_name: "Finding your place name…", geo_denied: "Location permission was blocked. Search for your place instead.", geo_fail: "Couldn't get your location. Search for your place instead.",
      /* reading */
      about_you: "About you", your_strengths: "Your strengths", things_watch: "Things to watch", good_to_know: "Good to know", right_now: "Right now in your life",
      main_period: "Main period (Mahadasha)", sub_period: "Sub-period (Antardasha)", pct_done: "{n}% complete", watch_out: "Watch out for:", how_affects: "How the {p} sub-period affects you",
      next_big: "Next big change:", gives_way: "{a} period gives way to {b} around {d}.", full_timeline: "Full timeline with every sub-period is in the Dasha tab.",
      areas_note: "Each card looks at one part of life using the planets in your chart. The dial shows how well supported that area is: left side needs care, right side is strong.",
      what_helps: "What helps", what_watch: "What to watch", dasha_intro: "Your life moves through planetary chapters called Mahadashas (the Vimshottari system, based on your Moon). Each one is divided into smaller Antardashas. Tap a chapter to open it, then tap a sub-period for what it means for you.",
      running_now: "Running now", maha_main: "Mahadasha (main period)", antar_sub: "Antardasha (sub-period)", maha_progress: "Mahadasha progress", antar_progress: "Antardasha progress",
      now: "now", completed: "Completed", upcoming: "Upcoming", sub_periods_title: "Sub-periods (Antardashas) and what each means for you", good_for: "Good for",
      method_title: "How this is worked out", ages: "Ages {a}-{b}",
      dosha_intro: "A dosha is a pattern that traditional astrology watches for. Finding one is common and is not a prediction of bad luck. Strong supporting planets and good periods reduce its effect.",
      found: "This was found in your chart.", not_found: "This was not found in your chart.", for_ref: "For reference:", softens: "What softens it in your chart", technical: "Technical detail", confidence: "confidence",
      lvl_mild: "Mild", lvl_medium: "Moderate", lvl_strong: "Strong", lvl_present: "Present", lvl_none: "Not found",
      rem_planets: "Planet remedies for you", rem_daily: "Everyday practices", support_planet: "Support your {p}", mantra: "Mantra", best_day: "Best day", day_note: "(a simple fast or light meal is traditional)",
      worship: "Worship", give: "Give (daan)", habit: "Daily habit", gemstone: "Gemstone", gem_text: "Traditionally linked to this planet, {note}. Please do not buy one without an astrologer checking your full chart.",
      how_often: "How often", book_pandit: "Book a pandit for Graha Shanti", talk_astro: "Talk to an astrologer",
      /* chart */
      key_title_d1: "Rashi (D1) key", key_title_d9: "Navamsa (D9) key", key_rising: "Rising sign", key_numbers: "Numbers in the chart are zodiac signs (1 = Aries … 12 = Pisces).",
      lagna_tag: "LAGNA", asc: "Asc", house_word: "house", planets_word: "Planets", no_planets: "No planets", rising_word: "RISING", chart_aria_n: "North Indian birth chart", chart_aria_s: "South Indian birth chart",
      /* sky */
      you: "YOU", auto_turn: "⟳ Auto-turn", reset_view: "⌖ Reset view", sky_hint: "Drag to turn the sky · tap a planet", sky_aria: "Interactive sky map: each planet at its position on the zodiac ring around the Earth. Drag to rotate.", house_n: "House {n}",
    },
    hi: {
      pill: "वैदिक ज्योतिष · मुफ़्त",
      title_html: "आपकी जन्म कुंडली,<br><em>सरल भाषा में।</em>",
      lede: "अपनी जन्म की जानकारी भरें और कुछ ही पल में जन्म कुंडली, ग्रह, दशा की समय-रेखा और दोष देखें। साफ़, इंटरैक्टिव और हिंदी या English में।",
      feat1: "उत्तर और दक्षिण भारतीय कुंडली", feat1s: "D1 राशि + D9 नवांश", feat2: "नक्षत्र और दशा", feat2s: "विंशोत्तरी समय-रेखा", feat3: "दोष और उपाय", feat3s: "सरल भाषा में मार्गदर्शन",
      step1: "जन्म विवरण", step2: "आपकी कुंडली", step3: "दशा और दोष",
      note: "लाहिरी अयनांश · संपूर्ण राशि भाव · स्विस एफ़ेमेरिस से गणना",
      form_title: "जन्म विवरण", form_hint: "सटीक समय ज़रूरी है: लग्न लगभग हर दो घंटे में बदल जाता है।",
      dob: "जन्म तिथि", tob: "जन्म समय (24 घंटे)", place: "जन्म स्थान", place_ph: "शहर, कस्बा या गाँव खोजें", place_hint: "अपना जन्म स्थान लिखें और सूची से चुनें।", tz: "समय क्षेत्र",
      use_current: "मौजूदा स्थान उपयोग करें", today: "आज", horoscope: "राशिफल देखें", generate: "मेरी कुंडली बनाएँ", loading: "आपका भाग्य-मानचित्र तैयार हो रहा है…",
      d1: "D1 (राशि)", d9: "D9 (नवांश)", north: "उत्तर भारतीय", south: "दक्षिण भारतीय", footer: "श्रद्धा से बनाया गया", lang_label: "भाषा",
      app_chart: "कुंडली", app_reading: "फलादेश", app_life: "जीवन", app_dasha: "दशा", app_dosha: "दोष", app_remedies: "उपाय", app_planets: "ग्रह", app_sky: "आकाश",
      sections: "कुंडली के भाग", scroll_l: "बाएँ खिसकाएँ", scroll_r: "दाएँ खिसकाएँ",
      raashi: "चंद्र राशि", place_lbl: "स्थान", tz_lbl: "समय क्षेत्र", active_cycle: "चल रहा चक्र", aligning: "संरेखित हो रहा है", location_syncing: "स्थान समन्वयित हो रहा है",
      phase_kicker: "अतीत / वर्तमान / अगला बदलाव", phase_title: "समय का बदलाव", fading: "समाप्त हो रही", active: "चल रही", next: "अगली",
      next_window: "अगला बड़ा बदलाव लगभग {d} से शुरू होगा।", phase_empty: "समय-बदलाव देखने के लिए कुंडली बनाएँ।",
      climate_kicker: "ग्रहों का माहौल", climate_title: "अभी सहारा बनाम दबाव", chart_stability: "कुंडली की स्थिरता", period_sensitivity: "दशा की संवेदनशीलता",
      supporting: "सहारा देने वाले ग्रह", pressurizing: "दबाव डालने वाले ग्रह", climate_empty: "अभी का सहारा और दबाव देखने के लिए कुंडली बनाएँ।",
      heat_title: "भाव फोकस मानचित्र", heat_empty: "कौन-से भाव अभी सबसे सक्रिय हैं, यह देखने के लिए कुंडली बनाएँ।",
      ruler: "स्वामी", support: "सहारा", pressure: "दबाव", dignity_neutral: "सम", no_planets_found: "कोई ग्रह नहीं मिला।",
      legend_support: "सहारा", legend_pressure: "दबाव", legend_selected: "चुना हुआ",
      d1_title: "D1 · राशि", d9_title: "D9 · नवांश", north_title: "उत्तर भारतीय", south_title: "दक्षिण भारतीय",
      err_dt: "कृपया जन्म की तिथि और समय भरें।", err_place: "कृपया अपना जन्म स्थान खोजें।", hint_search_first: "पहले अपना जन्म स्थान खोजें।",
      no_match_list: "कोई मिलता-जुलता स्थान नहीं मिला। पास का शहर आज़माएँ।", no_match: "कोई मेल नहीं मिला। सबसे नज़दीकी बड़ा शहर आज़माएँ।", pick_place: "सूची से अपना जन्म स्थान चुनें।", searching: "खोज रहे हैं…",
      place_failed: "स्थान की खोज नहीं हो सकी।", no_geo: "आपका ब्राउज़र अपना स्थान साझा नहीं कर सकता। इसके बजाय अपना स्थान खोजें।", locating: "स्थान खोज रहे हैं…", finding_loc: "आपका स्थान ढूँढ रहे हैं…",
      finding_name: "आपके स्थान का नाम ढूँढ रहे हैं…", geo_denied: "स्थान की अनुमति रोकी गई है। इसके बजाय अपना स्थान खोजें।", geo_fail: "आपका स्थान नहीं मिल सका। इसके बजाय अपना स्थान खोजें।",
      about_you: "आपके बारे में", your_strengths: "आपकी ताक़तें", things_watch: "ध्यान देने की बातें", good_to_know: "जानने लायक", right_now: "अभी आपके जीवन में",
      main_period: "मुख्य अवधि (महादशा)", sub_period: "उप-अवधि (अंतर्दशा)", pct_done: "{n}% पूरी", watch_out: "सावधान रहें:", how_affects: "{p} अंतर्दशा आप पर कैसे असर डालती है",
      next_big: "अगला बड़ा बदलाव:", gives_way: "{a} की अवधि लगभग {d} को {b} को जगह देती है।", full_timeline: "हर अंतर्दशा के साथ पूरी समय-रेखा दशा टैब में है।",
      areas_note: "हर कार्ड आपकी कुंडली के ग्रहों से जीवन के एक हिस्से को देखता है। डायल बताता है कि वह क्षेत्र कितना सहारा पा रहा है: बायाँ हिस्सा ध्यान माँगता है, दायाँ मज़बूत है।",
      what_helps: "क्या मदद करता है", what_watch: "किस पर नज़र रखें", dasha_intro: "आपका जीवन महादशाओं नामक ग्रह-अध्यायों से गुज़रता है (विंशोत्तरी पद्धति, आपके चंद्रमा पर आधारित)। हर एक छोटी अंतर्दशाओं में बँटी है। किसी अध्याय को खोलने के लिए टैप करें, फिर किसी उप-अवधि पर टैप करके देखें कि उसका आपके लिए क्या मतलब है।",
      running_now: "अभी चल रही", maha_main: "महादशा (मुख्य अवधि)", antar_sub: "अंतर्दशा (उप-अवधि)", maha_progress: "महादशा की प्रगति", antar_progress: "अंतर्दशा की प्रगति",
      now: "अभी", completed: "पूरी हुई", upcoming: "आने वाली", sub_periods_title: "उप-अवधियाँ (अंतर्दशाएँ) और हर एक का आपके लिए मतलब", good_for: "इनके लिए अच्छा",
      method_title: "यह कैसे निकाला गया", ages: "आयु {a}-{b}",
      dosha_intro: "दोष वह पैटर्न है जिस पर पारंपरिक ज्योतिष नज़र रखता है। इसका मिलना आम बात है और यह बुरी किस्मत की भविष्यवाणी नहीं है। मज़बूत सहायक ग्रह और अच्छे दौर इसका असर घटाते हैं।",
      found: "यह आपकी कुंडली में मिला।", not_found: "यह आपकी कुंडली में नहीं मिला।", for_ref: "संदर्भ के लिए:", softens: "आपकी कुंडली में इसे क्या हल्का करता है", technical: "तकनीकी विवरण", confidence: "विश्वसनीयता",
      lvl_mild: "हल्का", lvl_medium: "मध्यम", lvl_strong: "तीव्र", lvl_present: "मौजूद", lvl_none: "नहीं मिला",
      rem_planets: "आपके लिए ग्रह-उपाय", rem_daily: "रोज़ के अभ्यास", support_planet: "अपने {p} को सहारा दें", mantra: "मंत्र", best_day: "सबसे अच्छा दिन", day_note: "(हल्का उपवास या सादा भोजन परंपरागत है)",
      worship: "उपासना", give: "दान", habit: "रोज़ की आदत", gemstone: "रत्न", gem_text: "यह परंपरागत रूप से इस ग्रह से जुड़ा है, {note}। कृपया ज्योतिषी से अपनी पूरी कुंडली देखे बिना इसे न खरीदें।",
      how_often: "कितनी बार", book_pandit: "ग्रह शांति के लिए पंडित बुक करें", talk_astro: "ज्योतिषी से बात करें",
      key_title_d1: "राशि (D1) की कुंजी", key_title_d9: "नवांश (D9) की कुंजी", key_rising: "लग्न", key_numbers: "चार्ट में लिखे अंक राशियाँ हैं (1 = मेष … 12 = मीन)।",
      lagna_tag: "लग्न", asc: "लग्न", house_word: "भाव", planets_word: "ग्रह", no_planets: "कोई ग्रह नहीं", rising_word: "लग्न", chart_aria_n: "उत्तर भारतीय जन्म कुंडली", chart_aria_s: "दक्षिण भारतीय जन्म कुंडली",
      you: "आप", auto_turn: "⟳ अपने-आप घुमाएँ", reset_view: "⌖ दृश्य रीसेट", sky_hint: "आकाश घुमाने के लिए खींचें · ग्रह पर टैप करें", sky_aria: "इंटरैक्टिव आकाश-मानचित्र: पृथ्वी के चारों ओर राशि-चक्र पर हर ग्रह अपनी स्थिति में। घुमाने के लिए खींचें।", house_n: "भाव {n}",
    },
  };

  var NAK_HI = { "Ashwini": "अश्विनी", "Bharani": "भरणी", "Krittika": "कृत्तिका", "Rohini": "रोहिणी", "Mrigashira": "मृगशिरा", "Ardra": "आर्द्रा", "Punarvasu": "पुनर्वसु", "Pushya": "पुष्य", "Ashlesha": "आश्लेषा", "Magha": "मघा", "Purva Phalguni": "पूर्वा फाल्गुनी", "Uttara Phalguni": "उत्तरा फाल्गुनी", "Hasta": "हस्त", "Chitra": "चित्रा", "Swati": "स्वाति", "Vishakha": "विशाखा", "Anuradha": "अनुराधा", "Jyeshtha": "ज्येष्ठा", "Mula": "मूल", "Purva Ashadha": "पूर्वाषाढ़ा", "Uttara Ashadha": "उत्तराषाढ़ा", "Shravana": "श्रवण", "Dhanishta": "धनिष्ठा", "Shatabhisha": "शतभिषा", "Purva Bhadrapada": "पूर्वभाद्रपद", "Uttara Bhadrapada": "उत्तरभाद्रपद", "Revati": "रेवती" };
  var ORD_HI = { 1: "पहला", 2: "दूसरा", 3: "तीसरा", 4: "चौथा", 5: "पाँचवाँ", 6: "छठा", 7: "सातवाँ", 8: "आठवाँ", 9: "नौवाँ", 10: "दसवाँ", 11: "ग्यारहवाँ", 12: "बारहवाँ" };
  var AREA = {
    en: { 1: "self and personality", 2: "money and family", 3: "courage and effort", 4: "home and peace of mind", 5: "learning, children and creativity", 6: "daily work and health", 7: "marriage and partnerships", 8: "sudden changes and research", 9: "luck and guidance", 10: "career and reputation", 11: "gains and friends", 12: "rest, expenses and foreign lands" },
    hi: { 1: "स्वयं और व्यक्तित्व", 2: "धन और परिवार", 3: "साहस और प्रयास", 4: "घर और मन की शांति", 5: "शिक्षा, संतान और रचनात्मकता", 6: "दैनिक कार्य और स्वास्थ्य", 7: "विवाह और साझेदारी", 8: "अचानक बदलाव और शोध", 9: "भाग्य और मार्गदर्शन", 10: "करियर और प्रतिष्ठा", 11: "लाभ और मित्र", 12: "आराम, खर्च और विदेश" },
  };
  var SIGN_ABBR = {
    en: { Mesha: "Ari", Vrishabha: "Tau", Mithuna: "Gem", Karka: "Can", Simha: "Leo", Kanya: "Vir", Tula: "Lib", Vrischika: "Sco", Dhanu: "Sag", Makara: "Cap", Kumbha: "Aqu", Meena: "Pis" },
    hi: { Mesha: "मेष", Vrishabha: "वृष", Mithuna: "मिथु", Karka: "कर्क", Simha: "सिंह", Kanya: "कन्या", Tula: "तुला", Vrischika: "वृश्", Dhanu: "धनु", Makara: "मकर", Kumbha: "कुंभ", Meena: "मीन" },
  };
  var PLANET_ABBR = {
    en: { Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me", Jupiter: "Ju", Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke" },
    hi: { Sun: "सू", Moon: "चं", Mars: "मं", Mercury: "बु", Jupiter: "गु", Venus: "शु", Saturn: "श", Rahu: "रा", Ketu: "के" },
  };
  var PLANET_NAME_HI = { Sun: "सूर्य", Moon: "चंद्र", Mars: "मंगल", Mercury: "बुध", Jupiter: "गुरु", Venus: "शुक्र", Saturn: "शनि", Rahu: "राहु", Ketu: "केतु" };
  var SIGN_NAME_HI = { Mesha: "मेष", Vrishabha: "वृषभ", Mithuna: "मिथुन", Karka: "कर्क", Simha: "सिंह", Kanya: "कन्या", Tula: "तुला", Vrischika: "वृश्चिक", Dhanu: "धनु", Makara: "मकर", Kumbha: "कुंभ", Meena: "मीन" };
  var SIGN_NAME_EN = { Mesha: "Aries", Vrishabha: "Taurus", Mithuna: "Gemini", Karka: "Cancer", Simha: "Leo", Kanya: "Virgo", Tula: "Libra", Vrischika: "Scorpio", Dhanu: "Sagittarius", Makara: "Capricorn", Kumbha: "Aquarius", Meena: "Pisces" };
  var DIGNITY_HI = { "Own sign": "स्वराशि", "Friendly": "मित्र राशि", "Neutral": "सम", "Exalted": "उच्च", "Debilitated": "नीच", "Enemy": "शत्रु राशि", "Moolatrikona": "मूलत्रिकोण", "Navamsa view": "नवांश दृश्य" };
  var TAG_HI = { "occupied": "ग्रह उपस्थित", "empty but aspected": "खाली पर दृष्ट", "benefic influence": "शुभ प्रभाव", "malefic pressure": "पाप प्रभाव का दबाव", "mixed results": "मिश्रित फल", "quiet": "शांत" };

  function lang() {
    try { if (typeof kundaliState !== "undefined" && kundaliState.lang) return kundaliState.lang === "hi" ? "hi" : "en"; } catch (e) { /* not ready */ }
    try { return localStorage.getItem("sms_kundali_lang") === "hi" ? "hi" : "en"; } catch (e) { return "en"; }
  }
  function t(key, vars) {
    var l = lang(), s = (STR[l] && STR[l][key]);
    if (s == null) s = STR.en[key];
    if (s == null) return key;
    return vars ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; }) : s;
  }
  function ord(n) {
    n = Number(n);
    if (lang() === "hi") return ORD_HI[n] || String(n);
    return n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
  }

  function apply() {
    var l = lang();
    document.documentElement.setAttribute("lang", l === "hi" ? "hi" : "en");
    document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) { el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph"))); });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) { el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria"))); });
    document.querySelectorAll("[data-kx-only]").forEach(function (el) { el.hidden = el.getAttribute("data-kx-only") !== l; });
    document.querySelectorAll("[data-kx-lang-btn]").forEach(function (b) {
      var on = b.getAttribute("data-kx-lang-btn") === l;
      b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  window.KI = {
    t: t, lang: lang, apply: apply, ord: ord, STR: STR,
    area: function (n) { return AREA[lang()][n] || ""; },
    signAbbr: function (s) { return (SIGN_ABBR[lang()] || SIGN_ABBR.en)[s] || ""; },
    planetAbbr: function (p) { return (PLANET_ABBR[lang()] || PLANET_ABBR.en)[p] || String(p).slice(0, 2); },
    planet: function (p) { return lang() === "hi" ? (PLANET_NAME_HI[p] || p) : p; },
    signName: function (s) { return lang() === "hi" ? (SIGN_NAME_HI[s] || s) : (SIGN_NAME_EN[s] || s); },
    nak: function (n) { return lang() === "hi" ? (NAK_HI[n] || n) : n; },
    dignity: function (d) { return lang() === "hi" ? (DIGNITY_HI[d] || d) : d; },
    tag: function (g) { return lang() === "hi" ? (TAG_HI[g] || g) : g; },
    date: function (iso, withDay) {
      var d = new Date(iso); if (isNaN(d)) return "-";
      var loc = lang() === "hi" ? "hi-IN" : "en-IN";
      return d.toLocaleDateString(loc, withDay ? { day: "numeric", month: "short", year: "numeric" } : { month: "short", year: "numeric" });
    },
  };
})();
