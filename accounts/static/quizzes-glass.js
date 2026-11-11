/* Quizzes - liquid glass layer.
   1. Background: a game-show quiz stage. A WebGL shader paints volumetric spotlights sweeping through haze
      over a glossy neon floor; on top, a full-resolution 2D layer draws chunky 3D question marks, glass
      A/B/C/D answer orbs that flash right or wrong, a pulsing knowledge network, a countdown ring and dust
      motes drifting through the beams.
   2. Glass interaction: every glass surface gets a specular highlight that follows the pointer.
   3. Topic cards: each card is lit in its own colours with a light that travels around its border.
   4. App mode: bottom dock with scroll-spy, a Play button, immersive quiz screens (dock hidden). */
(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var body = document.body;

  /* ================================================================ background: the quiz stage */
  var sky = document.getElementById("lgSky");
  var fxCanvas = document.getElementById("lgFx");
  if (sky && fxCanvas) initBackground(sky, fxCanvas);

  function initBackground(sky, fxCanvas) {
    var small = window.innerWidth < 760;
    var W = 0, H = 0, running = false, last = 0;
    var scrollY = 0, mx = 0, my = 0, tmx = 0, tmy = 0;

    /* ---------- layer 1 (WebGL): game-show stage — volumetric spotlights in haze over a glossy neon floor ---------- */
    var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
    var FRAG = [
      "precision highp float;",
      "uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;uniform float uScroll;uniform float uLow;",
      "float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}",
      "float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
      " return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}",
      "float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);",
      " for(int i=0;i<4;i++){v+=a*noise(p);p=m*p;a*=.5;if(uLow>.5&&i==2)break;}return v;}",
      /* one volumetric spotlight cone */
      "vec3 beam(vec2 p,vec2 o,float ang,float w,vec3 c,float seed){",
      " vec2 d=p-o;float L=length(d);",
      " float a=atan(d.x,-d.y);",
      " float da=abs(a-ang);",
      " float cone=smoothstep(w,0.,da);cone*=cone;",
      " float fall=exp(-L*.85)*smoothstep(.0,.3,L);",
      " float dust=.5+1.0*fbm(p*2.6+vec2(seed,uTime*.05));",
      " return c*cone*fall*dust;",
      "}",
      "void main(){",
      " float asp=uRes.x/uRes.y;",
      " vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;",
      " p.x+=uMouse.x*.035;p.y+=uScroll*.02;",
      " float t=uTime;",
      " float y01=gl_FragCoord.y/uRes.y;",
      " vec3 col=mix(vec3(.012,.016,.062),vec3(.042,.028,.15),y01);",
      /* haze */
      " float hz=fbm(p*1.25+vec2(t*.02,uScroll*.05));",
      " col+=vec3(.08,.06,.21)*hz*hz*1.5;",
      /* spotlights sweeping from above the screen */
      " vec3 gold=vec3(1.,.78,.34),aqua=vec3(.28,.8,1.),vio=vec3(.62,.42,1.),mag=vec3(1.,.36,.74),ice=vec3(.72,.86,1.);",
      " vec3 sh=vec3(0.);",
      " sh+=beam(p,vec2(-.62*asp,.66),.30+sin(t*.17)*.34,.13,gold,1.);",
      " sh+=beam(p,vec2(-.22*asp,.7),.08+sin(t*.13+1.9)*.32,.11,aqua,2.);",
      " sh+=beam(p,vec2(.2*asp,.7),-.08+sin(t*.15+3.1)*.32,.12,vio,3.);",
      " if(uLow<.5){",
      "  sh+=beam(p,vec2(.62*asp,.66),-.30+sin(t*.19+4.4)*.34,.13,mag,4.);",
      "  sh+=beam(p,vec2(0.,.76),sin(t*.11+.6)*.45,.07,ice,5.)*.8;",
      " }",
      " col+=sh*.72;",
      /* glossy stage floor with a perspective neon grid */
      " float fl=smoothstep(-.14,-.46,p.y);",
      " float yy=max(-p.y-.08,.002);",
      " float z=.5/yy;",
      " vec2 g=vec2(p.x*z*.85+uMouse.x*.25,z*.9+t*.4);",
      " vec2 f=abs(fract(g)-.5);",
      " float ln=smoothstep(.455,.5,max(f.x,f.y));",
      " float gridFade=exp(-z*.035);",
      " col+=mix(vec3(.2,.55,1.),vec3(.7,.4,1.),clamp(p.x*.8+.5,0.,1.))*ln*gridFade*fl*.5;",
      " col+=vec3(.1,.08,.26)*fl*.45*(.5+.5*hz);",
      " col+=sh*fl*.35*smoothstep(-.5,-.15,p.y);",   /* the beams light up the floor */
      /* vignette + grain + tone-map */
      " float vg=smoothstep(1.4,.25,length(p*vec2(.78,1.)));",
      " col*=.6+.55*vg;",
      " col=col/(1.+col*.6)*1.4;",
      " float lum=dot(col,vec3(.3,.59,.11));",
      " col=mix(vec3(lum),col,1.45)*.92;",
      " col+=(hash(gl_FragCoord.xy+t)-.5)*.01;",
      " gl_FragColor=vec4(col,1.);",
      "}"
    ].join("\n");

    var gl = null, loc = {}, hasGL = false;
    try {
      gl = sky.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" }) || sky.getContext("experimental-webgl");
    } catch (e) { gl = null; }
    if (gl) {
      var sh = function (type, src) {
        var o = gl.createShader(type);
        gl.shaderSource(o, src); gl.compileShader(o);
        return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null;
      };
      var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
      if (vs && fs) {
        var prog = gl.createProgram();
        gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          gl.useProgram(prog);
          var buf = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
          var attr = gl.getAttribLocation(prog, "a");
          gl.enableVertexAttribArray(attr);
          gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
          ["uRes", "uTime", "uMouse", "uScroll", "uLow"].forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });
          hasGL = true;
        }
      }
    }
    var scale = small ? 0.5 : 0.62;
    var f2d = hasGL ? null : sky.getContext("2d");

    /* ---------- layer 2 (2D, full resolution): the quiz itself ---------- */
    var fx = fxCanvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);

    function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
    function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
    function shade(c, k) { return [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k)]; }
    function lighten(c, k) { return [Math.round(c[0] + (255 - c[0]) * k), Math.round(c[1] + (255 - c[1]) * k), Math.round(c[2] + (255 - c[2]) * k)]; }
    function mk(w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
    function blurred(src, px) {
      var c = mk(src.width, src.height), x = c.getContext("2d");
      if ("filter" in x) { x.filter = "blur(" + px + "px)"; x.drawImage(src, 0, 0); x.filter = "none"; } else { x.globalAlpha = 0.7; x.drawImage(src, 0, 0); }
      return c;
    }

    var PAL = { gold: hex("#ffc94d"), aqua: hex("#4fd8ff"), violet: hex("#a58bff"), pink: hex("#ff7ab8"), green: hex("#52f0a6"), red: hex("#ff6b6b") };
    var PAL_NAMES = ["gold", "aqua", "violet", "pink"];

    /* a chunky, glossy, extruded "?" */
    function questionSprite(col) {
      var S = 280, c = mk(S, S), x = c.getContext("2d");
      x.textAlign = "center"; x.textBaseline = "middle";
      x.font = '900 238px "Arial Black", "Helvetica Neue", "DM Sans", Arial, sans-serif';
      var cx = S / 2 - 7, cy = S / 2 + 8, depth = 20, i;
      x.shadowColor = rgba(col, 0.9); x.shadowBlur = 46;
      x.fillStyle = rgba(col, 0.5); x.fillText("?", cx, cy);
      x.shadowBlur = 0;
      for (i = depth; i >= 1; i--) { x.fillStyle = rgba(shade(col, 0.30 + 0.34 * (1 - i / depth)), 1); x.fillText("?", cx + i * 0.6, cy + i * 0.85); }
      var g = x.createLinearGradient(0, 40, 0, S - 30);
      g.addColorStop(0, rgba(lighten(col, 0.72), 1)); g.addColorStop(0.45, rgba(col, 1)); g.addColorStop(1, rgba(shade(col, 0.72), 1));
      x.fillStyle = g; x.fillText("?", cx, cy);
      x.lineWidth = 2.5; x.strokeStyle = "rgba(255,255,255,.65)"; x.strokeText("?", cx, cy);
      x.globalCompositeOperation = "source-atop";
      var sheen = x.createLinearGradient(0, 30, S * 0.8, S * 0.8);
      sheen.addColorStop(0, "rgba(255,255,255,.55)"); sheen.addColorStop(0.35, "rgba(255,255,255,.08)"); sheen.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = sheen; x.fillRect(0, 0, S, S);
      return c;
    }

    /* a glass answer orb with a letter inside */
    function orbSprite(letter, col) {
      var S = 240, c = mk(S, S), x = c.getContext("2d"), R = 84, cx = S / 2, cy = S / 2, g;
      g = x.createRadialGradient(cx, cy, R * 0.6, cx, cy, S / 2);
      g.addColorStop(0, rgba(col, 0.38)); g.addColorStop(1, rgba(col, 0));
      x.fillStyle = g; x.fillRect(0, 0, S, S);
      g = x.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.08, cx, cy, R);
      g.addColorStop(0, "rgba(255,255,255,.42)"); g.addColorStop(0.5, rgba(col, 0.26)); g.addColorStop(1, rgba(col, 0.55));
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, 6.2832); x.fill();
      x.save(); x.beginPath(); x.arc(cx, cy, R, 0, 6.2832); x.clip();
      g = x.createRadialGradient(cx, cy + R * 0.95, 4, cx, cy + R * 0.95, R * 1.1);
      g.addColorStop(0, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g; x.fillRect(0, 0, S, S); x.restore();
      g = x.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.5, rgba(col, 0.25)); g.addColorStop(1, rgba(lighten(col, 0.4), 0.8));
      x.lineWidth = 3; x.strokeStyle = g; x.beginPath(); x.arc(cx, cy, R - 1.5, 0, 6.2832); x.stroke();
      x.fillStyle = "rgba(255,255,255,.9)"; x.beginPath(); x.ellipse(cx - R * 0.42, cy - R * 0.5, R * 0.24, R * 0.12, -0.7, 0, 6.2832); x.fill();
      x.fillStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.ellipse(cx + R * 0.45, cy + R * 0.5, R * 0.12, R * 0.06, -0.7, 0, 6.2832); x.fill();
      x.textAlign = "center"; x.textBaseline = "middle";
      x.font = '700 84px "JetBrains Mono", "DM Sans", ui-monospace, monospace';
      x.shadowColor = rgba(lighten(col, 0.3), 0.95); x.shadowBlur = 20;
      x.fillStyle = "rgba(255,255,255,.96)"; x.fillText(letter, cx, cy + 4);
      return c;
    }

    var objects = [], nodes = [], edges = [], signals = [], motes = [], events = [], nextEvent = 3.2;
    var spritesReady = false;

    function placeX(z) {
      var x, tries = 0;
      do { x = Math.random(); tries++; } while (!small && z > 0.7 && x > 0.24 && x < 0.76 && tries < 20);
      return x;
    }

    function buildScene() {
      objects = []; nodes = []; edges = []; signals = []; motes = [];
      var qn = small ? 4 : 8, on = small ? 4 : 7, i;
      for (i = 0; i < qn; i++) {
        var cname = PAL_NAMES[i % PAL_NAMES.length], z = 0.35 + Math.random() * 0.65;
        var sp = questionSprite(PAL[cname]);
        objects.push({ kind: "q", sprite: sp, soft: z < 0.6 ? blurred(sp, 5 + (0.6 - z) * 14) : null, x: placeX(z), y: Math.random(), z: z, rot: (Math.random() - 0.5) * 0.7, vr: (Math.random() - 0.5) * 0.05, ph: Math.random() * 6.28, sp: 0.35 + Math.random() * 0.5, v: 0.003 + Math.random() * 0.006 });
      }
      var letters = ["A", "B", "C", "D", "A", "B", "C"];
      for (i = 0; i < on; i++) {
        var cn = PAL_NAMES[(i + 1) % PAL_NAMES.length], z2 = 0.4 + Math.random() * 0.6;
        var sp2 = orbSprite(letters[i % letters.length], PAL[cn]);
        objects.push({ kind: "orb", sprite: sp2, soft: z2 < 0.6 ? blurred(sp2, 4 + (0.6 - z2) * 12) : null, x: placeX(z2), y: Math.random(), z: z2, rot: 0, vr: 0, ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 0.6, v: 0.002 + Math.random() * 0.005, pulse: 0, flash: 0, flashCol: PAL.green });
      }
      objects.sort(function (a, b) { return a.z - b.z; });
      var nn = small ? 16 : 34;
      for (i = 0; i < nn; i++) nodes.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.004, vy: (Math.random() - 0.5) * 0.004, c: [PAL.aqua, PAL.violet, PAL.gold][i % 3], ph: Math.random() * 6.28 });
      var mn = small ? 26 : 60;
      for (i = 0; i < mn; i++) motes.push({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.6, v: 0.002 + Math.random() * 0.006, ph: Math.random() * 6.28, a: 0.12 + Math.random() * 0.4 });
      spritesReady = true;
    }

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      small = W < 760;
      sky.width = Math.max(2, Math.floor(W * scale)); sky.height = Math.max(2, Math.floor(H * scale));
      sky.style.width = W + "px"; sky.style.height = H + "px";
      if (gl && hasGL) gl.viewport(0, 0, sky.width, sky.height);
      fxCanvas.width = Math.floor(W * dpr); fxCanvas.height = Math.floor(H * dpr);
      fxCanvas.style.width = W + "px"; fxCanvas.style.height = H + "px";
      fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawStage(t) {
      if (hasGL) {
        gl.uniform2f(loc.uRes, sky.width, sky.height);
        gl.uniform1f(loc.uTime, t);
        gl.uniform2f(loc.uMouse, mx, my);
        gl.uniform1f(loc.uScroll, Math.min(scrollY / Math.max(H, 1), 6));
        gl.uniform1f(loc.uLow, small ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      } else if (f2d) {
        var g = f2d.createLinearGradient(0, 0, 0, sky.height);
        g.addColorStop(0, "#0a0828"); g.addColorStop(1, "#04051c");
        f2d.fillStyle = g; f2d.fillRect(0, 0, sky.width, sky.height);
        for (var i = 0; i < 4; i++) {
          var cx = (0.2 + i * 0.2 + Math.sin(t * 0.2 + i) * 0.1) * sky.width, c = [PAL.gold, PAL.aqua, PAL.violet, PAL.pink][i];
          var bg = f2d.createLinearGradient(cx, 0, cx + Math.sin(t * 0.2 + i) * sky.width * 0.2, sky.height);
          bg.addColorStop(0, rgba(c, 0.32)); bg.addColorStop(1, rgba(c, 0));
          f2d.fillStyle = bg; f2d.beginPath(); f2d.moveTo(cx - 8, 0); f2d.lineTo(cx + 8, 0);
          f2d.lineTo(cx + 120 + Math.sin(t * 0.2 + i) * 200, sky.height); f2d.lineTo(cx - 120 + Math.sin(t * 0.2 + i) * 200, sky.height); f2d.fill();
        }
      }
    }

    function drawQuiz(t) {
      fx.clearRect(0, 0, W, H);
      if (!spritesReady) return;
      var i, o, k;

      /* timer ring: a countdown that never reaches zero */
      var rcx = small ? W * 0.86 : W * 0.88, rcy = small ? H * 0.2 : H * 0.78, rr = small ? 70 : 150;
      fx.save(); fx.translate(rcx - mx * 14, rcy);
      for (k = 0; k < 2; k++) {
        var rad = rr * (1 + k * 0.42);
        fx.strokeStyle = rgba(PAL.aqua, 0.12 - k * 0.04); fx.lineWidth = 1; fx.beginPath(); fx.arc(0, 0, rad, 0, 6.2832); fx.stroke();
        fx.strokeStyle = rgba(PAL.aqua, 0.28 - k * 0.1);
        for (i = 0; i < 60; i++) {
          var an = i / 60 * 6.2832, tl = i % 5 === 0 ? 9 : 4;
          fx.beginPath(); fx.moveTo(Math.cos(an) * rad, Math.sin(an) * rad); fx.lineTo(Math.cos(an) * (rad - tl), Math.sin(an) * (rad - tl)); fx.stroke();
        }
      }
      var cycle = (t % 10) / 10, head = -1.5708 + cycle * 6.2832;
      var tg = fx.createConicGradient ? fx.createConicGradient(-1.5708, 0, 0) : null;
      fx.lineCap = "round"; fx.lineWidth = 5;
      fx.strokeStyle = rgba(cycle > 0.7 ? PAL.pink : PAL.aqua, 0.5);
      fx.shadowColor = rgba(cycle > 0.7 ? PAL.pink : PAL.aqua, 0.8); fx.shadowBlur = 14;
      fx.beginPath(); fx.arc(0, 0, rr - 2, -1.5708, head); fx.stroke();
      fx.shadowBlur = 0;
      fx.font = "700 " + Math.round(rr * 0.9) + 'px "JetBrains Mono", ui-monospace, monospace';
      fx.textAlign = "center"; fx.textBaseline = "middle"; fx.fillStyle = "rgba(255,255,255,.07)";
      fx.fillText(String(10 - Math.floor(cycle * 10)), 0, 4);
      fx.restore(); fx.lineCap = "butt";

      /* knowledge network: nodes link up and signals travel along the links */
      var nw = nodes.length;
      for (i = 0; i < nw; i++) {
        var n = nodes[i];
        if (!reduce) { n.x += n.vx * 0.033; n.y += n.vy * 0.033; if (n.x < 0 || n.x > 1) n.vx *= -1; if (n.y < 0 || n.y > 1) n.vy *= -1; }
      }
      edges.length = 0;
      var maxd = small ? 0.28 : 0.2;
      for (i = 0; i < nw; i++) for (k = i + 1; k < nw; k++) {
        var dx = (nodes[i].x - nodes[k].x) * (W / H), dy = nodes[i].y - nodes[k].y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < maxd) { edges.push([i, k, d]); }
      }
      fx.lineWidth = 0.8;
      for (i = 0; i < edges.length; i++) {
        var e = edges[i], A = nodes[e[0]], B = nodes[e[1]], al = (1 - e[2] / maxd) * 0.22;
        fx.strokeStyle = rgba(PAL.aqua, al.toFixed(3));
        fx.beginPath(); fx.moveTo(A.x * W - mx * 6, A.y * H - (scrollY * 0.03) % H); fx.lineTo(B.x * W - mx * 6, B.y * H - (scrollY * 0.03) % H); fx.stroke();
      }
      if (!reduce && edges.length && Math.random() < 0.08 && signals.length < 10) {
        var pick = edges[(Math.random() * edges.length) | 0]; signals.push({ a: pick[0], b: pick[1], u: 0, c: nodes[pick[0]].c });
      }
      for (i = signals.length - 1; i >= 0; i--) {
        var sg = signals[i]; sg.u += 0.018;
        if (sg.u >= 1) { signals.splice(i, 1); continue; }
        var P = nodes[sg.a], Q = nodes[sg.b];
        var sx = (P.x + (Q.x - P.x) * sg.u) * W - mx * 6, sy = (P.y + (Q.y - P.y) * sg.u) * H - (scrollY * 0.03) % H;
        var sgd = fx.createRadialGradient(sx, sy, 0, sx, sy, 9);
        sgd.addColorStop(0, rgba(lighten(sg.c, 0.6), 0.95)); sgd.addColorStop(1, rgba(sg.c, 0));
        fx.fillStyle = sgd; fx.beginPath(); fx.arc(sx, sy, 9, 0, 6.2832); fx.fill();
      }
      for (i = 0; i < nw; i++) {
        var nd = nodes[i], px = nd.x * W - mx * 6, py = nd.y * H - (scrollY * 0.03) % H, pul = 0.6 + 0.4 * Math.sin(t * 1.4 + nd.ph);
        var ng = fx.createRadialGradient(px, py, 0, px, py, 8 * pul + 2);
        ng.addColorStop(0, rgba(lighten(nd.c, 0.5), 0.9)); ng.addColorStop(1, rgba(nd.c, 0));
        fx.fillStyle = ng; fx.beginPath(); fx.arc(px, py, 8 * pul + 2, 0, 6.2832); fx.fill();
      }

      /* quiz events: a random answer orb lights up right or wrong */
      if (!reduce && t > nextEvent) {
        nextEvent = t + 4 + Math.random() * 3.5;
        var orbs = objects.filter(function (q) { return q.kind === "orb"; });
        if (orbs.length) { var ob = orbs[(Math.random() * orbs.length) | 0]; ob.flash = 1.7; ob.flashCol = Math.random() < 0.65 ? PAL.green : PAL.red; ob.flashOk = ob.flashCol === PAL.green; }
      }

      /* floating question marks and answer orbs, far to near */
      for (i = 0; i < objects.length; i++) {
        o = objects[i];
        if (!reduce) { o.y -= o.v * 0.033; if (o.y < -0.18) { o.y = 1.18; o.x = placeX(o.z); } o.rot += o.vr * 0.033; if (o.flash > 0) o.flash -= 0.033; }
        var size = (small ? 78 : 118) * (0.45 + o.z * 0.9);
        var ox = (o.x + Math.sin(t * o.sp + o.ph) * 0.012) * W - mx * 34 * o.z;
        var oy = ((o.y * H - scrollY * 0.09 * o.z) % (H * 1.4) + H * 1.4) % (H * 1.4) - H * 0.2 + Math.sin(t * o.sp * 1.3 + o.ph) * 8;
        var alpha = Math.min(0.85, 0.28 + o.z * 0.6) * (small ? 0.72 : 0.92);
        var img = (o.soft && o.z < 0.6) ? o.soft : o.sprite;
        var sc = 1 + (o.flash > 0 ? 0.08 * Math.sin(o.flash * 6) : 0);
        fx.save(); fx.translate(ox, oy); fx.rotate(o.kind === "q" ? o.rot + Math.sin(t * o.sp + o.ph) * 0.08 : 0); fx.scale(sc, sc);
        fx.globalAlpha = alpha; fx.drawImage(img, -size / 2, -size / 2, size, size);
        fx.restore();
        if (o.kind === "orb" && o.flash > 0) {
          var u = 1 - o.flash / 1.7, col = o.flashCol;
          fx.save(); fx.translate(ox, oy);
          fx.globalAlpha = Math.max(0, 1 - u) * 0.9; fx.strokeStyle = rgba(col, 1); fx.lineWidth = 3; fx.shadowColor = rgba(col, 1); fx.shadowBlur = 24;
          fx.beginPath(); fx.arc(0, 0, size * (0.38 + u * 0.55), 0, 6.2832); fx.stroke(); fx.shadowBlur = 0;
          fx.globalAlpha = Math.min(1, o.flash) * 0.95; fx.strokeStyle = "#fff"; fx.lineWidth = 5; fx.lineCap = "round"; fx.lineJoin = "round";
          fx.beginPath();
          if (o.flashOk) { fx.moveTo(-size * 0.1, size * 0.02); fx.lineTo(-size * 0.02, size * 0.1); fx.lineTo(size * 0.12, -size * 0.08); }
          else { fx.moveTo(-size * 0.08, -size * 0.08); fx.lineTo(size * 0.08, size * 0.08); fx.moveTo(size * 0.08, -size * 0.08); fx.lineTo(-size * 0.08, size * 0.08); }
          fx.stroke(); fx.restore();
        }
      }

      /* dust motes drifting through the beams */
      for (i = 0; i < motes.length; i++) {
        var m = motes[i];
        if (!reduce) { m.y -= m.v * 0.033; if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); } }
        var mxp = (m.x + Math.sin(t * 0.3 + m.ph) * 0.01) * W - mx * 14, myp = ((m.y * H - scrollY * 0.05) % H + H) % H;
        fx.fillStyle = "rgba(255,248,225," + (m.a * (0.5 + 0.5 * Math.sin(t * 1.2 + m.ph))).toFixed(3) + ")";
        fx.beginPath(); fx.arc(mxp, myp, m.r, 0, 6.2832); fx.fill();
      }
    }

    /* while a quiz is being played the scene slows down smoothly and then freezes, so nothing distracts */
    var speed = 1, vt = 0, frozen = false;
    function playing() { return body.classList.contains("lg-screen-quiz"); }
    function frame(now) {
      if (!running) return;
      var want = playing() ? 0 : 1;
      if (frozen && want === 0) return;
      requestAnimationFrame(frame);
      if (now - last < 33) return;
      var dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      speed += (want - speed) * 0.06;
      if (want === 0 && speed < 0.02) { speed = 0; frozen = true; }
      vt += dt * speed;
      mx += (tmx - mx) * 0.06 * speed; my += (tmy - my) * 0.06 * speed;
      drawStage(vt + 26); drawQuiz(vt + 26);
    }
    function wake() {
      if (!frozen || reduce || !running || playing()) return;
      frozen = false; requestAnimationFrame(frame);
    }
    if ("MutationObserver" in window) new MutationObserver(wake).observe(body, { attributes: true, attributeFilter: ["class"] });
    function still() { drawStage(26); drawQuiz(26); }

    window.addEventListener("scroll", function () { scrollY = window.scrollY || 0; }, { passive: true });
    window.addEventListener("pointermove", function (e) {
      tmx = (e.clientX / Math.max(W, 1) - 0.5) * 2; tmy = (e.clientY / Math.max(H, 1) - 0.5) * 2;
    }, { passive: true });
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { var wasSmall = small; resize(); if (wasSmall !== small) buildScene(); if (reduce || !running) still(); }, 150);
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) running = false;
      else if (!reduce) { running = true; requestAnimationFrame(frame); }
    });
    sky.addEventListener("webglcontextlost", function (e) { e.preventDefault(); running = false; }, false);

    resize();
    function start() {
      buildScene();
      if (reduce) still(); else { running = true; requestAnimationFrame(frame); }
    }
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(start, start); } else { start(); }
  }

  /* ================================================================ glass highlight that follows the pointer */
  var GLASS = ".daily-card, .leaderboard, .league-card, .browse-card, .question-card, .answer-btn, .result-stat-card, .share-card, .mystery-card, .hero-stat, .nav-stat, .lb-entry, .category-browse__head, .btn, .lb-toggle, .podium-platform";
  var rafPending = false, lastEvent = null;
  document.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    lastEvent = e;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      var el = lastEvent && lastEvent.target && lastEvent.target.closest ? lastEvent.target.closest(GLASS) : null;
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", ((lastEvent.clientX - r.left) / Math.max(r.width, 1) * 100).toFixed(1) + "%");
      el.style.setProperty("--my", ((lastEvent.clientY - r.top) / Math.max(r.height, 1) * 100).toFixed(1) + "%");
    });
  }, { passive: true });

  /* ================================================================ app mode: screens, dock, scroll-spy */
  var screens = { "hub-screen": "hub", "quiz-screen": "quiz", "result-screen": "result" };
  function syncScreen() {
    var current = "hub";
    Object.keys(screens).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.classList.contains("active")) current = screens[id];
    });
    body.classList.remove("lg-screen-hub", "lg-screen-quiz", "lg-screen-result");
    body.classList.add("lg-screen-" + current);
    if (current !== "hub") window.scrollTo(0, 0);
  }
  Object.keys(screens).forEach(function (id) {
    var el = document.getElementById(id);
    if (el && "MutationObserver" in window) new MutationObserver(syncScreen).observe(el, { attributes: true, attributeFilter: ["class"] });
  });
  syncScreen();

  var dock = document.getElementById("lgDock");
  if (dock) {
    var items = Array.prototype.slice.call(dock.querySelectorAll(".lg-dock__item"));
    function offset() { return window.innerWidth < 760 ? 78 : 96; }
    items.forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var el = document.getElementById(a.getAttribute("data-target"));
        if (!el) return;
        var y = el.getBoundingClientRect().top + window.scrollY - offset();
        pinned = a.getAttribute("data-target");          // keep the tapped item lit while the page glides there
        setActive(pinned);
        window.setTimeout(function () { pinned = ""; }, 1400);
        window.scrollTo({ top: Math.max(0, y), behavior: reduce ? "auto" : "smooth" });
      });
    });
    var play = document.getElementById("lgPlay");
    if (play) play.addEventListener("click", function () {
      var btn = document.getElementById("play-now-btn");
      if (btn) btn.click();
    });
    var seen = {};
    var pinned = "";
    function setActive(id) {
      items.forEach(function (a) {
        var on = a.getAttribute("data-target") === id;
        a.classList.toggle("is-active", on);
        if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
    }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { seen[en.target.id] = en.isIntersecting; });
        if (pinned) return;
        var order = items.map(function (a) { return a.getAttribute("data-target"); });
        for (var i = order.length - 1; i >= 0; i--) { if (seen[order[i]]) { setActive(order[i]); return; } }
      }, { rootMargin: "-30% 0px -55% 0px" });
      items.forEach(function (a) { var t = document.getElementById(a.getAttribute("data-target")); if (t) io.observe(t); });
    }
  }

  /* a tiny tap of haptics on answers (phones that support it) */
  document.addEventListener("click", function (e) {
    if (e.target && e.target.closest && e.target.closest(".answer-btn") && navigator.vibrate) { try { navigator.vibrate(8); } catch (err) { /* ignore */ } }
  }, true);

  /* ================================================================ topic cards: lighting border + tilt */
  var browser = document.getElementById("categoryBrowser");
  var litObserver = ("IntersectionObserver" in window)
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { en.target.classList.toggle("is-lit", en.isIntersecting); });
      }, { rootMargin: "60px" })
    : null;

  function lightCard(card) {
    if (card.dataset.lgLit) return;
    card.dataset.lgLit = "1";
    var styleAttr = card.getAttribute("style") || "";
    var colors = styleAttr.match(/#[0-9a-fA-F]{6}/g) || [];
    if (colors[0]) card.style.setProperty("--c1", colors[0]);
    if (colors[1] || colors[0]) card.style.setProperty("--c2", colors[1] || colors[0]);
    card.style.setProperty("--lg-delay", (-Math.random() * 6).toFixed(2) + "s"); // cards never spin in sync
    if ((card.dataset.liveCategory || "").trim()) card.classList.add("is-live");
    if (litObserver) litObserver.observe(card); else card.classList.add("is-lit");
  }

  function lightAll() {
    if (!browser) return;
    Array.prototype.forEach.call(browser.querySelectorAll(".browse-card"), lightCard);
  }
  if (browser && "MutationObserver" in window) new MutationObserver(lightAll).observe(browser, { childList: true, subtree: true });
  lightAll();

  /* gentle 3D tilt toward the pointer (mouse only) */
  if (window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine)").matches && !reduce) {
    document.addEventListener("pointermove", function (e) {
      var card = e.target && e.target.closest ? e.target.closest(".browse-card") : null;
      if (!card) return;
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / Math.max(r.width, 1) - 0.5, py = (e.clientY - r.top) / Math.max(r.height, 1) - 0.5;
      card.style.setProperty("--rx", (px * 9).toFixed(2) + "deg");
      card.style.setProperty("--ry", (-py * 9).toFixed(2) + "deg");
    }, { passive: true });
    document.addEventListener("pointerout", function (e) {
      var card = e.target && e.target.closest ? e.target.closest(".browse-card") : null;
      if (card && (!e.relatedTarget || !card.contains(e.relatedTarget))) { card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg"); }
    }, { passive: true });
  }
})();
