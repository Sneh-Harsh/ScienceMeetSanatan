/*!
 * ElectricBorder: vanilla canvas adaptation of the React Bits "Electric Border" effect for the SanatanSeva home page.
 * Original: https://reactbits.dev/animations/electric-border (MIT + Commons Clause, David Haz). Re-implemented without React
 * as animated strands of noise drawn around a rounded rectangle. Used as part of this website only.
 *
 * ElectricBorder.attach(element, { color, speed, chaos, spread, strands, thickness, borderRadius }) -> { destroy() }
 * ElectricBorder.watch(container, selector, options) attaches to matching children now and as they are added later.
 */
(function (global) {
  "use strict";

  var DEFAULTS = { color: "#7df9ff", speed: 1, chaos: 0.5, spread: 0.6, strands: 3, thickness: 1.5, borderRadius: 24, pad: 12 };
  var reduce = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var items = [];
  var raf = 0, last = 0, t0 = performance.now();

  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function noise(x, y) {   // smooth 2D value noise, -1..1
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi + yi * 57), b = hash(xi + 1 + yi * 57), c = hash(xi + (yi + 1) * 57), d = hash(xi + 1 + (yi + 1) * 57);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  }

  // points along the rounded-rectangle outline, with outward normals
  function outline(w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    var pts = [], step = 4, i, n, a;
    function line(x0, y0, x1, y1, nx, ny) {
      var len = Math.hypot(x1 - x0, y1 - y0); n = Math.max(1, Math.round(len / step));
      for (i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, nx, ny]);
    }
    function arc(cx, cy, a0) {
      n = Math.max(3, Math.round((Math.PI / 2 * r) / step));
      for (i = 0; i < n; i++) { a = a0 + (Math.PI / 2) * i / n; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a), Math.sin(a)]); }
    }
    line(r, 0, w - r, 0, 0, -1); arc(w - r, r, -Math.PI / 2);
    line(w, r, w, h - r, 1, 0); arc(w - r, h - r, 0);
    line(w - r, h, r, h, 0, 1); arc(r, h - r, Math.PI / 2);
    line(0, h - r, 0, r, -1, 0); arc(r, r, Math.PI);
    return pts;
  }

  function attach2d(el, options) {
    var o = Object.assign({}, DEFAULTS, options || {});
    var cs = global.getComputedStyle(el);
    if (cs.position === "static") el.style.position = "relative";
    var canvas = document.createElement("canvas");
    canvas.className = "eb-canvas";
    canvas.setAttribute("aria-hidden", "true");
    el.appendChild(canvas);
    el.classList.add("eb-host");
    var ctx = canvas.getContext("2d");
    var inst = { el: el, canvas: canvas, visible: false, pts: null, w: 0, h: 0, dpr: 1, seed: Math.random() * 100 };

    function size() {
      var w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !h) return;
      var rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || o.borderRadius;
      inst.dpr = Math.min(global.devicePixelRatio || 1, 2);
      inst.w = w; inst.h = h;
      canvas.style.left = canvas.style.top = -o.pad + "px";
      canvas.style.width = w + o.pad * 2 + "px";
      canvas.style.height = h + o.pad * 2 + "px";
      canvas.width = Math.round((w + o.pad * 2) * inst.dpr);
      canvas.height = Math.round((h + o.pad * 2) * inst.dpr);
      inst.pts = outline(w, h, rad);
      inst.draw(0);
    }

    inst.draw = function (t) {
      if (!inst.pts) return;
      var pts = inst.pts, np = pts.length, pad = o.pad, k, j, p, d, x, y;
      ctx.setTransform(inst.dpr, 0, 0, inst.dpr, 0, 0);
      ctx.clearRect(0, 0, inst.w + pad * 2, inst.h + pad * 2);
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      var amp = (pad - 2.5) * (0.25 + 0.75 * o.chaos);
      var freq = 0.03 + 0.05 * o.chaos;
      var sp = t * o.speed;
      for (k = 0; k < o.strands; k++) {
        var base = (k - (o.strands - 1) / 2) * o.spread * 3.2;
        var seed = inst.seed + k * 19.3;
        ctx.beginPath();
        for (j = 0; j <= np; j++) {
          p = pts[j % np];
          // one noise sample, plus a faster finer one for the crackle
          d = noise(j * 4 * freq + seed, sp * 1.3 + seed * 0.37) * 0.75 + noise(j * 4 * freq * 2.7 + seed * 2, sp * 2.9 + seed) * 0.25;
          d = base + d * amp;
          x = p[0] + p[2] * d + pad; y = p[1] + p[3] * d + pad;
          if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.shadowColor = o.color; ctx.shadowBlur = 14;
        ctx.strokeStyle = o.color; ctx.globalAlpha = 0.35; ctx.lineWidth = o.thickness * 3.2;
        ctx.stroke();
        ctx.shadowBlur = 5; ctx.globalAlpha = 0.95; ctx.lineWidth = o.thickness;
        ctx.stroke();
        ctx.shadowBlur = 0; ctx.globalAlpha = 0.7; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = o.thickness * 0.4;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    var ro = "ResizeObserver" in global ? new ResizeObserver(size) : null;
    if (ro) ro.observe(el);
    var io = "IntersectionObserver" in global ? new IntersectionObserver(function (es) { inst.visible = es[0].isIntersecting; if (inst.visible) wake(); }, { rootMargin: "80px" }) : null;
    if (io) io.observe(el); else inst.visible = true;
    inst.destroy = function () { if (ro) ro.disconnect(); if (io) io.disconnect(); canvas.remove(); el.classList.remove("eb-host"); };
    items.push(inst);
    size();
    wake();
    return inst;
  }

  function frame(now) {
    raf = 0;
    if (document.hidden) return;
    items = items.filter(function (i) { return i.el.isConnected || (i.destroy(), false); });
    if (now - last > 33) {   // 30fps
      last = now;
      var t = (now - t0) / 1000;
      for (var i = 0; i < items.length; i++) if (items[i].visible) items[i].draw(t);
    }
    if (!reduce) raf = requestAnimationFrame(frame);
  }
  function wake() { if (!raf && !reduce) raf = requestAnimationFrame(frame); }
  document.addEventListener("visibilitychange", wake);


  // ======================================================================================================================
  // WebGL2 version: a vanilla port of the React Bits "Electric Border" (https://reactbits.dev/animations/electric-border,
  // MIT + Commons Clause, David Haz). One shader context is shared by every border on the page: each border is drawn into the
  // shared canvas and copied onto its own element's canvas, so twelve cards do not need twelve WebGL contexts.
  // ======================================================================================================================
  var ARCS = 4, PULSES = 3, MARGIN = 64, PIXEL_BUDGET = 3e6, SURGE_SPEED = 560, HALF_PI = Math.PI / 2;

  var GL_VERTEX = `#version 300 es
const vec2 corners[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  gl_Position = vec4(corners[gl_VertexID], 0.0, 1.0);
}`;

  var GL_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uSize;
uniform float uRatio;
uniform vec2 uCenter;
uniform vec2 uHalf;
uniform float uRadius;
uniform vec3 uParam;
uniform float uPerimeter;
uniform vec4 uCells;
uniform vec2 uSoft;
uniform float uTime;
uniform float uPower;
uniform float uReveal;
uniform vec3 uHover;
uniform float uHoverRadius;
uniform vec4 uPulses[${PULSES}];
uniform vec3 uCore;
uniform vec3 uGlowColor;
uniform float uIntensity;
uniform float uGlow;
uniform float uThickness;
uniform float uStrands;
uniform float uChaos;
uniform float uSpread;
uniform float uFlicker;
uniform float uInk;
uniform vec4 uArcEnds[${ARCS}];
uniform vec4 uArcShape[${ARCS}];

out vec4 fragColor;

uint scramble(uint x) {
  x ^= x >> 16u;
  x *= 0x7feb352du;
  x ^= x >> 15u;
  x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}

vec2 slant(uint x, uint y, uint seed) {
  uint h = scramble(x * 0x8da6b343u + y * 0xd8163841u + seed * 0xcb1ab31fu);
  return vec2(uvec2(h, h >> 8u) & 255u) / 127.5 - 1.0;
}

vec2 ring(vec2 p, float period, uint seed) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float du = 30.0 * f.x * f.x * (f.x * (f.x - 2.0) + 1.0);
  uint x0 = uint(mod(i.x, period));
  uint x1 = uint(mod(i.x + 1.0, period));
  uint y0 = uint(i.y + 65536.0);
  vec2 ga = slant(x0, y0, seed);
  vec2 gb = slant(x1, y0, seed);
  vec2 gc = slant(x0, y0 + 1u, seed);
  vec2 gd = slant(x1, y0 + 1u, seed);
  float va = dot(ga, f);
  float vb = dot(gb, f - vec2(1.0, 0.0));
  float vc = dot(gc, f - vec2(0.0, 1.0));
  float vd = dot(gd, f - vec2(1.0, 1.0));
  float k = va - vb - vc + vd;
  float value = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * k;
  float gx = ga.x + u.x * (gb.x - ga.x) + u.y * (gc.x - ga.x) + u.x * u.y * (ga.x - gb.x - gc.x + gd.x);
  return vec2(value, gx + du * (vb - va + u.y * k));
}

float wobble(float x, uint seed) {
  return ring(vec2(x, 0.5), 1048576.0, seed).x;
}

vec2 frameAt(vec2 p) {
  vec2 inner = max(uHalf - uRadius, 0.0);
  vec2 q = abs(p) - inner;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  float quarter = uPerimeter * 0.25;
  vec2 v = abs(p) - uParam.xy;
  float t;
  if (v.x > 0.0 && v.y > 0.0) t = uParam.x + uParam.z * atan(v.x, v.y);
  else if (v.x > v.y) t = uParam.x + 1.5707963 * uParam.z + uParam.y - abs(p.y);
  else t = abs(p.x);
  t = clamp(t, 0.0, quarter);
  float s = p.x >= 0.0 ? (p.y < 0.0 ? t : 2.0 * quarter - t) : (p.y < 0.0 ? 4.0 * quarter - t : 2.0 * quarter + t);
  return vec2(s, d);
}

vec2 glowShape(float line, float spread, float w) {
  float x = abs(line);
  float y = abs(spread);
  return vec2(exp(-x * x / (w * w * 0.5)) + exp(-y / (w * 2.2)) * 0.6, exp(-y / (w * 4.5)) * 0.5);
}

void addArc(vec2 p, vec4 ends, vec4 info, float t, inout vec3 light, inout float energy, inout float hot) {
  if (info.y < 0.002) return;
  vec2 ab = ends.zw - ends.xy;
  float len = max(length(ab), 1.0);
  vec2 dir = ab / len;
  vec2 rel = p - ends.xy;
  float along = dot(rel, dir);
  float side = dot(rel, vec2(-dir.y, dir.x));
  float margin = abs(info.x) + (0.6 + uChaos) * (2.0 + len * 0.08) + uThickness * 12.0 + 10.0;
  if (along < -margin || along > len + margin || abs(side) > margin) return;
  float u = clamp(along / len, 0.0, 1.0);
  float taper = sin(3.14159265 * u);
  float settle = smoothstep(0.0, 0.15, u) * smoothstep(1.0, 0.85, u);
  float bendSlope = 3.14159265 / len * cos(3.14159265 * u) * settle;
  float beyond = max(-along, 0.0) + max(along - len, 0.0);
  for (int c = 0; c < 2; c++) {
    uint seed = uint(info.z * 131.0) + uint(c) * 29u + 7u;
    float jag = 0.0;
    float jagSlope = 0.0;
    float wave = max(len * 0.3, 14.0);
    float weight = (0.6 + uChaos) * (1.5 + len * 0.05) * (c == 0 ? 1.0 : 1.5);
    for (int o = 0; o < 3; o++) {
      vec2 n = ring(vec2(along / wave + info.z * 3.0, t * (1.4 + float(o) * 1.1)), 1048576.0, seed + uint(o));
      jag += n.x * weight;
      jagSlope += n.y * weight / wave;
      wave *= 0.42;
      weight *= 0.4;
    }
    float offset = (info.x + jag) * taper;
    float offsetSlope = (info.x + jag) * bendSlope + jagSlope * taper * settle;
    float across = (side - offset) / sqrt(1.0 + offsetSlope * offsetSlope);
    float gap = length(vec2(beyond, across));
    float w = uThickness * (c == 0 ? 0.9 : 0.6);
    vec2 g = glowShape(gap, gap, w);
    float k = info.y * (c == 0 ? 1.0 : 0.45);
    light += (uCore * g.x + uGlowColor * g.y * uGlow) * k;
    energy += (g.x + g.y * uGlow) * k;
    hot += exp(-gap * gap / (w * w * 0.16)) * k * (c == 0 ? 1.0 : 0.0);
  }
}

void main() {
  vec2 p = vec2(gl_FragCoord.x / uRatio, uSize.y - gl_FragCoord.y / uRatio);
  vec2 frame = frameAt(p - uCenter);
  float s = frame.x;
  float d = frame.y;
  float t = uTime;
  vec3 light = vec3(0.0);
  float energy = 0.0;
  float hot = 0.0;

  float along = min(s, uPerimeter - s);
  float front = uReveal * (uPerimeter * 0.5 + 80.0);
  float shown = smoothstep(front, front - 70.0, along) * uPower;
  float flare = uReveal < 1.0 ? exp(-pow((along - front + 30.0) / 26.0, 2.0)) * uPower : 0.0;

  vec2 toHover = p - uHover.xy;
  float heat = uHover.z * exp(-dot(toHover, toHover) / (uHoverRadius * uHoverRadius));
  float surge = 0.0;
  for (int i = 0; i < ${PULSES}; i++) {
    vec4 pulse = uPulses[i];
    if (pulse.z <= 0.0) continue;
    float gap = abs(s - pulse.x);
    gap = min(gap, uPerimeter - gap);
    float wave = (gap - pulse.y * ${SURGE_SPEED}.0) / 46.0;
    surge += exp(-wave * wave) * pulse.z * exp(-pulse.y * 1.2);
  }
  heat = min(heat * 0.7 + surge * 0.8 + flare * 0.6, 1.2);
  vec2 inset = min(p, uSize - p);
  float frameFade = smoothstep(0.0, 14.0, min(inset.x, inset.y));

  float edge = abs(d);
  float inward = d < 0.0 ? exp(d / 14.0) : 1.0;
  float bloom = (exp(-edge / 3.0) * 0.1 + exp(-edge / 16.0) * 0.05 * inward) * uGlow * (1.0 + heat * 0.6) * shown;
  light += uGlowColor * bloom;
  energy += bloom;

  float bendAmp = uSpread * 16.0 * (1.0 + heat * 0.35);
  float rippleAmp = uSpread * 6.0 * (1.0 + heat * 0.3);
  float crinkleAmp = uChaos * 4.5 * (1.0 + heat * 0.3);
  float squeeze = min(1.0, 34.0 / max((bendAmp + rippleAmp) * 1.6 + crinkleAmp, 1e-3));
  bendAmp *= squeeze;
  rippleAmp *= squeeze;
  crinkleAmp *= squeeze;
  float reach = (bendAmp * 1.9 + rippleAmp + crinkleAmp * 1.6) * 1.3 + uThickness * 14.0 + 8.0;
  if (edge < reach && shown > 0.0) {
    float fade = smoothstep(reach, reach * 0.55, edge);
    float count = min(uStrands + heat * 1.2, 6.0);
    float slopeScale = 1.0 / uPerimeter;
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      if (fi >= ceil(count)) break;
      float present = clamp(count - fi, 0.0, 1.0);
      uint seed = uint(i) * 7u + 3u;
      float lead = i == 0 ? 1.0 : 0.0;
      float range = mix(1.35 + fi * 0.18, 0.7, lead);
      float x = s * slopeScale;
      vec2 a = ring(vec2(x * uCells.x, t * 0.7 + fi * 3.1), uCells.x, seed);
      vec2 b = ring(vec2(x * uCells.y, t * 1.9 + fi * 1.7), uCells.y, seed + 1u);
      vec2 c = ring(vec2(x * uCells.z, t * 4.6 + fi * 0.9), uCells.z, seed + 2u);
      vec2 e = ring(vec2(x * uCells.w, t * 6.8), uCells.w, seed + 3u);
      float offset = (a.x * bendAmp + b.x * rippleAmp) * range + (c.x + e.x * 0.35) * crinkleAmp;
      float slope =
        ((a.y * uCells.x * bendAmp + b.y * uCells.y * rippleAmp) * range +
          (c.y * uCells.z + e.y * 0.35 * uCells.w) * crinkleAmp) *
        slopeScale;
      float drift = lead > 0.5 ? 0.0 : wobble(fi * 7.3, seed + 9u) * 2.5 * uSpread;
      offset += drift;
      float across = (d - offset) / sqrt(1.0 + slope * slope);
      float spread = d - a.x * bendAmp * range - drift;
      float swell = 0.5 + 0.5 * ring(vec2(x * uSoft.y, t * 2.0 + fi * 5.1), uSoft.y, seed + 8u).x;
      float w = uThickness * mix(0.55, 1.0, lead) * (0.5 + swell);
      float vis = mix(0.3 + 0.45 * smoothstep(-0.25, 0.2, ring(vec2(x * uSoft.x, t * 0.5 + fi * 3.7), uSoft.x, seed + 5u).x), 1.0, lead);
      float spark = 1.0 - uFlicker * 0.3 * (0.5 + 0.5 * wobble(t * 13.0 + fi * 2.3, seed + 6u));
      float weight = max(vis, heat * 0.6) * spark * fade * present * (0.7 + 0.6 * swell);
      vec2 g = glowShape(across, spread, w) * weight;
      g.y *= inward;
      float haze = uGlow * (1.0 + heat * 0.5) * (1.0 - uInk * 0.7);
      light += uCore * g.x + uGlowColor * g.y * haze;
      energy += g.x + g.y * haze;
      hot += exp(-across * across / (w * w * 0.16)) * lead * weight;
    }
    light *= shown;
    energy *= shown;
    hot *= shown;
  }

  for (int i = 0; i < ${ARCS}; i++) addArc(p, uArcEnds[i], uArcShape[i], t, light, energy, hot);

  float breath = 1.0 + uFlicker * 0.5 * wobble(t * 4.6 + 7.0, 3u);
  float gain = uIntensity * breath * (1.0 + heat * 0.25) * 1.4;
  light *= frameFade;
  energy *= frameFade;
  hot *= frameFade;
  float alpha = 1.0 - exp(-energy * gain);
  vec3 color = mix(1.0 - exp(-light * gain), alpha * light / max(energy, 1e-4), uInk);
  color = mix(color, vec3(alpha), clamp(hot, 0.0, 1.0) * uInk * 0.85);
  float grain = (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  alpha = clamp(alpha + grain, 0.0, 1.0);
  fragColor = vec4(clamp(color + grain, 0.0, alpha), alpha);
}`;

  var GL_DEFAULTS = {
    color: "#7df9ff", glowColor: null, speed: 1, chaos: 0.5, spread: 0.6, thickness: 1.5, strands: 3, glow: 0.6, intensity: 0.8,
    arcs: 1, flicker: 0.5, borderRadius: 24, offset: 0, active: true, intro: true, interactive: true, cursorRadius: 90, theme: "dark"
  };

  var colorProbe = null;
  function parseColor(value) {
    var text = String(value || "").trim();
    var hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
    if (hex) {
      var full = hex[1].length === 3 ? hex[1].replace(/./g, function (d) { return d + d; }) : hex[1];
      return [0, 2, 4].map(function (i) { return parseInt(full.slice(i, i + 2), 16) / 255; });
    }
    var rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
    if (rgb) return [rgb[1], rgb[2], rgb[3]].map(function (c) { return clamp(parseFloat(c) / 255, 0, 1); });
    colorProbe = colorProbe || document.createElement("canvas").getContext("2d");
    if (colorProbe) {
      colorProbe.fillStyle = "#000000";
      colorProbe.fillStyle = text;
      var normal = String(colorProbe.fillStyle);
      if (normal !== "#000000" || /^(#0{3}|#0{6}|black)$/i.test(text)) return parseColor(normal);
    }
    return [0.49, 0.98, 1];
  }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function roundBox(x, y, hx, hy, r) {
    var qx = Math.abs(x) - (hx - r), qy = Math.abs(y) - (hy - r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  }
  function pathOf(width, height, radius, offset) {
    var hx = Math.max(1, width / 2 + offset), hy = Math.max(1, height / 2 + offset);
    var r = clamp(radius + offset, 0, Math.min(hx, hy));
    var vr = Math.min(r + 48, Math.min(hx, hy));
    var ax = hx - vr, ay = hy - vr;
    var quarter = ax + ay + HALF_PI * vr;
    return { hx: hx, hy: hy, r: r, vr: vr, ax: ax, ay: ay, quarter: quarter, perimeter: quarter * 4 };
  }
  function pointOn(path, sPos) {
    var hx = path.hx, hy = path.hy, r = path.r, vr = path.vr, ax = path.ax, ay = path.ay, quarter = path.quarter, perimeter = path.perimeter;
    var u = ((sPos % perimeter) + perimeter) % perimeter;
    var part = Math.min(3, Math.floor(u / quarter));
    var rest = u - part * quarter;
    var local = part % 2 ? quarter - rest : rest;
    var x, y;
    if (local <= ax) { x = local; y = -hy; }
    else if (local <= ax + HALF_PI * vr) {
      var angle = vr > 0 ? (local - ax) / vr : 0;
      var dx = Math.sin(angle), dy = -Math.cos(angle), low = 0, high = vr + r + 2;
      for (var step = 0; step < 18; step++) {
        var mid = (low + high) / 2;
        if (roundBox(ax + dx * mid, -ay + dy * mid, hx, hy, r) < 0) low = mid; else high = mid;
      }
      x = ax + dx * low; y = -ay + dy * low;
    } else { x = hx; y = -ay + (local - ax - HALF_PI * vr); }
    var flipX = part >= 2 ? -1 : 1, flipY = part === 1 || part === 2 ? -1 : 1;
    var px = x * flipX, py = y * flipY;
    var nx = roundBox(px + 0.5, py, hx, hy, r) - roundBox(px - 0.5, py, hx, hy, r);
    var ny = roundBox(px, py + 0.5, hx, hy, r) - roundBox(px, py - 0.5, hx, hy, r);
    var length = Math.hypot(nx, ny) || 1;
    return { x: px, y: py, nx: nx / length, ny: ny / length };
  }
  function nearestOn(path, x, y) {
    var ax = path.ax, ay = path.ay, vr = path.vr, quarter = path.quarter;
    var qx = Math.abs(x) - ax, qy = Math.abs(y) - ay, t;
    if (qx > 0 && qy > 0) t = ax + vr * Math.atan2(qx, qy);
    else if (qx > qy) t = ax + HALF_PI * vr + ay - Math.abs(y);
    else t = Math.abs(x);
    t = clamp(t, 0, quarter);
    if (x >= 0) return y < 0 ? t : 2 * quarter - t;
    return y < 0 ? 4 * quarter - t : 2 * quarter + t;
  }

  // ---- the one shared GL context -----------------------------------------------------------------------------------------
  var shared = null, sharedFailed = false;
  function getShared() {
    if (shared && !shared.gl.isContextLost()) return shared;
    if (sharedFailed) return null;
    var canvas = document.createElement("canvas");
    var gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "default" });
    if (!gl) { sharedFailed = true; return null; }
    function compile(type, source) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, source);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(sh)); return null; }
      return sh;
    }
    var vs = compile(gl.VERTEX_SHADER, GL_VERTEX), fs = compile(gl.FRAGMENT_SHADER, GL_FRAGMENT);
    var program = vs && fs ? gl.createProgram() : null;
    if (!program) { sharedFailed = true; return null; }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(program)); sharedFailed = true; return null; }
    var uniforms = {}, count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i++) {
      var info = gl.getActiveUniform(program, i);
      if (info) uniforms[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(program, info.name);
    }
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); shared = null; });
    shared = { canvas: canvas, gl: gl, program: program, u: uniforms, vao: gl.createVertexArray() };
    return shared;
  }

  var glInstances = new Set();
  var glRaf = 0, glLast = 0;
  var reducedMotion = !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function glLoop(now) {
    glRaf = 0;
    if (document.hidden) return;
    var dt = clamp((now - glLast) / 1000 || 0, 0, 0.05);
    if (now - glLast < 18) { glRaf = requestAnimationFrame(glLoop); return; }   // about 50 fps is plenty
    glLast = now;
    var sh = getShared(), busy = false;
    glInstances.forEach(function (inst) {
      if (!inst.el.isConnected) { inst.destroy(); return; }
      if (!inst.visible) return;
      inst.update(now, dt);
      if (sh) inst.render(sh);
      busy = true;
    });
    if (busy) glRaf = requestAnimationFrame(glLoop);
  }
  function glWake() {
    if (glRaf || document.hidden) return;
    glLast = performance.now();
    glRaf = requestAnimationFrame(glLoop);
  }
  document.addEventListener("visibilitychange", glWake);
  global.addEventListener("pointermove", function (e) { glInstances.forEach(function (i) { if (i.visible) i.onMove(e); }); }, { passive: true });
  global.addEventListener("pointerdown", function (e) { glInstances.forEach(function (i) { if (i.visible) i.onDown(e); }); }, { passive: true });

  function attachGL(el, options) {
    if (!getShared()) return attach2d(el, options);
    var s = Object.assign({}, GL_DEFAULTS, options || {});
    var base = parseColor(s.color);
    var core = base.map(function (c) { return c + (1 - c) * 0.55; });
    var glowRgb = s.glowColor ? parseColor(s.glowColor) : base;
    s.chaos = clamp(s.chaos, 0, 2); s.spread = clamp(s.spread, 0, 2); s.thickness = Math.max(0.25, s.thickness);
    s.strands = clamp(Math.round(s.strands), 1, 6); s.glow = clamp(s.glow, 0, 3); s.flicker = clamp(s.flicker, 0, 1);

    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.classList.add("eb-host");
    var canvas = document.createElement("canvas");
    canvas.className = "eb-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.top = canvas.style.left = -MARGIN + "px";
    el.appendChild(canvas);
    var ctx = canvas.getContext("2d");

    var arcEnds = new Float32Array(ARCS * 4), arcShape = new Float32Array(ARCS * 4), pulseData = new Float32Array(PULSES * 4);
    var size = { width: 1, height: 1, ratio: 1 };
    var pointer = { x: 0, y: 0, over: false, near: false };
    var hover = { x: 0, y: 0, vx: 0, vy: 0, power: 0 };
    var sparks = [], pulses = [];
    var power = s.active && !(s.intro && !reducedMotion) ? 1 : 0;
    var reveal = power, wasActive = s.active, ink = s.theme === "light" ? 1 : 0;
    var path = pathOf(1, 1, 0, 0), time = Math.random() * 100;

    function resize() {
      var width = Math.max(1, el.offsetWidth), height = Math.max(1, el.offsetHeight);
      var cw = width + MARGIN * 2, ch = height + MARGIN * 2;
      var ratio = Math.min(global.devicePixelRatio || 1, 2, Math.sqrt(PIXEL_BUDGET / (cw * ch)));
      var pw = Math.max(1, Math.round(cw * ratio)), ph = Math.max(1, Math.round(ch * ratio));
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      canvas.style.width = cw + "px";
      canvas.style.height = ch + "px";
      size.width = width; size.height = height; size.ratio = pw / cw;
      var radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || s.borderRadius;
      path = pathOf(width, height, radius, s.offset);
    }

    function spawnArc(now, near) {
      var span = Math.min(path.perimeter * 0.3, 60 + Math.random() * 90);
      var start = near != null ? near : Math.random() * path.perimeter;
      var from = start - span * (0.2 + Math.random() * 0.6), to = from + span;
      var a = pointOn(path, from), b = pointOn(path, to), mid = pointOn(path, (from + to) / 2);
      var dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
      var side = (-dy / length) * mid.nx + (dx / length) * mid.ny;
      var bow = Math.min(MARGIN - 30, length * (0.14 + Math.random() * 0.16) + 5);
      return { ax: a.x, ay: a.y, bx: b.x, by: b.y, bow: side >= 0 ? bow : -bow, seed: 1 + Math.random() * 60, born: now, life: 0.35 + Math.random() * 0.45 };
    }

    function local(e) {
      var rect = el.getBoundingClientRect();
      // a tilted card has a bigger bounding box than the card; map the pointer back into the card's own space
      var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      var m = /matrix\(([^)]+)\)/.exec(getComputedStyle(el).transform);
      var x = e.clientX - cx, y = e.clientY - cy;
      if (m) {
        var v = m[1].split(",").map(parseFloat), det = v[0] * v[3] - v[1] * v[2] || 1;
        var lx = (v[3] * x - v[2] * y) / det, ly = (-v[1] * x + v[0] * y) / det;
        x = lx; y = ly;
      }
      pointer.x = x + size.width / 2; pointer.y = y + size.height / 2;
      pointer.over = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= size.width && pointer.y <= size.height;
      pointer.near = pointer.x >= -MARGIN / 2 && pointer.y >= -MARGIN / 2 && pointer.x <= size.width + MARGIN / 2 && pointer.y <= size.height + MARGIN / 2;
    }

    var inst = {
      el: el, visible: false,
      onMove: function (e) { local(e); },
      onDown: function (e) {
        local(e);
        if (!pointer.over || !s.interactive || !s.active || reducedMotion) return;
        var along = nearestOn(path, pointer.x - size.width / 2, pointer.y - size.height / 2);
        pulses.push({ s: along, born: performance.now() });
        if (pulses.length > PULSES) pulses.shift();
        if (sparks.length < ARCS) sparks.push(spawnArc(time, along));
      },
      update: function (now, dt) {
        time += dt * s.speed * (reducedMotion ? 0.2 : 1);
        if (s.active && !wasActive) reveal = 0;
        wasActive = s.active;
        power += ((s.active ? 1 : 0) - power) * (1 - Math.exp(-dt / (s.active ? 0.28 : 0.4)));
        if (s.active) reveal = reducedMotion ? 1 : Math.min(1, reveal + dt / 0.9);
        ink += ((s.theme === "light" ? 1 : 0) - ink) * (1 - Math.exp(-dt / 0.25));
        var engaged = s.interactive && pointer.near && s.active;
        if (engaged && hover.power < 0.01) { hover.x = pointer.x; hover.y = pointer.y; hover.vx = 0; hover.vy = 0; }
        hover.vx += ((pointer.x - hover.x) * 120 - hover.vx * 19) * dt;
        hover.vy += ((pointer.y - hover.y) * 120 - hover.vy * 19) * dt;
        hover.x += hover.vx * dt; hover.y += hover.vy * dt;
        hover.power += ((engaged ? 1 : 0) - hover.power) * (1 - Math.exp(-dt / (engaged ? 0.3 : 0.55)));
        for (var i = sparks.length - 1; i >= 0; i--) if (time - sparks[i].born > sparks[i].life) sparks.splice(i, 1);
        if (!reducedMotion && s.active && reveal >= 1 && s.arcs > 0 && sparks.length < ARCS) {
          var chance = dt * s.speed * s.arcs;
          if (Math.random() < chance * 5 * hover.power) sparks.push(spawnArc(time, nearestOn(path, hover.x - size.width / 2, hover.y - size.height / 2)));
          else if (Math.random() < chance * (0.6 + path.perimeter / 2400)) sparks.push(spawnArc(time, null));
        }
        var fit = power * power * (3 - 2 * power);
        for (var k = 0; k < ARCS; k++) {
          var o = k * 4, spark = sparks[k];
          if (!spark) { arcShape[o + 1] = 0; continue; }
          var kk = clamp((time - spark.born) / spark.life, 0, 1);
          arcEnds[o] = spark.ax + size.width / 2 + MARGIN; arcEnds[o + 1] = spark.ay + size.height / 2 + MARGIN;
          arcEnds[o + 2] = spark.bx + size.width / 2 + MARGIN; arcEnds[o + 3] = spark.by + size.height / 2 + MARGIN;
          arcShape[o] = spark.bow; arcShape[o + 1] = Math.sin(Math.PI * kk) * fit; arcShape[o + 2] = spark.seed;
        }
        for (var q = pulses.length - 1; q >= 0; q--) if (now - pulses[q].born > 2200) pulses.splice(q, 1);
        for (var pi = 0; pi < PULSES; pi++) {
          var po = pi * 4, pulse = pulses[pi];
          if (!pulse) { pulseData[po + 2] = 0; continue; }
          pulseData[po] = pulse.s; pulseData[po + 1] = (now - pulse.born) / 1000; pulseData[po + 2] = 1;
        }
      },
      render: function (sh) {
        var gl = sh.gl, u = sh.u;
        if (!el.offsetWidth) return;
        if (size.width !== el.offsetWidth || size.height !== el.offsetHeight) resize();
        if (power <= 0.001 && !sparks.length) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
        if (sh.canvas.width !== canvas.width || sh.canvas.height !== canvas.height) { sh.canvas.width = canvas.width; sh.canvas.height = canvas.height; }
        var width = size.width + MARGIN * 2, height = size.height + MARGIN * 2;
        gl.viewport(0, 0, sh.canvas.width, sh.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(sh.program);
        gl.uniform2f(u.uSize, width, height);
        gl.uniform1f(u.uRatio, size.ratio);
        gl.uniform2f(u.uCenter, width / 2, height / 2);
        gl.uniform2f(u.uHalf, path.hx, path.hy);
        gl.uniform1f(u.uRadius, path.r);
        gl.uniform3f(u.uParam, path.ax, path.ay, path.vr);
        gl.uniform1f(u.uPerimeter, path.perimeter);
        gl.uniform4f(u.uCells, Math.max(1, Math.round(path.perimeter / 75)), Math.max(2, Math.round(path.perimeter / 25)), Math.max(3, Math.round(path.perimeter / 9)), Math.max(4, Math.round(path.perimeter / 4)));
        gl.uniform2f(u.uSoft, Math.max(1, Math.round(path.perimeter / 150)), Math.max(1, Math.round(path.perimeter / 50)));
        gl.uniform1f(u.uTime, time);
        gl.uniform1f(u.uPower, power * power * (3 - 2 * power));
        gl.uniform1f(u.uReveal, reveal);
        gl.uniform3f(u.uHover, hover.x + MARGIN, hover.y + MARGIN, hover.power * (s.interactive ? 1 : 0));
        gl.uniform1f(u.uHoverRadius, Math.max(1, s.cursorRadius));
        gl.uniform4fv(u.uPulses, pulseData);
        gl.uniform3fv(u.uCore, core);
        gl.uniform3fv(u.uGlowColor, glowRgb);
        gl.uniform1f(u.uIntensity, Math.max(0, s.intensity));
        gl.uniform1f(u.uGlow, s.glow);
        gl.uniform1f(u.uThickness, s.thickness);
        gl.uniform1f(u.uStrands, s.strands);
        gl.uniform1f(u.uChaos, s.chaos);
        gl.uniform1f(u.uSpread, s.spread);
        gl.uniform1f(u.uFlicker, reducedMotion ? 0 : s.flicker);
        gl.uniform1f(u.uInk, ink);
        gl.uniform4fv(u.uArcEnds, arcEnds);
        gl.uniform4fv(u.uArcShape, arcShape);
        gl.bindVertexArray(sh.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(sh.canvas, 0, 0);
      },
      destroy: function () {
        glInstances.delete(inst);
        if (ro) ro.disconnect();
        if (io) io.disconnect();
        canvas.remove();
        el.classList.remove("eb-host");
      }
    };

    var ro = "ResizeObserver" in global ? new ResizeObserver(function () { resize(); glWake(); }) : null;
    if (ro) ro.observe(el);
    var io = "IntersectionObserver" in global ? new IntersectionObserver(function (es) { inst.visible = es[0].isIntersecting; if (inst.visible) glWake(); }, { rootMargin: "60px" }) : null;
    if (io) io.observe(el); else inst.visible = true;
    resize();
    glInstances.add(inst);
    glWake();
    return inst;
  }

  var attach = attachGL;

  function watch(container, selector, options) {
    if (!container) return;
    function scan() {
      container.querySelectorAll(selector).forEach(function (el) {
        if (!el.querySelector(":scope > .eb-canvas")) attach(el, options);
      });
    }
    scan();
    if ("MutationObserver" in global) new MutationObserver(scan).observe(container, { childList: true });
  }

  global.ElectricBorder = { attach: attach, watch: watch };
})(window);
