/* Pooja Vidhi library + guided step-by-step reader (Pandit Booking page, /pandits/)
 *
 * Data-driven: everything shown comes from two JSON files (see pandit/POOJA_GUIDES.md):
 *   - pooja/guides.json  the guides: preparation, samagri, ordered steps, mantras, sources, review status
 *   - pooja/images.json  the Cloudinary image configuration for every guide
 * Progress (checklist ticks, completed steps, language, text size) is stored only in this browser
 * (localStorage). No accounts, no server storage, no audio, no invented content.
 */
(function () {
  "use strict";

  var section = document.getElementById("pooja");
  var libraryEl = document.getElementById("poojaLibrary");
  var readerEl = document.getElementById("poojaReader");
  if (!section || !libraryEl || !readerEl) return;

  var GUIDES_URL = section.getAttribute("data-guides-url");
  var IMAGES_URL = section.getAttribute("data-images-url");
  var FESTIVALS_URL = section.getAttribute("data-festivals-url");
  var KATHAS_URL = section.getAttribute("data-kathas-url");
  var PREFS_KEY = "psb.pooja.prefs.v1";
  var PROGRESS_KEY = "psb.pooja.progress.v1";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var data = null;        // guides.json
  var images = null;      // images.json
  var fest = null;        // festivals.json (optional)
  var kathas = null;      // kathas.json (optional)
  var tab = "guides";     // library tab: guides | kathas
  var openKatha = null;   // id of the katha being read
  var loading = null;
  var openId = null;      // guide currently open in the reader
  var view = "overview";  // overview | prep | step | done
  var navOpen = false;
  var confirmingReset = false;
  var specularHandles = [];

  /* ------------------------------ storage -------------------------------- */

  function readJson(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key) || "null"); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode etc. */ } }

  var prefs = Object.assign({ lang: "hi", scale: 1 }, readJson(PREFS_KEY, {}));
  var progress = readJson(PROGRESS_KEY, {});

  function savePrefs() { writeJson(PREFS_KEY, prefs); }
  function guideProgress(id) {
    if (!progress[id]) progress[id] = { completed: [], samagri: [], current: null };
    return progress[id];
  }
  function saveProgress() { writeJson(PROGRESS_KEY, progress); }

  /* ------------------------------- helpers -------------------------------- */

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Localised text object {en, hi}. Falls back to the other language if one is missing.
  function tx(obj) {
    if (!obj) return "";
    if (typeof obj === "string") return obj;
    return obj[prefs.lang] || obj.en || obj.hi || "";
  }
  function other(obj) { return obj ? (obj[prefs.lang === "hi" ? "en" : "hi"] || "") : ""; }
  function lines(text) { return esc(text).replace(/\n/g, "<br>"); }

  function guideById(id) { return (data.guides || []).filter(function (g) { return g.id === id; })[0] || null; }

  var UI = {
    hi: {
      read: "पूजा विधि पढ़ें", book: "इस पूजा के लिए पंडित बुक करें", prep: "गाइड की तैयारी", inprep: "गाइड तैयार की जा रही है",
      start: "पूजा गाइड शुरू करें", back: "← सभी गाइड", overview: "सारांश", step: "चरण", of: "में से", prev: "← पिछला", next: "अगला →",
      done: "✓ चरण पूरा हुआ", undo: "चरण पूरा — वापस करें", allsteps: "सभी चरण", whatdo: "क्या करें", materials: "आवश्यक सामग्री",
      mantra: "मन्त्र", sanskrit: "संस्कृत (देवनागरी)", translit: "लिप्यन्तरण (रोमन, IAST)", meaning: "अर्थ", hiMeaning: "हिन्दी अर्थ", enMeaning: "English meaning", aartiLabel: "आरती", alsoIn: "English में भी देखें", lyricsHindi: "आरती के बोल (हिन्दी)", after: "इसके बाद", sources: "स्रोत और टिप्पणियाँ", restart: "गाइड फिर से शुरू करें",
      confirm: "हाँ, फिर से शुरू करें", cancel: "रहने दें", samagri: "सामग्री-सूची", conduct: "पूजा से पहले", essential: "आवश्यक", optional: "वैकल्पिक",
      begin: "चरण 1 शुरू करें", complete: "गाइड पूरी हुई", ready: "तैयार", textsize: "अक्षर का आकार", lang: "भाषा", pending: "अभी उपलब्ध नहीं",
      safety: "सुरक्षा", variation: "परम्परा में भेद", optionalTag: "वैकल्पिक"
    },
    en: {
      read: "Read Pooja Vidhi", book: "Book a Pandit for this Puja", prep: "Preparing this guide", inprep: "Guide in preparation",
      start: "Start Pooja Guide", back: "← All guides", overview: "Overview", step: "Step", of: "of", prev: "← Previous", next: "Next →",
      done: "✓ Mark step complete", undo: "Step complete — undo", allsteps: "All steps", whatdo: "What to do", materials: "Materials needed",
      mantra: "Mantra", sanskrit: "Sanskrit (Devanagari)", translit: "Transliteration (IAST)", meaning: "Meaning", hiMeaning: "हिन्दी अर्थ", enMeaning: "English meaning", aartiLabel: "Aarti", alsoIn: "Also in हिन्दी", lyricsHindi: "Aarti lyrics (Hindi)", after: "After this", sources: "Sources and notes", restart: "Restart guide",
      confirm: "Yes, restart", cancel: "Keep my progress", samagri: "Samagri checklist", conduct: "Before you begin", essential: "Essential", optional: "Optional",
      begin: "Begin Step 1", complete: "Guide complete", ready: "ready", textsize: "Text size", lang: "Language", pending: "Not available yet",
      safety: "Safety", variation: "Variation in practice", optionalTag: "Optional"
    }
  };
  function t(key) { return UI[prefs.lang][key]; }

  /* ----------------------------- Cloudinary ------------------------------- */

  var FALLBACK_ICONS = { other: "psb-i-other", havan: "psb-i-havan", sanskar: "psb-i-baby", vivah: "psb-i-rings", bhoomi: "psb-i-bhoomi", vastu: "psb-i-vastu", navagraha: "psb-i-planets", "griha-pravesh": "psb-i-home" };

  function cldUrl(cfg, width, ratio) {
    var cloud = images.cloudName;
    var crop = ratio ? (cfg.fit === "pad" ? ",ar_" + ratio + ",c_pad,b_rgb:efe6d2" : ",ar_" + ratio + ",c_fill,g_auto") : ",c_limit";
    if (cfg.resourceType === "video") {
      // First frame of a video that already lives in the Cloudinary library.
      return "https://res.cloudinary.com/" + cloud + "/video/upload/so_0" + crop + ",w_" + width + ",q_auto,f_jpg/" + cfg.publicId + ".jpg";
    }
    return "https://res.cloudinary.com/" + cloud + "/image/upload/f_auto,q_auto" + crop + ",w_" + width + "/" + cfg.publicId;
  }

  function imageHtml(guide, opts) {
    var cfg = images && images.images && images.images[guide.id];
    var big = opts && opts.big;
    var cls = "pr-img" + (big ? " pr-img--big" : "");
    if (!cfg || cfg.status !== "supplied" || !cfg.publicId) {
      var icon = FALLBACK_ICONS[guide.id] || "psb-i-lotus";
      return '<div class="' + cls + ' pr-img--placeholder" role="img" aria-label="' + esc(tx(guide.name)) + ' (image coming soon)">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#' + icon + '"/></svg><span>' + esc(cfg && cfg.caption ? cfg.caption : "Image coming soon") + "</span></div>";
    }
    var widths = big ? [640, 960, 1280] : [320, 480, 720];
    var srcset = widths.map(function (w) { return cldUrl(cfg, w, "4:3") + " " + w + "w"; }).join(", ");
    var sizes = big ? "(min-width: 900px) 440px, 92vw" : "(min-width: 960px) 260px, (min-width: 640px) 30vw, 46vw";
    return '<figure class="' + cls + '"><img src="' + esc(cldUrl(cfg, widths[1], "4:3")) + '" srcset="' + esc(srcset) + '" sizes="' + sizes + '" width="' + widths[1] + '" height="' + Math.round(widths[1] * 0.75) +
      '" alt="' + esc(cfg.alt || tx(guide.name)) + '" loading="lazy" decoding="async">' +
      (big && cfg.caption ? "<figcaption>" + esc(cfg.caption) + "</figcaption>" : "") +
      (cfg.license ? '<span class="pr-credit">' + esc(cfg.attribution) + "</span>" : "") + "</figure>";
  }

  /* ------------------------------- loading -------------------------------- */

  function load() {
    if (data && images) return Promise.resolve();
    if (loading) return loading;
    loading = Promise.all([
      fetch(GUIDES_URL, { credentials: "same-origin" }).then(function (r) { if (!r.ok) throw new Error("guides " + r.status); return r.json(); }),
      fetch(IMAGES_URL, { credentials: "same-origin" }).then(function (r) { if (!r.ok) throw new Error("images " + r.status); return r.json(); })
    ]).then(function (res) {
      data = res[0]; images = res[1];
      var opt = function (url) { return url ? fetch(url, { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null); };
      return Promise.all([opt(FESTIVALS_URL), opt(KATHAS_URL)]).then(function (o) { fest = o[0]; kathas = o[1]; });
    }).catch(function (err) { loading = null; throw err; });
    return loading;
  }

  function showError() {
    libraryEl.innerHTML = '<p class="pr-error">We could not load the guides just now. <button type="button" class="pr-link" id="poojaRetry">Try again</button></p>';
    var retry = document.getElementById("poojaRetry");
    if (retry) retry.addEventListener("click", function () { libraryEl.innerHTML = '<p class="psb-loading">Loading the guide library…</p>'; init(); });
  }

  /* ------------------------------- library -------------------------------- */

  function destroySpecular() {
    specularHandles.forEach(function (h) { try { h.destroy(); } catch (e) { /* ignore */ } });
    specularHandles = [];
  }

  function decorate(el, kind) {
    if (!window.PanditBooking || !window.PanditBooking.decorate) return;
    var h = window.PanditBooking.decorate(el, kind);
    if (h) specularHandles.push(h);
  }

  function badge(guide) {
    var r = guide.review || {};
    var cls = r.status === "reviewed-approved" ? "psb-badge--ok" : r.status === "draft-pandit-review-needed" ? "psb-badge--draft" : "psb-badge--prep";
    return '<span class="psb-badge ' + cls + '">' + esc(r.label || "") + "</span>";
  }

  /* --------------------------- coming-up festivals ------------------------- */

  var FEATURE_DAYS = 45;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dayStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function parseDay(str) { var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(str || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function fmtDay(d) { return d.getDate() + " " + MONTHS[d.getMonth()]; }
  function festInfo(f) {
    var start = parseDay(f.date), end = parseDay(f.endDate) || start, today = dayStart(new Date());
    if (!start || end < today) return null;
    var days = Math.max(0, Math.round((start - today) / 86400000));
    var when = fmtDay(start) + (f.endDate && f.endDate !== f.date ? " – " + fmtDay(end) : "");
    var rel = start <= today ? "happening now" : days === 0 ? "today" : days === 1 ? "tomorrow" : "in " + days + " days";
    return { f: f, days: days, when: when, rel: rel };
  }
  var _soon = null;
  function soonList() {
    if (_soon) return _soon;
    var list = [];
    ((fest && fest.festivals) || []).forEach(function (f) {
      var i = festInfo(f);
      if (i && i.days <= FEATURE_DAYS) { i.gs = (f.guides || []).filter(function (g) { return g !== "other"; }); list.push(i); }
    });
    list.sort(function (a, b) { return a.days - b.days; });
    _soon = list;
    return list;
  }
  function soonFor(gid) {
    var l = soonList(), any = null;
    for (var i = 0; i < l.length; i++) {
      if (l[i].gs.indexOf(gid) === -1) continue;
      if (l[i].f.kind === "festival") return l[i];   // a real festival outranks a monthly vrat
      if (!any) any = l[i];
    }
    return any;
  }
  function soonForKatha(k) {
    var best = null;
    (k.guides || []).forEach(function (g) { var x = soonFor(g); if (x && (!best || x.days < best.days)) best = x; });
    soonList().forEach(function (x) {
      if ((k.match || []).some(function (m) { return x.f.id.indexOf(m) === 0; }) && (!best || x.days < best.days)) best = x;
    });
    return best;
  }
  function kathasFor(gid) { return ((kathas && kathas.kathas) || []).filter(function (k) { return (k.guides || []).indexOf(gid) !== -1; }); }
  function kathasForFest(x) {
    return ((kathas && kathas.kathas) || []).filter(function (k) {
      return (k.match || []).some(function (m) { return x.f.id.indexOf(m) === 0; }) || x.gs.some(function (g) { return (k.guides || []).indexOf(g) !== -1; });
    });
  }

  /* ------------------------------ find & filter --------------------------- */

  var CATS = [
    { id: "all", label: "All" },
    { id: "soon", label: "Coming up" },
    { id: "deity", label: "Deity puja" },
    { id: "festival", label: "Festivals" },
    { id: "home", label: "Home & land" },
    { id: "sanskar", label: "Sanskar & family" },
    { id: "fire", label: "Havan" },
    { id: "general", label: "Any puja" }
  ];
  var find = { q: "", cat: "all" };

  function fold(str) {
    return String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\u0900-\u097f ]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function haystack(g) {
    if (g._hay) return g._hay;
    var parts = [g.name.en, g.name.hi, g.deity.en, g.deity.hi, g.summary.en, g.summary.hi, (g.keywords || []).join(" ")];
    var titles = (g.steps || []).map(function (st) { return st.title.en + " " + st.title.hi; });
    g._hay = fold(parts.join(" "));
    g._head = fold([g.name.en, g.name.hi, g.deity.en, (g.keywords || []).join(" ")].join(" "));
    g._steps = titles.map(fold);
    return g._hay;
  }

  function matchGuide(g) {
    if (find.cat === "soon") { if (!soonFor(g.id)) return null; }
    else if (find.cat !== "all" && (g.categories || []).indexOf(find.cat) === -1) return null;
    var tokens = fold(find.q).split(" ").filter(Boolean);
    if (!tokens.length) return { hit: "" };
    haystack(g);
    var hit = "";
    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      if (g._hay.indexOf(tk) !== -1) continue;
      var found = -1;
      for (var k = 0; k < g._steps.length; k++) if (g._steps[k].indexOf(tk) !== -1) { found = k; break; }
      if (found === -1) return null;
      if (!hit) hit = g.steps[found].title.en;
    }
    return { hit: hit };
  }

  function cardHtml(g, m, L) {
    var documented = g.availability === "documented";
    var read = documented
      ? '<button type="button" class="psb-btn psb-btn--navy pr-card__read" data-open="' + esc(g.id) + '">Read Vidhi</button>'
      : '<p class="pr-card__soon" role="note">' + esc(L.inprep) + "</p>";
    var sn = soonFor(g.id), ks = kathasFor(g.id);
    return '<li class="pr-card' + (documented ? " pr-card--doc" : "") + (sn ? " pr-card--soon" : "") + '">' +
      (sn ? '<span class="pr-ribbon">★ ' + esc(sn.f.name.en) + " · " + esc(sn.when) + "</span>" : "") +
      imageHtml(g) +
      '<div class="pr-card__body">' +
      '<h3>' + esc(g.name.en) + (g.name.hi ? ' <span class="pr-hi" lang="hi">' + esc(g.name.hi) + "</span>" : "") + "</h3>" +
      '<p class="pr-card__deity">' + esc(g.deity.en) + "</p>" +
      (m && m.hit ? '<p class="pr-card__hit">Found in step: <strong>' + esc(m.hit) + "</strong></p>" : "") +
      '<p class="pr-card__badges">' + badge(g) + (ks.length ? '<button type="button" class="pr-card__katha" data-katha="' + esc(ks[0].id) + '" aria-label="Read the vrat katha">📖 Katha</button>' : "") + "</p>" +
      '<div class="pr-card__actions">' + read +
      '<button type="button" class="psb-btn psb-btn--line pr-card__book" data-book="' + esc(g.id) + '">Book a Pandit</button></div>' +
      "</div></li>";
  }

  function renderCards() {
    var L = UI.en;
    var out = [];
    var hits = [];
    data.guides.forEach(function (g) { var m = matchGuide(g); if (m) hits.push({ g: g, m: m, s: soonFor(g.id) }); });
    var feat = hits.filter(function (h) { return h.s; }).sort(function (a, b) {
      var fa = a.s.f.kind === "festival" ? 0 : 1, fb = b.s.f.kind === "festival" ? 0 : 1;
      return fa - fb || a.s.days - b.s.days;
    });
    var rest = hits.filter(function (h) { return !h.s; });
    var plain = !find.q && find.cat === "all" && feat.length && rest.length;
    feat.forEach(function (h) { out.push(cardHtml(h.g, h.m, L)); });
    rest.forEach(function (h) { out.push(cardHtml(h.g, h.m, L)); });
    out = out.filter(Boolean);
    var nGuides = hits.length;
    var list = libraryEl.querySelector(".pr-cards");
    list.innerHTML = out.join("");
    var count = libraryEl.querySelector(".pr-find__count");
    count.textContent = nGuides === data.guides.length && !find.q && find.cat === "all" ? data.guides.length + " guides" : nGuides + (nGuides === 1 ? " guide found" : " guides found");
    var empty = libraryEl.querySelector(".pr-empty");
    empty.hidden = nGuides > 0;
    list.hidden = nGuides === 0;
    libraryEl.querySelector(".pr-find__clear").hidden = !find.q;
    $all(".pr-chip[data-cat]", libraryEl).forEach(function (c) {
      var on = c.getAttribute("data-cat") === find.cat;
      c.classList.toggle("is-on", on); c.setAttribute("aria-pressed", on);
    });
  }

  function renderLibrary() {
    // The library page itself is English; the Hindi/English choice applies inside the reader.
    var cats = CATS.filter(function (c) { return c.id !== "soon" || soonList().length; });
    var nk = kathas && kathas.kathas ? kathas.kathas.length : 0;
    libraryEl.innerHTML =
      (nk ? '<div class="pr-tabs" role="tablist" aria-label="Library">' +
        '<button type="button" role="tab" class="pr-tab is-on" data-tab="guides" aria-selected="true">Pooja Vidhi <span>' + data.guides.length + "</span></button>" +
        '<button type="button" role="tab" class="pr-tab" data-tab="kathas" aria-selected="false">Vrat Katha <span>' + nk + "</span></button></div>" : "") +
      '<div class="pr-find" role="search">' +
      '<label class="pr-find__box"><span class="sr-only">Search pooja vidhi</span>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true" class="pr-find__ico"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>' +
      '<input type="search" class="pr-find__input" placeholder="Search a pooja, deity or step (e.g. Chhath, Ganesh, कलश, havan)" autocomplete="off" enterkeyhint="search" maxlength="60">' +
      '<button type="button" class="pr-find__clear" aria-label="Clear search" hidden>&times;</button></label>' +
      '<div class="pr-find__chips" role="group" aria-label="Filter by kind of puja">' +
      cats.map(function (c) { return '<button type="button" class="pr-chip" data-cat="' + c.id + '" aria-pressed="false">' + esc(c.label) + "</button>"; }).join("") +
      "</div>" +
      '<p class="pr-find__count" aria-live="polite"></p></div>' +
      '<ul class="pr-cards"></ul>' +
      '<ul class="pr-cards pr-kcards" hidden></ul>' +
      '<div class="pr-empty" hidden><p><strong>No guide matches that yet.</strong></p><p>Try another word, or choose &ldquo;Any puja&rdquo; for a general guide. You can also ask us to arrange a pandit for this puja.</p>' +
      '<button type="button" class="psb-btn psb-btn--navy" data-book="other">Ask about this puja</button></div>';
    var input = libraryEl.querySelector(".pr-find__input");
    var timer = null;
    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { find.q = input.value; renderActive(); }, 120);
    });
    libraryEl.querySelector(".pr-find__clear").addEventListener("click", function () { input.value = ""; find.q = ""; renderActive(); input.focus(); });
    libraryEl.addEventListener("click", function (e) {
      var tb = e.target.closest("[data-tab]"); if (!tb) return;
      setTab(tb.getAttribute("data-tab"));
    });
    libraryEl.querySelector(".pr-find__chips").addEventListener("click", function (e) {
      var c = e.target.closest("[data-cat]"); if (!c) return;
      find.cat = c.getAttribute("data-cat"); renderCards();
    });
    tab = "guides";
    renderCards();
  }

  /* ------------------------------ katha library ---------------------------- */

  function renderActive() { if (tab === "kathas") renderKathas(); else renderCards(); }

  function setTab(t) {
    tab = t;
    $all(".pr-tab", libraryEl).forEach(function (b) { var on = b.getAttribute("data-tab") === t; b.classList.toggle("is-on", on); b.setAttribute("aria-selected", on); });
    var isK = t === "kathas";
    libraryEl.querySelector(".pr-find__chips").hidden = isK;
    libraryEl.querySelector(".pr-cards:not(.pr-kcards)").hidden = isK;
    libraryEl.querySelector(".pr-kcards").hidden = !isK;
    libraryEl.querySelector(".pr-find__input").placeholder = isK ? "Search a katha (e.g. Satyanarayan, छठ, कार्तिक)" : "Search a pooja, deity or step (e.g. Chhath, Ganesh, कलश, havan)";
    renderActive();
  }

  function kathaHay(k) {
    if (!k._hay) k._hay = fold([k.title.en, k.title.hi, (k.festivalName && k.festivalName.en) || "", (k.festivalName && k.festivalName.hi) || "", (k.keywords || []).join(" "), (k.paragraphs || []).join(" ")].join(" "));
    return k._hay;
  }
  function kathaCard(k) {
    var sn = soonForKatha(k);
    var g0 = (k.guides || []).filter(function (id) { var g = guideById(id); return g && g.availability === "documented"; })[0];
    return '<li class="pr-card pr-card--katha' + (sn ? " pr-card--soon" : "") + '" data-sort="' + (sn ? sn.days : 999) + '">' +
      (sn ? '<span class="pr-ribbon">★ ' + esc(sn.f.name.en) + " · " + esc(sn.when) + "</span>" : "") +
      '<div class="pr-katha__cover" aria-hidden="true"><span>📖</span></div>' +
      '<div class="pr-card__body"><h3>' + esc(k.title.en) + (k.title.hi ? ' <span class="pr-hi" lang="hi">' + esc(k.title.hi) + "</span>" : "") + "</h3>" +
      '<p class="pr-card__deity">' + esc((k.festivalName && k.festivalName.en) || "") + " · " + esc(k.language || "Hindi") + (k.pdf && k.pdf.pages ? " · " + k.pdf.pages + " pp" : "") + "</p>" +
      '<p class="pr-card__badges"><span class="psb-badge psb-badge--draft">Not pandit-reviewed</span></p>' +
      '<div class="pr-card__actions"><button type="button" class="psb-btn psb-btn--navy" data-katha="' + esc(k.id) + '">Read Katha</button>' +
      (g0 ? '<button type="button" class="psb-btn psb-btn--line" data-open="' + esc(g0) + '">Pooja Vidhi</button>' : (k.pdf && k.pdf.file ? '<a class="psb-btn psb-btn--line" href="' + esc(fileUrl(k)) + '" target="_blank" rel="noopener">Open PDF</a>' : "")) +
      "</div></div></li>";
  }
  function renderKathas() {
    var tokens = fold(find.q).split(" ").filter(Boolean);
    var hits = ((kathas && kathas.kathas) || []).filter(function (k) { var h = kathaHay(k); return tokens.every(function (t) { return h.indexOf(t) !== -1; }); });
    var cards = hits.map(kathaCard).sort(function (a, b) { return Number(/data-sort="(\d+)"/.exec(a)[1]) - Number(/data-sort="(\d+)"/.exec(b)[1]); });
    libraryEl.querySelector(".pr-kcards").innerHTML = cards.join("");
    libraryEl.querySelector(".pr-find__count").textContent = hits.length + (hits.length === 1 ? " katha" : " kathas") + (find.q ? " found" : "");
    libraryEl.querySelector(".pr-find__clear").hidden = !find.q;
    var empty = libraryEl.querySelector(".pr-empty"); empty.hidden = hits.length > 0;
    libraryEl.querySelector(".pr-kcards").hidden = hits.length === 0;
  }
  function fileUrl(k) { return GUIDES_URL.replace(/[^/]*$/, "").replace(/\?.*$/, "") + k.pdf.file; }
  function pdfPages(k) {
    var cloud = images.cloudName, out = "";
    for (var n = 1; n <= k.pdf.pages; n++) {
      var base = "https://res.cloudinary.com/" + cloud + "/image/upload/pg_" + n + ",f_auto,q_auto,";
      out += '<img class="pr-pdf__page" loading="lazy" decoding="async" width="900" height="1273" alt="' + esc(k.title.en) + " — page " + n + '" src="' + base + 'w_900/' + k.pdf.publicId + '.jpg" srcset="' + base + "w_600/" + k.pdf.publicId + ".jpg 600w, " + base + "w_900/" + k.pdf.publicId + ".jpg 900w, " + base + "w_1400/" + k.pdf.publicId + '.jpg 1400w" sizes="(min-width: 900px) 800px, 94vw">';
    }
    return out;
  }
  function katha(id) { return ((kathas && kathas.kathas) || []).filter(function (k) { return k.id === id; })[0] || null; }
  function hl(text, q) {
    var out = esc(text);
    fold(q).split(" ").filter(function (x) { return x.length > 1; }).forEach(function (tk) {
      var re = new RegExp("(" + tk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      out = out.replace(re, "<mark>$1</mark>");
    });
    return out;
  }
  function viewKatha(k) {
    var guides = (k.guides || []).filter(function (id) { var g = guideById(id); return g && g.availability === "documented"; });
    var sn = soonForKatha(k);
    return '<div class="pr-toolbar"><button type="button" class="pr-link" data-kact="back">← All kathas</button>' +
      '<div class="pr-tools" role="group" aria-label="Reading options"><span class="pr-tools__label">' + esc(t("textsize")) + "</span>" +
      '<button type="button" class="pr-chip" data-size="-1" aria-label="Smaller text">A−</button><button type="button" class="pr-chip" data-size="1" aria-label="Larger text">A+</button>' +
      '<span class="pr-tools__scale" data-scale-label aria-live="polite"></span></div></div>' +
      '<article class="pr-katha"><h3 data-focus>' + esc(k.title.en) + (k.title.hi ? ' <span class="pr-hi" lang="hi">' + esc(k.title.hi) + "</span>" : "") + "</h3>" +
      '<p class="pr-card__deity">' + esc((k.festivalName && k.festivalName.en) || "") + " · " + esc(k.language || "Hindi") + "</p>" +
      (sn ? '<p class="pr-callout">★ ' + esc(sn.f.name.en) + " is " + esc(sn.rel) + " (" + esc(sn.when) + ").</p>" : "") +
      '<p class="pr-review"><span class="psb-badge psb-badge--draft">Not reviewed by a pandit</span> <span>' + esc((k.review && k.review.note) || "Text taken from the free source below. Versions of this katha differ between families and regions.") + "</span></p>" +
      '<div class="pr-cta">' +
      (k.pdf && k.pdf.file ? '<a class="psb-btn psb-btn--navy" href="' + esc(fileUrl(k)) + '" target="_blank" rel="noopener">Open PDF</a><a class="psb-btn psb-btn--line" href="' + esc(fileUrl(k)) + '" download="' + esc(k.id) + '-katha.pdf">Download PDF</a>' : "") +
      (guides.length ? '<button type="button" class="psb-btn psb-btn--line" data-open="' + esc(guides[0]) + '">Pooja vidhi for this festival</button>' : "") +
      "</div>" +
      (k.pdf && k.pdf.publicId && k.pdf.pages ? '<div class="pr-kview" role="tablist" aria-label="How to read"><button type="button" role="tab" class="pr-kview__b is-on" data-kview="text" aria-selected="true">Read as text</button><button type="button" role="tab" class="pr-kview__b" data-kview="pdf" aria-selected="false">View PDF (' + k.pdf.pages + ' pages)</button></div>' : "") +
      '<div class="pr-katha__text" lang="hi">' + (k.paragraphs || []).map(function (ptxt) { return "<p>" + hl(ptxt, find.q) + "</p>"; }).join("") + "</div>" +
      '<div class="pr-pdf" data-kpane="pdf" hidden></div>' +
      '<section class="pr-panel"><h4>Source and licence</h4><p class="pr-small">' + esc(k.sourceName || "") + (k.sourceUrl ? ' — <a href="' + esc(k.sourceUrl) + '" target="_blank" rel="noopener">source page</a>' : "") +
      "<br>" + esc(k.license || "") + (k.licenseNote ? " — " + esc(k.licenseNote) : "") + "</p></section>" +
      '<button type="button" class="psb-btn psb-btn--line" data-book="' + esc((k.guides || ["other"])[0]) + '">' + esc(UI.en.book) + "</button></article>";
  }
  function openKathaView(id) {
    var k = katha(id); if (!k) return;
    openKatha = k.id; openId = null;
    libraryEl.hidden = true;
    section.querySelector(".psb-legend").hidden = true;
    readerEl.hidden = false;
    readerEl.innerHTML = viewKatha(k);
    readerEl.setAttribute("data-view", "katha");
    applyScale();
    scrollToReader();
  }

  /* ------------------------------- reader --------------------------------- */

  function stepsOf(g) { return g.steps || []; }
  function stepIndex(g, id) { var s = stepsOf(g); for (var i = 0; i < s.length; i++) if (s[i].id === id) return i; return -1; }
  function samagriName(g, id) {
    var list = (g.preparation && g.preparation.samagri) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function open(id, startView) {
    var g = guideById(id);
    if (!g || g.availability !== "documented") return;
    openId = id; openKatha = null;
    var p = guideProgress(id);
    view = startView || "overview";
    if (view === "overview" && p.current && p.current !== "overview" && p.completed.length) view = "overview";
    confirmingReset = false;
    libraryEl.hidden = true;
    section.querySelector(".psb-legend").hidden = true;
    readerEl.hidden = false;
    renderReader();
    scrollToReader();
  }

  function scrollToReader() {
    var top = readerEl.getBoundingClientRect().top + window.pageYOffset - 84;
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
    focusHeading();
  }

  function focusHeading() {
    var h = readerEl.querySelector("[data-focus]");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }

  function close() {
    destroySpecular();
    openId = null;
    openKatha = null;
    readerEl.hidden = true;
    readerEl.innerHTML = "";
    libraryEl.hidden = false;
    section.querySelector(".psb-legend").hidden = false;
    if (window.PanditBooking) window.PanditBooking.setReturnLink(null);
    var top = section.getBoundingClientRect().top + window.pageYOffset - 84;
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
  }

  function bookFor(g) {
    var B = window.PanditBooking;
    if (!B) return;
    B.selectPuja(g.name.en);
    B.setReturnLink("Back to the " + g.name.en + " guide", function () {
      if (openId !== g.id) { open(g.id, view === "step" ? "step" : "overview"); return; }
      scrollToReader();
    });
  }

  function toolbar(g) {
    return '<div class="pr-toolbar">' +
      '<button type="button" class="pr-link" data-act="back">' + esc(t("back")) + "</button>" +
      '<div class="pr-tools" role="group" aria-label="Reading options">' +
      '<span class="pr-tools__label">' + esc(t("lang")) + '</span>' +
      '<button type="button" class="pr-chip' + (prefs.lang === "hi" ? " is-on" : "") + '" data-lang="hi" lang="hi" aria-pressed="' + (prefs.lang === "hi") + '">हिन्दी</button>' +
      '<button type="button" class="pr-chip' + (prefs.lang === "en" ? " is-on" : "") + '" data-lang="en" aria-pressed="' + (prefs.lang === "en") + '">English</button>' +
      '<span class="pr-tools__label">' + esc(t("textsize")) + '</span>' +
      '<button type="button" class="pr-chip" data-size="-1" aria-label="Smaller text">A−</button>' +
      '<button type="button" class="pr-chip" data-size="1" aria-label="Larger text">A+</button>' +
      '<span class="pr-tools__scale" data-scale-label aria-live="polite"></span>' +
      "</div></div>";
  }

  function reviewNote(g) {
    var r = g.review || {};
    return '<p class="pr-review">' + badge(g) + " <span>" + esc(r.note || "") + "</span></p>";
  }

  function viewOverview(g) {
    var p = guideProgress(g.id);
    var total = stepsOf(g).length;
    var resume = p.completed.length > 0 || (p.current && p.current !== "overview");
    var items = (g.preparation.samagri || []).map(function (s) {
      return "<li>" + esc(tx(s.name)) + (s.essential ? "" : ' <em class="pr-opt">(' + esc(t("optional")) + ")</em>") + "</li>";
    }).join("");
    var sources = (g.sources || []).map(function (sid) {
      var s = (g.sourceMap && g.sourceMap[sid]) || data.sources[sid]; if (!s) return "";
      var title = s.url ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + "</a>" : esc(s.title);
      return "<li>" + title + (s.publisher ? " — " + esc(s.publisher) : "") + (s.note ? '<span class="pr-srcnote"> ' + esc(s.note) + "</span>" : "") + "</li>";
    }).join("");
    return toolbar(g) +
      '<article class="pr-overview">' +
      '<div class="pr-overview__media">' + imageHtml(g, { big: true }) + "</div>" +
      '<div class="pr-overview__text">' +
      '<h3 data-focus>' + esc(g.name.en) + ' <span class="pr-hi" lang="hi">' + esc(g.name.hi) + "</span></h3>" +
      '<p class="pr-card__deity">' + esc(tx(g.deity)) + "</p>" +
      reviewNote(g) +
      "<p>" + esc(tx(g.summary)) + "</p>" +
      '<dl class="pr-facts">' +
      (g.tradition && tx(g.tradition) ? "<div><dt>Tradition</dt><dd>" + esc(tx(g.tradition)) + "</dd></div>" : "") +
      "<div><dt>Steps</dt><dd>" + total + "</dd></div>" +
      "<div><dt>Duration</dt><dd>" + esc(g.duration ? (typeof g.duration === "string" ? g.duration : tx(g.duration)) : "Not stated by the source") + "</dd></div>" +
      "</dl>" +
      (g.variation ? '<p class="pr-callout pr-callout--var"><strong>' + esc(t("variation")) + ".</strong> " + esc(tx(g.variation)) + "</p>" : "") +
      (g.havanNote ? '<p class="pr-callout"><strong>Havan.</strong> ' + esc(tx(g.havanNote)) + "</p>" : "") +
      '<div class="pr-cta">' +
      '<button type="button" class="psb-cta psb-cta--dark" data-act="start" data-specular="dark">' + esc(resume ? "Continue the guide" : t("start")) + "</button>" +
      '<button type="button" class="psb-btn psb-btn--line" data-act="book">' + esc(t("book")) + "</button>" +
      (kathasFor(g.id).length ? '<button type="button" class="psb-btn psb-btn--line" data-katha="' + esc(kathasFor(g.id)[0].id) + '">📖 Read the vrat katha</button>' : "") +
      "</div>" +
      (resume ? '<p class="pr-resume">' + p.completed.length + " / " + total + " steps completed on this device.</p>" : "") +
      "</div></article>" +
      '<div class="pr-twocol">' +
      '<section class="pr-panel"><h4>Samagri at a glance</h4><ul class="pr-list">' + items + '</ul><p class="pr-small">' + esc(tx(g.preparation.substitution)) + "</p></section>" +
      '<section class="pr-panel"><h4>Sources</h4><ul class="pr-list pr-list--src">' + sources + "</ul></section>" +
      "</div>";
  }

  function viewPrep(g) {
    var p = guideProgress(g.id);
    var samagri = g.preparation.samagri || [];
    var ready = samagri.filter(function (s) { return p.samagri.indexOf(s.id) !== -1; }).length;
    var conduct = (g.preparation.conduct || []).map(function (c) { return "<li>" + esc(tx(c)) + "</li>"; }).join("");
    var boxes = samagri.map(function (s) {
      var on = p.samagri.indexOf(s.id) !== -1;
      return '<li><label class="pr-check"><input type="checkbox" data-samagri="' + esc(s.id) + '"' + (on ? " checked" : "") + '><span>' +
        '<strong>' + esc(tx(s.name)) + "</strong>" +
        '<em class="' + (s.essential ? "pr-tag" : "pr-tag pr-tag--opt") + '">' + esc(s.essential ? t("essential") : t("optional")) + "</em>" +
        (s.note ? '<small>' + esc(tx(s.note)) + "</small>" : "") + "</span></label></li>";
    }).join("");
    return toolbar(g) +
      '<div class="pr-prep">' +
      '<h3 data-focus>' + esc(t("prep")) + " — " + esc(g.name.en) + "</h3>" +
      reviewNote(g) +
      (conduct ? '<section class="pr-panel"><h4>' + esc(t("conduct")) + '</h4><ul class="pr-list">' + conduct + '</ul><p class="pr-small">' + esc(tx(g.preparation.conductNote)) + "</p></section>"
        : '<p class="pr-small">' + esc(prefs.lang === "hi" ? "पहला चरण घर और पूजा-स्थान की सफाई से शुरू होता है। पहले नीचे की सामग्री इकट्ठी कर लें।" : "Step 1 begins with cleaning the house and the puja place. First gather the items below.") + "</p>") +
      '<section class="pr-panel"><h4>' + esc(t("samagri")) + ' <span class="pr-count" id="prCount">' + ready + " / " + samagri.length + " " + esc(t("ready")) + '</span></h4>' +
      '<ul class="pr-checklist">' + boxes + '</ul><p class="pr-small">' + esc(tx(g.preparation.substitution)) + "</p></section>" +
      '<div class="pr-actions">' +
      '<button type="button" class="psb-btn psb-btn--line" data-act="overview">' + esc(t("overview")) + "</button>" +
      '<button type="button" class="psb-btn psb-btn--navy" data-act="begin">' + esc(t("begin")) + "</button></div>" +
      "</div>";
  }

  function navList(g) {
    var p = guideProgress(g.id);
    var cur = p.current;
    var html = "";
    var group = null;
    stepsOf(g).forEach(function (s, i) {
      if (s.group !== group) {
        group = s.group;
        html += '<li class="pr-nav__group">' + esc(tx((g.groups && g.groups[group]) || data.groups[group])) + "</li>";
      }
      var done = p.completed.indexOf(s.id) !== -1;
      html += '<li><button type="button" class="pr-nav__item' + (s.id === cur && view === "step" ? " is-current" : "") + (done ? " is-done" : "") + '" data-goto="' + esc(s.id) + '">' +
        '<span class="pr-nav__n" aria-hidden="true">' + (done ? "✓" : i + 1) + "</span><span>" + esc(tx(s.title)) + (s.optional ? ' <em class="pr-opt">(' + esc(t("optionalTag")) + ")</em>" : "") + "</span>" +
        (done ? '<span class="pr-sr"> (completed)</span>' : "") + "</button></li>";
    });
    return html;
  }

  // Every mantra is shown in all four forms at once: Sanskrit (Devanagari), transliteration, Hindi meaning, English meaning.
  function mantraHtml(m) {
    var hi = m.meaning && m.meaning.hi, en = m.meaning && m.meaning.en;
    return '<figure class="pr-mantra' + (m.optional ? " pr-mantra--opt" : "") + '">' +
      (m.optional ? '<span class="pr-tag pr-tag--opt">' + esc(t("optionalTag")) + "</span>" : "") +
      '<div class="pr-lang"><span class="pr-label">' + esc(t("sanskrit")) + '</span><blockquote class="pr-deva" lang="sa">' + lines(m.devanagari) + "</blockquote></div>" +
      '<div class="pr-lang"><span class="pr-label">' + esc(t("translit")) + '</span><p class="pr-translit" lang="sa-Latn">' + lines(m.transliteration) + "</p></div>" +
      '<div class="pr-meanings">' +
      (hi ? '<div><span class="pr-label">' + esc(t("hiMeaning")) + '</span><p class="pr-meaning" lang="hi">' + esc(hi) + "</p></div>" : "") +
      (en ? '<div><span class="pr-label">' + esc(t("enMeaning")) + '</span><p class="pr-meaning" lang="en">' + esc(en) + "</p></div>" : "") +
      "</div>" +
      (m.note ? '<p class="pr-small">' + esc(m.note) + "</p>" : "") + "</figure>";
  }

  function aartiHtml(a) {
    var hi = a.meaning && a.meaning.hi, en = a.meaning && a.meaning.en;
    return '<figure class="pr-mantra pr-aarti">' +
      '<figcaption class="pr-aarti__title">🪔 ' + esc(tx(a.title)) + "</figcaption>" +
      '<div class="pr-lang"><span class="pr-label">' + esc(t("lyricsHindi")) + '</span><blockquote class="pr-deva pr-deva--aarti" lang="hi">' + lines(a.lyrics) + "</blockquote></div>" +
      '<div class="pr-lang"><span class="pr-label">' + esc(t("translit")) + '</span><p class="pr-translit" lang="hi-Latn">' + lines(a.transliteration) + "</p></div>" +
      '<div class="pr-meanings">' +
      (hi ? '<div><span class="pr-label">' + esc(t("hiMeaning")) + '</span><p class="pr-meaning" lang="hi">' + esc(hi) + "</p></div>" : "") +
      (en ? '<div><span class="pr-label">' + esc(t("enMeaning")) + '</span><p class="pr-meaning" lang="en">' + esc(en) + "</p></div>" : "") +
      "</div></figure>";
  }

  function viewStep(g) {
    var steps = stepsOf(g);
    var p = guideProgress(g.id);
    var i = stepIndex(g, p.current);
    if (i < 0) { i = 0; p.current = steps[0].id; }
    var s = steps[i];
    var done = p.completed.indexOf(s.id) !== -1;
    var pct = Math.round((p.completed.length / steps.length) * 100);
    var mats = (s.materials || []).map(function (id) {
      var m = samagriName(g, id); if (!m) return "";
      var on = p.samagri.indexOf(id) !== -1;
      return '<li><label class="pr-check pr-check--small"><input type="checkbox" data-samagri="' + esc(id) + '"' + (on ? " checked" : "") + "><span>" + esc(tx(m.name)) + "</span></label></li>";
    }).join("");
    var srcs = (s.sources || []).map(function (c) {
      var src = (g.sourceMap && g.sourceMap[c.source]) || data.sources[c.source] || {};
      var title = src.url ? '<a href="' + esc(src.url) + '" target="_blank" rel="noopener">' + esc(src.title) + "</a>" : esc(src.title || c.source);
      return "<li>" + title + (c.cite ? " — " + esc(c.cite) : "") + "</li>";
    }).join("");
    var noMantra = !(s.mantras && s.mantras.length) && !s.aarti;
    var last = i === steps.length - 1;
    return toolbar(g) +
      '<div class="pr-stage">' +
      '<nav class="pr-nav" aria-label="Steps of ' + esc(g.name.en) + '">' +
      '<button type="button" class="pr-nav__toggle" data-act="togglenav" aria-expanded="' + navOpen + '" aria-controls="prNavList">' + esc(t("allsteps")) + " (" + steps.length + ')<span aria-hidden="true">' + (navOpen ? " ▴" : " ▾") + "</span></button>" +
      '<ol class="pr-nav__list' + (navOpen ? " is-open" : "") + '" id="prNavList">' + navList(g) + "</ol></nav>" +
      '<article class="pr-step">' +
      '<div class="pr-progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + steps.length + '" aria-valuenow="' + p.completed.length + '" aria-label="Steps completed"><span style="width:' + pct + '%"></span></div>' +
      '<p class="pr-steplabel" aria-live="polite">' + esc(tx((g.groups && g.groups[s.group]) || data.groups[s.group])) + " · " + esc(t("step")) + " " + (i + 1) + " " + esc(t("of")) + " " + steps.length + (done ? " · ✓" : "") + "</p>" +
      '<h3 data-focus>' + esc(tx(s.title)) + (s.optional ? ' <em class="pr-opt">(' + esc(t("optionalTag")) + ")</em>" : "") + "</h3>" +
      '<section class="pr-block"><h4>' + esc(t("whatdo")) + "</h4><p lang=\"" + prefs.lang + "\">" + esc(tx(s.do)) + "</p>" +
        (other(s.do) ? '<details class="pr-alt"><summary>' + esc(t("alsoIn")) + '</summary><p lang="' + (prefs.lang === "hi" ? "en" : "hi") + '">' + esc(other(s.do)) + "</p></details>" : "") + "</section>" +
      (mats ? '<section class="pr-block"><h4>' + esc(t("materials")) + '</h4><ul class="pr-checklist pr-checklist--inline">' + mats + "</ul></section>" : "") +
      (s.pending ? '<p class="pr-callout pr-callout--pending"><strong>' + esc(t("pending")) + ".</strong> " + esc(tx(s.pending)) + "</p>" : "") +
      (!noMantra ? '<section class="pr-block">' + ((s.mantras && s.mantras.length) ? "<h4>" + esc(t("mantra")) + "</h4>" + s.mantras.map(mantraHtml).join("") : "") + (s.aarti ? "<h4>" + esc(t("aartiLabel")) + "</h4>" + aartiHtml(s.aarti) : "") + "</section>" :
        (!s.pending ? '<p class="pr-small pr-nomantra">No mantra is prescribed for this step in the source.</p>' : "")) +
      (s.after ? '<section class="pr-block"><h4>' + esc(t("after")) + "</h4><p>" + esc(tx(s.after)) + "</p></section>" : "") +
      (s.safety ? '<p class="pr-callout pr-callout--safety"><strong>' + esc(t("safety")) + ".</strong> " + esc(tx(s.safety)).replace(/^(Safety|सुरक्षा)[^:]*:\s*/, "") + "</p>" : "") +
      ((s.notes || []).length ? '<ul class="pr-notes">' + s.notes.map(function (n) { return "<li>" + esc(tx(n)) + "</li>"; }).join("") + "</ul>" : "") +
      (s.variation ? '<p class="pr-callout pr-callout--var"><strong>' + esc(t("variation")) + ".</strong> " + esc(tx(s.variation)) + "</p>" : "") +
      '<details class="pr-sources"><summary>' + esc(t("sources")) + '</summary><ul class="pr-list pr-list--src">' + srcs + "</ul>" +
      '<p class="pr-small">' + esc((g.review && g.review.label) || "") + ": " + esc((g.review && g.review.note) || "") + "</p></details>" +
      '<div class="pr-controls">' +
      '<button type="button" class="psb-btn psb-btn--line" data-act="prev"' + (i === 0 ? ' disabled aria-disabled="true"' : "") + ">" + esc(t("prev")) + "</button>" +
      '<button type="button" class="psb-btn ' + (done ? "psb-btn--wa" : "psb-btn--navy") + '" data-act="toggle" aria-pressed="' + done + '">' + esc(done ? t("undo") : t("done")) + "</button>" +
      '<button type="button" class="psb-btn psb-btn--navy" data-act="next">' + esc(last ? t("complete") : t("next")) + "</button></div>" +
      '<div class="pr-foot"><button type="button" class="pr-link" data-act="book">' + esc(t("book")) + "</button>" +
      (confirmingReset
        ? '<span class="pr-confirm" role="alertdialog" aria-label="Confirm restart"><span>Clear all progress for this guide?</span> <button type="button" class="pr-link pr-link--danger" data-act="reset-yes">' + esc(t("confirm")) + '</button> <button type="button" class="pr-link" data-act="reset-no">' + esc(t("cancel")) + "</button></span>"
        : '<button type="button" class="pr-link" data-act="reset">' + esc(t("restart")) + "</button>") +
      "</div></article></div>";
  }

  function viewDone(g) {
    var p = guideProgress(g.id);
    var total = stepsOf(g).length;
    return toolbar(g) +
      '<div class="pr-end">' +
      '<h3 data-focus>' + esc(t("complete")) + " — " + esc(g.name.en) + "</h3>" +
      "<p>" + p.completed.length + " / " + total + " steps marked complete on this device.</p>" +
      reviewNote(g) +
      '<p>If you would like a pandit to conduct this puja, send an enquiry. Opening WhatsApp is not a booking: the booking is confirmed only after we speak and agree.</p>' +
      '<div class="pr-cta">' +
      '<button type="button" class="psb-cta psb-cta--dark" data-act="book" data-specular="dark">' + esc(t("book")) + "</button>" +
      '<button type="button" class="psb-btn psb-btn--line" data-act="review">' + esc(t("overview")) + "</button>" +
      '<button type="button" class="psb-btn psb-btn--line" data-act="back">' + esc(t("back")) + "</button></div></div>";
  }

  function renderReader(keepFocus) {
    var g = guideById(openId);
    if (!g) return;
    destroySpecular();
    var body = view === "prep" ? viewPrep(g) : view === "step" ? viewStep(g) : view === "done" ? viewDone(g) : viewOverview(g);
    readerEl.innerHTML = body;
    readerEl.setAttribute("data-view", view);
    applyScale();
    $all("[data-specular]", readerEl).forEach(function (el) { decorate(el); });
    if (!keepFocus) focusHeading();
  }

  function applyScale() {
    readerEl.style.setProperty("--pr-scale", prefs.scale);
    var small = $all('[data-size="-1"]', readerEl)[0], big = $all('[data-size="1"]', readerEl)[0];
    if (small) small.disabled = prefs.scale <= 0.9;
    if (big) big.disabled = prefs.scale >= 1.7;
    var lab = readerEl.querySelector("[data-scale-label]");
    if (lab) lab.textContent = Math.round(prefs.scale * 100) + "%";
  }

  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function go(stepId) {
    var g = guideById(openId);
    var p = guideProgress(g.id);
    p.current = stepId;
    saveProgress();
    view = "step";
    navOpen = false;
    confirmingReset = false;
    renderReader();
    var top = readerEl.getBoundingClientRect().top + window.pageYOffset - 84;
    if (readerEl.getBoundingClientRect().top < 0) window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
  }

  function move(delta) {
    var g = guideById(openId);
    var steps = stepsOf(g);
    var p = guideProgress(g.id);
    var i = stepIndex(g, p.current);
    var n = i + delta;
    if (n < 0) { view = "prep"; renderReader(); return; }
    if (n >= steps.length) { view = "done"; renderReader(); return; }
    go(steps[n].id);
  }

  /* ----------------------------- interactions ----------------------------- */

  readerEl.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act], [data-goto], [data-lang], [data-size], [data-kact], [data-kview], [data-open], [data-book], [data-katha]");
    if (!el) return;
    if (el.hasAttribute("data-katha")) { openKathaView(el.getAttribute("data-katha")); return; }
    if (el.hasAttribute("data-kact")) { close(); return; }
    if (el.hasAttribute("data-kview") && openKatha) {
      var kv = el.getAttribute("data-kview"), kk2 = katha(openKatha);
      $all(".pr-kview__b", readerEl).forEach(function (b) { var on = b === el; b.classList.toggle("is-on", on); b.setAttribute("aria-selected", on); });
      var tx2 = readerEl.querySelector(".pr-katha__text"), pane = readerEl.querySelector("[data-kpane=pdf]");
      if (kv === "pdf" && !pane.firstChild) pane.innerHTML = '<div class="pr-pdf__pages">' + pdfPages(kk2) + '</div>';
      tx2.hidden = kv === "pdf"; pane.hidden = kv !== "pdf";
      return;
    }
    if (el.hasAttribute("data-open") && openKatha) { open(el.getAttribute("data-open")); return; }
    if (el.hasAttribute("data-book") && openKatha) {
      var bg = guideById(el.getAttribute("data-book")); var kk = katha(openKatha);
      if (bg && window.PanditBooking) { window.PanditBooking.selectPuja(bg.name.en); window.PanditBooking.setReturnLink("Back to the katha", function () { openKathaView(kk.id); }); }
      return;
    }
    if (el.hasAttribute("data-size") && openKatha && !openId) {
      prefs.scale = Math.max(0.9, Math.min(1.7, Math.round((prefs.scale + Number(el.getAttribute("data-size")) * 0.15) * 100) / 100));
      savePrefs(); applyScale(); return;
    }
    if (!openId) return;
    var g = guideById(openId);
    var p = guideProgress(g.id);

    if (el.hasAttribute("data-lang")) { prefs.lang = el.getAttribute("data-lang"); savePrefs(); renderReader(true); return; }
    if (el.hasAttribute("data-size")) {
      prefs.scale = Math.max(0.9, Math.min(1.7, Math.round((prefs.scale + Number(el.getAttribute("data-size")) * 0.15) * 100) / 100));
      savePrefs();
      applyScale();
      return;
    }
    if (el.hasAttribute("data-goto")) { go(el.getAttribute("data-goto")); return; }

    switch (el.getAttribute("data-act")) {
      case "back": close(); break;
      case "overview":
      case "review": view = "overview"; renderReader(); break;
      case "start":
        if (p.current && p.current !== "overview" && p.completed.length) { view = "step"; renderReader(); }
        else { view = "prep"; renderReader(); }
        break;
      case "begin": go(stepsOf(g)[0].id); break;
      case "prev": move(-1); break;
      case "next": move(1); break;
      case "toggle": {
        var cur = p.current;
        var k = p.completed.indexOf(cur);
        if (k === -1) p.completed.push(cur); else p.completed.splice(k, 1);
        saveProgress();
        renderReader(true);
        break;
      }
      case "togglenav": navOpen = !navOpen; renderReader(true); break;
      case "book": bookFor(g); break;
      case "reset": confirmingReset = true; renderReader(true); break;
      case "reset-no": confirmingReset = false; renderReader(true); break;
      case "reset-yes":
        progress[g.id] = { completed: [], samagri: [], current: null };
        saveProgress();
        confirmingReset = false;
        view = "overview";
        renderReader();
        break;
    }
  });

  readerEl.addEventListener("change", function (e) {
    var box = e.target;
    if (!box || !box.hasAttribute || !box.hasAttribute("data-samagri") || !openId) return;
    var g = guideById(openId);
    var p = guideProgress(g.id);
    var id = box.getAttribute("data-samagri");
    var k = p.samagri.indexOf(id);
    if (box.checked && k === -1) p.samagri.push(id);
    if (!box.checked && k !== -1) p.samagri.splice(k, 1);
    saveProgress();
    // keep every copy of this checkbox in sync (preparation list and the per-step list)
    $all('input[data-samagri="' + id + '"]', readerEl).forEach(function (b) { b.checked = box.checked; });
    var count = document.getElementById("prCount");
    if (count) {
      var total = (g.preparation.samagri || []).length;
      var ready = (g.preparation.samagri || []).filter(function (s) { return p.samagri.indexOf(s.id) !== -1; }).length;
      count.textContent = ready + " / " + total + " " + t("ready");
    }
  });

  // Arrow keys move between steps (never while typing or while a control other than the reader has focus).
  readerEl.addEventListener("keydown", function (e) {
    if (view !== "step" || e.altKey || e.ctrlKey || e.metaKey) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || tag === "summary") return;
    if (e.key === "ArrowRight") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
  });

  libraryEl.addEventListener("click", function (e) {
    var kt = e.target.closest("[data-katha]");
    if (kt) { openKathaView(kt.getAttribute("data-katha")); return; }
    var o = e.target.closest("[data-open]");
    if (o) { open(o.getAttribute("data-open")); return; }
    var b = e.target.closest("[data-book]");
    if (b && window.PanditBooking) {
      var g = guideById(b.getAttribute("data-book"));
      if (g) { window.PanditBooking.selectPuja(g.name.en); window.PanditBooking.setReturnLink("Back to the Pooja Vidhi guides", function () {
        var top = section.getBoundingClientRect().top + window.pageYOffset - 84;
        window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
      }); }
    }
  });

  /* --------------------------------- boot --------------------------------- */

  function init() {
    load().then(function () {
      renderLibrary();
      document.dispatchEvent(new CustomEvent("psb:pooja-ready"));
    }).catch(showError);
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { io.disconnect(); init(); }
    }, { rootMargin: "900px 0px" });
    io.observe(section);
  } else {
    init();
  }

  // Explicit user intent (the hero "Explore Pooja Vidhi" button) loads immediately.
  var explore = document.getElementById("psbHeroExplore");
  if (explore) explore.addEventListener("click", function () { init(); });

  window.PoojaVidhi = { open: function (id) { return load().then(function () { if (!libraryEl.querySelector(".pr-cards")) renderLibrary(); open(id); }); } };
})();
