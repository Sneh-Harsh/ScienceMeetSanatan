// Shared by the library and the reader: one small store in localStorage (progress, favourites, collections, highlights, notes,
// reading preferences) and the book-cover builder. Everything lives on the reader's device, so it works logged out too.
(function () {
  var KEY = "sms-kl-v1";
  var DEFAULTS = { progress: {}, favorites: [], want: [], collections: [], notes: {}, prefs: {}, recent: [], finished: [], days: [] };
  var listeners = [];
  var state = load();

  function parse(raw, fallback) { try { var v = JSON.parse(raw); return v == null ? fallback : v; } catch (e) { return fallback; } }
  function load() {
    var s = {};
    try { s = parse(localStorage.getItem(KEY), {}); } catch (e) { s = {}; }
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = s && s[k] != null ? s[k] : JSON.parse(JSON.stringify(DEFAULTS[k])); });
    if (!s || !s.migrated) migrate(out);
    return out;
  }
  // bring over what the previous library remembered, once
  function migrate(out) {
    try {
      parse(localStorage.getItem("sms-library-progress"), []).forEach(function (e) {
        if (e && e.slug && !out.progress[e.slug]) out.progress[e.slug] = { pct: Math.round(Number(e.progress) || 0), at: e.lastReadAt || new Date().toISOString() };
      });
      parse(localStorage.getItem("sms-library-bookmarks"), []).forEach(function (e) { if (e && e.slug && out.favorites.indexOf(e.slug) < 0) out.favorites.push(e.slug); });
      parse(localStorage.getItem("sms-library-recent"), []).forEach(function (e) { if (e && e.slug && out.recent.indexOf(e.slug) < 0) out.recent.push(e.slug); });
    } catch (e) { /* storage unavailable */ }
    out.migrated = true;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: keep in memory */ }
    listeners.forEach(function (fn) { try { fn(state); } catch (e) { /* a listener must not break saving */ } });
  }
  function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }

  var store = {
    get: function () { return state; },
    on: function (fn) { listeners.push(fn); },
    update: function (fn) { fn(state); save(); },
    pref: function (k, d) { var v = state.prefs[k]; return v == null ? d : v; },
    setPref: function (k, v) { state.prefs[k] = v; save(); },
    progress: function (slug) { return state.progress[slug] || null; },
    touch: function (slug, patch) {
      var cur = state.progress[slug] || {};
      state.progress[slug] = Object.assign({}, cur, patch, { at: new Date().toISOString() });
      if (patch && patch.pct >= 99.5) { state.progress[slug].finished = true; if (state.finished.indexOf(slug) < 0) state.finished.push(slug); }
      state.recent = [slug].concat(state.recent.filter(function (s) { return s !== slug; })).slice(0, 30);
      var today = new Date().toISOString().slice(0, 10);
      if (patch && patch.pct != null && state.days[state.days.length - 1] !== today) state.days = state.days.concat(today).slice(-120);
      save();
    },
    markFinished: function (slug, on) {
      var cur = state.progress[slug] || {};
      state.progress[slug] = Object.assign({}, cur, { finished: !!on, pct: on ? 100 : (cur.pct >= 99.5 ? 0 : cur.pct || 0), at: new Date().toISOString() });
      state.finished = state.finished.filter(function (s) { return s !== slug; });
      if (on) state.finished.push(slug);
      save();
    },
    status: function (slug) {
      var p = state.progress[slug];
      if (!p) return "unread";
      if (p.finished || p.pct >= 99.5) return "finished";
      return p.pct > 0 ? "reading" : "unread";
    },
    isFav: function (slug) { return state.favorites.indexOf(slug) >= 0; },
    toggleFav: function (slug) {
      var i = state.favorites.indexOf(slug);
      if (i >= 0) state.favorites.splice(i, 1); else state.favorites.unshift(slug);
      save(); return i < 0;
    },
    isWant: function (slug) { return state.want.indexOf(slug) >= 0; },
    toggleWant: function (slug) {
      var i = state.want.indexOf(slug);
      if (i >= 0) state.want.splice(i, 1); else state.want.unshift(slug);
      save(); return i < 0;
    },
    createCollection: function (name) {
      var c = { id: uid(), name: String(name || "").trim().slice(0, 40) || "New collection", slugs: [] };
      state.collections.push(c); save(); return c;
    },
    renameCollection: function (id, name) { var c = state.collections.find(function (x) { return x.id === id; }); if (c) { c.name = String(name).trim().slice(0, 40) || c.name; save(); } },
    deleteCollection: function (id) { state.collections = state.collections.filter(function (x) { return x.id !== id; }); save(); },
    inCollection: function (id, slug) { var c = state.collections.find(function (x) { return x.id === id; }); return !!(c && c.slugs.indexOf(slug) >= 0); },
    toggleInCollection: function (id, slug) {
      var c = state.collections.find(function (x) { return x.id === id; }); if (!c) return;
      var i = c.slugs.indexOf(slug); if (i >= 0) c.slugs.splice(i, 1); else c.slugs.unshift(slug);
      save();
    },
    notesOf: function (slug) { return (state.notes[slug] || []).slice(); },
    addNote: function (slug, note) {
      var n = Object.assign({ id: uid(), at: new Date().toISOString() }, note);
      (state.notes[slug] = state.notes[slug] || []).push(n); save(); return n;
    },
    updateNote: function (slug, id, patch) {
      var n = (state.notes[slug] || []).find(function (x) { return x.id === id; });
      if (n) { Object.assign(n, patch); save(); } return n;
    },
    removeNote: function (slug, id) { state.notes[slug] = (state.notes[slug] || []).filter(function (x) { return x.id !== id; }); save(); },
    allNotes: function () {
      var out = [];
      Object.keys(state.notes).forEach(function (slug) { state.notes[slug].forEach(function (n) { out.push(Object.assign({ slug: slug }, n)); }); });
      return out.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    },
    // consecutive days with some reading, counting today or yesterday as the latest
    streak: function () {
      var d = new Date(), n = 0, set = {};
      state.days.forEach(function (x) { set[x] = 1; });
      if (!set[d.toISOString().slice(0, 10)]) d.setDate(d.getDate() - 1);
      while (set[d.toISOString().slice(0, 10)]) { n++; d.setDate(d.getDate() - 1); }
      return n;
    },
    uid: uid
  };

  // ---- covers -------------------------------------------------------------------------------------------------------------------
  var ART = {};
  try { ART = JSON.parse(document.getElementById("klArt").textContent) || {}; } catch (e) { ART = {}; }
  // [pattern, key, leather colour, darker shade, foil emblem]: the leather colour follows the deity, the emblem is stamped in gold
  var RULES = [
    [/ganesh|vinayak|siddhi/i, "ganesha", "#8d2f10", "#4a1606", "om"],
    [/shiv|mahadev|rudra|rigveda|shankar/i, "shiva", "#1b2150", "#0a0d26", "trishul"],
    [/krishna|govind|gopal|murari|achyut|keshav|gita|geeta/i, "krishna", "#12395e", "#071a30", "flute"],
    [/hanuman|bajrang/i, "hanuman", "#85300a", "#421403", "mace"],
    [/durga|devi|shakti|kali|mantra/i, "durga", "#661320", "#330810", "lotus"],
    [/\bram\b|rama|raghu|ramayan|ramcharit|mangal bhavan/i, "rama", "#7d4515", "#3f2008", "bow"],
    [/vishnu|narayan|hari\b|hari-|bhagwat|bhagavat/i, "vishnu", "#0e3160", "#06172e", "chakra"],
    [/veda|upanishad|surya|savitr/i, "sunrise", "#6e5016", "#35260a", "sun"],
    [/puran|purana/i, "glow", "#40204f", "#1d0d27", "lotus"]
  ];
  function artFor(item) {
    var hay = [item.name, item.deity, (item.deity_tags || []).join(" "), item.category, item.slug].join(" ");
    for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(hay)) return { key: RULES[i][1], c1: RULES[i][2], c2: RULES[i][3], emb: RULES[i][4], url: ART[RULES[i][1]] || "" };
    return { key: "glow", c1: "#3c1c4a", c2: "#1a0b24", emb: "om", url: ART.glow || "" };
  }
  var TYPE_LABEL = { Aartis: "Aarti", Bhajans: "Bhajan", Books: "Scripture", Mantras: "Mantra", Chalisas: "Chalisa", Vedas: "Veda", Upanishads: "Upanishad", "Sacred Hymns": "Hymn" };
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  // gold-foil emblems, drawn as fine line art so they read as stamped, not as cartoons
  var EMB = {
    trishul: '<path d="M32 6v52M18 14c0 14 28 14 28 0M18 14V8M46 14V8M32 6l-4 6h8z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 40h12M27 46h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    flute: '<path d="M8 50 56 20" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><circle cx="24" cy="41" r="1.4" fill="currentColor"/><circle cx="31" cy="37" r="1.4" fill="currentColor"/><circle cx="38" cy="33" r="1.4" fill="currentColor"/><path d="M20 12c9 4 12 14 6 22-6 8-14 6-12-4 1-7 5-13 6-18z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="21.5" cy="26" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/>',
    mace: '<path d="M44 14 14 52" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><circle cx="46" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M46 5v-3M57 16h3M54 8l2-2M54 24l2 2M38 8l-2-2M38 24l-2 2M46 27v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M42 12c3-3 7-1 8 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
    bow: '<path d="M18 6c28 8 28 44 0 52" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M18 6v52" stroke="currentColor" stroke-width="1.4"/><path d="M8 32h46M54 32l-7-5M54 32l-7 5M8 32l-4-4M8 32l-4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    lotus: '<path d="M32 50C22 46 14 36 18 24c6 3 11 9 14 26zM32 50c10-4 18-14 14-26-6 3-11 9-14 26zM32 50C26 40 24 26 32 12c8 14 6 28 0 38z" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"/><path d="M14 54c10 4 26 4 36 0" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/>',
    chakra: '<circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="32" cy="32" r="6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M32 12v14M32 38v14M12 32h14M38 32h14M18 18l10 10M36 36l10 10M46 18 36 28M28 36 18 46" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M32 6l3 5h-6zM32 58l3-5h-6zM6 32l5-3v6zM58 32l-5-3v6z" fill="currentColor"/>',
    sun: '<circle cx="32" cy="32" r="10" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M32 6v10M32 48v10M6 32h10M48 32h10M14 14l7 7M43 43l7 7M50 14l-7 7M21 43l-7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'
  };
  function emblem(kind) {
    if (kind === "om") return '<span class="kl-cover__om" aria-hidden="true">ॐ</span>';
    return '<svg class="kl-cover__emb" viewBox="0 0 64 64" aria-hidden="true">' + (EMB[kind] || EMB.sun) + "</svg>";
  }
  // The cover is built from HTML and CSS: grained leather, gold foil, a page block and hinge shadow. When the book has a real first
  // page (a PDF) that picture is laid over it, like a paperback; until it loads, or if it never does, the leather cover shows.
  function coverHtml(item, opts) {
    opts = opts || {};
    var a = artFor(item);
    var label = TYPE_LABEL[item.category] || item.category || "Text";
    var prog = store.progress(item.slug);
    var pct = prog ? Math.max(0, Math.min(100, Math.round(prog.pct || 0))) : 0;
    var badges = "";
    if (item.audio_url) badges += '<span class="kl-badge kl-badge--audio" title="Audio available" aria-label="Audio available"><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.6" fill="currentColor"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.6" fill="currentColor"/></svg></span>';
    if (item.content_type === "pdf") badges += '<span class="kl-badge" title="PDF scripture">PDF</span>';
    var st = store.status(item.slug);
    var tag = st === "finished" ? '<span class="kl-flag kl-flag--done">Finished</span>' : "";
    var bar = pct > 0 && st !== "finished" ? '<span class="kl-cover__bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span>' : "";
    var isPdf = item.content_type === "pdf";
    var pageSrc = isPdf && item.cover_page && item.cover_image ? item.cover_image + (item.cover_image.indexOf("?") < 0 ? "?w=520" : "") : "";
    var pdfSrc = isPdf && !pageSrc && item.pdf_url && !item.pdf_embed ? item.pdf_url : "";
    var img = isPdf ? '<img class="kl-cover__page' + (pageSrc ? "" : " is-pending") + '" alt="" decoding="async"' + (pageSrc ? ' loading="lazy" src="' + esc(pageSrc) + '" onload="this.classList.add(\'is-in\')" onerror="this.remove()"' : "") + ">" : "";
    var long = String(item.name || "").length > 26;
    return '<span class="kl-cover' + (isPdf ? " kl-cover--pdf" : "") + (long ? " is-long" : "") + (opts.cls ? " " + opts.cls : "") + '" style="--c1:' + a.c1 + ";--c2:" + a.c2 + '"' +
      (pdfSrc ? ' data-pdfcover="' + esc(pdfSrc) + '"' : "") + '><span class="kl-cover__body">' +
      '<span class="kl-cover__grain" aria-hidden="true"></span><span class="kl-cover__light" aria-hidden="true"></span>' +
      '<span class="kl-cover__foil"><span class="kl-cover__rule" aria-hidden="true"></span>' +
      '<small class="kl-cover__type">' + esc(label) + "</small>" + emblem(a.emb) + '<b class="kl-cover__title">' + esc(item.name) + '</b><i class="kl-cover__sub">' + esc(item.deity || "") + "</i></span>" +
      img + '<span class="kl-cover__hinge" aria-hidden="true"></span><span class="kl-cover__sheen" aria-hidden="true"></span>' +
      '<span class="kl-badges">' + badges + "</span>" + tag + bar + '</span><span class="kl-cover__pages" aria-hidden="true"></span></span>';
  }

  // a line-art emblem for topic cards (inherits the text colour), or the Om glyph
  function topicIcon(kind) {
    if (kind === "om") return '<span class="kl-topic__om" aria-hidden="true">ॐ</span>';
    return '<svg class="kl-topic__svg" viewBox="0 0 64 64" aria-hidden="true">' + (EMB[kind] || EMB.lotus) + "</svg>";
  }
  // square album art for the player, built from the same pieces as a cover
  function albumArtHtml(track) {
    var a = track.art && track.art.c1 ? track.art : artFor({ name: track.title || track.name, deity: track.deity, category: track.category, slug: track.slug });
    var label = TYPE_LABEL[track.category] || track.category || "Audio";
    var title = track.title || track.name || "";
    return '<span class="kl-cover kl-cover--sq' + (title.length > 26 ? " is-long" : "") + '" style="--c1:' + a.c1 + ";--c2:" + a.c2 + '"><span class="kl-cover__body"><span class="kl-cover__grain"></span><span class="kl-cover__light"></span>' +
      '<span class="kl-cover__foil"><small class="kl-cover__type">' + esc(label) + "</small>" + emblem(a.emb || "om") + '<b class="kl-cover__title">' + esc(title) + '</b><i class="kl-cover__sub">' + esc(track.singer || track.deity || "") + "</i></span>" +
      '<span class="kl-cover__sheen"></span></span></span>';
  }

  // ---- pdf.js (loaded on demand, shared by the library covers and the reader) ---------------------------------------------------
  var PDFJS_BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  var pdfjsPromise = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfjsPromise) return pdfjsPromise;
    pdfjsPromise = new Promise(function (resolve, reject) {
      var tag = document.createElement("script");
      tag.src = PDFJS_BASE + "pdf.min.js"; tag.async = true;
      tag.onload = function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + "pdf.worker.min.js"; resolve(window.pdfjsLib); };
      tag.onerror = function () { pdfjsPromise = null; reject(new Error("pdf.js could not be loaded")); };
      document.head.appendChild(tag);
    });
    return pdfjsPromise;
  }
  // cached covers: a first page rendered once is kept on the device so it is never fetched again
  var idbP = null;
  function idb() {
    if (idbP) return idbP;
    idbP = new Promise(function (resolve) {
      try {
        var req = indexedDB.open("sms-kl-covers", 1);
        req.onupgradeneeded = function () { req.result.createObjectStore("c"); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
    return idbP;
  }
  function idbGet(key) { return idb().then(function (db) { return new Promise(function (res) { if (!db) return res(null); try { var r = db.transaction("c").objectStore("c").get(key); r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { res(null); }; } catch (e) { res(null); } }); }); }
  function idbPut(key, blob) { return idb().then(function (db) { if (!db) return; try { db.transaction("c", "readwrite").objectStore("c").put(blob, key); } catch (e) { /* cache is optional */ } }); }
  // two lanes: books on this site render straight away, books streamed from Drive (slow, big) wait their turn one at a time
  var lanes = { fast: { q: [], n: 0, max: 2 }, slow: { q: [], n: 0, max: 1 } };
  function pump(lane) {
    while (lane.n < lane.max && lane.q.length) {
      var job = lane.q.shift(); lane.n++;
      job().then(function () { lane.n--; pump(lane); }, function () { lane.n--; pump(lane); });
    }
  }
  // first page of an open pdf.js document -> a JPEG blob (the cover)
  function firstPageBlob(doc) {
    return doc.getPage(1).then(function (page) {
      var vp1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: 520 / vp1.width });
      var cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      return page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise.then(function () {
        return new Promise(function (res) { cv.toBlob(function (blob) { res(blob); }, "image/jpeg", 0.84); });
      });
    });
  }
  // the reader already has the book open, so it saves page 1 as the cover for the library to use
  function captureCover(url, doc) {
    return idbGet(url).then(function (hit) {
      if (hit) return;
      return firstPageBlob(doc).then(function (blob) { if (blob) return idbPut(url, blob); });
    }).catch(function () { /* optional */ });
  }
  function renderPdfCover(el) {
    var url = el.dataset.pdfcover, img = el.querySelector(".kl-cover__page");
    if (!url || !img) return;
    var show = function (blob) { img.src = URL.createObjectURL(blob); img.onload = function () { img.classList.add("is-in"); }; };
    idbGet(url).then(function (hit) {
      if (hit) return show(hit);
      // big files over a slow link can take a while, so this runs quietly in the background, one at a time
      var lane = url.indexOf("/library/file/") >= 0 ? lanes.slow : lanes.fast;
      lane.q.push(function () {
        return loadPdfJs().then(function (lib) {
          return lib.getDocument({ url: url, rangeChunkSize: 262144, disableAutoFetch: true, disableStream: false }).promise.then(function (doc) {
            return firstPageBlob(doc).then(function (blob) { if (blob) { idbPut(url, blob); show(blob); } doc.destroy(); });
          });
        }).catch(function () { /* the leather cover stays */ });
      });
      pump(lane);
    });
  }
  var coverObserver = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { coverObserver.unobserve(e.target); renderPdfCover(e.target); } });
  }, { rootMargin: "240px" }) : null;
  function scanCovers(root) {
    if (!root.querySelectorAll) return;
    var list = root.matches && root.matches("[data-pdfcover]") ? [root] : [];
    Array.prototype.forEach.call(root.querySelectorAll("[data-pdfcover]:not([data-seen])"), function (n) { list.push(n); });
    list.forEach(function (n) { if (n.dataset.seen) return; n.dataset.seen = "1"; if (coverObserver) coverObserver.observe(n); else renderPdfCover(n); });
  }
  if (document.body) {
    new MutationObserver(function (muts) { muts.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) scanCovers(n); }); }); }).observe(document.body, { childList: true, subtree: true });
  }
  function words(item) {
    var t = item.languages ? [item.languages.english, item.languages.hindi, item.languages.sanskrit].join(" ") : "";
    return t.split(/\s+/).filter(Boolean).length;
  }
  function readMinutes(item) {
    if (item.content_type === "pdf") return null;
    return Math.max(1, Math.round(words(item) / 120));
  }
  function relTime(iso) {
    var t = Date.parse(iso); if (!t) return "";
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "just now"; if (m < 60) return m + " min ago";
    var h = Math.round(m / 60); if (h < 24) return h + " hr ago";
    var d = Math.round(h / 24); if (d < 30) return d + " day" + (d > 1 ? "s" : "") + " ago";
    return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  // "Page 120 of 1054" for books read page by page, "42% read" otherwise
  function progressLabel(item) {
    var p = store.progress(item.slug), st = store.status(item.slug);
    if (st === "finished") return "Finished";
    if (!p || !(p.pct > 0 || p.pdfPage > 1)) return "";
    if (item.content_type === "pdf" && p.pdfPage) return "Page " + p.pdfPage + (p.pdfTotal ? " of " + p.pdfTotal : "");
    return Math.round(p.pct) + "% read";
  }
  if (document.body) scanCovers(document.body);
  window.KL = { store: store, artFor: artFor, coverHtml: coverHtml, albumArtHtml: albumArtHtml, topicIcon: topicIcon, esc: esc, readMinutes: readMinutes, relTime: relTime, TYPE_LABEL: TYPE_LABEL, loadPdfJs: loadPdfJs, captureCover: captureCover, progressLabel: progressLabel, scanCovers: scanCovers };
})();
