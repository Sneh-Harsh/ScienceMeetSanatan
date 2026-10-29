/* Pandit Booking page only: "Upcoming festivals" cards right below the hero.
   Reads pooja/festivals.json (dates for Patna from Drik Panchang) and lets a visitor book ahead for a festival:
   the puja, festival name and date are filled into the request form. */
(function () {
  "use strict";
  var section = document.getElementById("festivals");
  var list = document.getElementById("psbFestList");
  if (!section || !list) return;

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  // guide id -> the value used in the request form's "Puja type" list
  var PUJA = {
    "lakshmi-puja": "Lakshmi Puja", "ganesh-puja": "Ganesh Puja", "satyanarayan": "Satyanarayan Puja", "rudrabhishek": "Rudrabhishek",
    "bhai-dooj": "Bhai Dooj", "chitragupta": "Chitragupta Puja", "chhath": "Chhath Puja", "vivah": "Marriage and Vivah ceremonies",
    "havan": "Havan and other rituals", "sanskar": "Naamkaran and Mundan Sanskar", "griha-pravesh": "Griha Pravesh Puja",
    "navagraha": "Navagraha Shanti", "vastu": "Vastu Shanti", "bhoomi": "Bhoomi Puja"
  };
  var MAX = 6, WINDOW_DAYS = 150;
  var images = null; // pooja/images.json: Cloudinary pictures per guide (cloud name + public ids, no secrets)

  function bgUrl(cfg, w) {
    if (!images || !cfg || cfg.status !== "supplied" || !cfg.publicId) return "";
    var crop = ",ar_16:9,c_fill,g_auto,w_" + w + ",q_auto";
    if (cfg.resourceType === "video") return "https://res.cloudinary.com/" + images.cloudName + "/video/upload/so_0" + crop + ",f_jpg/" + cfg.publicId + ".jpg";
    return "https://res.cloudinary.com/" + images.cloudName + "/image/upload/f_auto" + crop + "/" + cfg.publicId;
  }
  // One AI-generated picture per festival (images.json -> festivals); falls back to the guide's picture.
  function bgHtml(f, gid) {
    var base = String(f.id || "").replace(/-20\d\d.*$/, "");
    var cfg = images && images.festivals && images.festivals[base];
    if (!cfg) cfg = images && images.images && images.images[gid || "other"];
    var u1 = bgUrl(cfg, 480), u2 = bgUrl(cfg, 800);
    if (!u1) return "";
    return '<img class="psb-fcard__bg" src="' + esc(u1) + '" srcset="' + esc(u1) + " 480w, " + esc(u2) + ' 800w" sizes="(min-width: 1000px) 380px, 84vw" width="480" height="270" alt="" loading="lazy" decoding="async">' +
      (cfg.attribution ? '<span class="psb-fcard__credit">' + esc(cfg.attribution) + "</span>" : "");
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function day(str) { var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(str || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }

  function pick(data) {
    var t = today(), out = [], seen = {};
    (data.festivals || []).forEach(function (f) {
      if (f.kind !== "festival") return;
      var s = day(f.date), e = day(f.endDate) || s;
      if (!s || e < t) return;
      var days = Math.max(0, Math.round((s - t) / 86400000));
      if (days > WINDOW_DAYS) return;
      var gid = (f.guides || []).filter(function (g) { return PUJA[g]; })[0];
      var key = f.name.en.toLowerCase();
      if (seen[key]) return; seen[key] = 1;
      out.push({ f: f, s: s, e: e, days: days, gid: gid || null });
    });
    out.sort(function (a, b) { return a.s - b.s; });
    // festivals with their own puja first, then the rest (they use "Other Puja"), always in date order
    var withPuja = out.filter(function (x) { return x.gid; }), rest = out.filter(function (x) { return !x.gid; });
    var chosen = withPuja.slice(0, MAX);
    if (chosen.length < MAX) chosen = chosen.concat(rest.slice(0, MAX - chosen.length));
    return chosen.sort(function (a, b) { return a.s - b.s; });
  }

  function rel(x) { return x.s <= today() ? "Happening now" : x.days === 0 ? "Today" : x.days === 1 ? "Tomorrow" : "In " + x.days + " days"; }

  function card(x, i) {
    var f = x.f, multi = f.endDate && f.endDate !== f.date;
    var puja = x.gid ? PUJA[x.gid] : "Other Puja";
    var dateText = WEEKDAYS[x.s.getDay()] + ", " + x.s.getDate() + " " + MONTHS[x.s.getMonth()] + (multi ? " – " + x.e.getDate() + " " + MONTHS[x.e.getMonth()] : "");
    var bg = bgHtml(f, x.gid);
    return '<li class="psb-fcard' + (i === 0 ? " psb-fcard--next" : "") + (bg ? " has-bg" : "") + '">' + bg +
      (i === 0 ? '<span class="psb-fcard__next">Next up</span>' : "") +
      '<div class="psb-fcard__top"><div class="psb-fcard__date" aria-hidden="true"><b>' + x.s.getDate() + "</b><span>" + MONTHS[x.s.getMonth()] + "</span></div>" +
      '<div class="psb-fcard__title"><h3>' + esc(f.name.en) + "</h3>" + (f.name.hi ? '<p lang="hi">' + esc(f.name.hi) + "</p>" : "") + "</div></div>" +
      '<p class="psb-fcard__when"><span class="psb-fcard__pill' + (x.days <= 7 ? " is-soon" : "") + '">' + esc(rel(x)) + "</span><span>" + esc(dateText) + "</span></p>" +
      '<p class="psb-fcard__for">Pandit for: <strong>' + esc(x.gid ? puja : "your festival puja") + "</strong></p>" +
      '<div class="psb-fcard__acts">' +
      '<button type="button" class="psb-btn psb-btn--gold psb-fcard__book" data-fest="' + i + '">Book ahead for this festival</button>' +
      (x.gid ? '<button type="button" class="psb-fcard__vidhi" data-vidhi="' + esc(x.gid) + '">Read pooja vidhi</button>' : "") +
      "</div></li>";
  }

  var shown = [];
  function render(items) {
    shown = items;
    if (!items.length) { section.hidden = true; return; }
    list.innerHTML = items.map(card).join("");
    section.hidden = false;
  }

  list.addEventListener("click", function (e) {
    var b = e.target.closest("[data-fest]");
    if (b) {
      var x = shown[Number(b.getAttribute("data-fest"))];
      var B = window.PanditBooking;
      if (!x || !B || !B.prefill) { location.hash = "#book"; return; }
      var iso = x.s.getFullYear() + "-" + String(x.s.getMonth() + 1).padStart(2, "0") + "-" + String(x.s.getDate()).padStart(2, "0");
      var date = x.s < today() ? "" : iso;
      B.prefill({ puja: x.gid ? PUJA[x.gid] : "Other Puja", other: x.f.name.en, festival: x.f.name.en, date: date });
      return;
    }
    var v = e.target.closest("[data-vidhi]");
    if (v && window.PoojaVidhi) {
      var sec = document.getElementById("pooja");
      window.PoojaVidhi.open(v.getAttribute("data-vidhi"));
      if (sec) sec.scrollIntoView({ block: "start" });
    }
  });

  var getJson = function (url) { return url ? fetch(url, { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null); };
  Promise.all([getJson(section.getAttribute("data-url")), getJson(section.getAttribute("data-images-url"))])
    .then(function (r) { images = r[1]; if (r[0]) render(pick(r[0])); })
    .catch(function () { /* the section simply stays hidden */ });
})();
