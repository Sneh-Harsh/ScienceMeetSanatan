/* Horoscope — deep-space background.
   Layer 1 (WebGL, rendered at reduced resolution): domain-warped volumetric nebula, galactic dust band,
   and a lit, banded ringed planet with an atmosphere rim and a small moon.
   Layer 2 (2D canvas, full resolution): parallax stars with diffraction flares, faint constellation lines,
   shooting stars and slow orbital HUD rings around the planet.
   Pauses when hidden, draws one still frame for reduced-motion users, falls back to a 2D glow without WebGL. */
(function () {
  "use strict";

  var gl_canvas = document.getElementById("liveSky");
  var fx_canvas = document.getElementById("liveSkyFx");
  if (!gl_canvas || !fx_canvas) return;

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = window.innerWidth < 760;
  var W = 0, H = 0, running = false, last = 0;
  var scrollY = 0, mx = 0, my = 0, tmx = 0, tmy = 0;

  /* ---------------------------------------------------------------- WebGL layer */
  var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  var FRAG = [
    "precision highp float;",
    "uniform vec2 uRes;uniform float uTime;uniform vec2 uScroll;uniform vec2 uMouse;uniform float uLow;",
    "float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}",
    "float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
    " return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}",
    "float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);",
    " for(int i=0;i<5;i++){v+=a*noise(p);p=m*p;a*=.5;if(uLow>.5&&i==3)break;}return v;}",
    "mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}",
    "void main(){",
    " float asp=uRes.x/uRes.y;",
    " vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;",
    " vec2 q0=p+uScroll*.12+uMouse*.02;",
    " float t=uTime*.018;",
    /* nebula */
    " vec2 q=vec2(fbm(q0*1.5+t),fbm(q0*1.5+vec2(5.2,1.3)-t));",
    " vec2 r=vec2(fbm(q0*2.+4.*q+vec2(1.7,9.2)+t*1.5),fbm(q0*2.+4.*q+vec2(8.3,2.8)-t));",
    " float f=fbm(q0*1.7+4.*r);",
    " vec3 col=vec3(.010,.012,.032);",
    " col=mix(col,vec3(.32,.11,.60),clamp(f*f*2.6,0.,1.));",
    " col=mix(col,vec3(.04,.46,.62),clamp(length(q)*.75*f,0.,1.)*.62);",
    " col=mix(col,vec3(.98,.46,.20),clamp(pow(r.x,3.)*f*2.2,0.,1.)*.42);",
    " col*=.45+1.0*f;",
    /* galactic band + dust */
    " float band=exp(-pow((q0.y-.28*q0.x+.04)*2.4,2.));",
    " col+=band*vec3(.11,.08,.19)*(.4+fbm(q0*6.+t));",
    " if(uLow<.5){float dust=fbm(q0*5.+r*2.);col*=1.-.5*smoothstep(.55,.85,dust)*band;}",
    /* planet */
    " float R=.27*clamp(asp,.62,1.1);",
    " vec2 c=vec2(asp*.5+.06,-.30)+vec2(uMouse.x*.01,uMouse.y*.008);",
    " c.y+=uScroll.y*.05;",
    " vec2 d=p-c;",
    " vec2 rd=rot(-.42)*d;",                       /* ring plane tilt */
    " vec2 e=vec2(rd.x,rd.y/.26)/R;",
    " float rr=length(e);",
    " float ringBand=.5+.5*sin(rr*70.+fbm(vec2(rr*16.,1.))*6.);",
    " float ringA=smoothstep(1.28,1.34,rr)*(1.-smoothstep(2.02,2.12,rr))*(.35+.65*ringBand);",
    " ringA*=1.-smoothstep(1.62,1.66,rr)*(1.-smoothstep(1.7,1.74,rr))*.85;",   /* Cassini gap */
    " vec3 ringCol=mix(vec3(.62,.52,.40),vec3(.92,.82,.66),ringBand)*.9;",
    " float behind=step(0.,rd.y);",                /* upper half is behind the planet */
    " col=mix(col,ringCol*.55,ringA*behind*.85);",
    " float pr=length(d)/R;",
    " if(pr<1.04){",
    "  float z=sqrt(max(1.-pr*pr,0.));",
    "  vec3 n=vec3(d/R,z);",
    "  vec3 L=normalize(vec3(-.72,.52,.62));",
    "  float diff=max(dot(n,L),0.);",
    "  float lat=n.y*3.6+fbm(vec2(n.x*2.2+t*4.,n.y*7.))*.95;",
    "  float bands=.5+.5*sin(lat*8.4);",
    "  vec3 c1=vec3(.82,.62,.38),c2=vec3(.50,.31,.19),c3=vec3(.95,.86,.66);",
    "  vec3 surf=mix(c2,c1,bands);",
    "  surf=mix(surf,c3,smoothstep(.55,1.,fbm(vec2(n.x*3.2,lat*2.2)))*.5);",
    "  vec3 lit=surf*(diff*1.15+.015);",
    "  float rim=pow(1.-z,3.);",
    "  lit+=vec3(.42,.54,1.)*rim*.9*smoothstep(-.25,.9,dot(n,L)+.35);",
    "  float edge=1.-smoothstep(.985,1.,pr);",
    "  col=mix(col,lit,edge);",
    /* ring shadow band across the planet */
    "  float sh=smoothstep(.02,.0,abs(n.y+.14))*.0;",
    " }",
    " col+=vec3(.30,.42,.95)*exp(-max(pr-1.,0.)*9.)*step(1.,pr)*.14;",
    " col=mix(col,ringCol,ringA*(1.-behind)*.92);",   /* front half over the planet */
    /* moon */
    " vec2 mc=c+vec2(-R*2.7,R*.55);",
    " float mR=R*.17;vec2 md=p-mc;float mr=length(md)/mR;",
    " if(mr<1.){float mz=sqrt(1.-mr*mr);vec3 mn=vec3(md/mR,mz);",
    "  float mdif=max(dot(mn,normalize(vec3(-.72,.52,.62))),0.);",
    "  float cr=fbm(mn.xy*5.+3.);vec3 ms=mix(vec3(.46,.46,.50),vec3(.80,.80,.84),cr);",
    "  col=mix(col,ms*(mdif*1.2+.02),1.-smoothstep(.96,1.,mr));}",
    /* vignette + subtle grain */
    " float vg=smoothstep(1.25,.25,length(p*vec2(.8,1.)));",
    " col*=.55+.6*vg;",
    " col+=(hash(gl_FragCoord.xy+uTime)-.5)*.012;",
    " col=pow(col,vec3(.92));",
    " gl_FragColor=vec4(col,1.);",
    "}"
  ].join("\n");

  var gl = null, prog = null, loc = {};
  function initGL() {
    try {
      gl = gl_canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power", preserveDrawingBuffer: false }) ||
           gl_canvas.getContext("experimental-webgl");
    } catch (e) { gl = null; }
    if (!gl) return false;
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { return null; }
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var a = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    ["uRes", "uTime", "uScroll", "uMouse", "uLow"].forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });
    return true;
  }

  var hasGL = initGL();
  var scale = small ? 0.5 : 0.55;

  function sizeGL() {
    gl_canvas.width = Math.max(2, Math.floor(W * scale));
    gl_canvas.height = Math.max(2, Math.floor(H * scale));
    gl_canvas.style.width = W + "px";
    gl_canvas.style.height = H + "px";
    if (gl) gl.viewport(0, 0, gl_canvas.width, gl_canvas.height);
  }

  function drawGL(t) {
    if (!gl) return;
    gl.uniform2f(loc.uRes, gl_canvas.width, gl_canvas.height);
    gl.uniform1f(loc.uTime, t);
    gl.uniform2f(loc.uScroll, 0, Math.min(scrollY / Math.max(H, 1), 4));
    gl.uniform2f(loc.uMouse, mx, my);
    gl.uniform1f(loc.uLow, small ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* ---------------------------------------------------------------- 2D fallback (no WebGL) */
  var f2d = hasGL ? null : gl_canvas.getContext("2d");
  function drawFallback(t) {
    if (!f2d) return;
    f2d.setTransform(1, 0, 0, 1, 0, 0);
    f2d.fillStyle = "#05050f";
    f2d.fillRect(0, 0, gl_canvas.width, gl_canvas.height);
    var cols = [[120, 70, 200], [30, 140, 190], [230, 120, 70]];
    for (var i = 0; i < 3; i++) {
      var x = (0.5 + Math.sin(t * 0.05 + i * 2) * 0.35) * gl_canvas.width;
      var y = (0.4 + Math.cos(t * 0.04 + i * 3) * 0.3) * gl_canvas.height;
      var r = Math.max(gl_canvas.width, gl_canvas.height) * 0.5;
      var g = f2d.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(" + cols[i].join(",") + ",.35)");
      g.addColorStop(1, "rgba(" + cols[i].join(",") + ",0)");
      f2d.fillStyle = g;
      f2d.fillRect(0, 0, gl_canvas.width, gl_canvas.height);
    }
  }

  /* ---------------------------------------------------------------- 2D effects layer */
  var fx = fx_canvas.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
  var stars = [], lines = [], shooters = [], nextShot = 4;

  function seedStars() {
    stars = []; lines = [];
    var n = small ? 120 : 260;
    var pal = ["255,255,255", "190,210,255", "255,226,190", "255,255,255", "210,190,255"];
    for (var i = 0; i < n; i++) {
      var z = 0.2 + Math.random() * 0.8;
      stars.push({
        x: Math.random(), y: Math.random(), z: z,
        r: (0.35 + Math.random() * 1.1) * (0.5 + z),
        a: 0.35 + Math.random() * 0.65,
        ph: Math.random() * 6.28, sp: 0.5 + Math.random() * 2.2,
        c: pal[(Math.random() * pal.length) | 0],
        flare: Math.random() < 0.06
      });
    }
    /* constellation lines between nearby bright stars */
    var bright = stars.filter(function (s) { return s.r > 0.9; }).slice(0, small ? 18 : 36);
    for (var a = 0; a < bright.length; a++) {
      var best = null, bd = 1e9;
      for (var b = 0; b < bright.length; b++) {
        if (a === b) continue;
        var dx = bright[a].x - bright[b].x, dy = (bright[a].y - bright[b].y) * 0.6;
        var d = dx * dx + dy * dy;
        if (d < bd && d < 0.03) { bd = d; best = bright[b]; }
      }
      if (best) lines.push([bright[a], best]);
    }
  }

  function sizeFX() {
    fx_canvas.width = Math.floor(W * dpr);
    fx_canvas.height = Math.floor(H * dpr);
    fx_canvas.style.width = W + "px";
    fx_canvas.style.height = H + "px";
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function planetScreen() {
    var asp = W / H;
    var R = 0.27 * Math.min(Math.max(asp, 0.62), 1.1);
    var cx = asp * 0.5 + 0.06 + mx * 0.01;
    var cy = -0.30 + (scrollY / Math.max(H, 1)) * 0.05 + my * 0.008;
    return { x: W / 2 + cx * H, y: H / 2 - cy * H, R: R * H };
  }

  function drawFX(t) {
    fx.clearRect(0, 0, W, H);
    var sy = scrollY;

    /* constellation lines */
    fx.lineWidth = 0.6;
    fx.strokeStyle = "rgba(160,190,255,.10)";
    fx.beginPath();
    lines.forEach(function (l) {
      var a = l[0], b = l[1];
      fx.moveTo(a.x * W + mx * 8 * a.z, ((a.y * H - sy * 0.04 * a.z) % H + H) % H);
      fx.lineTo(b.x * W + mx * 8 * b.z, ((b.y * H - sy * 0.04 * b.z) % H + H) % H);
    });
    fx.stroke();

    /* stars */
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var x = s.x * W + mx * 14 * s.z;
      var y = (((s.y * H - sy * 0.05 * s.z) % H) + H) % H;
      var tw = reduce ? 0.8 : 0.55 + 0.45 * Math.sin(t * s.sp + s.ph);
      var al = s.a * tw;
      var r = s.r * (reduce ? 1 : 0.85 + 0.25 * tw);
      fx.fillStyle = "rgba(" + s.c + "," + al.toFixed(3) + ")";
      fx.beginPath(); fx.arc(x, y, r, 0, 6.2832); fx.fill();
      if (s.r > 0.9) {
        var g = fx.createRadialGradient(x, y, 0, x, y, r * 5);
        g.addColorStop(0, "rgba(" + s.c + "," + (al * 0.35).toFixed(3) + ")");
        g.addColorStop(1, "rgba(" + s.c + ",0)");
        fx.fillStyle = g; fx.beginPath(); fx.arc(x, y, r * 5, 0, 6.2832); fx.fill();
      }
      if (s.flare) {
        fx.strokeStyle = "rgba(" + s.c + "," + (al * 0.5).toFixed(3) + ")";
        fx.lineWidth = 0.6;
        fx.beginPath();
        fx.moveTo(x - r * 7, y); fx.lineTo(x + r * 7, y);
        fx.moveTo(x, y - r * 7); fx.lineTo(x, y + r * 7);
        fx.stroke();
      }
    }

    /* orbital HUD rings around the planet */
    var P = planetScreen();
    fx.save();
    fx.translate(P.x, P.y);
    var rings = small ? [1.9, 2.5] : [2.35, 2.95, 3.6];
    fx.lineWidth = 0.8;
    rings.forEach(function (k, idx) {
      var r = P.R * k;
      fx.save();
      fx.rotate((reduce ? 0 : t * (0.02 + idx * 0.012)) * (idx % 2 ? -1 : 1));
      fx.strokeStyle = "rgba(120,220,255," + (0.14 - idx * 0.03) + ")";
      fx.setLineDash(idx === 1 ? [2, 7] : idx === 2 ? [16, 10] : []);
      fx.beginPath(); fx.arc(0, 0, r, 0, 6.2832); fx.stroke();
      fx.setLineDash([]);
      /* tick marks */
      fx.strokeStyle = "rgba(150,230,255," + (0.22 - idx * 0.05) + ")";
      for (var a = 0; a < 72; a++) {
        var ang = (a / 72) * 6.2832;
        var tl = a % 6 === 0 ? 9 : 4;
        fx.beginPath();
        fx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
        fx.lineTo(Math.cos(ang) * (r - tl), Math.sin(ang) * (r - tl));
        fx.stroke();
      }
      /* orbiting marker */
      var oa = (reduce ? 1 : t * (0.09 + idx * 0.04)) + idx * 2;
      fx.fillStyle = "rgba(255,200,130,.85)";
      fx.beginPath(); fx.arc(Math.cos(oa) * r, Math.sin(oa) * r, 2.6, 0, 6.2832); fx.fill();
      fx.restore();
    });
    fx.restore();

    /* shooting stars */
    if (!reduce) {
      if (t > nextShot) {
        nextShot = t + 6 + Math.random() * 9;
        var ang = 0.35 + Math.random() * 0.25;
        shooters.push({ x: Math.random() * W * 0.8, y: Math.random() * H * 0.45, vx: Math.cos(ang) * 900, vy: Math.sin(ang) * 900, life: 0 });
      }
      for (var k = shooters.length - 1; k >= 0; k--) {
        var sh = shooters[k];
        sh.life += 0.016;
        sh.x += sh.vx * 0.016; sh.y += sh.vy * 0.016;
        var al2 = Math.max(0, 1 - sh.life / 0.9);
        var g2 = fx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 0.12, sh.y - sh.vy * 0.12);
        g2.addColorStop(0, "rgba(255,255,255," + al2 + ")");
        g2.addColorStop(1, "rgba(150,190,255,0)");
        fx.strokeStyle = g2; fx.lineWidth = 1.6;
        fx.beginPath(); fx.moveTo(sh.x, sh.y); fx.lineTo(sh.x - sh.vx * 0.12, sh.y - sh.vy * 0.12); fx.stroke();
        if (sh.life > 0.9) shooters.splice(k, 1);
      }
    }
  }

  /* ---------------------------------------------------------------- loop */
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    small = W < 760;
    sizeGL(); sizeFX();
    if (f2d) { gl_canvas.width = Math.floor(W * 0.5); gl_canvas.height = Math.floor(H * 0.5); }
  }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (now - last < 33) return;
    last = now;
    mx += (tmx - mx) * 0.06; my += (tmy - my) * 0.06;
    var t = now / 1000;
    if (hasGL) drawGL(t); else drawFallback(t);
    drawFX(t);
  }

  function still() {
    var t = 40;
    if (hasGL) drawGL(t); else drawFallback(t);
    drawFX(t);
  }

  window.addEventListener("scroll", function () { scrollY = window.scrollY || 0; }, { passive: true });
  window.addEventListener("pointermove", function (e) {
    tmx = (e.clientX / Math.max(W, 1) - 0.5) * 2;
    tmy = (e.clientY / Math.max(H, 1) - 0.5) * 2;
  }, { passive: true });
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { resize(); if (reduce || !running) still(); }, 150);
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { running = false; } else if (!reduce) { running = true; requestAnimationFrame(frame); }
  });
  if (gl_canvas.addEventListener) {
    gl_canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); running = false; }, false);
    gl_canvas.addEventListener("webglcontextrestored", function () { hasGL = initGL(); resize(); if (!reduce) { running = true; requestAnimationFrame(frame); } else still(); }, false);
  }

  resize();
  seedStars();
  if (reduce) { still(); }
  else { running = true; requestAnimationFrame(frame); }
})();
