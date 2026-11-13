/* Baby names background: a living nursery sky.
   Lotus petals drift down, glass letter bubbles float up (tap one to see names that start with it),
   golden sparkles follow your finger or mouse, and the colours turn rose for girl names, blue-gold for boy names.
   It pauses when the tab is hidden, shows one still frame for people who prefer reduced motion,
   and uses fewer shapes on phones. */
(function () {
  "use strict";
  var sky = document.querySelector(".bn-sky");
  if (!sky) return;

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = window.matchMedia && window.matchMedia("(max-width: 760px)").matches;
  var canvas = document.createElement("canvas");
  canvas.className = "bn-fx";
  canvas.setAttribute("aria-hidden", "true");
  sky.appendChild(canvas);
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var W = 0, H = 0, dpr = 1;
  var PALETTES = {
    girl: { petals: [[255, 150, 178], [255, 196, 214], [255, 209, 140]], glow: [255, 170, 190], bubble: [255, 214, 226] },
    boy: { petals: [[140, 178, 255], [255, 214, 140], [186, 168, 255]], glow: [150, 190, 255], bubble: [214, 226, 255] }
  };
  var cur = JSON.parse(JSON.stringify(PALETTES.girl));
  var target = PALETTES.girl;

  function lerpTo(a, b, k) { for (var i = 0; i < 3; i++) a[i] += (b[i] - a[i]) * k; }
  function rgba(c, a) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a + ")"; }
  function easePalette() {
    var want = PALETTES[document.body.getAttribute("data-gender") === "boy" ? "boy" : "girl"];
    if (want !== target) target = want;
    for (var i = 0; i < 3; i++) lerpTo(cur.petals[i], target.petals[i], 0.04);
    lerpTo(cur.glow, target.glow, 0.04);
    lerpTo(cur.bubble, target.bubble, 0.04);
  }

  /* each bubble shows a letter; Devanagari ones map to the English letter they sound like */
  var LETTERS = [
    ["A", "A"], ["अ", "A"], ["S", "S"], ["श्री", "S"], ["K", "K"], ["क", "K"], ["R", "R"], ["ॐ", "OM"],
    ["M", "M"], ["म", "M"], ["V", "V"], ["D", "D"], ["G", "G"], ["ग", "G"], ["L", "L"], ["P", "P"],
    ["T", "T"], ["N", "N"], ["H", "H"], ["J", "J"]
  ];

  var petals = [], bubbles = [], dust = [], sparks = [];
  var mx = -999, my = -999, tmx = 0, tmy = 0, px = 0, py = 0, scrollY = 0, lastTrail = 0, hoverBubble = null;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function newPetal(top) {
    return {
      x: Math.random() * W, y: top ? rnd(-H * 0.1, H) : rnd(-80, -20), z: rnd(0.4, 1),
      s: rnd(14, 30), rot: rnd(0, 6.28), vr: rnd(-0.012, 0.012), vy: rnd(0.25, 0.6), ph: rnd(0, 6.28),
      sw: rnd(0.6, 1.6), c: (Math.random() * 3) | 0
    };
  }
  function newBubble(bottom) {
    var pair = LETTERS[(Math.random() * LETTERS.length) | 0];
    var r = small ? rnd(22, 32) : rnd(28, 46);
    return {
      x: rnd(r, Math.max(r + 1, W - r)), y: bottom ? H + r + rnd(0, 120) : rnd(0, H), r: r,
      vy: -rnd(0.18, 0.42), ph: rnd(0, 6.28), label: pair[0], key: pair[1], pop: 0, vx: 0, glow: 0
    };
  }
  function build() {
    petals = []; bubbles = []; dust = [];
    var np = small ? 14 : 28, nb = small ? 6 : 12, nd = small ? 40 : 90, i;
    for (i = 0; i < np; i++) petals.push(newPetal(true));
    for (i = 0; i < nb; i++) bubbles.push(newBubble(false));
    for (i = 0; i < nd; i++) dust.push({ x: Math.random() * W, y: Math.random() * H, r: rnd(0.6, 1.8), ph: rnd(0, 6.28), sp: rnd(0.6, 1.8), z: rnd(0.3, 1) });
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawPetal(p, t) {
    var sway = Math.sin(t * p.sw + p.ph) * 26 * p.z;
    var x = p.x + sway - px * 18 * p.z, y = p.y - scrollY * 0.12 * p.z;
    y = ((y % (H + 120)) + (H + 120)) % (H + 120) - 60;
    var c = cur.petals[p.c], s = p.s * p.z;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.rot + Math.sin(t * 0.8 + p.ph) * 0.5);
    ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(t * 0.7 + p.ph)));
    var g = ctx.createLinearGradient(0, -s, 0, s);
    g.addColorStop(0, rgba(c, 0.62 * p.z));
    g.addColorStop(1, rgba([255, 240, 220], 0.22 * p.z));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.85, -s * 0.4, s * 0.7, s * 0.7, 0, s);
    ctx.bezierCurveTo(-s * 0.7, s * 0.7, -s * 0.85, -s * 0.4, 0, -s);
    ctx.fill();
    ctx.strokeStyle = rgba([255, 255, 255], 0.18 * p.z);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  function bubbleXY(b, t) {
    return { x: b.x + Math.sin(t * 0.6 + b.ph) * 18 - px * 10, y: b.y - scrollY * 0.06 };
  }
  function drawBubble(b, t, hover) {
    var pos = bubbleXY(b, t), r = b.r * (1 + b.glow * 0.18) * (b.pop > 0 ? 1 + b.pop * 0.5 : 1);
    var a = b.pop > 0 ? 1 - b.pop : 1;
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(pos.x, pos.y);
    if (b.glow > 0.02) {
      var gl = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2.2);
      gl.addColorStop(0, rgba([255, 205, 120], 0.55 * b.glow));
      gl.addColorStop(1, rgba([255, 205, 120], 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, 6.2832); ctx.fill();
    }
    var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, rgba(cur.bubble, 0.34));
    g.addColorStop(0.7, rgba(cur.bubble, 0.1));
    g.addColorStop(1, rgba(cur.bubble, 0.2));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = rgba([255, 255, 255], 0.38 + 0.3 * b.glow); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 3.6, 4.4); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255," + (0.62 + 0.36 * b.glow) + ")";
    ctx.font = "700 " + Math.round(r * (b.label.length > 1 ? 0.7 : 0.95)) + "px 'Fraunces', 'Noto Sans Devanagari', Georgia, serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(b.label, 0, r * 0.04);
    ctx.restore();
  }

  function burst(x, y, n) {
    for (var i = 0; i < n; i++) {
      var a = rnd(0, 6.2832), v = rnd(1, 4.2);
      sparks.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 1, d: rnd(0.012, 0.025), r: rnd(1.4, 3.4), star: Math.random() < 0.5 });
    }
  }
  function drawStar(x, y, r) {
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var rad = i % 2 ? r * 0.35 : r, a = i * Math.PI / 4;
      ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fill();
  }

  var last = 0, running = false;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (now - last < 30) return;
    var dt = Math.min((now - last) / 16.7, 3); last = now;
    draw(now / 1000, dt);
  }
  function draw(t, dt) {
    easePalette();
    px += (tmx - px) * 0.05; py += (tmy - py) * 0.05;
    ctx.clearRect(0, 0, W, H);

    /* soft moon halo that breathes */
    var hx = W * 0.82 - px * 24, hy = H * 0.16 - py * 16, hr = Math.min(W, H) * (0.2 + Math.sin(t * 0.5) * 0.012);
    var hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr * 2);
    hg.addColorStop(0, "rgba(255,236,200,0.34)");
    hg.addColorStop(0.35, rgba(cur.glow, 0.1));
    hg.addColorStop(1, "rgba(255,236,200,0)");
    ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);

    var i, p, b;
    /* golden dust */
    for (i = 0; i < dust.length; i++) {
      var d = dust[i];
      d.y -= d.sp * 0.12 * dt; if (d.y < -4) { d.y = H + 4; d.x = Math.random() * W; }
      var tw = 0.35 + 0.65 * Math.abs(Math.sin(t * d.sp + d.ph));
      ctx.fillStyle = "rgba(255,230,170," + (0.5 * tw * d.z).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(d.x - px * 14 * d.z, (d.y - scrollY * 0.04 * d.z + H) % H, d.r, 0, 6.2832); ctx.fill();
    }
    /* petals */
    for (i = 0; i < petals.length; i++) {
      p = petals[i];
      p.y += p.vy * dt * p.z; p.rot += p.vr * dt;
      var ddx = p.x - mx, ddy = p.y - scrollY * 0.12 * p.z - my;
      if (ddx * ddx + ddy * ddy < 100 * 100) { p.x += (ddx > 0 ? 1 : -1) * 1.6 * dt; p.y -= 0.8 * dt; }
      if (p.y > H + 80) { p.y = -60; p.x = Math.random() * W; }
      drawPetal(p, t);
    }
    /* letter bubbles */
    hoverBubble = null;
    for (i = 0; i < bubbles.length; i++) {
      b = bubbles[i];
      b.y += b.vy * dt; b.x += b.vx * dt; b.vx *= 0.94;
      var pos = bubbleXY(b, t), dx = pos.x - mx, dy = pos.y - my, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < b.r + 90 && dist > 0.1) { var f = (b.r + 90 - dist) / 90; b.vx += (dx / dist) * f * 0.5; b.y += (dy / dist) * f * 1.2; }
      var over = dist < b.r && !b.pop;
      if (over) hoverBubble = b;
      b.glow += ((over ? 1 : 0) - b.glow) * 0.18;
      if (b.pop > 0) { b.pop += 0.06 * dt; if (b.pop >= 1) { bubbles[i] = newBubble(true); continue; } }
      if (b.y < -b.r * 2) { bubbles[i] = newBubble(true); continue; }
      if (b.x < b.r) b.x = b.r; if (b.x > W - b.r) b.x = W - b.r;
      drawBubble(b, t);
    }
    /* sparkles */
    for (i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 0.05 * dt; s.vx *= 0.985; s.life -= s.d * dt;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.fillStyle = "rgba(255," + (205 + 40 * s.life | 0) + "," + (120 + 80 * s.life | 0) + "," + s.life.toFixed(2) + ")";
      if (s.star) drawStar(s.x, s.y, s.r * (1 + s.life)); else { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill(); }
    }
    document.documentElement.classList.toggle("bn-bubble-hover", !!hoverBubble);
  }

  /* only react when the pointer is over empty background, never over a button, card or field */
  var INTERACTIVE = "a,button,input,select,textarea,label,summary,.deity-card,.bn-name,.bn-tipgrid article,.bn-stats,.deity-modal,header,nav,.bn-chip";
  function overBackground(el) { return !(el && el.closest && el.closest(INTERACTIVE)); }

  window.addEventListener("pointermove", function (e) {
    tmx = (e.clientX / Math.max(W, 1) - 0.5) * 2; tmy = (e.clientY / Math.max(H, 1) - 0.5) * 2;
    if (!overBackground(e.target)) { mx = my = -999; return; }
    mx = e.clientX; my = e.clientY;
    var now = performance.now();
    if (!reduce && now - lastTrail > 45) { lastTrail = now; sparks.push({ x: mx, y: my, vx: rnd(-0.4, 0.4), vy: rnd(-0.6, 0.1), life: 0.8, d: 0.03, r: rnd(1, 2.4), star: Math.random() < 0.4 }); }
  }, { passive: true });
  window.addEventListener("pointerleave", function () { mx = my = -999; });
  window.addEventListener("scroll", function () { scrollY = window.scrollY || 0; }, { passive: true });

  document.addEventListener("click", function (e) {
    if (!overBackground(e.target) || reduce) return;
    var x = e.clientX, y = e.clientY, t = performance.now() / 1000;
    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i], pos = bubbleXY(b, t);
      var dx = pos.x - x, dy = pos.y - y;
      if (!b.pop && dx * dx + dy * dy <= (b.r + 6) * (b.r + 6)) {
        b.pop = 0.01; burst(pos.x, pos.y, 26);
        if (window.BabyNames && window.BabyNames.pickLetter) window.BabyNames.pickLetter(b.key, b.label);
        return;
      }
    }
    burst(x, y, 14);
  });

  window.BabyNamesFx = { burst: function (x, y, n) { if (!reduce) burst(x, y, n || 20); } };

  function start() {
    resize(); build();
    if (reduce) { draw(26, 1); return; }
    running = true; requestAnimationFrame(frame);
  }
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { var was = small; small = window.innerWidth <= 760; resize(); if (was !== small) build(); if (reduce) draw(26, 1); }, 150);
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) running = false;
    else if (!reduce) { running = true; requestAnimationFrame(frame); }
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start, start); else start();
})();
