/* Kundali: easy-language reading, Dasha / Antardasha tables, doshas and remedies.
   Everything shown comes from payload.reading, which the server builds from the chart that was just calculated. */
(function () {
  "use strict";

  var SYM = { Sun: "☉", Moon: "☽", Mars: "♂", Mercury: "☿", Jupiter: "♃", Venus: "♀", Saturn: "♄", Rahu: "☊", Ketu: "☋" };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function dt(iso) { var d = new Date(iso); return isNaN(d) ? null : d; }
  function monthYear(iso) { var d = dt(iso); return d ? d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "-"; }
  function fullDate(iso) { var d = dt(iso); return d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-"; }
  function span(iso) {
    var a = dt(iso.start), b = dt(iso.end);
    if (!a || !b) return "";
    var months = Math.round((b - a) / (30.4375 * 86400000)), y = Math.floor(months / 12), m = months % 12;
    return (y ? y + " yr " : "") + (m ? m + " mo" : "") || "< 1 mo";
  }
  function coin(planet) {
    return '<span class="rd-coin planet-chip--' + esc(String(planet).toLowerCase()) + '" aria-hidden="true">' + esc(SYM[planet] || String(planet).slice(0, 2)) + "</span>";
  }
  function list(items, cls) {
    if (!items || !items.length) return "";
    return '<ul class="rd-list ' + (cls || "") + '">' + items.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
  }
  function tube(label, pct, right) {
    pct = Math.max(0, Math.min(100, Number(pct) || 0));
    return '<div class="rd-meter"><div><span>' + esc(label) + "</span><span>" + esc(right != null ? right : pct + "% complete") + '</span></div><div class="rd-tube" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="' + esc(label) + '"><i style="--p:' + pct + '"></i></div></div>';
  }

  /* ---------------- tabs ---------------- */
  function overview(r, hi) {
    var p = r.personality || {}, ph = r.phase || {};
    var snap = (r.snapshot || []).map(function (s) {
      return '<div class="rd-medal"><small>' + esc(s.label) + "</small><strong>" + esc(s.value) + "</strong><span>" + esc(s.sub) + "</span></div>";
    }).join("");
    var about =
      '<div class="rd-card"><div class="rd-kicker">About you</div><div class="rd-lead">' + esc(p.headline) + "</div>" +
      (p.paragraphs || []).map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") +
      (p.strengths && p.strengths.length ? '<div class="rd-sub">Your strengths</div><ul class="rd-chips good">' + p.strengths.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
      (p.watch && p.watch.length ? '<div class="rd-sub">Things to watch</div><ul class="rd-chips care">' + p.watch.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
      (p.notes && p.notes.length ? '<div class="rd-sub">Good to know</div>' + list(p.notes) : "") + "</div>";
    var now = "";
    if (ph.title) {
      now =
        '<div class="rd-card"><div class="rd-kicker">Right now in your life</div><div class="rd-lead">' + esc(ph.title) + "</div>" +
        tube("Main period (Mahadasha): " + ph.maha.planet, ph.progress, monthYear(ph.maha.start) + " to " + monthYear(ph.maha.end)) +
        tube("Sub-period (Antardasha): " + ph.antar.planet, ph.antar_progress, monthYear(ph.antar.start) + " to " + monthYear(ph.antar.end)) +
        (ph.paragraphs || []).map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") +
        (ph.do && ph.do.length ? '<div class="rd-tip">' + esc(ph.do[0]) + "</div>" : "") +
        (ph.caution ? '<p style="margin-top:.6rem"><strong>Be careful:</strong> ' + esc(ph.caution) + "</p>" : "") +
        (ph.next_change && ph.next_change.transition_date ? "<p><strong>Next big change:</strong> " + esc(ph.next_change.active) + " period gives way to " + esc(ph.next_change.next) + " around " + esc(fullDate(ph.next_change.transition_date)) + ".</p>" : "") + "</div>";
    }
    return '<div class="rd">' + (hi ? '<div class="rd-note-hi">The detailed reading is currently written in English. Chart names above follow your language choice.</div>' : "") +
      '<div class="rd-snap">' + snap + '</div><div class="rd-grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">' + about + now + "</div></div>";
  }

  function areas(r) {
    return '<div class="rd"><p class="k-note" style="margin:0">Each card looks at one part of life using the planets in your chart. The dial shows how well supported that area is: left side needs care, right side is strong.</p><div class="rd-grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">' +
      (r.areas || []).map(function (a) {
        return '<article class="rd-card rd-area"><div class="rd-area__top"><div class="rd-area__title"><i aria-hidden="true">' + esc(a.icon) + "</i><h3 style=\"margin:0\">" + esc(a.title) + '</h3></div>' +
          '<div style="display:grid;justify-items:center;gap:.35rem"><div class="rd-dial" style="--v:' + esc(a.score) + '" role="img" aria-label="' + esc(a.title + ": " + a.verdict_label) + '"><b></b></div><span class="rd-badge ' + esc(a.verdict) + '">' + esc(a.verdict_label) + "</span></div></div>" +
          "<p>" + esc(a.summary) + "</p>" +
          (a.helps && a.helps.length ? '<div class="rd-sub">What helps</div>' + list(a.helps, "good") : "") +
          (a.watch && a.watch.length ? '<div class="rd-sub">What to watch</div>' + list(a.watch, "care") : "") +
          '<div class="rd-tip">' + esc(a.tip) + "</div></article>";
      }).join("") + "</div></div>";
  }

  function dasha(r) {
    var rows = r.dasha || [], ph = r.phase || {};
    var head = ph.title ?
      '<div class="rd-card rd-now"><div class="rd-kicker">Running now</div><div class="rd-now__pair">' +
      '<div style="display:flex;gap:.8rem;align-items:center">' + coin(ph.maha.planet) + '<div><div class="rd-sub" style="margin:0">Mahadasha (main period)</div><strong class="rd-lead" style="font-size:1.2rem">' + esc(ph.maha.planet) + "</strong><div class=\"k-note\" style=\"color:#6b4f2c\">" + esc(fullDate(ph.maha.start)) + " to " + esc(fullDate(ph.maha.end)) + "</div></div></div>" +
      '<div style="display:flex;gap:.8rem;align-items:center">' + coin(ph.antar.planet) + '<div><div class="rd-sub" style="margin:0">Antardasha (sub-period)</div><strong class="rd-lead" style="font-size:1.2rem">' + esc(ph.antar.planet) + "</strong><div class=\"k-note\" style=\"color:#6b4f2c\">" + esc(fullDate(ph.antar.start)) + " to " + esc(fullDate(ph.antar.end)) + "</div></div></div></div>" +
      tube("Mahadasha progress", ph.progress) + tube("Antardasha progress", ph.antar_progress) + "</div>" : "";
    var intro = '<p class="k-note" style="margin:0">Your life moves through planetary chapters called Mahadashas (the Vimshottari system, based on your Moon). Each one is divided into smaller Antardashas. Tap a chapter to see its sub-periods.</p>';
    var table = rows.map(function (m, i) {
      var open = m.isCurrent;
      var tag = m.isCurrent ? "Running now" : (m.isPast ? "Completed" : "Upcoming");
      var subs = (m.antardashas || []).map(function (a) {
        return '<tr class="' + (a.isCurrent ? "is-current" : (dt(a.end) < new Date() ? "is-past" : "")) + '"><td>' + coin(a.planet) + " " + esc(a.planet) + "</td><td>" + esc(fullDate(a.start)) + "</td><td>" + esc(fullDate(a.end)) + "</td><td>" + esc(span(a)) + (a.isCurrent ? " &middot; now" : "") + "</td></tr>";
      }).join("");
      return '<div class="rd-mrow' + (m.isCurrent ? " is-current is-open" : "") + (m.isPast ? " is-past" : "") + '" data-idx="' + i + '">' +
        '<button type="button" aria-expanded="' + (open ? "true" : "false") + '">' + coin(m.planet) +
        '<span class="rd-mrow__name"><strong>' + esc(m.planet) + " Mahadasha</strong><small>" + esc(monthYear(m.start)) + " to " + esc(monthYear(m.end)) + " &middot; " + esc(span(m)) + '</small></span><span><span class="rd-mrow__tag">' + tag + '</span><span class="rd-mrow__chev" aria-hidden="true">▾</span></span></button>' +
        '<div class="rd-mrow__body"><p>' + esc(m.meaning) + "</p>" +
        '<div style="overflow-x:auto"><table class="rd-antar"><thead><tr><th>Antardasha</th><th>From</th><th>To</th><th>Length</th></tr></thead><tbody>' + subs + "</tbody></table></div></div></div>";
    }).join("");
    return '<div class="rd">' + intro + head + '<div class="rd-dasha">' + table + "</div></div>";
  }

  function doshas(r) {
    var items = (r.doshas || []).map(function (d) {
      var found = d.detected;
      var lvl = found ? ({ high: "Strong", medium: "Moderate", low: "Mild" }[d.level] || "Present") : "Not found";
      return '<article class="rd-card rd-dosha' + (found ? " is-found" : "") + '"><div class="rd-dosha__top"><h3 style="margin:0">' + esc(d.plain_name) + '</h3><span class="rd-badge ' + (found ? "care" : "strong") + '">' + esc(lvl) + "</span></div>" +
        "<p>" + (found ? "<strong>This was found in your chart.</strong> " + esc(d.what) : "<strong>This was not found in your chart.</strong> For reference: " + esc(d.what)) + "</p>" +
        (found ? "<p>" + esc(d.comfort) + "</p>" + (d.softeners && d.softeners.length ? '<div class="rd-sub">What softens it in your chart</div>' + list(d.softeners, "good") : "") : "") +
        '<details class="rd-tech"><summary>Technical detail</summary><p style="margin-top:.4rem">' + esc(d.technical) + (d.confidence ? " (confidence: " + esc(d.confidence) + ")" : "") + "</p></details></article>";
    }).join("");
    return '<div class="rd"><p class="k-note" style="margin:0">A dosha is a pattern that traditional astrology watches for. Finding one is common and is not a prediction of bad luck. Strong supporting planets and good periods reduce its effect.</p><div class="rd-grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">' + items + "</div></div>";
  }

  function remedies(r) {
    var rem = r.remedies || {};
    var cards = (rem.planets || []).map(function (c) {
      return '<article class="rd-card rd-rem"><div class="rd-rem__head">' + coin(c.planet) + '<div><h3 style="margin:0">Support your ' + esc(c.planet) + "</h3></div></div><p>" + esc(c.why) + "</p>" +
        '<ul class="rd-rem__rows">' +
        '<li><i>ॐ</i><span><b>Mantra</b>' + esc(c.mantra) + "</span></li>" +
        '<li><i>☾</i><span><b>Best day</b>' + esc(c.day) + " (a simple fast or light meal is traditional)</span></li>" +
        '<li><i>✦</i><span><b>Worship</b>' + esc(c.worship) + "</span></li>" +
        '<li><i>♡</i><span><b>Give (daan)</b>' + esc(c.donate) + "</span></li>" +
        '<li><i>☀</i><span><b>Daily habit</b>' + esc(c.habit) + "</span></li></ul>" +
        '<div class="rd-gem"><strong>Gemstone: ' + esc(c.gem.name) + ".</strong> Traditionally linked to this planet, " + esc(c.gem.note) + ". Please do not buy one without an astrologer checking your full chart.</div></article>";
    }).join("");
    var daily = (rem.daily || []).map(function (d) {
      return '<article class="rd-card"><div class="rd-area__title"><i aria-hidden="true" style="width:2.2rem;height:2.2rem;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle at 35% 28%,#fff6cf,#d9aa44 60%,#8a6218);border:1px solid #4e340d;font-style:normal">' + esc(d.icon) + '</i><h4 style="margin:0">' + esc(d.title) + '</h4></div><p style="margin-top:.5rem">' + esc(d.why) + '</p><div class="rd-sub">How often</div><p><strong>' + esc(d.when) + "</strong> &middot; " + esc(d.kind) + "</p></article>";
    }).join("");
    return '<div class="rd"><p class="k-note" style="margin:0">' + esc(rem.intro) + "</p>" +
      '<div class="rd-sub" style="color:#e9d9b4">Planet remedies for you</div><div class="rd-grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">' + cards + "</div>" +
      (daily ? '<div class="rd-sub" style="color:#e9d9b4">Everyday practices</div><div class="rd-grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">' + daily + "</div>" : "") +
      '<div class="rd-cta"><a href="/pandit-for-navagraha-in-patna/">Book a pandit for Graha Shanti</a><a class="alt" href="/astrologers/">Talk to an astrologer</a></div>' +
      '<div class="rd-disclaimer">' + esc(rem.disclaimer) + "</div></div>";
  }

  /* ---------------- wiring ---------------- */
  function set(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }

  function render(state) {
    var r = state && state.data && state.data.reading;
    if (!r) return; // older payload: keep the original panes
    var hi = state.lang === "hi";
    set("tabOverview", overview(r, hi));
    set("tabPredictions", areas(r));
    set("tabDasha", dasha(r));
    set("tabDosha", doshas(r));
    set("tabRemedies", remedies(r));
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest(".rd-mrow > button");
    if (!btn) return;
    var row = btn.parentElement, open = !row.classList.contains("is-open");
    row.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  window.KundaliReading = { render: render };
})();
