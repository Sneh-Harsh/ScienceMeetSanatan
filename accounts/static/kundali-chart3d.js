/* Kundali charts as scalable SVG: a brass plate with ivory house tiles, glossy planet orbs and a full key.
   Everything is drawn in one coordinate space, so text can never overflow or be clipped, at any screen size.
   Loaded after kundali.js: it replaces renderNorthChart / renderSouthChart and reuses that file's data helpers. */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var SIGN_NO = { Mesha: 1, Vrishabha: 2, Mithuna: 3, Karka: 4, Simha: 5, Kanya: 6, Tula: 7, Vrischika: 8, Dhanu: 9, Makara: 10, Kumbha: 11, Meena: 12 };
  var SIGN_ABBR = { Mesha: "Ari", Vrishabha: "Tau", Mithuna: "Gem", Karka: "Can", Simha: "Leo", Kanya: "Vir", Tula: "Lib", Vrischika: "Sco", Dhanu: "Sag", Makara: "Cap", Kumbha: "Aqu", Meena: "Pis" };
  var SIGN_EN = { Mesha: "Aries", Vrishabha: "Taurus", Mithuna: "Gemini", Karka: "Cancer", Simha: "Leo", Kanya: "Virgo", Tula: "Libra", Vrischika: "Scorpio", Dhanu: "Sagittarius", Makara: "Capricorn", Kumbha: "Aquarius", Meena: "Pisces" };
  var ABBR = { Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me", Jupiter: "Ju", Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke" };
  var ORB = {
    Sun: ["#ffd36a", "#c2630a"], Moon: ["#eef3fb", "#6b7a95"], Mars: ["#ff7a5c", "#8a1c10"], Mercury: ["#6fd89a", "#17653a"],
    Jupiter: ["#ffe27a", "#9a6c0a"], Venus: ["#ffb3d1", "#a03a67"], Saturn: ["#8ea2e6", "#27346b"], Rahu: ["#a592c4", "#2b2040"], Ketu: ["#d49a63", "#58321a"],
  };
  var AREA = {
    1: "self and personality", 2: "money and family", 3: "courage and effort", 4: "home and peace of mind", 5: "learning, children and creativity",
    6: "daily work and health", 7: "marriage and partnerships", 8: "sudden changes and research", 9: "luck and guidance", 10: "career and reputation",
    11: "gains and friends", 12: "rest, expenses and foreign lands",
  };
  function ord(n) { return n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"); }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function f(n) { return Math.round(n * 100) / 100; }
  function deg(p) {
    var raw = p && (p.degree != null ? p.degree : "");
    var m = String(raw).match(/(\d+(\.\d+)?)/);
    return m ? Math.round(parseFloat(m[1])) + "°" : "";
  }

  /* ---------- shared artwork ---------- */
  function defs(id) {
    var orbs = Object.keys(ORB).map(function (k) {
      return '<radialGradient id="' + id + "-o-" + k + '" cx="34%" cy="28%" r="78%"><stop offset="0" stop-color="#fff"/><stop offset=".14" stop-color="' + ORB[k][0] + '"/><stop offset=".62" stop-color="' + ORB[k][0] + '"/><stop offset="1" stop-color="' + ORB[k][1] + '"/></radialGradient>';
    }).join("");
    return "<defs>" + orbs +
      '<linearGradient id="' + id + '-brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fdeeb4"/><stop offset=".2" stop-color="#e2b653"/><stop offset=".45" stop-color="#9b6f1c"/><stop offset=".7" stop-color="#ecc96e"/><stop offset="1" stop-color="#7d5616"/></linearGradient>' +
      '<linearGradient id="' + id + '-ivory" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffaea"/><stop offset=".55" stop-color="#f1e1b8"/><stop offset="1" stop-color="#dcc489"/></linearGradient>' +
      '<linearGradient id="' + id + '-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".5" stop-color="#f0c452"/><stop offset="1" stop-color="#c8902a"/></linearGradient>' +
      '<linearGradient id="' + id + '-ruby" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2566c"/><stop offset=".55" stop-color="#a62338"/><stop offset="1" stop-color="#6e1021"/></linearGradient>' +
      '<linearGradient id="' + id + '-inlay" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#150b05"/><stop offset="1" stop-color="#2d1b0f"/></linearGradient>' +
      '<radialGradient id="' + id + '-rivet" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff6cf"/><stop offset=".5" stop-color="#c9a043"/><stop offset="1" stop-color="#5a3f10"/></radialGradient>' +
      '<filter id="' + id + '-tile" x="-10%" y="-10%" width="125%" height="130%"><feDropShadow dx="0" dy=".7" stdDeviation=".55" flood-color="#000" flood-opacity=".55"/></filter>' +
      '<filter id="' + id + '-lift" x="-20%" y="-20%" width="145%" height="155%"><feDropShadow dx="0" dy="1.4" stdDeviation="1" flood-color="#000" flood-opacity=".6"/><feDropShadow dx="0" dy="0" stdDeviation="1.6" flood-color="#ffc850" flood-opacity=".85"/></filter>' +
      '<filter id="' + id + '-orb" x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx=".2" dy=".7" stdDeviation=".45" flood-color="#000" flood-opacity=".6"/></filter>' +
      '<filter id="' + id + '-etch" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0" dy=".35" stdDeviation="0" flood-color="#000" flood-opacity=".7"/></filter>' +
      "</defs>";
  }

  function plate(id) {
    var rivets = [[3.6, 3.6], [96.4, 3.6], [3.6, 96.4], [96.4, 96.4]].map(function (p) {
      return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.35" fill="url(#' + id + '-rivet)" stroke="#3c2808" stroke-width=".2"/><path d="M' + (p[0] - .7) + " " + p[1] + "h1.4" + '" stroke="#3c2808" stroke-width=".25"/>';
    }).join("");
    var ticks = "";
    for (var i = 1; i < 24; i++) {
      var p = 4 + i * 4; if (Math.abs(p - 50) < 0.1 && false) continue;
      ticks += '<circle cx="' + p + '" cy="1.9" r=".32" fill="#5a3f10"/><circle cx="' + p + '" cy="98.1" r=".32" fill="#5a3f10"/><circle cx="1.9" cy="' + p + '" r=".32" fill="#5a3f10"/><circle cx="98.1" cy="' + p + '" r=".32" fill="#5a3f10"/>';
    }
    return '<rect x=".4" y=".4" width="99.2" height="99.2" rx="3.4" fill="url(#' + id + '-brass)" stroke="#3c2808" stroke-width=".5"/>' +
      '<rect x="1.1" y="1.1" width="97.8" height="97.8" rx="2.9" fill="none" stroke="#fff3c4" stroke-opacity=".75" stroke-width=".35"/>' +
      '<rect x="5.2" y="5.2" width="89.6" height="89.6" rx="1.4" fill="url(#' + id + '-inlay)" stroke="#fff0b0" stroke-opacity=".55" stroke-width=".3"/>' +
      '<rect x="5.2" y="5.2" width="89.6" height="89.6" rx="1.4" fill="none" stroke="#000" stroke-opacity=".7" stroke-width=".9" transform="translate(0 .35)" opacity=".55"/>' +
      ticks + rivets;
  }

  /* ---------- orb layout ---------- */
  function orbSvg(id, p, cx, cy, r, idx) {
    var name = String(p.planet || "");
    var short = ABBR[name] || name.slice(0, 2);
    var d = deg(p);
    var tip = name + " in " + (SIGN_EN[p.sign] || p.sign || "") + (d ? ", " + d : "") + (p.dignity ? " (" + p.dignity + ")" : "");
    return '<g class="nk-orb" style="--d:' + (idx * 0.37).toFixed(2) + 's"><title>' + esc(tip) + "</title>" +
      '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="url(#' + id + "-o-" + (ORB[name] ? name : "Sun") + ')" stroke="rgba(0,0,0,.55)" stroke-width=".25" filter="url(#' + id + '-orb)"/>' +
      '<text x="' + f(cx) + '" y="' + f(cy + r * 0.36) + '" text-anchor="middle" font-size="' + f(r * 0.95) + '" font-weight="800" fill="#fff" stroke="rgba(0,0,0,.5)" stroke-width=".18" paint-order="stroke" class="nk-orb__t">' + esc(short) + "</text>" +
      "</g>";
  }

  /* lay planets out in rows along a base line inside a triangle or rhombus */
  function rowsInTile(shape, planets) {
    var out = [];
    var n = planets.length;
    if (!n) return out;
    var r = n > 4 ? 2.3 : 2.7;
    var stepX = r * 2 + 1.3, stepY = r * 2 + 1.4;
    var i = 0, row = 0;
    while (i < n && row < 8) {
      var t = shape.firstRow + row * stepY;
      var width = shape.widthAt(t);
      var cap = Math.max(1, Math.min(4, Math.floor((width + 1.3) / stepX)));
      var take = Math.min(cap, n - i);
      for (var k = 0; k < take; k++) {
        var off = (k - (take - 1) / 2) * stepX;
        var pos = shape.at(t, off);
        out.push({ p: planets[i + k], x: pos[0], y: pos[1], r: r });
      }
      i += take; row++;
    }
    return out;
  }

  function shapeOf(points) {
    var P = points.split(" ").map(function (s) { var a = s.split(",").map(Number); return [7 + (a[0] - 4) / 92 * 86, 7 + (a[1] - 4) / 92 * 86]; });
    if (P.length === 3) {
      // triangle: base = longest edge, apex opposite; rows run away from the base
      var best = 0, bi = 0;
      for (var i = 0; i < 3; i++) {
        var a = P[i], b = P[(i + 1) % 3], l = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (l > best) { best = l; bi = i; }
      }
      var A = P[bi], B = P[(bi + 1) % 3], apex = P[(bi + 2) % 3];
      var mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      var h = Math.hypot(apex[0] - mid[0], apex[1] - mid[1]);
      var v = [(apex[0] - mid[0]) / h, (apex[1] - mid[1]) / h];
      var u = [(B[0] - A[0]) / best, (B[1] - A[1]) / best];
      var horizontal = Math.abs(u[0]) >= Math.abs(u[1]);
      var label;
      if (horizontal) {
        label = [mid[0], v[1] > 0 ? mid[1] + 5.4 : mid[1] - 1.9];   // baseline sits just inside the base edge
      } else {
        var up = u[1] < 0 ? u : [-u[0], -u[1]];                       // side tiles: label in the upper part, planets below it
        var dy = 9.5, extent = h * (1 - dy / (best / 2));              // how deep the triangle reaches at that height
        var depth = extent / 2;                                        // centre the label inside the triangle at that height
        label = [mid[0] + v[0] * depth + up[0] * dy, mid[1] + v[1] * depth + up[1] * dy + 1.5];
      }
      return {
        kind: "tri", points: P, label: label, firstRow: h * 0.52,
        widthAt: function (t) { return Math.max(0, best * (1 - t / h) - 3.4); },
        at: function (t, off) { return [mid[0] + v[0] * t + u[0] * off, mid[1] + v[1] * t + u[1] * off]; },
      };
    }
    var cx = (P[0][0] + P[1][0] + P[2][0] + P[3][0]) / 4, cy = (P[0][1] + P[1][1] + P[2][1] + P[3][1]) / 4;
    var diag = Math.max(Math.abs(P[0][0] - P[2][0]), Math.abs(P[0][1] - P[2][1]));
    return {
      kind: "rh", points: P, label: [cx, cy - diag * 0.2], firstRow: -diag * 0.04,
      widthAt: function (t) { return Math.max(0, diag - 2 * Math.abs(t) - 5); },
      at: function (t, off) { return [cx + off, cy + t]; },
    };
  }

  function tileText(id, sign, anchor, big) {
    var no = SIGN_NO[sign] || "";
    return '<text x="' + f(anchor[0]) + '" y="' + f(anchor[1]) + '" text-anchor="middle" class="nk-sign"><tspan class="nk-sign__n" font-size="' + (big ? 4.6 : 4.2) + '">' + no + '</tspan><tspan class="nk-sign__a" dx=".8" font-size="2.35">' + esc(SIGN_ABBR[sign] || "") + "</tspan></text>";
  }

  /* ---------- North Indian ---------- */
  function renderNorth(houses, lagna) {
    var host = els.northChart;
    if (!host) return;
    var id = "nk";
    var active = getActiveData();
    var hmap = getHouseMap(houses);
    var body = "";
    NORTH_HOUSE_REGIONS.forEach(function (cfg) {
      var n = Number(cfg.house);
      var info = getHouseExperience(n, active) || {};
      var h = hmap.get(n) || {};
      var sign = String(info.sign || h.rashi || "");
      var planets = Array.isArray(info.planets) ? info.planets : [];
      var shape = shapeOf(cfg.points);
      var selected = n === Number(kundaliState.selectedHouse);
      var lag = n === 1;
      var poly = shape.points.map(function (p) { return f(p[0]) + "," + f(p[1]); }).join(" ");
      var fill = selected ? id + "-gold" : (lag ? id + "-ruby" : id + "-ivory");
      var names = planets.map(function (p) { return p.planet; }).join(", ");
      var label = ord(n) + " house, " + (SIGN_EN[sign] || sign) + ", " + AREA[n] + (names ? ". Planets: " + names : ". No planets");
      var orbs = rowsInTile(shape, planets).map(function (o, i) { return orbSvg(id, o.p, o.x, o.y, o.r, i + n); }).join("");
      var ink = lag && !selected ? "nk-ink--light" : "";
      body += '<g class="nk-house' + (selected ? " is-selected" : "") + (lag ? " is-lagna" : "") + '" data-house="' + n + '" tabindex="0" role="button" aria-label="' + esc(label) + '"><title>' + esc(label) + "</title>" +
        '<polygon points="' + poly + '" fill="url(#' + fill + ')" stroke="url(#' + id + '-brass)" stroke-width="1" stroke-linejoin="round" filter="url(#' + id + (selected ? "-lift" : "-tile") + ')"/>' +
        '<polygon points="' + poly + '" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".25" transform="translate(0 -.3)" class="nk-hi"/>' +
        '<g class="' + ink + '">' + tileText(id, sign, shape.label, shape.kind === "rh") + (lag ? '<text x="' + f(shape.label[0]) + '" y="' + f(shape.label[1] + 2.9) + '" text-anchor="middle" font-size="1.9" font-weight="800" letter-spacing=".25" class="nk-asc__t2">LAGNA</text>' : "") + "</g>" + orbs + "</g>";
    });
    host.innerHTML = '<svg class="nk-svg" viewBox="0 0 100 100" xmlns="' + NS + '" role="group" aria-label="North Indian birth chart">' + defs(id) + plate(id) + body + "</svg>";
    wire(host);
    renderKey(active, houses, lagna);
  }

  /* ---------- South Indian ---------- */
  function renderSouth(houses, lagna) {
    var host = els.southChart;
    if (!host) return;
    var id = "sk";
    var active = getActiveData();
    var bySign = new Map();
    (houses || []).forEach(function (h) { bySign.set(Number(h.rashi_index), h); });
    var lagIdx = ((houses || []).find(function (h) { return Number(h.house) === 1; }) || {}).rashi_index;
    var C = 21.5, X0 = 7, body = "";
    SOUTH_SIGN_POSITIONS.forEach(function (row, ry) {
      row.forEach(function (signIdx, rx) {
        if (signIdx === null) return;
        var x = X0 + rx * C, y = X0 + ry * C;
        var h = bySign.get(signIdx) || {};
        var sign = String(h.rashi || "");
        var n = Number(h.house);
        var info = getHouseExperience(n, active) || {};
        var planets = Array.isArray(info.planets) ? info.planets : [];
        var lag = Number(signIdx) === Number(lagIdx);
        var selected = n === Number(kundaliState.selectedHouse);
        var fill = selected ? id + "-gold" : (lag ? id + "-ruby" : id + "-ivory");
        var names = planets.map(function (p) { return p.planet; }).join(", ");
        var label = (SIGN_EN[sign] || sign) + ", " + ord(n) + " house, " + AREA[n] + (names ? ". Planets: " + names : ". No planets");
        var shape = {
          firstRow: 8.2,
          widthAt: function () { return C - 3; },
          at: function (t, off) { return [x + C / 2 + off, y + t + 1]; },
        };
        var orbs = rowsInTile(shape, planets).map(function (o, i) { return orbSvg(id, o.p, o.x, o.y, Math.min(o.r, 2.5), i + n); }).join("");
        body += '<g class="nk-house' + (selected ? " is-selected" : "") + (lag ? " is-lagna" : "") + '" data-house="' + n + '" tabindex="0" role="button" aria-label="' + esc(label) + '"><title>' + esc(label) + "</title>" +
          '<rect x="' + f(x + .35) + '" y="' + f(y + .35) + '" width="' + f(C - .7) + '" height="' + f(C - .7) + '" rx=".9" fill="url(#' + fill + ')" stroke="url(#' + id + '-brass)" stroke-width=".8" filter="url(#' + id + (selected ? "-lift" : "-tile") + ')"/>' +
          '<g class="' + (lag && !selected ? "nk-ink--light" : "") + '"><text x="' + f(x + 1.9) + '" y="' + f(y + 4.6) + '" class="nk-sign"><tspan class="nk-sign__n" font-size="3.6">' + (SIGN_NO[sign] || "") + '</tspan><tspan class="nk-sign__a" dx=".6" font-size="2.2">' + esc(SIGN_ABBR[sign] || "") + '</tspan></text>' +
          '<text x="' + f(x + C - 1.7) + '" y="' + f(y + 4.4) + '" text-anchor="end" class="nk-hno" font-size="2.2">' + (lag ? "Asc" : "H" + n) + "</text></g>" + orbs + "</g>";
      });
    });
    var mid = X0 + C * 2;
    body += '<g pointer-events="none"><rect x="' + f(X0 + C + .35) + '" y="' + f(X0 + C + .35) + '" width="' + f(C * 2 - .7) + '" height="' + f(C * 2 - .7) + '" rx="1" fill="url(#' + id + '-inlay)" stroke="url(#' + id + '-brass)" stroke-width=".8"/>' +
      '<circle cx="' + mid + '" cy="' + mid + '" r="9.5" fill="none" stroke="url(#' + id + '-brass)" stroke-width=".7"/><circle cx="' + mid + '" cy="' + mid + '" r="7.4" fill="none" stroke="#f1cf78" stroke-opacity=".5" stroke-width=".25" stroke-dasharray=".6 1"/>' +
      '<text x="' + mid + '" y="' + f(mid - 0.6) + '" text-anchor="middle" font-size="7.6" fill="url(#' + id + '-gold)" class="nk-om">ॐ</text>' +
      '<text x="' + mid + '" y="' + f(mid + 13) + '" text-anchor="middle" font-size="2.4" font-weight="800" fill="#f1cf78" letter-spacing=".15">' + esc(String(kundaliState.chart || "d1").toUpperCase() + " · " + (SIGN_EN[lagna] || lagna)) + " RISING</text></g>";
    host.innerHTML = '<svg class="nk-svg" viewBox="0 0 100 100" xmlns="' + NS + '" role="group" aria-label="South Indian birth chart">' + defs(id) + plate(id) + body + "</svg>";
    wire(host);
    renderKey(active, houses, lagna);
  }

  function wire(host) {
    host.querySelectorAll(".nk-house[data-house]").forEach(function (g) {
      function go() {
        var n = Number(g.getAttribute("data-house"));
        if (!isFinite(n)) return;
        kundaliState.selectedHouse = n;
        renderHousePanel();
        renderChart();
        var again = host.querySelector('.nk-house[data-house="' + n + '"]');
        if (again && document.activeElement === document.body) again.focus({ preventScroll: true });
      }
      g.addEventListener("click", go);
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
  }

  /* ---------- the key under the chart: every planet, where it is and how strong ---------- */
  function renderKey(active, houses, lagna) {
    var shell = document.querySelector(".chart-shell");
    if (!shell) return;
    var key = document.getElementById("chartKey");
    if (!key) {
      key = document.createElement("div");
      key.id = "chartKey";
      key.className = "nk-key";
      shell.insertAdjacentElement("afterend", key);
    }
    var planets = (active && active.planets) || [];
    var d1 = kundaliState.data || {};
    var detail = {};
    var hd = (d1.experience && d1.experience.house_details) || {};
    Object.keys(hd).forEach(function (h) { (hd[h].planets || []).forEach(function (p) { detail[p.planet] = p; }); });
    var cells = planets.map(function (p, i) {
      var name = String(p.planet);
      var dp = kundaliState.chart === "d1" ? detail[name] : null;
      var sign = String(p.rashi || p.sign || "");
      var bits = [(SIGN_EN[sign] || sign), ord(Number(p.house)) + " house"];
      if (dp && dp.dignity && dp.dignity !== "Neutral") bits.push(dp.dignity);
      return '<li class="nk-key__item"><svg viewBox="0 0 10 10" width="30" height="30" aria-hidden="true"><circle cx="5" cy="5" r="4.4" fill="url(#kk-o-' + esc(ORB[name] ? name : "Sun") + ')" stroke="rgba(0,0,0,.5)" stroke-width=".3"/><text x="5" y="6.3" text-anchor="middle" font-size="3.6" font-weight="800" fill="#fff" stroke="rgba(0,0,0,.45)" stroke-width=".25" paint-order="stroke">' + esc(ABBR[name] || "") + "</text></svg>" +
        '<span><strong>' + esc(name) + "</strong><small>" + esc(bits.join(" · ")) + "</small></span><em>" + esc(deg(p) || "") + "</em></li>";
    }).join("");
    var lagSign = String(lagna || "");
    key.innerHTML = '<div class="nk-key__head"><strong>' + esc(kundaliState.chart === "d9" ? "Navamsa (D9)" : "Rashi (D1)") + ' key</strong><span>Rising sign: ' + esc((SIGN_EN[lagSign] || lagSign) + (SIGN_EN[lagSign] ? " (" + lagSign + ")" : "")) + '. Numbers in the chart are zodiac signs (1 = Aries … 12 = Pisces).</span></div>' +
      '<ul class="nk-key__list">' + cells + "</ul>";
    // the key has its own gradient definitions: the chart svg may be hidden (display:none svgs do not render gradients)
    if (!document.getElementById("kkDefs")) {
      var holder = document.createElementNS(NS, "svg");
      holder.id = "kkDefs"; holder.setAttribute("width", "0"); holder.setAttribute("height", "0"); holder.setAttribute("aria-hidden", "true");
      holder.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
      holder.innerHTML = defs("kk");
      document.body.appendChild(holder);
    }
  }

  window.KundaliChart3D = {
    areaName: function (n) { return AREA[n] || ""; },
    ord: ord,
  };
  window.renderNorthChart = renderNorth;
  window.renderSouthChart = renderSouth;
  // global function declarations in kundali.js are resolved at call time, so these assignments take over
  /* eslint-disable no-global-assign */
  try { renderNorthChart = renderNorth; renderSouthChart = renderSouth; } catch (e) { /* strict-mode safety */ }

  // if kundali.js already drew a chart before this file loaded, redraw it with the new renderer
  if (typeof kundaliState !== "undefined" && kundaliState.data && typeof renderChart === "function") renderChart();
})();
