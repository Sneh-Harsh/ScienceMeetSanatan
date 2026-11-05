/* Planetary Observatory: a geocentric orrery on a canvas. No libraries and no downloaded textures: every planet is shaded
   per pixel from procedural noise (generated in small slices after first paint, so the page stays fast), and the day/night
   edge of each planet is aimed live at the Sun. You (Earth) sit in the middle; every planet is at its real sidereal longitude.
   Drag to turn the sky, tap a planet to jump to its house. Same export as before. */

const INSTANCES = new WeakMap();
const TAU = Math.PI * 2;
const VS = "︎";
const SIGNS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"].map((g) => g + VS);
const SIGN_KEYS = ["Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya", "Tula", "Vrischika", "Dhanu", "Makara", "Kumbha", "Meena"];
const ELEMENT = ["255,120,80", "120,190,110", "240,215,120", "100,160,235"]; // fire, earth, air, water
const SLOT = { Moon: 0.3, Mercury: 0.38, Venus: 0.46, Sun: 0.54, Mars: 0.62, Jupiter: 0.7, Saturn: 0.78, Rahu: 0.86, Ketu: 0.86 };
const SIZE = { Sun: 0.058, Moon: 0.036, Mercury: 0.03, Venus: 0.042, Mars: 0.038, Jupiter: 0.066, Saturn: 0.05, Rahu: 0.036, Ketu: 0.034 };
const GLOW = { Sun: "255,190,90", Moon: "210,220,255", Mercury: "200,190,170", Venus: "255,225,160", Mars: "255,130,90", Jupiter: "255,205,150", Saturn: "240,215,160", Rahu: "170,140,230", Ketu: "230,160,100" };

const KIx = () => (typeof window !== "undefined" && window.KI) || null;
const tr = (k, v) => (KIx() ? KIx().t(k, v) : k);
const pname = (p) => (KIx() ? KIx().planet(p) : p);

/* ---------- noise ---------- */
const PERM = (() => {
  const p = new Uint8Array(512), a = Array.from({ length: 256 }, (_, i) => i);
  let s = 1337;
  for (let i = 255; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  for (let i = 0; i < 512; i++) p[i] = a[i & 255];
  return p;
})();
const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
function noise3(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
  const xf = x - X, yf = y - Y, zf = z - Z, u = fade(xf), v = fade(yf), w = fade(zf);
  const xi = X & 255, yi = Y & 255, zi = Z & 255;
  const h = (a, b, c) => PERM[PERM[PERM[a] + b] + c] / 255;
  const x1 = lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), u), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v);
  const x2 = lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v);
  return lerp(x1, x2, w);
}
function fbm(x, y, z, oct = 4) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
const mix3 = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (a, b, t) => fade(clamp01((t - a) / (b - a)));

