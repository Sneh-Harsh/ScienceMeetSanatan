/*!
 * AeroShards: WebGL2 background of drifting translucent glass shards for the SanatanSeva home page hero.
 *
 * Inspired by the React Bits "Aero Shards" component (https://reactbits.dev, MIT + Commons Clause, David Haz). The component's source
 * that was supplied for this site was cut off part-way and relies on a WebGPU helper library, so this is an independent WebGL2
 * implementation that follows the same design and parameters: shards flowing along five depth-layered ribbons across the full
 * frame, glass shading, sacred symbols (swastika, Om, diya) as floating markers, depth of field, glow, grain, vignette, mouse repulsion and parallax, click pulses and
 * hold-to-gather. Used as part of this website only; it is not redistributed as a component.
 *
 * AeroShards.attach(container, options) -> { update(options), destroy() } | null (when WebGL2 is unavailable)
 * Vignette and grain are drawn by CSS layers on the container (see welcome_fx.css).
 */
(function (global) {
  "use strict";

  var TAU = Math.PI * 2;
  var CAMERA = 4;                       // distance of the eye; also the focal length of the projection
  var FOCUS = 3.1;
  var DEPTHS = [2.7, 3.9, 5.6, 8.1, 11.6];
  var SHARE = [0.26, 0.23, 0.2, 0.17, 0.14];
  var GROWTH = [1, 1.3, 1.8, 2.6, 3.6];
  var FADE = [1, 0.8, 0.52, 0.32, 0.2];
  var FULL_SLOPES = [[0.2, -0.78], [-0.72, 0.02], [0.58, -0.06], [-0.24, 0.62], [0.8, 0.3]];
  var LEVELS = DEPTHS.length;
  var SAMPLES = 96;
  var MAX_BANK = 1.0;
  var INTRO_SECONDS = 3.4;
  var MAX_RINGS = 3;

  var DEFAULTS = {
    shardColor: "#896ABD", accentColor: "#A855F7", count: 1300, shardSize: 1, spread: 1, twist: 1, billow: 1, speed: 1, scale: 1,
    depthOfField: 0.75, glow: 0.35, intro: true, mouseInteraction: true, mouseStrength: 0.6, markers: "plus", pulseOnClick: true,
    holdToGather: true, parallax: 0.5, paused: false, dpr: 2, eventTarget: null
  };

  // ------------------------------------------------------------------------------------------------------------------ shaders
  var SHARD_VS = `#version 300 es
precision highp float;
in vec4 aA;      // center.xyz, size
in vec4 aB;      // axis.xyz, flash
in vec4 aC;      // normal.xyz, tint
in vec4 aS0;     // corners 0,1
in vec4 aS1;     // corners 2,3
in vec4 aS2;     // corner 4, count, seed
uniform mat3 uView;
uniform vec3 uEye;
uniform float uAspect;
uniform float uFocal;
uniform float uDof;
uniform float uLevelFade;
uniform float uIntro;
out float vEdge;
out vec3 vNormal;
out float vTint;
out float vFlash;
out float vDepth;
out float vSeed;
out float vCoc;

void main() {
  int tri = gl_VertexID / 3;
  int k = gl_VertexID - tri * 3;
  float size = aA.w;
  vec3 axis = normalize(aB.xyz);
  vec3 normal = normalize(aC.xyz);
  vec3 side = normalize(cross(normal, axis));
  int count = int(aS2.z);
  vec2 pts[5] = vec2[5](aS0.xy, aS0.zw, aS1.xy, aS1.zw, aS2.xy);
  vec2 corner = vec2(0.0);
  float edge = 0.0;
  if (k == 1) { corner = pts[min(tri, count - 1)]; edge = 1.0; }
  else if (k == 2) { corner = pts[min((tri + 1) % count, count - 1)]; edge = 1.0; }
  // extra triangles of a 3- or 4-sided shard collapse to nothing
  if (tri >= count) { gl_Position = vec4(2.0, 2.0, 0.0, 1.0); return; }
  vec3 world = aA.xyz + (axis * corner.x + side * corner.y) * size;
  vec3 p = uView * (world - uEye);
  float depth = max(-p.z, 0.05);
  gl_Position = vec4(p.x * uFocal / uAspect, p.y * uFocal, 0.0, depth);
  vEdge = edge;
  vNormal = uView * normal;
  vTint = aC.w;
  vFlash = aB.w;
  vDepth = depth;
  vSeed = aS2.w;
  vCoc = clamp(uDof * abs(depth - ${FOCUS.toFixed(2)}) / ${FOCUS.toFixed(2)} * 0.9, 0.0, 1.0);
}`;

  var SHARD_FS = `#version 300 es
precision highp float;
in float vEdge;
in vec3 vNormal;
in float vTint;
in float vFlash;
in float vDepth;
in float vSeed;
in float vCoc;
uniform vec3 uShard;
uniform vec3 uAccent;
uniform float uGlow;
uniform float uLevelFade;
uniform float uIntro;
out vec4 fragColor;

void main() {
  vec3 n = normalize(vNormal);
  float ndv = abs(n.z);
  float fres = pow(1.0 - ndv, 2.4);
  // soft bokeh edge: the further from the focus plane, the blurrier the outline
  float soft = 0.04 + vCoc * 0.55;
  float cover = 1.0 - smoothstep(1.0 - soft, 1.0, vEdge);
  if (cover <= 0.002) discard;
  float rim = smoothstep(0.55, 0.98, vEdge) * (1.0 - vCoc * 0.65);

  vec3 key = normalize(vec3(-0.28, 0.72, 0.64));
  vec3 rimLight = normalize(vec3(0.78, 0.22, -0.58));
  vec3 view = vec3(0.0, 0.0, 1.0);
  vec3 r = reflect(-view, n);
  float spec = pow(max(dot(r, key), 0.0), 18.0) + 0.7 * pow(max(dot(r, rimLight), 0.0), 10.0);
  float wrap = clamp(dot(n, key) * 0.5 + 0.5, 0.0, 1.0);

  vec3 base = mix(uShard, uAccent, clamp(vTint * 0.65 + (1.0 - wrap) * 0.25, 0.0, 1.0));
  float body = 0.1 + 0.2 * fres + 0.1 * wrap;
  float alpha = mix(body, 0.5 + 0.35 * fres, rim);
  alpha += spec * 0.28;
  alpha = clamp(alpha, 0.0, 0.92) * cover * uLevelFade * uIntro;
  alpha *= mix(1.0, 0.55, vCoc);

  vec3 glint = mix(vec3(1.0), uAccent, 0.25);
  vec3 color = base * (0.3 + 0.5 * wrap) * alpha;
  color += glint * (spec * 0.7 + rim * 0.55 * (0.4 + wrap) + fres * 0.18) * uGlow * 2.2 * cover * uLevelFade * uIntro * (1.0 - vCoc * 0.6);
  color += mix(uAccent, vec3(1.0), 0.4) * vFlash * 0.7 * cover * uIntro;
  alpha = max(alpha, vFlash * 0.4 * cover);
  fragColor = vec4(color, alpha);
}`;

  var MARK_VS = `#version 300 es
precision highp float;
in vec4 aM;      // world xyz, phase
uniform mat3 uView;
uniform vec3 uEye;
uniform float uAspect;
uniform float uFocal;
uniform vec2 uPixel;     // 1 css pixel in ndc (x, y)
uniform float uSize;
uniform float uTime;
out vec2 vLocal;
out float vTwinkle;
flat out float vId;
void main() {
  vec2 corners[6] = vec2[6](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0));
  vec2 c = corners[gl_VertexID];
  vec3 p = uView * (aM.xyz - uEye);
  float depth = max(-p.z, 0.05);
  vec2 center = vec2(p.x * uFocal / uAspect, p.y * uFocal) / depth;
  float size = uSize * clamp(sqrt(5.0 / depth), 0.6, 1.4);
  gl_Position = vec4(center + c * uPixel * size, 0.0, 1.0);
  vLocal = c;
  vId = floor(aM.w * 2.999);
  vTwinkle = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.7 + aM.w) + aM.w * 40.0));
}`;

  var MARK_FS = `#version 300 es
precision highp float;
in vec2 vLocal;
in float vTwinkle;
flat in float vId;
uniform sampler2D uAtlas;
uniform float uGlow;
out vec4 fragColor;
void main() {
  vec2 uv = vLocal * 0.5 + 0.5;
  float cover = texture(uAtlas, vec2((vId + uv.x) / 3.0, 1.0 - uv.y)).a;
  // warm gold for the sacred symbols: saffron swastika, golden Om, flame-gold diya
  vec3 tint = vId < 0.5 ? vec3(1.0, 0.6, 0.2) : (vId < 1.5 ? vec3(1.0, 0.82, 0.42) : vec3(1.0, 0.74, 0.3));
  float a = cover * vTwinkle * (0.55 + uGlow);
  fragColor = vec4(tint * a, a * 0.85);
}`;

  // ------------------------------------------------------------------------------------------------------------------ helpers
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function smoother(x) { var t = clamp(x, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); }
  function mulberry(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var probe = null;
  function parseColor(value, fallback) {
    if (!probe) probe = document.createElement("canvas").getContext("2d");
    if (!probe) return fallback;
    probe.fillStyle = "#000000";
    probe.fillStyle = value;
    var t = probe.fillStyle;
    if (t.charAt(0) === "#") {
      var hex = parseInt(t.slice(1), 16);
      return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
    }
    return fallback;
  }

  function ribbonPoint(level, s, aspect, out) {
    var u = -1.32 + 2.64 * s;
    var slope = FULL_SLOPES[level];
    var v = slope[0] + (slope[1] - slope[0]) * s + 0.1 * Math.sin(s * TAU * 0.7 + level * 2.3) + 0.045 * Math.sin(s * TAU * 1.9 + level);
    var d = DEPTHS[level] + 0.35 * Math.sin(s * Math.PI * 1.4 + level * 1.9);
    out[0] = (u * aspect * d) / CAMERA;
    out[1] = (v * d) / CAMERA;
    out[2] = CAMERA - d;
    return out;
  }

  function createShards(count, seed) {
    var next = mulberry(seed), shards = [], made = 0;
    for (var level = 0; level < LEVELS; level++) {
      var amount = level === LEVELS - 1 ? count - made : Math.round(count * SHARE[level]);
      made += amount;
      for (var index = 0; index < amount; index++) {
        var flat = next() * 2 - 1, family = next(), outline = [], i;
        if (family < 0.55) {
          var sp = 0.17 + next() * 0.15;
          outline.push([1, (next() - 0.5) * 0.08]);
          outline.push([-0.5 - next() * 0.25, sp * (0.8 + next() * 0.4)]);
          outline.push([-0.5 - next() * 0.25, -sp * (0.8 + next() * 0.4)]);
        } else if (family < 0.8) {
          var sp2 = 0.2 + next() * 0.14;
          outline.push([1, 0]);
          outline.push([(next() - 0.3) * 0.5, sp2]);
          outline.push([-0.55 - next() * 0.2, (next() - 0.5) * 0.1]);
          outline.push([(next() - 0.3) * 0.5, -sp2 * (0.8 + next() * 0.4)]);
        } else {
          var sides = next() < 0.5 ? 4 : 5, stretch = 0.4 + next() * 0.3, turn = next() * TAU;
          for (var c = 0; c < sides; c++) {
            var angle = turn + ((c + (next() - 0.5) * 0.6) * TAU) / sides;
            outline.push([Math.cos(angle), Math.sin(angle) * stretch]);
          }
        }
        var n = outline.length, mx = 0, my = 0;
        for (i = 0; i < n; i++) { mx += outline[i][0] / n; my += outline[i][1] / n; }
        var shape = [];
        for (i = 0; i < 5; i++) { var pt = outline[Math.min(i, n - 1)]; shape.push(pt[0] - mx, pt[1] - my); }
        shards.push({
          level: level, phase: (index + next()) / Math.max(amount, 1),
          lane: Math.sign(flat) * Math.pow(Math.abs(flat), 0.85),
          layer: Math.sqrt(-2 * Math.log(Math.max(next(), 1e-6))) * Math.cos(TAU * next()),
          size: 0.6 + next() * next() * 1.25, shape: shape, sides: n,
          yaw: (next() - 0.5) * 0.36, bank: (next() - 0.5) * 0.5, pitch: (next() - 0.5) * 0.24, tint: next(),
          drift: [next() * TAU, next() * TAU, next() * TAU], rate: [0.3 + next() * 0.35, 0.25 + next() * 0.35, 0.3 + next() * 0.3],
          flutter: [next() * TAU, 0.5 + next() * 0.5], arrive: next(), seed: next(),
          off: [0, 0, 0], vel: [0, 0, 0], flash: 0
        });
      }
    }
    return shards;
  }

  // ------------------------------------------------------------------------------------------------------------------ attach
  function attach(container, options) {
    var s = Object.assign({}, DEFAULTS, options || {});
    var canvas = document.createElement("canvas");
    canvas.className = "aero-shards-canvas";
    canvas.setAttribute("aria-hidden", "true");
    var gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true, depth: false, stencil: false, powerPreference: "high-performance" });
    if (!gl) return null;

    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(sh)); return null; }
      return sh;
    }
    function program(vs, fs, attribs) {
      var a = compile(gl.VERTEX_SHADER, vs), b = compile(gl.FRAGMENT_SHADER, fs);
      if (!a || !b) return null;
      var p = gl.createProgram();
      gl.attachShader(p, a); gl.attachShader(p, b);
      attribs.forEach(function (n, i) { gl.bindAttribLocation(p, i, n); });
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(p)); return null; }
      var u = {}, cnt = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < cnt; i++) { var info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
      return { p: p, u: u };
    }
    var shardProg = program(SHARD_VS, SHARD_FS, ["aA", "aB", "aC", "aS0", "aS1", "aS2"]);
    var markProg = program(MARK_VS, MARK_FS, ["aM"]);
    if (!shardProg || !markProg) return null;
    container.insertBefore(canvas, container.firstChild);

    var reduce = !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
    var coarse = !!(global.matchMedia && global.matchMedia("(pointer: coarse)").matches);

    // ---- data
    var shardCount = coarse ? Math.min(s.count, 760) : s.count;
    var shards = createShards(shardCount, 1337);
    var order = shards.map(function (_, i) { return i; }).sort(function (a, b) { return shards[b].level - shards[a].level; });   // far layers first
    var STRIDE = 12;                                      // dynamic floats per shard: center+size, axis+flash, normal+tint
    var dyn = new Float32Array(shardCount * STRIDE);
    var stat = new Float32Array(shardCount * 12);         // corners (10) + count + seed
    shards.forEach(function (sh, i) {
      var o = i * 12;
      for (var k = 0; k < 10; k++) stat[o + k] = sh.shape[k];
      stat[o + 10] = sh.sides; stat[o + 11] = sh.seed;
    });
    var levelStart = [], levelCount = [];
    (function () {
      var pos = 0;
      for (var lv = LEVELS - 1; lv >= 0; lv--) {
        levelStart[lv] = pos;
        var n = 0;
        for (var i = 0; i < shardCount; i++) if (shards[order[i]].level === lv) n++;
        levelCount[lv] = n;
        pos += n;
      }
    })();

    var dynBuf = gl.createBuffer(), statBuf = gl.createBuffer(), vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
    gl.bufferData(gl.ARRAY_BUFFER, dyn.byteLength, gl.DYNAMIC_DRAW);
    [0, 1, 2].forEach(function (i) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, STRIDE * 4, i * 16);
      gl.vertexAttribDivisor(i, 1);
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, statBuf);
    gl.bufferData(gl.ARRAY_BUFFER, stat, gl.STATIC_DRAW);
    [3, 4, 5].forEach(function (i, k) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 48, k * 16);
      gl.vertexAttribDivisor(i, 1);
    });
    gl.bindVertexArray(null);

    // plus markers scattered through the volume
    var markerCount = s.markers === "none" || s.markers === false ? 0 : (coarse ? 18 : 34);
    var mk = new Float32Array(markerCount * 4), mrand = mulberry(99);
    for (var mi = 0; mi < markerCount; mi++) {
      var md = 2.6 + mrand() * 9;
      mk[mi * 4] = (mrand() * 2 - 1) * 1.25 * md / CAMERA * 1.6;
      mk[mi * 4 + 1] = (mrand() * 2 - 1) * 1.1 * md / CAMERA;
      mk[mi * 4 + 2] = CAMERA - md;
      mk[mi * 4 + 3] = mrand();
    }
    var markBuf = gl.createBuffer(), markVao = gl.createVertexArray();
    gl.bindVertexArray(markVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, markBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mk, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(0, 1);
    gl.bindVertexArray(null);

    // glyph atlas: swastika, Om, diya drawn once into a 3-cell strip
    var atlas = (function () {
      var N = 96, c = document.createElement("canvas");
      c.width = N * 3; c.height = N;
      var g = c.getContext("2d");
      g.fillStyle = "#fff"; g.strokeStyle = "#fff";
      g.save(); g.translate(0, 0);
      g.lineWidth = 10; g.lineCap = "butt"; g.lineJoin = "miter";
      g.beginPath();
      g.moveTo(16, 48); g.lineTo(80, 48); g.moveTo(48, 16); g.lineTo(48, 80);
      g.moveTo(48, 16); g.lineTo(70, 16); g.moveTo(80, 48); g.lineTo(80, 70);
      g.moveTo(48, 80); g.lineTo(26, 80); g.moveTo(16, 48); g.lineTo(16, 26);
      g.stroke(); g.restore();
      var font = '"Noto Sans Devanagari", "Kohinoor Devanagari", "Devanagari Sangam MN", "Nirmala UI", Mangal, "Lohit Devanagari", sans-serif';
      g.font = "700 100px " + font; g.textBaseline = "alphabetic";
      var m = g.measureText("\u0950");
      var w = (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || m.width), h = (m.actualBoundingBoxAscent || 80) + (m.actualBoundingBoxDescent || 20);
      var k = (0.86 * N) / Math.max(w, h, 1);
      g.save(); g.translate(N + N / 2, N / 2); g.scale(k, k);
      g.fillText("\u0950", -w / 2 + (m.actualBoundingBoxLeft || 0), (m.actualBoundingBoxAscent || 80) - h / 2);
      g.restore();
      g.save(); g.translate(N * 2, 0);
      g.beginPath(); g.ellipse(50, 62, 40, 25, 0, 0, Math.PI, false); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(10, 62); g.lineTo(2, 46); g.lineTo(24, 58); g.closePath(); g.fill();
      g.fillRect(30, 86, 40, 5); g.fillRect(46, 52, 8, 9);
      g.beginPath(); g.moveTo(50, 4); g.bezierCurveTo(66, 20, 64, 38, 50, 47); g.bezierCurveTo(36, 38, 34, 20, 50, 4); g.closePath(); g.fill();
      g.restore();
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    })();
    if (document.fonts && document.fonts.load) {   // redraw once the Devanagari font has arrived, so the Om is the real glyph
      document.fonts.load('700 100px "Noto Sans Devanagari"', "\u0950").catch(function () {});
    }

    // ---- paths (rebuilt when the aspect ratio changes)
    var paths = [], pathAspect = 0, tmp = [0, 0, 0];
    function buildPaths(aspect) {
      if (Math.abs(aspect - pathAspect) < 1e-3) return;
      pathAspect = aspect;
      for (var lv = 0; lv < LEVELS; lv++) {
        var pos = new Float32Array(SAMPLES * 3), tan = new Float32Array(SAMPLES * 3), acr = new Float32Array(SAMPLES * 3), lift = new Float32Array(SAMPLES * 3), i;
        for (i = 0; i < SAMPLES; i++) {
          ribbonPoint(lv, i / (SAMPLES - 1), aspect, tmp);
          pos[i * 3] = tmp[0]; pos[i * 3 + 1] = tmp[1]; pos[i * 3 + 2] = tmp[2];
        }
        for (i = 0; i < SAMPLES; i++) {
          var a = Math.max(0, i - 1), b = Math.min(SAMPLES - 1, i + 1);
          var tx = pos[b * 3] - pos[a * 3], ty = pos[b * 3 + 1] - pos[a * 3 + 1], tz = pos[b * 3 + 2] - pos[a * 3 + 2];
          var tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
          // across: sideways in the picture plane; lift: out of the ribbon (towards the viewer)
          var ax = -ty, ay = tx, az = 0, al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al;
          tan[i * 3] = tx; tan[i * 3 + 1] = ty; tan[i * 3 + 2] = tz;
          acr[i * 3] = ax; acr[i * 3 + 1] = ay; acr[i * 3 + 2] = az;
          var lx = ty * az - tz * ay, ly = tz * ax - tx * az, lz = tx * ay - ty * ax, ll = Math.hypot(lx, ly, lz) || 1;
          lift[i * 3] = lx / ll; lift[i * 3 + 1] = ly / ll; lift[i * 3 + 2] = lz / ll;
          if (lz < 0) { lift[i * 3] *= -1; lift[i * 3 + 1] *= -1; lift[i * 3 + 2] *= -1; }
        }
        paths[lv] = { pos: pos, tan: tan, acr: acr, lift: lift };
      }
    }

    // ---- state
    var shardRGB = parseColor(s.shardColor, [0.54, 0.42, 0.74]);
    var accentRGB = parseColor(s.accentColor, [0.66, 0.33, 0.97]);
    var st = {
      clock: reduce ? 6 : 0, travel: [0, 0, 0, 0, 0], introAt: -1, introT: s.intro && !reduce ? 0 : 1,
      pointer: [0.5, 0.5], inside: false, presence: 0, yaw: 0, pitch: 0, pressAt: -1, pressPoint: null, holding: false, hold: 0,
      rings: [], width: 1, height: 1, ratio: 1
    };
    var raf = 0, last = 0, visible = true, alive = true;
    var viewMat = new Float32Array(9);

    function resize() {
      var ratio = Math.min(global.devicePixelRatio || 1, coarse ? 1.5 : s.dpr);
      var w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
      canvas.width = Math.max(1, Math.round(w * ratio));
      canvas.height = Math.max(1, Math.round(h * ratio));
      st.width = w; st.height = h; st.ratio = ratio;
      wake();
    }

    function pointerNdc() { return [st.pointer[0] * 2 - 1, 1 - st.pointer[1] * 2]; }

    function update(dt) {
      var aspect = st.width / st.height;
      buildPaths(aspect);
      var speed = s.speed * (s.paused ? 0 : 1);
      st.clock += dt * speed;
      if (st.introT < 1) st.introT = Math.min(1, st.introT + dt / INTRO_SECONDS);
      for (var lv = 0; lv < LEVELS; lv++) st.travel[lv] += dt * speed * (0.011 + lv * 0.0016);

      st.presence += ((st.inside ? 1 : 0) - st.presence) * (1 - Math.exp(-dt / 0.3));
      // hold to gather: ramps up after a short press, falls away when released
      var holding = s.holdToGather && st.holding && st.pressAt >= 0 && performance.now() - st.pressAt > 240;
      st.hold += ((holding ? 1 : 0) - st.hold) * (1 - Math.exp(-dt / (holding ? 0.5 : 0.35)));
      var pn = pointerNdc();
      var targetYaw = (pn[0]) * 0.16 * s.parallax, targetPitch = (-pn[1]) * 0.1 * s.parallax;
      if (!st.inside) { targetYaw = 0; targetPitch = 0; }
      st.yaw += (targetYaw - st.yaw) * (1 - Math.exp(-dt / 0.6));
      st.pitch += (targetPitch - st.pitch) * (1 - Math.exp(-dt / 0.6));
      for (var r = st.rings.length - 1; r >= 0; r--) if (st.clock - st.rings[r].t > 2.4) st.rings.splice(r, 1);

      var scale = s.scale, now = st.clock, introEase = 1 - Math.pow(1 - st.introT, 3);
      var mouseOn = s.mouseInteraction && st.presence > 0.01;
      var R = 0.34, push = s.mouseStrength * 2.2 * st.presence;
      var gatherReach = 0.75;

      for (var n = 0; n < shardCount; n++) {
        var sh = shards[order[n]], lvl = sh.level, path = paths[lvl];
        var sPos = (sh.phase + st.travel[lvl]) % 1;
        var f = sPos * (SAMPLES - 1), i0 = Math.min(SAMPLES - 2, Math.floor(f)), t = f - i0, i1 = i0 + 1;
        var px = path.pos[i0 * 3] + (path.pos[i1 * 3] - path.pos[i0 * 3]) * t;
        var py = path.pos[i0 * 3 + 1] + (path.pos[i1 * 3 + 1] - path.pos[i0 * 3 + 1]) * t;
        var pz = path.pos[i0 * 3 + 2] + (path.pos[i1 * 3 + 2] - path.pos[i0 * 3 + 2]) * t;
        var tx = path.tan[i0 * 3] + (path.tan[i1 * 3] - path.tan[i0 * 3]) * t, ty = path.tan[i0 * 3 + 1] + (path.tan[i1 * 3 + 1] - path.tan[i0 * 3 + 1]) * t, tz = path.tan[i0 * 3 + 2] + (path.tan[i1 * 3 + 2] - path.tan[i0 * 3 + 2]) * t;
        var ax = path.acr[i0 * 3], ay = path.acr[i0 * 3 + 1], az = path.acr[i0 * 3 + 2];
        var lx = path.lift[i0 * 3], ly = path.lift[i0 * 3 + 1], lz = path.lift[i0 * 3 + 2];
        var d = DEPTHS[lvl];
        var halfWidth = 0.5 * d / CAMERA * s.spread;
        var wave = Math.sin(sPos * TAU * 1.7 + now * 0.55 * s.billow + sh.drift[0]) * 0.22 * s.billow * (d / CAMERA) + Math.sin(sPos * TAU * 3.1 - now * 0.8 + sh.drift[1]) * 0.07 * s.billow * (d / CAMERA);
        var across = sh.lane * halfWidth + Math.sin(now * sh.rate[0] + sh.drift[2]) * 0.05 * (d / CAMERA);
        var up = sh.layer * 0.16 * (d / CAMERA) * s.spread + wave;
        var cx = px + ax * across + lx * up, cy = py + ay * across + ly * up, cz = pz + az * across + lz * up;

        // pointer: push shards away, pulse rings, gather
        var depth = Math.max(CAMERA - (cz + sh.off[2]), 0.3);
        var nx = (cx + sh.off[0]) * CAMERA / (depth * aspect), ny = (cy + sh.off[1]) * CAMERA / depth;
        var targetX = 0, targetY = 0, targetZ = 0;
        var dx = nx - pn[0], dy = ny - pn[1], dist = Math.hypot(dx, dy) || 1e-4;
        if (mouseOn && dist < R) {
          var fall = 1 - dist / R, k = fall * fall * push * dt;
          sh.vel[0] += (dx / dist) * k * depth * aspect / CAMERA * 6;
          sh.vel[1] += (dy / dist) * k * depth / CAMERA * 6;
          sh.vel[2] += k * 1.5;
        }
        if (st.hold > 0.01 && dist < gatherReach) {
          var pull = st.hold * (1 - dist / gatherReach);
          targetX = -dx * depth * aspect / CAMERA * 0.82 * pull;
          targetY = -dy * depth / CAMERA * 0.82 * pull;
          targetZ = 0.35 * pull;
        }
        for (var q = 0; q < st.rings.length; q++) {
          var ring = st.rings[q], age = now - ring.t, radius = age * 1.5;
          var rx = nx - ring.x, ry = ny - ring.y, rd = Math.hypot(rx, ry) || 1e-4, band = Math.abs(rd - radius);
          if (band < 0.16) {
            var wgt = (1 - band / 0.16) * Math.exp(-age * 1.4) * dt * 30;
            sh.vel[0] += (rx / rd) * wgt * depth * aspect / CAMERA * 0.9;
            sh.vel[1] += (ry / rd) * wgt * depth / CAMERA * 0.9;
            sh.vel[2] += wgt * 0.5;
            sh.flash = Math.max(sh.flash, (1 - band / 0.16) * Math.exp(-age * 1.2));
          }
        }
        // spring back to the ribbon (or towards the gather point)
        for (var c = 0; c < 3; c++) {
          var tgt = c === 0 ? targetX : c === 1 ? targetY : targetZ;
          sh.vel[c] += ((tgt - sh.off[c]) * 22 - sh.vel[c] * 7) * dt;
          sh.off[c] += sh.vel[c] * dt;
        }
        sh.flash *= Math.exp(-dt * 2.2);

        var wx = cx + sh.off[0], wy = cy + sh.off[1], wz = cz + sh.off[2];

        // orientation: along the ribbon, rolled by the twist
        var roll = (sh.bank + twistAngle(sh, now, sPos)) ;
        var cr = Math.cos(roll), sr = Math.sin(roll);
        var nxv = lx * cr + ax * sr + tx * sh.pitch, nyv = ly * cr + ay * sr + ty * sh.pitch, nzv = lz * cr + az * sr + tz * sh.pitch;
        var nl = Math.hypot(nxv, nyv, nzv) || 1; nxv /= nl; nyv /= nl; nzv /= nl;
        var yaw = sh.yaw + Math.sin(now * sh.rate[1] + sh.drift[0]) * 0.18 * s.twist;
        var ex = tx + ax * yaw, ey = ty + ay * yaw, ez = tz + az * yaw;
        var dn = ex * nxv + ey * nyv + ez * nzv; ex -= nxv * dn; ey -= nyv * dn; ez -= nzv * dn;
        var el = Math.hypot(ex, ey, ez) || 1; ex /= el; ey /= el; ez /= el;

        var arrive = s.intro ? smoother(st.introT * 2.2 - sh.arrive * 1.2) : 1;
        var size = 0.085 * GROWTH[lvl] * sh.size * s.shardSize * scale * (0.55 + 0.45 * arrive) * (1 + 0.08 * Math.sin(now * sh.flutter[1] + sh.flutter[0]));
        // shards leave and enter softly at both ends of the ribbon
        size *= smoother(sPos / 0.06) * smoother((1 - sPos) / 0.06);

        var o = n * STRIDE;
        dyn[o] = wx; dyn[o + 1] = wy; dyn[o + 2] = wz; dyn[o + 3] = size;
        dyn[o + 4] = ex; dyn[o + 5] = ey; dyn[o + 6] = ez; dyn[o + 7] = sh.flash;
        dyn[o + 8] = nxv; dyn[o + 9] = nyv; dyn[o + 10] = nzv; dyn[o + 11] = sh.tint;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, dyn);
      void introEase;
    }

    function twistAngle(sh, now, sPos) {
      return (Math.sin(now * sh.rate[0] * 0.9 + sh.drift[1]) * 0.55 + Math.sin(sPos * TAU * 0.8 + sh.drift[2]) * 0.4) * MAX_BANK * s.twist
        + Math.sin(now * sh.flutter[1] * 0.6 + sh.flutter[0]) * 0.12;
    }

    function setView() {
      var cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
      // R = Rx(pitch) * Ry(yaw), column-major
      viewMat[0] = cy; viewMat[1] = sp * sy; viewMat[2] = -cp * sy;
      viewMat[3] = 0; viewMat[4] = cp; viewMat[5] = sp;
      viewMat[6] = sy; viewMat[7] = -sp * cy; viewMat[8] = cp * cy;
    }

    function render() {
      var aspect = st.width / st.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      setView();
      var introAlpha = s.intro ? smoother(st.introT * 1.6) : 1;

      gl.useProgram(shardProg.p);
      var u = shardProg.u;
      gl.uniformMatrix3fv(u.uView, false, viewMat);
      gl.uniform3f(u.uEye, 0, 0, CAMERA);
      gl.uniform1f(u.uAspect, aspect);
      gl.uniform1f(u.uFocal, CAMERA);
      gl.uniform1f(u.uDof, s.depthOfField);
      gl.uniform3fv(u.uShard, shardRGB);
      gl.uniform3fv(u.uAccent, accentRGB);
      gl.uniform1f(u.uGlow, s.glow);
      gl.uniform1f(u.uIntro, introAlpha);
      gl.bindVertexArray(vao);
      for (var lv = LEVELS - 1; lv >= 0; lv--) {
        if (!levelCount[lv]) continue;
        gl.uniform1f(u.uLevelFade, FADE[lv]);
        drawLayer(lv);   // this layer's slice of the instance buffer
      }
      gl.bindVertexArray(null);

      if (markerCount) {
        gl.useProgram(markProg.p);
        var m = markProg.u;
        gl.uniformMatrix3fv(m.uView, false, viewMat);
        gl.uniform3f(m.uEye, 0, 0, CAMERA);
        gl.uniform1f(m.uAspect, aspect);
        gl.uniform1f(m.uFocal, CAMERA);
        gl.uniform2f(m.uPixel, 2 / st.width, 2 / st.height);
        gl.uniform1f(m.uSize, 16);
        gl.uniform1f(m.uTime, st.clock);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, atlas);
        gl.uniform1i(m.uAtlas, 0);
        gl.uniform1f(m.uGlow, s.glow);
        gl.bindVertexArray(markVao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, markerCount);
        gl.bindVertexArray(null);
      }
    }

    // WebGL2 has no base-instance offset, so each layer's slice is drawn by moving the attribute pointers
    function drawLayer(lv) {
      var start = levelStart[lv], count = levelCount[lv];
      gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
      [0, 1, 2].forEach(function (i) { gl.vertexAttribPointer(i, 4, gl.FLOAT, false, STRIDE * 4, start * STRIDE * 4 + i * 16); });
      gl.bindBuffer(gl.ARRAY_BUFFER, statBuf);
      [3, 4, 5].forEach(function (i, k) { gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 48, start * 48 + k * 16); });
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 15, count);
    }

    function frame(now) {
      raf = 0;
      if (!alive || !visible || document.hidden) return;
      var dt = last ? clamp((now - last) / 1000, 0.0005, 0.05) : 1 / 60;
      last = now;
      update(dt);
      render();
      var still = reduce || (s.paused && st.introT >= 1 && Math.abs(st.hold) < 0.01);
      if (!still) raf = requestAnimationFrame(frame); else last = 0;
    }
    function wake() { if (!raf && alive && visible && !document.hidden) raf = requestAnimationFrame(frame); }

    // ---- input (listens on the hero, since text and buttons sit above the background)
    var target = s.eventTarget || container;
    function inHero(e) {
      var r = container.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      return { x: x, y: y, inside: x >= 0 && x <= 1 && y >= 0 && y <= 1 };
    }
    function onMove(e) {
      var p = inHero(e);
      st.inside = p.inside && e.pointerType !== "touch";
      if (p.inside) { st.pointer[0] = p.x; st.pointer[1] = p.y; }
      wake();
    }
    function interactive(e) { return !(e.target && e.target.closest && e.target.closest("a, button, input, form, select, textarea, label")); }
    function onDown(e) {
      var p = inHero(e);
      if (!p.inside || !interactive(e)) return;
      st.pointer[0] = p.x; st.pointer[1] = p.y;
      st.pressAt = performance.now(); st.holding = true;
      if (s.pulseOnClick && !reduce) {
        st.rings.push({ x: p.x * 2 - 1, y: 1 - p.y * 2, t: st.clock });
        if (st.rings.length > MAX_RINGS) st.rings.shift();
      }
      wake();
    }
    function onUp() { st.holding = false; st.pressAt = -1; wake(); }
    function onLeave() { st.inside = false; wake(); }
    global.addEventListener("pointermove", onMove, { passive: true });
    target.addEventListener("pointerdown", onDown, { passive: true });
    global.addEventListener("pointerup", onUp, { passive: true });
    global.addEventListener("pointercancel", onUp, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", function () { last = 0; wake(); });

    var ro = new ResizeObserver(resize);
    ro.observe(container);
    var io = new IntersectionObserver(function (es) { visible = es.some(function (e) { return e.isIntersecting; }); if (visible) { last = 0; wake(); } });
    io.observe(container);
    resize();

    return {
      update: function (next) {
        Object.assign(s, next || {});
        shardRGB = parseColor(s.shardColor, shardRGB);
        accentRGB = parseColor(s.accentColor, accentRGB);
        wake();
      },
      destroy: function () {
        alive = false;
        cancelAnimationFrame(raf);
        ro.disconnect(); io.disconnect();
        global.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerdown", onDown);
        global.removeEventListener("pointerup", onUp);
        global.removeEventListener("pointercancel", onUp);
        document.documentElement.removeEventListener("pointerleave", onLeave);
        var lose = gl.getExtension("WEBGL_lose_context");
        if (lose) lose.loseContext();
        canvas.remove();
      }
    };
  }

  global.AeroShards = { attach: attach };
})(window);
