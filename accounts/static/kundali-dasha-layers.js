/* Kundali: the Dasha journey.
   Top: a ladder that shows where you are right now in every layer (Mahadasha > Antardasha > Pratyantar > Sookshma > Prana).
   Below: a swipeable row of cards for the layer you are looking at. Tap a card to look inside it.
   Every layer is the parent period split in the ratio of the planets' years (Sun 6, Moon 10, Mars 7, Rahu 18, Jupiter 16,
   Saturn 19, Mercury 17, Ketu 7, Venus 20 out of 120), starting with the parent's own planet (mirrors kundali/dasha_levels.py). */
(function () {
  "use strict";

  var ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
  var YEARS = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };
  var SYM = { Sun: "☉", Moon: "☽", Mars: "♂", Mercury: "☿", Jupiter: "♃", Venus: "♀", Saturn: "♄", Rahu: "☊", Ketu: "☋" };
  var COLOR = { // [light, deep]
    Sun: ["#ffb347", "#c2570c"], Moon: ["#cfd9e8", "#5b6b86"], Mars: ["#ff6b5e", "#a82230"], Mercury: ["#43d9a3", "#0b7a58"],
    Jupiter: ["#ffd84d", "#b87a08"], Venus: ["#ff9fd0", "#c0357f"], Saturn: ["#7c8cff", "#3340b0"], Rahu: ["#b794ff", "#6a3fc4"], Ketu: ["#c3b8a8", "#6b5e50"],
  };
  var DAY = 86400000;
  var LEVELS = ["maha", "antar", "praty", "sook", "prana"];

  var TXT = {
    en: {
      title: "Your Dasha journey",
      intro: "Your life moves in planet turns, like a clock. A big turn (years) holds smaller turns (months), which hold even smaller ones (weeks, days, hours). The ladder shows where you are right now. Tap a row, then swipe the cards to explore.",
      level: { maha: "Mahadasha", antar: "Antardasha", praty: "Pratyantar", sook: "Sookshma", prana: "Prana" },
      size: { maha: "Big chapter · years", antar: "Sub-chapter · months", praty: "Phase · weeks", sook: "Short spell · days", prana: "Moment · hours" },
      plural: { maha: "main chapters of your life", antar: "sub-chapters", praty: "phases", sook: "short spells", prana: "moments" },
      line: {
        maha: "{P} leads this long chapter of your life. {t}.",
        antar: "Inside the big chapter, {P} sets the mood of this stretch. {t}.",
        praty: "A shorter phase where {P} takes the lead. {t}.",
        sook: "For these days, {P} is the quick undercurrent. {t}.",
        prana: "The finest layer: {P} colours these hours. {t}.",
      },
      fine: "This is a fine-timing layer. It helps pinpoint the right day or hour. Read it together with the bigger layers above it.",
      theme: { Sun: "Confidence, career and status", Moon: "Mind, home and feelings", Mars: "Energy, courage and action", Mercury: "Business, learning and talk", Jupiter: "Wisdom, growth and luck", Venus: "Love, comfort and money", Saturn: "Hard work, patience and lessons", Rahu: "Big ambition and sudden change", Ketu: "Letting go and inner peace" },
      pick: "Swipe and tap one to look inside", pickLast: "Swipe to see each one", now: "NOW", done: "DONE", later: "LATER", live: "Showing right now", jump: "Back to now", back: "Back", from: "From", to: "To", you: "you are here",
      prev: "Scroll left", next: "Scroll right", of: "of", inside: "Inside {P}", meaning: "What this means", open: "Tap to open", pct: "done", length: "Lasts",
      d: "d", h: "h", m: "min", s: "s", y: "yr", mo: "mo", how: "Each layer = the layer above × the planet's years ÷ 120. Year = 365.25 days. Times use the birth place's clock.",
    },
    hi: {
      title: "आपकी दशा यात्रा",
      intro: "आपका जीवन ग्रहों की बारी से चलता है, घड़ी की तरह। बड़ी बारी (वर्ष) के अंदर छोटी बारी (माह), उसके अंदर और छोटी (सप्ताह, दिन, घंटे) होती है। सीढ़ी बताती है कि आप अभी कहाँ हैं। किसी पंक्ति पर टैप करें, फिर कार्ड स्वाइप करके देखें।",
      level: { maha: "महादशा", antar: "अंतर्दशा", praty: "प्रत्यंतर", sook: "सूक्ष्म", prana: "प्राण" },
      size: { maha: "बड़ा अध्याय · वर्ष", antar: "उप-अध्याय · माह", praty: "दौर · सप्ताह", sook: "छोटा दौर · दिन", prana: "पल · घंटे" },
      plural: { maha: "जीवन के मुख्य अध्याय", antar: "उप-अध्याय", praty: "दौर", sook: "छोटे दौर", prana: "पल" },
      line: {
        maha: "{P} आपके जीवन के इस लंबे अध्याय का स्वामी है। {t}।",
        antar: "बड़े अध्याय के अंदर, {P} इस दौर का मिज़ाज तय करता है। {t}।",
        praty: "एक छोटा दौर जिसमें {P} आगे है। {t}।",
        sook: "इन दिनों {P} भीतर की तेज़ धारा है। {t}।",
        prana: "सबसे बारीक परत: {P} इन घंटों को रंगता है। {t}।",
      },
      fine: "यह बारीक समय की परत है। यह सही दिन या घंटा पकड़ने में मदद करती है। इसे ऊपर की बड़ी परतों के साथ पढ़ें।",
      theme: { Sun: "आत्मविश्वास, करियर और मान-सम्मान", Moon: "मन, घर और भावनाएँ", Mars: "ऊर्जा, साहस और कर्म", Mercury: "व्यापार, पढ़ाई और बातचीत", Jupiter: "ज्ञान, उन्नति और भाग्य", Venus: "प्रेम, सुख और धन", Saturn: "मेहनत, धैर्य और सीख", Rahu: "बड़ी महत्वाकांक्षा और अचानक बदलाव", Ketu: "त्याग और भीतरी शांति" },
      pick: "स्वाइप करें और अंदर देखने के लिए टैप करें", pickLast: "हर एक देखने के लिए स्वाइप करें", now: "अभी", done: "पूरा", later: "आगे", live: "अभी जो चल रहा है", jump: "अभी पर लौटें", back: "वापस", from: "से", to: "तक", you: "आप यहाँ हैं",
      prev: "बाएँ", next: "दाएँ", of: "में से", inside: "{P} के अंदर", meaning: "इसका मतलब", open: "खोलने के लिए टैप करें", pct: "पूरा", length: "अवधि",
      d: "दिन", h: "घं", m: "मि", s: "से", y: "वर्ष", mo: "माह", how: "हर परत = ऊपर की परत × ग्रह के वर्ष ÷ 120। वर्ष = 365.25 दिन। समय जन्म स्थान की घड़ी में हैं।",
    },
  };
  var MONTHS = {
    en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    hi: ["जन॰", "फ़र॰", "मार्च", "अप्रैल", "मई", "जून", "जुला॰", "अग॰", "सित॰", "अक्टू॰", "नव॰", "दिस॰"],
  };

  function lang() { return window.KI && KI.lang() === "hi" ? "hi" : "en"; }
  function X() { return TXT[lang()]; }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pl(p) { return window.KI ? KI.planet(p) : p; }

  /* ---------- the maths ---------- */
  function ms(iso) { return new Date(iso).getTime(); }
  function offsetMs(iso) {
    var m = /([+-])(\d\d):?(\d\d)$/.exec(String(iso));
    return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60000 : 0;
  }
  /* node = { planet, start, end, nominalStart, nominalDays } (times in ms) */
  function split(node) {
    var from = ORDER.indexOf(node.planet);
    var seq = ORDER.slice(from).concat(ORDER.slice(0, from));
    var out = [], cursor = node.nominalStart;
    for (var i = 0; i < seq.length; i++) {
      var days = node.nominalDays * YEARS[seq[i]] / 120;
      var next = cursor + days * DAY;
      if (next > node.start && cursor < node.end) {
        out.push({ planet: seq[i], start: Math.max(cursor, node.start), end: Math.min(next, node.end), nominalStart: cursor, nominalDays: days });
      }
      cursor = next;
    }
    // keep the first and last part exactly on the parent's edges (rounding can drift by a second)
    if (out.length) {
      if (Math.abs(out[0].start - node.start) < 2000) out[0].start = node.start;
      if (Math.abs(out[out.length - 1].end - node.end) < 2000) out[out.length - 1].end = node.end;
    }
    return out;
  }
  /* a Mahadasha row from the server -> node. The one running at birth is only the balance, so cut from its full length. */
  function mahaNode(m) {
    var start = ms(m.start), end = ms(m.end), nd = YEARS[m.planet] * 365.25;
    var full = (end - start) / DAY >= nd - 1;
    return { planet: m.planet, start: start, end: end, nominalDays: nd, nominalStart: full ? start : end - nd * DAY };
  }
  function at(list, now) {
    for (var i = 0; i < list.length; i++) if (now >= list[i].start && now < list[i].end) return list[i];
    return null;
  }

  /* ---------- formatting ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function stamp(t, off, level) {
    var d = new Date(t + off), base = d.getUTCDate() + " " + MONTHS[lang()][d.getUTCMonth()] + " " + d.getUTCFullYear();
    if (level === "maha" || level === "antar" || level === "praty") return base;
    var hm = pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
    return base + ", " + (level === "prana" ? hm + ":" + pad(d.getUTCSeconds()) : hm);
  }
  function span(durMs) {
    var C = X(), d = durMs / DAY, r = [];
    if (d >= 365.25) { var y = Math.floor(d / 365.25); r.push(y + " " + C.y); d -= y * 365.25; var mo = Math.floor(d / 30.4375); if (mo) r.push(mo + " " + C.mo); return r.join(" "); }
    if (d >= 30.4375) { var m2 = Math.floor(d / 30.4375); r.push(m2 + " " + C.mo); d -= m2 * 30.4375; var dd = Math.round(d); if (dd) r.push(dd + " " + C.d); return r.join(" "); }
    if (d >= 1) { var d1 = Math.floor(d); r.push(d1 + " " + C.d); var h = Math.round((d - d1) * 24); if (h) r.push(h + " " + C.h); return r.join(" "); }
    var hrs = d * 24;
    if (hrs >= 1) { var h1 = Math.floor(hrs); r.push(h1 + " " + C.h); var mi = Math.round((hrs - h1) * 60); if (mi) r.push(mi + " " + C.m); return r.join(" "); }
    var mins = hrs * 60;
    if (mins >= 1) return Math.floor(mins) + " " + C.m + " " + Math.round((mins - Math.floor(mins)) * 60) + " " + C.s;
    return Math.round(mins * 60) + " " + C.s;
  }
  function pctDone(n, now) { return now >= n.end ? 100 : (now < n.start ? 0 : Math.round((now - n.start) / (n.end - n.start) * 100)); }

  /* ---------- state ---------- */
  var R = null;   // the reading payload
  var S = null;   // { key, path[5], focus }

  function mahas() { return (R.dasha || []).filter(function (m) { return m.start && m.end && YEARS[m.planet]; }).map(mahaNode); }
  function offset() { return R && R.dasha && R.dasha[0] ? offsetMs(R.dasha[0].start) : 0; }
  function siblings(level) { return level === 0 ? mahas() : split(S.path[level - 1]); }
  function livePath() {
    var now = Date.now(), list = mahas(), path = [];
    var node = at(list, now) || list[list.length - 1];
    path.push(node);
    for (var i = 1; i < LEVELS.length; i++) {
      var kids = split(node);
      node = at(kids, now) || kids[kids.length - 1];
      path.push(node);
    }
    return path;
  }
  function ensure() {  // fill the ladder: the running period if it lies inside its parent, else the first one
    for (var i = 1; i < LEVELS.length; i++) {
      if (S.path[i]) continue;
      var kids = split(S.path[i - 1]);
      S.path[i] = at(kids, Date.now()) || kids[0];
    }
  }
  function isLive() {
    var now = Date.now();
    return S.path.every(function (n) { return n && now >= n.start && now < n.end; });
  }
  function same(a, b) { return a && b && a.planet === b.planet && a.start === b.start; }

  /* ---------- drawing ---------- */
  function tint(p) { var c = COLOR[p] || COLOR.Sun; return "--c1:" + c[0] + ";--c2:" + c[1]; }
  function orb(p) { return '<span class="rl-orb" style="' + tint(p) + '" aria-hidden="true">' + esc(SYM[p]) + "</span>"; }
  function status(n, now) { var C = X(); return now >= n.end ? ["done", C.done] : (now >= n.start ? ["now", C.now] : ["later", C.later]); }

  function ladder() {
    var C = X(), off = offset(), now = Date.now();
    return '<ol class="rl-ladder">' + LEVELS.map(function (lv, i) {
      var n = S.path[i], st = status(n, now), pct = pctDone(n, now);
      return '<li style="--i:' + i + '"><button type="button" class="rl-rung' + (i === S.focus ? " is-focus" : "") + '" data-focus="' + i + '" style="' + tint(n.planet) + '" aria-pressed="' + (i === S.focus) + '">' +
        '<span class="rl-rung__lvl"><b>' + esc(C.level[lv]) + "</b><small>" + esc(C.size[lv]) + "</small></span>" + orb(n.planet) +
        '<span class="rl-rung__main"><strong>' + esc(pl(n.planet)) + '</strong><small>' + esc(stamp(n.start, off, lv)) + " → " + esc(stamp(n.end, off, lv)) + "</small></span>" +
        '<span class="rl-badge rl-badge--' + st[0] + '">' + esc(st[1]) + "</span>" +
        '<span class="rl-rung__bar" aria-hidden="true"><i style="--p:' + pct + '"></i></span></button></li>';
    }).join("") + "</ol>";
  }

  function cards() {
    var C = X(), off = offset(), now = Date.now(), lv = LEVELS[S.focus], list = siblings(S.focus), sel = S.path[S.focus];
    return list.map(function (n, i) {
      var st = status(n, now), pct = pctDone(n, now), on = same(n, sel);
      return '<button type="button" class="rl-card rl-card--' + st[0] + (on ? " is-sel" : "") + '" data-card="' + i + '" style="' + tint(n.planet) + '" aria-pressed="' + on + '">' +
        '<span class="rl-card__top"><span class="rl-badge rl-badge--' + st[0] + '">' + esc(st[1]) + "</span><span class=\"rl-card__no\">" + (i + 1) + "/" + list.length + "</span></span>" +
        orb(n.planet) + "<strong>" + esc(pl(n.planet)) + "</strong>" +
        '<span class="rl-card__dates"><small>' + esc(C.from) + "</small>" + esc(stamp(n.start, off, lv)) + "<small>" + esc(C.to) + "</small>" + esc(stamp(n.end, off, lv)) + "</span>" +
        '<span class="rl-chip">' + esc(C.length) + " " + esc(span(n.end - n.start)) + "</span>" +
        '<span class="rl-card__bar" aria-hidden="true"><i style="--p:' + pct + '"></i></span>' +
        (S.focus < LEVELS.length - 1 ? '<span class="rl-card__open">' + esc(C.open) + " ›</span>" : "") + "</button>";
    }).join("");
  }

  function mahaRow(start) { return (R.dasha || []).filter(function (m) { return ms(m.start) === start; })[0]; }
  function antarEffect(n) {
    var maha = mahaRow(S.path[0].start);
    var a = maha && (maha.antardashas || []).filter(function (x) { return ms(x.start) === n.start && x.planet === n.planet; })[0];
    return a && a.effect ? a.effect : null;
  }
  function tr(k, fallback) { var v = window.KI ? KI.t(k) : k; return v && v !== k ? v : fallback; }

  function detail() {
    var C = X(), lv = LEVELS[S.focus], n = S.path[S.focus], off = offset(), now = Date.now(), body = "";
    if (lv === "maha") {
      var row = mahaRow(n.start);
      body = "<p>" + esc(row && row.meaning ? row.meaning : C.line.maha.replace("{P}", pl(n.planet)).replace("{t}", C.theme[n.planet])) + "</p>";
    } else {
      body = "<p>" + esc(C.line[lv].replace("{P}", pl(n.planet)).replace("{t}", C.theme[n.planet])) + "</p>";
      var e = lv === "antar" ? antarEffect(n) : null;
      if (e) {
        body += '<p class="rl-eff rl-eff--' + esc(e.tone) + '"><b>' + esc(e.tone_label) + ".</b> " + esc(e.summary) + "</p>" +
          (e.text || []).map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") +
          (e.good_for && e.good_for.length ? '<div class="rl-sub">' + esc(tr("good_for", "Good for")) + '</div><ul class="rd-chips good">' + e.good_for.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
          (e.careful ? '<p class="rd-careful"><strong>' + esc(tr("watch_out", "Watch out for:")) + "</strong> " + esc(e.careful) + "</p>" : "");
      }
      if (S.focus >= 3) body += '<p class="rl-fine">' + esc(C.fine) + "</p>";
    }
    return '<div class="rl-detail" style="' + tint(n.planet) + '"><div class="rl-detail__head">' + orb(n.planet) + '<div><div class="rl-detail__k">' + esc(C.meaning) + '</div><h4>' + esc(pl(n.planet)) + " " + esc(C.level[lv]) + "</h4>" +
      "<small>" + esc(stamp(n.start, off, lv)) + " → " + esc(stamp(n.end, off, lv)) + " · " + esc(span(n.end - n.start)) + (now >= n.start && now < n.end ? " · " + pctDone(n, now) + "% " + esc(C.pct) : "") + "</small></div></div>" + body + "</div>";
  }

  function paint(root, recenter) {
    var C = X(), lv = LEVELS[S.focus], parent = S.focus > 0 ? S.path[S.focus - 1] : null;
    ensure();
    root.innerHTML =
      '<div class="rl-head"><div><div class="rl-title">' + esc(C.title) + '</div><p class="rl-intro">' + esc(C.intro) + "</p></div>" +
      (isLive() ? '<span class="rl-live">' + esc(C.live) + "</span>" : '<button type="button" class="rl-btn" data-act="now">' + esc(C.jump) + "</button>") + "</div>" +
      ladder() +
      '<div class="rl-pick"><div class="rl-pick__top">' +
      (S.focus > 0 ? '<button type="button" class="rl-btn rl-btn--ghost" data-act="back">‹ ' + esc(C.back) + "</button>" : "") +
      '<div class="rl-pick__title"><b>' + esc(parent ? C.inside.replace("{P}", pl(parent.planet) + " " + C.level[LEVELS[S.focus - 1]]) : C.level.maha + " · " + C.plural.maha) + "</b>" +
      "<small>" + esc(S.focus < LEVELS.length - 1 ? C.pick : C.pickLast) + " · " + esc(C.level[lv]) + "</small></div>" +
      '<div class="rl-arrows"><button type="button" class="rl-arrow" data-act="left" aria-label="' + esc(C.prev) + '">‹</button><button type="button" class="rl-arrow" data-act="right" aria-label="' + esc(C.next) + '">›</button></div></div>' +
      '<div class="rl-track" tabindex="0">' + cards() + "</div></div>" +
      detail();
    if (recenter) center(root, false);
  }
  function center(root, smooth) {
    var track = root.querySelector(".rl-track"), card = track && track.querySelector(".is-sel");
    if (!card) return;
    var left = card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2;
    if (smooth && track.scrollTo) track.scrollTo({ left: left, behavior: "smooth" }); else track.scrollLeft = left;
  }

  /* ---------- clicks ---------- */
  document.addEventListener("click", function (e) {
    var root = e.target.closest && e.target.closest(".rl");
    if (!root || !S) return;
    var t = e.target.closest("[data-card],[data-focus],[data-act]");
    if (!t) return;
    if (t.hasAttribute("data-card")) {
      var node = siblings(S.focus)[Number(t.getAttribute("data-card"))];
      S.path[S.focus] = node;
      S.path.length = S.focus + 1;
      if (S.focus < LEVELS.length - 1) S.focus += 1;
      paint(root, true);
    } else if (t.hasAttribute("data-focus")) {
      S.focus = Number(t.getAttribute("data-focus")); paint(root, true);
    } else {
      var act = t.getAttribute("data-act");
      if (act === "now") { S.path = livePath(); paint(root, true); }
      else if (act === "back") { S.focus = Math.max(0, S.focus - 1); paint(root, true); }
      else if (act === "left" || act === "right") {
        var track = root.querySelector(".rl-track"), w = (track.querySelector(".rl-card") || { offsetWidth: 180 }).offsetWidth + 12;
        track.scrollBy({ left: (act === "left" ? -1 : 1) * w * 2, behavior: "smooth" });
      }
    }
  });

  /* ---------- public ---------- */
  function shell(r) { R = r; return '<div class="rl"></div>'; }
  function mount() {
    var root = document.querySelector("#tabDasha .rl");
    if (!root || !R || !R.dasha || !R.dasha.length) return;
    var key = R.dasha[0].start;
    if (!S || S.key !== key) S = { key: key, path: livePath(), focus: 1 };
    paint(root, true);
    if ("IntersectionObserver" in window) {  // the tab may be hidden while painting, so centre the cards once it is visible
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { center(root, false); io.disconnect(); }
      }, { threshold: 0.05 });
      io.observe(root);
    }
  }

  window.KundaliLayers = { shell: shell, mount: mount, _split: split, _mahaNode: mahaNode };
})();