/* ---------- planet surfaces: (x,y,z) on the unit sphere -> [r,g,b] 0..255 ---------- */
const SURFACE = {
  Earth(x, y, z, nz) {
    const land = fbm(x * 2.1 + 3.1, y * 2.1, z * 2.1, 5);
    const coast = smooth(0.5, 0.53, land);
    const deep = mix3([8, 40, 105], [30, 110, 190], clamp01(nz * 0.9 + fbm(x * 5, y * 5, z * 5, 3) * 0.25));
    const lat = Math.abs(y);
    const dry = fbm(x * 4 + 9, y * 4, z * 4, 4);
    const lc = mix3([46, 112, 52], [150, 128, 78], clamp01(dry * 1.5 + lat * 0.35));
    let c = mix3(deep, lc, coast);
    const ice = smooth(0.82, 0.92, lat + fbm(x * 6, y * 6, z * 6, 3) * 0.12);
    c = mix3(c, [244, 248, 255], ice);
    const cloud = smooth(0.52, 0.72, fbm(x * 3 + 7, y * 4.2, z * 3 + 2, 5));
    c = mix3(c, [255, 255, 255], cloud * 0.82);
    const rim = Math.pow(1 - nz, 2.5);
    return mix3(c, [120, 180, 255], rim * 0.7);
  },
  Sun(x, y, z, nz) {
    const g = fbm(x * 9, y * 9, z * 9, 4), spot = smooth(0.62, 0.72, fbm(x * 3 + 5, y * 3, z * 3, 3));
    let c = mix3([255, 120, 20], [255, 236, 150], Math.pow(nz, 0.55));
    c = mix3(c, [255, 255, 235], clamp01((g - 0.45) * 1.1));
    return mix3(c, [150, 50, 5], spot * 0.7 * (1 - nz * 0.3));
  },
  Moon(x, y, z, nz) {
    const maria = smooth(0.46, 0.58, fbm(x * 1.7 + 2, y * 1.7, z * 1.7, 4));
    const detail = fbm(x * 12, y * 12, z * 12, 4);
    const ridged = 1 - Math.abs(fbm(x * 6 + 1, y * 6, z * 6, 3) * 2 - 1);
    let c = mix3([196, 196, 200], [92, 94, 104], maria);
    const v = 0.78 + detail * 0.38 + ridged * 0.12;
    return [c[0] * v, c[1] * v, c[2] * v];
  },
  Mercury(x, y, z, nz) {
    const d = fbm(x * 10, y * 10, z * 10, 5), r = 1 - Math.abs(fbm(x * 5, y * 5, z * 5, 3) * 2 - 1);
    const v = 0.7 + d * 0.5 + r * 0.15;
    return mix3([128, 118, 106], [196, 184, 164], clamp01(v - 0.5)).map((c) => c * (0.8 + d * 0.3));
  },
  Venus(x, y, z, nz) {
    const wx = fbm(x * 2, y * 3, z * 2, 3), swirl = fbm(x * 2.6 + wx * 2, y * 4 + wx, z * 2.6 + wx * 2, 5);
    let c = mix3([226, 186, 110], [255, 238, 186], swirl);
    c = mix3(c, [190, 140, 70], smooth(0.55, 0.8, fbm(x * 3 + 4, y * 5, z * 3, 3)) * 0.4);
    return mix3(c, [255, 220, 150], Math.pow(1 - nz, 2.2) * 0.5);
  },
  Mars(x, y, z, nz) {
    const t = fbm(x * 3 + 1, y * 3, z * 3, 5), dark = smooth(0.5, 0.65, fbm(x * 2.2 + 6, y * 2.2, z * 2.2, 4)), dust = fbm(x * 9, y * 9, z * 9, 3);
    let c = mix3([196, 92, 52], [226, 142, 88], t);
    c = mix3(c, [88, 40, 28], dark * 0.65);
    c = c.map((v) => v * (0.88 + dust * 0.25));
    return mix3(c, [250, 250, 255], smooth(0.86, 0.95, Math.abs(y) + fbm(x * 6, y * 6, z * 6, 2) * 0.08));
  },
  Jupiter(x, y, z, nz) {
    const warp = fbm(x * 3, y * 2, z * 3, 4) * 0.35;
    const band = 0.5 + 0.5 * Math.sin((y + warp) * 20 + fbm(x * 2, y * 6, z * 2, 3) * 3);
    const pal = band < 0.35 ? mix3([168, 108, 70], [210, 160, 108], band / 0.35) : mix3([232, 200, 156], [248, 228, 196], (band - 0.35) / 0.65);
    let c = mix3(pal, [150, 92, 62], smooth(0.55, 0.8, fbm(x * 8, y * 14, z * 8, 4)) * 0.4);
    const sx = x - 0.28, sy = y + 0.3, spot = Math.exp(-(sx * sx * 26 + sy * sy * 90));
    c = mix3(c, [190, 70, 40], clamp01(spot * 1.3));
    return c;
  },
  Saturn(x, y, z, nz) {
    const band = 0.5 + 0.5 * Math.sin((y + fbm(x * 2, y * 2, z * 2, 3) * 0.2) * 16);
    const c = mix3([206, 178, 120], [246, 226, 176], band);
    return c.map((v) => v * (0.9 + fbm(x * 8, y * 14, z * 8, 3) * 0.2));
  },
  Rahu(x, y, z, nz) {
    const s = fbm(x * 3 + fbm(x * 2, y * 2, z * 2, 3) * 1.5, y * 3, z * 3, 5);
    const c = mix3([38, 26, 66], [128, 106, 178], s);
    return mix3(c, [190, 170, 240], Math.pow(1 - nz, 2.4) * 0.5);
  },
  Ketu(x, y, z, nz) {
    const s = fbm(x * 3 + fbm(x * 2, y * 2, z * 2, 3) * 1.5, y * 3, z * 3, 5);
    const c = mix3([60, 34, 18], [190, 124, 70], s);
    return mix3(c, [250, 190, 120], Math.pow(1 - nz, 2.4) * 0.5);
  },
};
const ROT = { Earth: 0.5, Sun: 0, Moon: 1.9, Mercury: 2.6, Venus: 0.9, Mars: 3.3, Jupiter: 1.2, Saturn: 0.4, Rahu: 0.2, Ketu: 2.1 };

