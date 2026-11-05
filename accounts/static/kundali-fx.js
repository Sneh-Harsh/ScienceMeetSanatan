/* Kundali page polish: cursor spotlight on glass panels and a smooth hand-off to the chart once it is ready. */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;


  // living background: slowly turning astrolabe rings, breathing glows, twinkling stars and drifting embers
  var bg = document.querySelector(".kx-bg");
  if (bg) {
    var small = window.matchMedia("(max-width: 640px)").matches;
    var VS = "\uFE0E"; // force the plain text glyph, not the coloured emoji
    var Z = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"].map(function (g) { return g + VS; }), P = ["☉", "☽", "♂", "☿", "♃", "♀", "♄", "☊", "☋"].map(function (g) { return g + VS; });
    function ringSvg(kind) {
      var out = '<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="none" stroke="#e6b95a" stroke-linecap="round">';
      out += '<circle cx="500" cy="500" r="494" stroke-width="3"/><circle cx="500" cy="500" r="470" stroke-width="1.2"/><circle cx="500" cy="500" r="478" stroke-width="6" stroke-dasharray="1.6 11.4"/>';
      out += '<g class="kx-spin' + (kind === "b" ? " kx-spin--rev" : "") + '"><circle cx="500" cy="500" r="395" stroke-width="1.4"/><circle cx="500" cy="500" r="330" stroke-width="1"/>';
      for (var i = 0; i < 12; i++) {
        var a = i * 30, rad = a * Math.PI / 180;
        out += '<line x1="' + (500 + 330 * Math.sin(rad)).toFixed(1) + '" y1="' + (500 - 330 * Math.cos(rad)).toFixed(1) + '" x2="' + (500 + 470 * Math.sin(rad)).toFixed(1) + '" y2="' + (500 - 470 * Math.cos(rad)).toFixed(1) + '" stroke-width="1.4"/>';
      }
      out += "</g></g>";
      out += '<g class="kx-spin' + (kind === "b" ? " kx-spin--rev" : "") + '" fill="#e6b95a" font-size="54" text-anchor="middle" font-family="serif">';
      for (var j = 0; j < 12; j++) {
        var ang = (j * 30 + 15) * Math.PI / 180;
        out += '<text x="' + (500 + 432 * Math.sin(ang)).toFixed(1) + '" y="' + (500 - 432 * Math.cos(ang) + 18).toFixed(1) + '">' + Z[j] + "</text>";
      }
      out += "</g>";
      out += '<g class="kx-spin kx-spin--slow' + (kind === "b" ? "" : " kx-spin--rev") + '" fill="#e6b95a" font-size="40" text-anchor="middle" font-family="serif" stroke="none">';
      for (var k = 0; k < 9; k++) {
        var an = k * 40 * Math.PI / 180;
        out += '<text x="' + (500 + 262 * Math.sin(an)).toFixed(1) + '" y="' + (500 - 262 * Math.cos(an) + 14).toFixed(1) + '">' + P[k] + "</text>";
      }
      out += '</g><g class="kx-spin kx-spin--slow" fill="none" stroke="#e6b95a" stroke-width="1.2"><circle cx="500" cy="500" r="190"/><circle cx="500" cy="500" r="150" stroke-dasharray="3 9"/><path d="M500 310 L546 454 L690 500 L546 546 L500 690 L454 546 L310 500 L454 454Z"/></g></svg>';
      return out;
    }
    var h = '<div class="kx-lamp"></div><div class="kx-rays"></div><div class="kx-fog kx-fog--1"></div><div class="kx-fog kx-fog--2"></div>' +
      '<div class="kx-ring kx-ring--a">' + ringSvg("a") + '</div><div class="kx-ring kx-ring--b">' + ringSvg("b") + '</div><div class="kx-spot"></div><canvas class="kx-canvas" aria-hidden="true"></canvas>';
    bg.insertAdjacentHTML("afterbegin", h);
    startSky(bg.querySelector(".kx-canvas"), small);
    var spot = bg.querySelector(".kx-spot"), tx = innerWidth * 0.7, ty = innerHeight * 0.3, cxs = tx, cys = ty;
    if (!reduce && window.matchMedia("(hover: hover)").matches) {
      window.addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
      (function loop() { cxs += (tx - cxs) * 0.06; cys += (ty - cys) * 0.06; spot.style.setProperty("--mx", cxs.toFixed(0) + "px"); spot.style.setProperty("--my", cys.toFixed(0) + "px"); requestAnimationFrame(loop); })();
    }
    if (!reduce) {
      var sy = 0, ticking = false;
      window.addEventListener("scroll", function () {
        sy = window.scrollY;
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () { bg.style.setProperty("--sy", sy); ticking = false; });
      }, { passive: true });
    }
  }



  // ---- living sky: dust in the light, soft bokeh, rising embers, far stars and the odd shooting star (canvas, ~60 particles) ----
  function startSky(canvas, small) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d"), W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 1.5), parts = [], px = 0, py = 0, tpx = 0, tpy = 0, sy = 0, shoot = null, nextShoot = 6000 + Math.random() * 8000, last = performance.now(), visible = true;
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function make(kind, initial) {
      var p = { k: kind, x: rnd(0, W), y: initial ? rnd(0, H) : H + 20, z: rnd(.2, 1), ph: rnd(0, 6.28) };
      if (kind === "dust") { p.r = rnd(.5, 1.7); p.vx = rnd(-6, 6); p.vy = rnd(-9, 3); p.a = rnd(.25, .8); }
      if (kind === "bokeh") { p.r = rnd(18, 64); p.vx = rnd(-3, 3); p.vy = rnd(-7, -2); p.a = rnd(.025, .07); p.hue = Math.random() < .6 ? "255,190,110" : "255,150,90"; if (!initial) p.y = H + p.r; }
      if (kind === "ember") { p.r = rnd(1, 2.6); p.vx = rnd(-8, 10); p.vy = rnd(-34, -14); p.a = rnd(.5, 1); p.life = 0; p.max = rnd(7, 15); if (initial) p.life = rnd(0, p.max); }
      if (kind === "star") { p.r = rnd(.4, 1.2); p.vx = 0; p.vy = 0; p.a = rnd(.2, .8); p.y = rnd(0, H * .7); }
      return p;
    }
    function resize() {
      W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
      canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      parts = []; var n = small ? 0.55 : 1, i;
      for (i = 0; i < 46 * n; i++) parts.push(make("dust", true));
      for (i = 0; i < 9 * n; i++) parts.push(make("bokeh", true));
      for (i = 0; i < 16 * n; i++) parts.push(make("ember", true));
      for (i = 0; i < 26 * n; i++) parts.push(make("star", true));
    }
    resize(); window.addEventListener("resize", resize);
    if (window.matchMedia("(hover: hover)").matches) window.addEventListener("pointermove", function (e) { tpx = (e.clientX / innerWidth - .5) * 2; tpy = (e.clientY / innerHeight - .5) * 2; }, { passive: true });
    window.addEventListener("scroll", function () { sy = window.scrollY; }, { passive: true });
    document.addEventListener("visibilitychange", function () { visible = document.visibilityState === "visible"; last = performance.now(); });
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible) return;
      var dt = Math.min(.05, (now - last) / 1000); last = now;
      px += (tpx - px) * .04; py += (tpy - py) * .04;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.ph += dt * (p.k === "star" ? 1.6 : 1);
        if (p.k === "star") {
          ctx.globalAlpha = p.a * (.35 + .65 * Math.abs(Math.sin(p.ph)));
          ctx.fillStyle = "#fff3d6"; ctx.beginPath(); ctx.arc(p.x + px * 4 * p.z, p.y + py * 3 * p.z, p.r, 0, 6.283); ctx.fill(); continue;
        }
        p.x += (p.vx + Math.sin(p.ph * .7) * 6) * dt * (p.k === "bokeh" ? 1 : p.z + .4);
        p.y += p.vy * dt * (p.k === "ember" ? 1 : p.z + .4);
        if (p.k === "ember") { p.life += dt; if (p.life > p.max || p.y < -20) { parts[i] = make("ember", false); continue; } }
        else if (p.y < -p.r - 10 || p.x < -80 || p.x > W + 80) { parts[i] = make(p.k, false); if (p.x < -80 || p.x > W + 80) parts[i].x = rnd(0, W); continue; }
        var ox = px * 22 * p.z, oy = py * 16 * p.z - (sy * .03 * p.z) % H;
        var x = p.x + ox, y = p.y + oy;
        if (p.k === "dust") {
          var lit = Math.max(0, 1 - Math.hypot(x - W * .15, y - 0) / (W * .95));     // brighter inside the lamp's light
          ctx.globalAlpha = p.a * (.25 + lit * .9) * (.6 + .4 * Math.sin(p.ph * 2.2));
          ctx.fillStyle = "#ffe6b8"; ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.283); ctx.fill();
        } else if (p.k === "bokeh") {
          var g = ctx.createRadialGradient(x, y, p.r * .15, x, y, p.r);
          g.addColorStop(0, "rgba(" + p.hue + ",0)"); g.addColorStop(.75, "rgba(" + p.hue + "," + (p.a).toFixed(3) + ")"); g.addColorStop(1, "rgba(" + p.hue + ",0)");
          ctx.globalAlpha = .75 + .25 * Math.sin(p.ph); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.283); ctx.fill();
        } else {
          var f = 1 - p.life / p.max, flick = .6 + .4 * Math.sin(p.ph * 9);
          var gg = ctx.createRadialGradient(x, y, 0, x, y, p.r * 5);
          gg.addColorStop(0, "rgba(255,240,190," + (p.a * f * flick).toFixed(3) + ")"); gg.addColorStop(.3, "rgba(255,160,60," + (p.a * f * .5).toFixed(3) + ")"); gg.addColorStop(1, "rgba(255,100,20,0)");
          ctx.globalAlpha = 1; ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, p.r * 5, 0, 6.283); ctx.fill();
        }
      }
      // shooting star
      nextShoot -= dt * 1000;
      if (!shoot && nextShoot <= 0) { shoot = { x: rnd(0, W * .6), y: rnd(0, H * .3), vx: rnd(520, 760), vy: rnd(160, 300), life: 0 }; nextShoot = 9000 + Math.random() * 12000; }
      if (shoot) {
        shoot.life += dt; shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt;
        var a = Math.max(0, 1 - shoot.life / .9), tl = 120, nx = shoot.vx / Math.hypot(shoot.vx, shoot.vy), ny = shoot.vy / Math.hypot(shoot.vx, shoot.vy);
        var lg = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - nx * tl, shoot.y - ny * tl); lg.addColorStop(0, "rgba(255,244,210," + a + ")"); lg.addColorStop(1, "rgba(255,200,120,0)");
        ctx.globalAlpha = 1; ctx.strokeStyle = lg; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - nx * tl, shoot.y - ny * tl); ctx.stroke();
        if (shoot.life > .9) shoot = null;
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    }
    if (reduce) { frame(performance.now()); visible = false; } else requestAnimationFrame(frame);
  }

  // ---- scroll navigation helper: fades, arrows, progress track and a first-time nudge ----
  function enhanceScroller(el, opts) {
    if (!el || el.dataset.kxSn) return null;
    el.dataset.kxSn = "1";
    var wrap = document.createElement("div");
    wrap.className = "kx-sn" + (opts && opts.cls ? " " + opts.cls : "");
    el.parentNode.insertBefore(wrap, el);
    el.classList.add("kx-sn__scroll");
    wrap.appendChild(el);
    var l = document.createElement("button"), r = document.createElement("button");
    l.type = r.type = "button"; l.className = "kx-sn__btn kx-sn__btn--l"; r.className = "kx-sn__btn kx-sn__btn--r";
    l.setAttribute("aria-label", KI.t("scroll_l")); r.setAttribute("aria-label", KI.t("scroll_r")); l.setAttribute("data-i18n-aria", "scroll_l"); r.setAttribute("data-i18n-aria", "scroll_r"); l.textContent = "‹"; r.textContent = "›";
    var track = document.createElement("div"); track.className = "kx-sn__track"; track.setAttribute("aria-hidden", "true"); track.innerHTML = "<i></i>";
    wrap.appendChild(l); wrap.appendChild(r); wrap.appendChild(track);
    function update() {
      var max = el.scrollWidth - el.clientWidth, x = el.scrollLeft;
      wrap.classList.toggle("can-left", x > 4);
      wrap.classList.toggle("can-right", x < max - 4);
      var bar = track.firstChild, share = max > 0 ? el.clientWidth / el.scrollWidth : 1;
      bar.style.width = Math.max(18, share * 100) + "%";
      bar.style.left = (max > 0 ? (x / max) * (100 - Math.max(18, share * 100)) : 0) + "%";
    }
    function step(dir) { el.scrollBy({ left: dir * Math.max(140, el.clientWidth * 0.6), behavior: reduce ? "auto" : "smooth" }); }
    l.addEventListener("click", function () { step(-1); }); r.addEventListener("click", function () { step(1); });
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    if ("ResizeObserver" in window) new ResizeObserver(update).observe(el);
    setTimeout(update, 60);
    wrap.update = update;
    if (!reduce && !(opts && opts.noHint)) {
      var seen = false;
      try { seen = sessionStorage.getItem("kxSnHint") === "1"; } catch (e) { /* ignore */ }
      if (!seen) {
        setTimeout(function () {
          if (el.scrollWidth > el.clientWidth + 8 && wrap.offsetParent) {
            wrap.classList.add("hint");
            try { sessionStorage.setItem("kxSnHint", "1"); } catch (e) { /* ignore */ }
            setTimeout(function () { wrap.classList.remove("hint"); }, 3200);
          }
        }, 900);
      }
    }
    return wrap;
  }

  // ---- app bar for phones: one section at a time, like an app ----
  var APPS = [["chart", "◈", "app_chart"], ["reading", "✎", "app_reading"], ["areas", "♡", "app_life"], ["dasha", "◷", "app_dasha"], ["dosha", "⚑", "app_dosha"], ["remedies", "✿", "app_remedies"], ["planets", "☉", "app_planets"], ["sky", "☄", "app_sky"]];
  var PANE = { reading: "overview", areas: "predictions", dasha: "dasha", dosha: "dosha", remedies: "remedies", planets: "planets" };
  var outEl = document.getElementById("kOutput");
  if (outEl) {
    var bar = document.createElement("nav");
    bar.className = "kx-appbar"; bar.setAttribute("aria-label", KI.t("sections")); bar.setAttribute("data-i18n-aria", "sections");
    bar.innerHTML = '<div class="kx-appbar__in">' + APPS.map(function (a, i) {
      return '<button type="button" data-app="' + a[0] + '"' + (i === 0 ? ' class="is-active" aria-current="true"' : "") + "><i aria-hidden=\"true\">" + a[1] + "</i><span data-i18n=\"" + a[2] + "\">" + KI.t(a[2]) + "</span></button>";
    }).join("") + "</div>";
    outEl.insertBefore(bar, outEl.firstChild);
    outEl.setAttribute("data-app", "chart");
    var sn = enhanceScroller(bar.firstChild, { noHint: false });
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-app]");
      if (!b) return;
      var key = b.getAttribute("data-app");
      outEl.setAttribute("data-app", key);
      bar.querySelectorAll("button").forEach(function (x) { var on = x === b; x.classList.toggle("is-active", on); if (on) x.setAttribute("aria-current", "true"); else x.removeAttribute("aria-current"); });
      if (PANE[key] && typeof setActiveTab === "function") setActiveTab(PANE[key]);
      try { b.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" }); } catch (err) { /* ignore */ }
      var top = bar.getBoundingClientRect().top + window.scrollY - 84;
      if (window.matchMedia("(max-width: 760px)").matches) window.scrollTo({ top: Math.max(0, outEl.getBoundingClientRect().top + window.scrollY - 84), behavior: reduce ? "auto" : "smooth" });
    });
  }
  // the desktop tab bar gets the same affordances
  enhanceScroller(document.querySelector(".k-tabs__head"), { noHint: true });

  // 3D chart plate: gently floats, and tilts toward the pointer while you hover over it
  var plates = document.querySelectorAll(".north-chart, .south-chart");
  plates.forEach(function (el) { if (!reduce) el.classList.add("is-floating"); });
  var shell = document.querySelector(".chart-shell");
  if (shell && !reduce && window.matchMedia("(hover: hover)").matches) {
    var idle = 0;
    shell.addEventListener("pointermove", function (e) {
      var r = shell.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      plates.forEach(function (el) {
        el.classList.remove("is-floating");
        el.style.setProperty("--ry", (x * 22).toFixed(1) + "deg");
        el.style.setProperty("--rx", (12 - y * 16).toFixed(1) + "deg");
      });
      clearTimeout(idle);
    });
    shell.addEventListener("pointerleave", function () {
      idle = setTimeout(function () {
        plates.forEach(function (el) { el.style.removeProperty("--ry"); el.style.removeProperty("--rx"); el.classList.add("is-floating"); });
      }, 2500);
    });
  }

  // spotlight: expose the pointer position to CSS (--mx / --my) for the panel under the cursor
  if (!reduce && window.matchMedia("(hover: hover)").matches) {
    var raf = 0;
    document.addEventListener("pointermove", function (e) {
      var panel = e.target.closest && e.target.closest(".kx .glass-panel");
      if (!panel || raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var r = panel.getBoundingClientRect();
        panel.style.setProperty("--mx", (e.clientX - r.left) + "px");
        panel.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    }, { passive: true });
  }

  // after the visitor presses Generate, bring the fresh chart into view (the page also draws a sample chart on load,
  // which must not move the page)
  var out = document.getElementById("kOutput");
  var btn = document.getElementById("generateBtn");
  var want = false;
  function reveal() {
    var target = document.querySelector(".kx-summary") || out;
    if (!target) return;
    var top = target.getBoundingClientRect().top + window.scrollY - 92;
    window.scrollTo({ top: top, behavior: reduce ? "auto" : "smooth" });
  }
  if (btn) {
    btn.addEventListener("click", function () {
      want = true;
      setTimeout(function () { want = false; }, 15000);
    });
  }
  var loading = document.getElementById("kLoading");
  if (loading && "MutationObserver" in window) {
    new MutationObserver(function () {
      if (loading.hidden && want) { want = false; setTimeout(reveal, 150); }
    }).observe(loading, { attributes: true, attributeFilter: ["hidden"] });
  }
})();
