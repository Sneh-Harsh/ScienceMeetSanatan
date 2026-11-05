/* Kundali: easy-language reading, Dasha / Antardasha, doshas and remedies, in English or Hindi.
   Everything shown comes from payload.reading, which the server builds from the chart that was just calculated. */
(function () {
  "use strict";

  var SYM = { Sun: "☉", Moon: "☽", Mars: "♂", Mercury: "☿", Jupiter: "♃", Venus: "♀", Saturn: "♄", Rahu: "☊", Ketu: "☋" };
  var T = function (k, v) { return window.KI ? KI.t(k, v) : k; };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function monthYear(iso) { return KI.date(iso, false); }
  function fullDate(iso) { return KI.date(iso, true); }
  function pl(p) { return window.KI ? KI.planet(p) : p; }
  function coin(planet) {
    return '<span class="rd-coin planet-chip--' + esc(String(planet).toLowerCase()) + '" aria-hidden="true">' + esc(SYM[planet] || String(planet).slice(0, 2)) + "</span>";
  }
  function list(items, cls) {
    if (!items || !items.length) return "";
    return '<ul class="rd-list ' + (cls || "") + '">' + items.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
  }
  function chips(items, cls) {
    if (!items || !items.length) return "";
    return '<ul class="rd-chips ' + cls + '">' + items.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
  }
  function tube(label, pct, right) {
    pct = Math.max(0, Math.min(100, Number(pct) || 0));
    return '<div class="rd-meter"><div><span>' + esc(label) + "</span><span>" + esc(right != null ? right : T("pct_done", { n: pct })) + '</span></div><div class="rd-tube" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="' + esc(label) + '"><i style="--p:' + pct + '"></i></div></div>';
  }
  function tone(e) { return e && e.tone ? '<span class="rd-tone ' + esc(e.tone) + '">' + esc(e.tone_label) + "</span>" : ""; }

  /* ---------------- tabs ---------------- */
  function overview(r) {
    var p = r.personality || {}, ph = r.phase || {};
    var snap = (r.snapshot || []).map(function (s) {
      return '<div class="rd-medal"><small>' + esc(s.label) + "</small><strong>" + esc(s.value) + "</strong><span>" + esc(s.sub) + "</span></div>";
    }).join("");
    var about =
      '<div class="rd-card"><div class="rd-kicker">' + esc(T("about_you")) + '</div><div class="rd-lead">' + esc(p.headline) + "</div>" +
      (p.paragraphs || []).map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") +
      (p.strengths && p.strengths.length ? '<div class="rd-sub">' + esc(T("your_strengths")) + "</div>" + chips(p.strengths, "good") : "") +
      (p.watch && p.watch.length ? '<div class="rd-sub">' + esc(T("things_watch")) + "</div>" + chips(p.watch, "care") : "") +
      (p.notes && p.notes.length ? '<div class="rd-sub">' + esc(T("good_to_know")) + "</div>" + list(p.notes) : "") + "</div>";
    var now = "";
    if (ph.title && ph.maha && ph.antar) {
      var ae = ph.antar_effect;
      now =
        '<div class="rd-card"><div class="rd-kicker">' + esc(T("right_now")) + '</div><div class="rd-lead">' + esc(ph.title) + "</div>" +
        tube(T("main_period") + ": " + pl(ph.maha.planet), ph.progress, monthYear(ph.maha.start) + " – " + monthYear(ph.maha.end)) +
        tube(T("sub_period") + ": " + pl(ph.antar.planet), ph.antar_progress, monthYear(ph.antar.start) + " – " + monthYear(ph.antar.end)) +
        "<p>" + esc(ph.gist_maha) + "</p>" +
        (ae ? '<div class="rd-effect ' + esc(ae.tone) + '"><div class="rd-sub" style="margin-top:0">' + esc(T("how_affects", { p: pl(ph.antar.planet) })) + " " + tone(ae) + "</div><p>" + esc(ph.gist_antar) + "</p>" +
          (ae.careful ? '<p class="rd-careful"><strong>' + esc(T("watch_out")) + "</strong> " + esc(ae.careful) + "</p>" : "") + "</div>" : "") +
        (ph.do && ph.do.length ? '<div class="rd-tip">' + esc(ph.do[0]) + "</div>" : "") +
        (ph.caution ? '<p style="margin-top:.6rem"><strong>' + esc(T("watch_out")) + "</strong> " + esc(ph.caution) + "</p>" : "") +
        (ph.next_change && ph.next_change.transition_date ? "<p><strong>" + esc(T("next_big")) + "</strong> " + esc(T("gives_way", { a: pl(ph.next_change.active), b: pl(ph.next_change.next), d: fullDate(ph.next_change.transition_date) })) + "</p>" : "") +
        '<p class="k-note" style="margin:.4rem 0 0;color:#6b4f2c">' + esc(T("full_timeline")) + "</p></div>";
    }
    return '<div class="rd"><div class="rd-snap">' + snap + '</div><div class="rd-grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">' + about + now + "</div></div>";
  }

  function areas(r) {
    return '<div class="rd"><p class="k-note" style="margin:0">' + esc(T("areas_note")) + '</p><div class="rd-grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">' +
      (r.areas || []).map(function (a) {
        return '<article class="rd-card rd-area"><div class="rd-area__top"><div class="rd-area__title"><i aria-hidden="true">' + esc(a.icon) + '</i><h3 style="margin:0">' + esc(a.title) + "</h3></div>" +
          '<div style="display:grid;justify-items:center;gap:.35rem"><div class="rd-dial" style="--v:' + esc(a.score) + '" role="img" aria-label="' + esc(a.title + ": " + a.verdict_label) + '"><b></b></div><span class="rd-badge ' + esc(a.verdict) + '">' + esc(a.verdict_label) + "</span></div></div>" +
          "<p>" + esc(a.summary) + "</p>" +
          (a.helps && a.helps.length ? '<div class="rd-sub">' + esc(T("what_helps")) + "</div>" + list(a.helps, "good") : "") +
          (a.watch && a.watch.length ? '<div class="rd-sub">' + esc(T("what_watch")) + "</div>" + list(a.watch, "care") : "") +
          '<div class="rd-tip">' + esc(a.tip) + "</div></article>";
      }).join("") + "</div></div>";
  }

  function dasha(r) {
    var rows = r.dasha || [], ph = r.phase || {};
    var head = ph.title && ph.maha ?
      '<div class="rd-card rd-now"><div class="rd-kicker">' + esc(T("running_now")) + '</div><div class="rd-now__pair">' +
      '<div style="display:flex;gap:.8rem;align-items:center">' + coin(ph.maha.planet) + '<div><div class="rd-sub" style="margin:0">' + esc(T("maha_main")) + '</div><strong class="rd-lead" style="font-size:1.2rem">' + esc(pl(ph.maha.planet)) + '</strong><div class="k-note" style="color:#6b4f2c">' + esc(fullDate(ph.maha.start)) + " – " + esc(fullDate(ph.maha.end)) + "</div></div></div>" +
      '<div style="display:flex;gap:.8rem;align-items:center">' + coin(ph.antar.planet) + '<div><div class="rd-sub" style="margin:0">' + esc(T("antar_sub")) + '</div><strong class="rd-lead" style="font-size:1.2rem">' + esc(pl(ph.antar.planet)) + '</strong><div class="k-note" style="color:#6b4f2c">' + esc(fullDate(ph.antar.start)) + " – " + esc(fullDate(ph.antar.end)) + "</div></div></div></div>" +
      tube(T("maha_progress"), ph.progress) + tube(T("antar_progress"), ph.antar_progress) + "</div>" : "";
    var intro = '<p class="k-note" style="margin:0">' + esc(T("dasha_intro")) + "</p>";
    var hi = window.KI && KI.lang() === "hi";
    var table = rows.map(function (m, i) {
      var tag = m.isCurrent ? T("running_now") : (m.isPast ? T("completed") : T("upcoming"));
      var subs = (m.antardashas || []).map(function (a) {
        var e = a.effect || {};
        return '<div class="rd-ant' + (a.isCurrent ? " is-current is-open" : "") + (a.isPast ? " is-past" : "") + '">' +
          '<button type="button" class="rd-ant__head" aria-expanded="' + (a.isCurrent ? "true" : "false") + '">' + coin(a.planet) +
          '<span class="rd-ant__name"><strong>' + esc(pl(m.planet)) + " – " + esc(pl(a.planet)) + (a.isCurrent ? '<em class="rd-now-dot">' + esc(T("now")) + "</em>" : "") + "</strong><small>" + esc(fullDate(a.start)) + " – " + esc(fullDate(a.end)) + " &middot; " + esc(T("ages", { a: a.ageStart, b: a.ageEnd })) + " &middot; " + esc(a.span) + "</small></span>" +
          tone(e) + '<span class="rd-mrow__chev" aria-hidden="true">▾</span></button>' +
          '<div class="rd-ant__body"><p class="rd-ant__sum"><strong>' + esc(e.summary) + "</strong></p>" + (e.text || []).map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") +
          (e.good_for && e.good_for.length ? '<div class="rd-sub">' + esc(T("good_for")) + "</div>" + chips(e.good_for, "good") : "") +
          (e.careful ? '<p class="rd-careful"><strong>' + esc(T("watch_out")) + "</strong> " + esc(e.careful) + "</p>" : "") + "</div></div>";
      }).join("");
      return '<div class="rd-mrow' + (m.isCurrent ? " is-current is-open" : "") + (m.isPast ? " is-past" : "") + '" data-idx="' + i + '">' +
        '<button type="button" aria-expanded="' + (m.isCurrent ? "true" : "false") + '">' + coin(m.planet) +
        '<span class="rd-mrow__name"><strong>' + esc(pl(m.planet)) + " " + (hi ? "महादशा" : "Mahadasha") + "</strong><small>" + esc(monthYear(m.start)) + " – " + esc(monthYear(m.end)) + " &middot; " + esc(T("ages", { a: m.ageStart, b: m.ageEnd })) + " &middot; " + esc(m.span) + '</small></span><span class="rd-mrow__side"><span class="rd-mrow__tag">' + esc(tag) + '</span><span class="rd-mrow__chev" aria-hidden="true">▾</span></span></button>' +
        '<div class="rd-mrow__body"><p>' + esc(m.meaning) + '</p><div class="rd-sub">' + esc(T("sub_periods_title")) + '</div><div class="rd-ants">' + subs + "</div></div></div>";
    }).join("");
    return '<div class="rd">' + intro + head + '<div class="rd-dasha">' + table + "</div>" +
      '<details class="rd-method"><summary>' + esc(T("method_title")) + "</summary><p>" + esc(r.method) + "</p></details></div>";
  }

  function doshas(r) {
    var LV = { mild: "lvl_mild", medium: "lvl_medium", strong: "lvl_strong" };
    var items = (r.doshas || []).map(function (d) {
      var found = d.detected;
      var lvl = found ? T(LV[d.level] || "lvl_present") : T("lvl_none");
      return '<article class="rd-card rd-dosha' + (found ? " is-found" : "") + '"><div class="rd-dosha__top"><h3 style="margin:0">' + esc(d.plain_name) + '</h3><span class="rd-badge ' + (found ? "care" : "strong") + '">' + esc(lvl) + "</span></div>" +
        "<p><strong>" + esc(found ? T("found") : T("not_found")) + "</strong> " + (found ? "" : esc(T("for_ref")) + " ") + esc(d.what) + "</p>" +
        (found ? "<p>" + esc(d.comfort) + "</p>" + (d.softeners && d.softeners.length ? '<div class="rd-sub">' + esc(T("softens")) + "</div>" + list(d.softeners, "good") : "") : "") +
        '<details class="rd-tech"><summary>' + esc(T("technical")) + '</summary><p style="margin-top:.4rem">' + esc(d.technical) + (d.confidence ? " (" + esc(T("confidence")) + ": " + esc(d.confidence) + ")" : "") + "</p></details></article>";
    }).join("");
    return '<div class="rd"><p class="k-note" style="margin:0">' + esc(T("dosha_intro")) + '</p><div class="rd-grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">' + items + "</div></div>";
  }

  function remedies(r) {
    var rem = r.remedies || {};
    var cards = (rem.planets || []).map(function (c) {
      return '<article class="rd-card rd-rem"><div class="rd-rem__head">' + coin(c.planet) + '<div><h3 style="margin:0">' + esc(T("support_planet", { p: pl(c.planet) })) + "</h3></div></div><p>" + esc(c.why) + "</p>" +
        '<ul class="rd-rem__rows">' +
        "<li><i>ॐ</i><span><b>" + esc(T("mantra")) + "</b>" + esc(c.mantra) + "</span></li>" +
        "<li><i>☾</i><span><b>" + esc(T("best_day")) + "</b>" + esc(c.day) + " " + esc(T("day_note")) + "</span></li>" +
        "<li><i>✦</i><span><b>" + esc(T("worship")) + "</b>" + esc(c.worship) + "</span></li>" +
        "<li><i>♡</i><span><b>" + esc(T("give")) + "</b>" + esc(c.donate) + "</span></li>" +
        "<li><i>☀</i><span><b>" + esc(T("habit")) + "</b>" + esc(c.habit) + "</span></li></ul>" +
        '<div class="rd-gem"><strong>' + esc(T("gemstone")) + ": " + esc(c.gem.name) + ".</strong> " + esc(T("gem_text", { note: c.gem.note })) + "</div></article>";
    }).join("");
    var daily = (rem.daily || []).map(function (d) {
      return '<article class="rd-card"><div class="rd-area__title"><i aria-hidden="true" style="width:2.2rem;height:2.2rem;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle at 35% 28%,#fff6cf,#d9aa44 60%,#8a6218);border:1px solid #4e340d;font-style:normal">' + esc(d.icon) + '</i><h4 style="margin:0">' + esc(d.title) + '</h4></div><p style="margin-top:.5rem">' + esc(d.why) + '</p><div class="rd-sub">' + esc(T("how_often")) + "</div><p><strong>" + esc(d.when) + "</strong> &middot; " + esc(d.kind) + "</p></article>";
    }).join("");
    return '<div class="rd"><p class="k-note" style="margin:0">' + esc(rem.intro) + "</p>" +
      '<div class="rd-sub" style="color:#e9d9b4">' + esc(T("rem_planets")) + '</div><div class="rd-grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">' + cards + "</div>" +
      (daily ? '<div class="rd-sub" style="color:#e9d9b4">' + esc(T("rem_daily")) + '</div><div class="rd-grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">' + daily + "</div>" : "") +
      '<div class="rd-cta"><a href="/pandit-for-navagraha-in-patna/">' + esc(T("book_pandit")) + '</a><a class="alt" href="/astrologers/">' + esc(T("talk_astro")) + "</a></div>" +
      '<div class="rd-disclaimer">' + esc(rem.disclaimer) + "</div></div>";
  }

  /* ---------------- wiring ---------------- */
  function set(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }

  function render(state) {
    var r = state && state.data && state.data.reading;
    if (!r) return; // older payload: keep the original panes
    set("tabOverview", overview(r));
    set("tabPredictions", areas(r));
    set("tabDasha", dasha(r));
    set("tabDosha", doshas(r));
    set("tabRemedies", remedies(r));
  }

  document.addEventListener("click", function (e) {
    var ab = e.target.closest && e.target.closest(".rd-ant__head");
    if (ab) {
      var card = ab.parentElement, o = !card.classList.contains("is-open");
      card.classList.toggle("is-open", o);
      ab.setAttribute("aria-expanded", o ? "true" : "false");
      return;
    }
    var btn = e.target.closest && e.target.closest(".rd-mrow > button");
    if (!btn) return;
    var row = btn.parentElement, open = !row.classList.contains("is-open");
    row.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  window.KundaliReading = { render: render };
})();