/* Render one planet sprite, a few rows at a time. Returns a canvas that fills in while it is being drawn. */
function makeSprite(name, size, done) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d"), img = g.createImageData(size, size), data = img.data;
  const ring = name === "Saturn";
  const R = size * (ring ? 0.2 : 0.43), cx = size / 2, cy = size / 2, rot = ROT[name] || 0, cr = Math.cos(rot), sr = Math.sin(rot);
  const fn = SURFACE[name] || SURFACE.Moon;
  let y0 = 0;
  const slice = () => {
    const end = Math.min(size, y0 + 14);
    for (let py = y0; py < end; py++) {
      for (let px = 0; px < size; px++) {
        const nx = (px + 0.5 - cx) / R, ny = (py + 0.5 - cy) / R, r2 = nx * nx + ny * ny;
        if (r2 > 1.04) continue;
        const rr = Math.sqrt(r2), nzv = Math.sqrt(Math.max(0, 1 - r2));
        const x = nx * cr + nzv * sr, z = -nx * sr + nzv * cr, y = -ny;
        const col = fn(x, y, z, nzv);
        const edge = clamp01((1.0 - rr) * R * 0.9 + 0.5);
        const limb = name === "Sun" ? 1 : 0.55 + 0.45 * Math.pow(nzv, 0.35);
        const i = (py * size + px) * 4;
        data[i] = col[0] * limb; data[i + 1] = col[1] * limb; data[i + 2] = col[2] * limb; data[i + 3] = edge * 255;
      }
    }
    y0 = end;
    if (y0 < size) { setTimeout(slice, 0); return; }
    g.putImageData(img, 0, 0);
    if (ring) addRings(g, size, R);
    c.ready = true;
    done && done();
  };
  c.R = R; c.cx = cx; c.cy = cy;
  setTimeout(slice, 0);
  return c;
}
function addRings(g, size, R) {
  // draw rings into the same canvas: back half is hidden behind the planet by drawing it first via destination-over
  const cx = size / 2, cy = size / 2, tilt = -0.36;
  const stripes = [[1.32, 0.05, "rgba(120,100,70,.55)"], [1.42, 0.1, "rgba(232,210,160,.85)"], [1.58, 0.12, "rgba(246,228,182,.9)"], [1.74, 0.06, "rgba(150,126,90,.5)"], [1.84, 0.09, "rgba(214,190,140,.75)"], [1.98, 0.04, "rgba(190,166,120,.55)"]];
  const draw = (front) => {
    g.save(); g.translate(cx, cy); g.rotate(tilt);
    stripes.forEach(([k, w, col]) => { g.strokeStyle = col; g.lineWidth = R * w * 1.4; g.beginPath(); g.ellipse(0, 0, R * k, R * k * 0.3, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); g.stroke(); });
    g.restore();
  };
  g.globalCompositeOperation = "destination-over"; draw(false);
  g.globalCompositeOperation = "source-over"; draw(true);
}

function nebulaImage(w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"), img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w * 3.2, v = y / h * 3.2;
      const a = fbm(u, v, 1.3, 5), b = fbm(u * 1.4 + 9, v * 1.4, 4.1, 4), band = Math.exp(-Math.pow((y / h - 0.5 - (x / w - 0.5) * 0.32) * 3.2, 2));
      const k = clamp01((a - 0.42) * 2.4) * (0.35 + band * 0.9);
      const m = clamp01((b - 0.5) * 2.2) * 0.6;
      const i = (y * w + x) * 4;
      d[i] = 6 + k * 120 + m * 80; d[i + 1] = 4 + k * 70 + m * 30; d[i + 2] = 14 + k * 170 + m * 120; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function buildInstance(host) {
  host.innerHTML = "";
  const canvas = document.createElement("canvas");
  canvas.className = "kundali-planetarium-canvas kx-orrery";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", tr("sky_aria"));
  host.appendChild(canvas);
  const ui = document.createElement("div");
  ui.className = "kx-orrery__ui";
  host.appendChild(ui);
  const hint = document.createElement("div"); hint.className = "kx-orrery__hint"; host.appendChild(hint);
  const paintUi = () => {
    ui.innerHTML = '<button type="button" data-a="spin" aria-pressed="' + auto + '"' + (auto ? "" : ' class="is-off"') + ">" + tr("auto_turn") + '</button><button type="button" data-a="reset">' + tr("reset_view") + "</button>";
    hint.textContent = tr("sky_hint"); canvas.setAttribute("aria-label", tr("sky_aria"));
  };
  host.classList.add("kundali-planetarium--webgl-ready");

  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sprites = {};
  let W = 0, H = 0, dpr = 1, neb = null, stars = [], spriteSize = 192;
  let planets = [], lagnaDeg = null, yaw = 0, yawV = 0, auto = !reduce, dragging = false, lastX = 0, hover = null, selected = null, visible = true, raf = 0, drawn = [];
  const t0 = performance.now();
  const TILT = 0.5;

  function getSprite(name) {
    if (!sprites[name]) sprites[name] = makeSprite(name, spriteSize);
    return sprites[name];
  }
  function warm() { // earth and sun first, the rest right behind them, all after the first frame
    ["Earth", "Sun", "Jupiter", "Saturn", "Moon", "Mars", "Venus", "Mercury", "Rahu", "Ketu"].forEach((n, i) => setTimeout(() => getSprite(n), 40 + i * 60));
  }

  function resize() {
    const r = host.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(280, Math.floor(r.width)); H = Math.max(280, Math.floor(r.height));
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!neb) neb = nebulaImage(W < 480 ? 150 : 220, W < 480 ? 130 : 190);
    const rr = ((s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(21); stars = [];
    for (let i = 0; i < 150; i++) stars.push({ x: rr() * W, y: rr() * H, z: 0.3 + rr() * 0.9, p: rr() * TAU, s: 0.4 + rr() * 1.4, c: rr() });
  }

  function project(lon, R, rx, cx, cy) {
    const a = (lon * Math.PI) / 180 + yaw, depth = Math.sin(a), k = 1 + 0.16 * depth;
    return { x: cx + Math.cos(a) * R * rx * k, y: cy + Math.sin(a) * R * rx * TILT * k, depth, k };
  }
  function ringPath(R, rx, cx, cy, from = 0, to = 360, step = 2) {
    ctx.beginPath();
    for (let d = from; d <= to; d += step) { const p = project(d, R, rx, cx, cy); d === from ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); }
  }

  function draw(now) {
    const time = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    // deep space + nebula (parallax with the turn of the sky)
    ctx.fillStyle = "#04030a"; ctx.fillRect(0, 0, W, H);
    if (neb) { ctx.globalAlpha = 0.85; ctx.imageSmoothingEnabled = true; ctx.drawImage(neb, -((yaw * 30) % 40) - 20, -10, W + 60, H + 20); }
    ctx.globalAlpha = 1;
    stars.forEach((s) => {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * s.s + s.p)), px = (s.x + yaw * 50 * s.z + W * 2) % W;
      ctx.globalAlpha = (0.2 + 0.75 * tw) * s.z; ctx.fillStyle = s.c > 0.8 ? "#ffd9a8" : s.c > 0.5 ? "#cfe0ff" : "#ffffff";
      ctx.beginPath(); ctx.arc(px, s.y, s.s * s.z * 0.85, 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;

    const base = Math.min(W, H), rx = Math.min(W * 0.46, (H * 0.46) / TILT * 0.98), cx = W / 2, cy = H / 2;

    // glow on the zodiac plane
    const pg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    pg.addColorStop(0, "rgba(255,190,110,.18)"); pg.addColorStop(0.5, "rgba(110,90,200,.08)"); pg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, TILT); ctx.translate(-cx, -cy); ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(cx, cy, rx * 1.02, 0, TAU); ctx.fill(); ctx.restore();

    // orbit lanes: brighter at the front, faint at the back
    [0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78, 0.86].forEach((R) => {
      for (let seg = 0; seg < 2; seg++) {
        ringPath(R, rx, cx, cy, seg * 180, seg * 180 + 180, 3);
        ctx.strokeStyle = seg === 0 ? "rgba(255,225,160,.22)" : "rgba(255,225,160,.09)"; ctx.lineWidth = 1; ctx.setLineDash([2, 6]); ctx.stroke();
      }
    });
    ctx.setLineDash([]);

    // zodiac band: glass sectors, brass edges, ticks and glyphs
    for (let i = 0; i < 12; i++) {
      const a0 = i * 30, a1 = a0 + 30;
      ctx.beginPath();
      for (let d = a0; d <= a1; d += 3) { const p = project(d, 0.995, rx, cx, cy); d === a0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); }
      for (let d = a1; d >= a0; d -= 3) { const p = project(d, 0.915, rx, cx, cy); ctx.lineTo(p.x, p.y); }
      ctx.closePath(); ctx.fillStyle = `rgba(${ELEMENT[i % 4]},${i === selected ? 0.36 : 0.14})`; ctx.fill();
      ctx.strokeStyle = "rgba(245,210,130,.55)"; ctx.lineWidth = 1; ctx.stroke();
    }
    ringPath(0.915, rx, cx, cy); ctx.strokeStyle = "rgba(255,228,160,.75)"; ctx.lineWidth = 1.4; ctx.stroke();
    ringPath(0.995, rx, cx, cy); ctx.strokeStyle = "rgba(255,230,165,.9)"; ctx.lineWidth = 1.7; ctx.stroke();
    for (let d = 0; d < 360; d += 5) {
      const big = d % 30 === 0, a = project(d, 0.995, rx, cx, cy), b = project(d, big ? 0.93 : 0.96, rx, cx, cy);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = big ? "rgba(255,232,170,.95)" : "rgba(255,232,170,.4)"; ctx.lineWidth = big ? 1.3 : 0.8; ctx.stroke();
    }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let i = 0; i < 12; i++) {
      const p = project(i * 30 + 15, 0.955, rx, cx, cy);
      ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * ((p.depth + 1) / 2); ctx.font = `${Math.round(14 * p.k * Math.min(1.2, rx / 150))}px "Noto Sans Symbols","Segoe UI Symbol",serif`;
      ctx.fillStyle = "#ffe9a8"; ctx.shadowColor = "rgba(255,190,80,.9)"; ctx.shadowBlur = 8; ctx.fillText(SIGNS[i], p.x, p.y); ctx.restore();
    }
    if (lagnaDeg != null) {
      const p = project(lagnaDeg, 1.0, rx, cx, cy), q = project(lagnaDeg, 1.13, rx, cx, cy);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = "#ff6b5a"; ctx.lineWidth = 2.4; ctx.shadowColor = "#ff6b5a"; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffb1a6"; ctx.font = `800 ${Math.round(10 * Math.min(1.3, rx / 150))}px Inter,"Noto Sans Devanagari",sans-serif`; ctx.fillText(tr("asc").toUpperCase(), q.x, q.y + (q.y > cy ? 11 : -9));
    }

    // bodies
    const bodies = [];
    let sunPos = { x: cx - 1, y: cy - 1 };
    planets.forEach((pl) => {
      const lon = Number(pl.degree);
      if (!isFinite(lon)) return;
      const p = project(lon, SLOT[pl.planet] || 0.6, rx, cx, cy);
      bodies.push({ kind: "planet", pl, p, size: (SIZE[pl.planet] || 0.04) * base * p.k, depth: p.depth, name: pl.planet });
      if (pl.planet === "Sun") sunPos = p;
    });
    bodies.push({ kind: "earth", p: { x: cx, y: cy, k: 1, depth: 0 }, size: 0.07 * base, depth: 0, name: "Earth" });
    bodies.sort((a, b) => a.depth - b.depth);

    // sun bloom first, so it glows behind everything near it
    const sun = bodies.find((b) => b.name === "Sun");
    if (sun) {
      const rad = sun.size * (4 + 0.3 * Math.sin(time * 1.5));
      const gr = ctx.createRadialGradient(sun.p.x, sun.p.y, sun.size * 0.4, sun.p.x, sun.p.y, rad);
      gr.addColorStop(0, "rgba(255,214,120,.8)"); gr.addColorStop(0.35, "rgba(255,150,50,.3)"); gr.addColorStop(1, "rgba(255,100,20,0)");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sun.p.x, sun.p.y, rad, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(sun.p.x, sun.p.y); ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 2; k++) { ctx.rotate(time * 0.05 + k * 1.1); const lg = ctx.createLinearGradient(-sun.size * 5, 0, sun.size * 5, 0); lg.addColorStop(0, "rgba(255,230,160,0)"); lg.addColorStop(0.5, "rgba(255,230,160,.35)"); lg.addColorStop(1, "rgba(255,230,160,0)"); ctx.fillStyle = lg; ctx.fillRect(-sun.size * 5, -1.2, sun.size * 10, 2.4); }
      ctx.restore();
    }

    const placedLabels = [];
    bodies.forEach((b) => {
      const sp = getSprite(b.name), ready = sp.ready;
      const disc = b.size, S = (disc / (sp.R || 1)) * (spriteSize); // sprite pixels per drawn pixel
      const drawSize = (disc / sp.R) * spriteSize;
      // soft aura
      const glowCol = b.name === "Earth" ? "110,170,255" : GLOW[b.name] || "255,220,160";
      const ar = disc * (b.name === "Earth" ? 1.9 : 1.7);
      const ag = ctx.createRadialGradient(b.p.x, b.p.y, disc * 0.8, b.p.x, b.p.y, ar);
      ag.addColorStop(0, `rgba(${glowCol},${b.name === "Sun" ? 0.5 : 0.22})`); ag.addColorStop(1, `rgba(${glowCol},0)`);
      ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(b.p.x, b.p.y, ar, 0, TAU); ctx.fill();
      if (b.kind === "planet" && b.name !== "Sun") { ctx.fillStyle = "rgba(0,0,0,.32)"; ctx.beginPath(); ctx.ellipse(b.p.x, b.p.y + disc * 1.15, disc * 0.85, disc * 0.2, 0, 0, TAU); ctx.fill(); }
      const isHover = hover === b, isSel = b.kind === "planet" && selected === b.name;
      if (isHover || isSel) { ctx.save(); ctx.shadowColor = "#ffd77a"; ctx.shadowBlur = 22; ctx.strokeStyle = "rgba(255,225,150,.95)"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(b.p.x, b.p.y, disc * 1.4, 0, TAU); ctx.stroke(); ctx.restore(); }
      if (ready) {
        ctx.globalAlpha = 0.82 + 0.18 * ((b.p.depth + 1) / 2);
        ctx.drawImage(sp, b.p.x - drawSize / 2, b.p.y - drawSize / 2, drawSize, drawSize);
        ctx.globalAlpha = 1;
        // aim the day/night edge at the Sun
        if (b.name !== "Sun") {
          let dx = sunPos.x - b.p.x, dy = sunPos.y - b.p.y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
          ctx.save(); ctx.beginPath(); ctx.arc(b.p.x, b.p.y, disc * 0.995, 0, TAU); ctx.clip();
          const sh = ctx.createLinearGradient(b.p.x + dx * disc, b.p.y + dy * disc, b.p.x - dx * disc, b.p.y - dy * disc);
          sh.addColorStop(0, "rgba(2,3,12,0)"); sh.addColorStop(0.42, "rgba(2,3,12,.05)"); sh.addColorStop(0.62, "rgba(2,3,12,.62)"); sh.addColorStop(1, "rgba(2,3,12,.93)");
          ctx.fillStyle = sh; ctx.fillRect(b.p.x - disc, b.p.y - disc, disc * 2, disc * 2); ctx.restore();
        }
      } else {
        const ph = ctx.createRadialGradient(b.p.x - disc * 0.3, b.p.y - disc * 0.3, 0, b.p.x, b.p.y, disc);
        ph.addColorStop(0, `rgba(${glowCol},1)`); ph.addColorStop(1, "rgba(20,20,30,1)"); ctx.fillStyle = ph; ctx.beginPath(); ctx.arc(b.p.x, b.p.y, disc, 0, TAU); ctx.fill();
      }
      b.hit = Math.max(16, disc * 1.6);
      // label pill
      if (b.kind === "planet") {
        const text = pname(b.name), fs = Math.round(11 * Math.min(1.25, base / 380));
        ctx.font = `800 ${fs}px Inter,"Noto Sans Devanagari",sans-serif`;
        const w = ctx.measureText(text).width + 14, h = fs + 8;
        let lx = b.p.x - w / 2, ly = b.p.y + disc * 1.5 + 3;
        for (let tries = 0; tries < 4 && placedLabels.some((q) => lx < q.x + q.w && lx + w > q.x && ly < q.y + q.h && ly + h > q.y); tries++) ly += h + 2;
        placedLabels.push({ x: lx, y: ly, w, h });
        ctx.fillStyle = "rgba(10,6,16,.72)"; ctx.strokeStyle = "rgba(245,210,130,.45)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx, ly, w, h, h / 2) : ctx.rect(lx, ly, w, h); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#ffeec4"; ctx.fillText(text, b.p.x, ly + h / 2 + 0.5);
      }
    });
    drawn = bodies;

    // tooltip
    const tipB = hover && hover.kind === "planet" ? hover : (selected ? drawn.find((d) => d.kind === "planet" && d.name === selected) : null);
    if (tipB) {
      const tip = tipB.pl, lon = ((Number(tip.degree) % 360) + 360) % 360, signKey = SIGN_KEYS[Math.floor(lon / 30)];
      const lines = [pname(tip.planet), `${KIx() ? KIx().signName(signKey) : signKey} ${(lon % 30).toFixed(1)}°`, tip.house ? tr("house_n", { n: tip.house }) : ""].filter(Boolean);
      const wBox = 140, hBox = 16 + lines.length * 18;
      let bx = Math.min(W - wBox - 8, Math.max(8, tipB.p.x - wBox / 2)), by = tipB.p.y - tipB.size * 2 - hBox - 14; if (by < 8) by = tipB.p.y + tipB.size * 2 + 30;
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 16; ctx.fillStyle = "rgba(20,12,6,.94)"; ctx.strokeStyle = "rgba(240,205,120,.85)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, wBox, hBox, 10) : ctx.rect(bx, by, wBox, hBox); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.textAlign = "left"; lines.forEach((ln, i) => { ctx.font = (i === 0 ? "800 13px" : "600 12px") + ' Inter,"Noto Sans Devanagari",sans-serif'; ctx.fillStyle = i === 0 ? "#ffe9a8" : "#e9d9b4"; ctx.fillText(ln, bx + 12, by + 18 + i * 18); }); ctx.textAlign = "center";
    }
    ctx.font = '700 10px Inter,"Noto Sans Devanagari",sans-serif'; ctx.fillStyle = "rgba(190,215,255,.95)"; ctx.fillText(tr("you"), cx, cy + 0.07 * base * 1.45 + 12);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.38, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.6)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  function frame(now) {
    raf = 0;
    if (visible && document.visibilityState === "visible") {
      if (!dragging) { yaw += yawV; yawV *= 0.94; if (auto) yaw += 0.0016; }
      draw(now);
    }
    raf = requestAnimationFrame(frame);
  }
  function pick(ev) {
    const r = canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    let best = null, bd = 1e9;
    for (let i = drawn.length - 1; i >= 0; i--) { const b = drawn[i]; if (b.kind !== "planet") continue; const d = Math.hypot(b.p.x - x, b.p.y - y); if (d < (b.hit || 16) && d < bd) { best = b; bd = d; } }
    return best;
  }
  canvas.style.touchAction = "pan-y";
  canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; yawV = 0; canvas.setPointerCapture?.(e.pointerId); hint.style.opacity = "0"; });
  canvas.addEventListener("pointermove", (e) => {
    if (dragging) { const dx = e.clientX - lastX; lastX = e.clientX; yaw += dx * 0.008; yawV = dx * 0.0016; }
    else { hover = pick(e); canvas.style.cursor = hover ? "pointer" : "grab"; }
  });
  canvas.addEventListener("pointerup", (e) => {
    dragging = false; const p = pick(e);
    if (p) { selected = selected === p.name ? null : p.name; if (instance.onSelectHouse && p.pl.house) instance.onSelectHouse(Number(p.pl.house)); } else selected = null;
  });
  canvas.addEventListener("pointercancel", () => { dragging = false; });
  canvas.addEventListener("pointerleave", () => { hover = null; });
  ui.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.a === "spin") { auto = !auto; b.setAttribute("aria-pressed", String(auto)); b.classList.toggle("is-off", !auto); }
    if (b.dataset.a === "reset") { yaw = restYaw(); yawV = 0; selected = null; }
  });
  const restYaw = () => (lagnaDeg != null ? Math.PI / 2 - (lagnaDeg * Math.PI) / 180 : 0);

  const io = "IntersectionObserver" in window ? new IntersectionObserver((en) => { visible = en.some((x) => x.isIntersecting); }, { threshold: 0.05 }) : null;
  io && io.observe(host);
  const ro = "ResizeObserver" in window ? new ResizeObserver(() => resize()) : null;
  ro && ro.observe(host);
  window.addEventListener("resize", resize);
  resize();
  spriteSize = (W > 700 && dpr > 1.5) ? 256 : (W < 420 ? 160 : 192);
  paintUi();
  document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest("[data-kx-lang-btn],[data-lang]")) setTimeout(paintUi, 0); });

  const instance = {
    onSelectHouse: null,
    update(list, options) {
      planets = Array.isArray(list) ? list.filter((p) => p && p.planet) : [];
      let ld = null;
      try { if (((options || {}).chart || "d1") === "d1" && typeof kundaliState !== "undefined" && kundaliState.data && isFinite(kundaliState.data.lagna_degree)) ld = Number(kundaliState.data.lagna_degree); } catch (e) { ld = null; }
      const first = !instance.started && planets.length;
      lagnaDeg = ld;
      if (first || ld !== null) yaw = restYaw();
      if (first) { instance.started = true; warm(); }
      paintUi();
      if (!raf) raf = requestAnimationFrame(frame);
    },
    dispose() { cancelAnimationFrame(raf); raf = 0; io && io.disconnect(); ro && ro.disconnect(); window.removeEventListener("resize", resize); host.innerHTML = ""; },
  };
  return instance;
}

export function renderKundaliPlanetarium(host, planets, options = {}) {
  if (!host) return;
  let instance = INSTANCES.get(host);
  if (!instance) {
    instance = buildInstance(host);
    INSTANCES.set(host, instance);
  }
  instance.onSelectHouse = options.onSelectHouse || null;
  instance.update(planets, options);
}

window.renderKundaliPlanetarium = renderKundaliPlanetarium;
