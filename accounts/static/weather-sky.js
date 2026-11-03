// WeatherSky: a full-screen WebGL2 sky that looks like the real weather outside.
// Layered cloud noise lit from the sun, slanted rain streaks in three depths, snow, fog, lightning, stars and a lit moon,
// with the sky colour following the sun's height (night, dawn/dusk glow, day). Every change eases in, so going from sunny
// to rainy fades instead of jumping. Draws at reduced resolution (clouds are soft) and sleeps when hidden.
(function () {
  var VERT = "#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

  var FRAG = [
    "#version 300 es",
    "precision highp float;",
    "uniform vec2 uRes;uniform float uTime;",
    "uniform float uCloud,uRain,uSnow,uFog,uStorm,uElev,uCelX,uCelY,uWind,uFlash,uFlashX,uMoonA,uMoonSide,uLod;",
    "out vec4 o;",
    "float h11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}",
    "float h21(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}",
    "float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
    "return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}",
    "float fbm(vec2 p){float s=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);",
    "for(int i=0;i<6;i++){if(float(i)>=uLod)break;s+=a*vn(p);p=m*p;a*=.5;}return s;}",
    // sky colour for height v (0 bottom .. 1 top) given the sun's height
    "vec3 skyCol(float v,float elev,float dx){",
    "float day=smoothstep(-.06,.34,elev);",
    "float tw=exp(-pow((elev-.02)/.17,2.));",
    "vec3 top=mix(vec3(.008,.016,.07),vec3(.07,.30,.72),day);",
    "vec3 hor=mix(vec3(.05,.09,.22),vec3(.58,.80,.97),day);",
    "top=mix(top,vec3(.10,.14,.38),tw*.85);",
    "hor=mix(hor,vec3(1.,.52,.26),tw);",
    "hor+=vec3(.55,.25,.08)*tw*exp(-dx*dx*2.2);",
    "vec3 c=mix(hor,top,pow(clamp(v,0.,1.),.62));",
    "return c;}",
    "float stars(vec2 uv,float t){vec2 g=uv*vec2(uRes.x/uRes.y,1.)*85.;vec2 id=floor(g);vec2 f=fract(g)-.5;",
    "float r=h21(id);float on=step(.965,r);vec2 off=vec2(h21(id+3.1),h21(id+7.7))-.5;",
    "float d=length(f-off*.6);float tw=.6+.4*sin(t*(1.+r*3.)+r*40.);",
    "return on*smoothstep(.16,.0,d)*tw*(.4+.6*h21(id+1.));}",
    "float rainLayer(vec2 uv,float cols,float len,float speed,float seed,float dens){",
    "uv.x+=uv.y*-.16;float x=uv.x*cols;float cx=floor(x);float fx=fract(x);",
    "float r=h11(cx+seed);float on=step(1.-dens,h11(cx*1.7+seed*3.1));",
    "float y=fract(uv.y*.62+uTime*speed*(.75+.5*r)+r*17.);",
    "float w=smoothstep(.30,.08,abs(fx-.5));",
    "float tail=smoothstep(len,0.,y)*smoothstep(0.,.008,y);",
    "return w*tail*on;}",
    "float snowLayer(vec2 uv,float scale,float speed,float seed){",
    "uv.y+=uTime*speed;uv.x+=sin(uv.y*2.3+seed)*.035+uTime*.012*uWind;",
    "vec2 g=uv*scale;vec2 id=floor(g);vec2 f=fract(g)-.5;",
    "vec2 pos=(vec2(h21(id+seed),h21(id+seed+7.))-.5)*.6;float sz=.05+.09*h21(id+3.);",
    "return smoothstep(sz,sz*.25,length(f-pos))*step(.4,h21(id+11.));}",
    "void main(){",
    "vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;vec2 p=vec2((uv.x-.5)*asp,uv.y);",
    "vec2 cel=vec2((uCelX-.5)*asp,uCelY);float elev=uElev;",
    "float dx=p.x-cel.x;",
    "float day=smoothstep(-.06,.34,elev);float tw=exp(-pow((elev-.02)/.17,2.));",
    "vec3 col=skyCol(uv.y,elev,dx);",
    "float cover=clamp(uCloud+uRain*.4+uSnow*.35+uStorm*.3,0.,1.);",
    // stars, only on clear nights
    "float nightK=1.-smoothstep(-.12,.08,elev);",
    "col+=vec3(.85,.92,1.)*stars(uv,uTime)*nightK*(1.-cover)*smoothstep(.15,.5,uv.y);",
    // sun / moon
    "float d=length(p-cel);",
    "if(elev>=0.){",
    "float disc=smoothstep(.052,.046,d);",
    "vec3 sc=mix(vec3(1.,.97,.9),vec3(1.,.62,.3),tw);",
    "float glow=exp(-d*4.2)*.6+exp(-d*14.)*.95;",
    "col+=sc*(glow*.7+disc*2.4)*(1.-smoothstep(.55,1.,cover)*.8)*(1.-uFog*.4);}",
    "else{",
    "vec2 q=(p-cel)/.062;float r2=dot(q,q);",
    "float disc=smoothstep(1.,.9,sqrt(r2));",
    "vec3 n=vec3(q,sqrt(max(0.,1.-r2)));",
    "float a=uMoonA;vec3 L=vec3(uMoonSide*sin(a),.0,cos(a));",
    "float lit=smoothstep(-.02,.12,dot(n,L));",
    "float cr=fbm(q*2.4+3.)*.55+.45;",
    "vec3 mc=mix(vec3(.04,.05,.09),vec3(.93,.94,.88)*cr,lit);",
    "col=mix(col,mc,disc*(1.-smoothstep(.55,1.,cover)*.75));",
    "col+=vec3(.55,.65,.95)*exp(-d*7.)*.34*(1.-smoothstep(.55,1.,cover)*.75);}",
    // clouds: three drifting layers, lit from the sun's side
    "vec2 sdir=normalize(vec2(cel.x-p.x,cel.y-p.y)+1e-4);",
    "float lightDay=mix(.28,1.,day);",
    "vec3 litC=mix(vec3(.14,.17,.28),vec3(1.,.985,.96),day);",
    "litC=mix(litC,vec3(1.,.74,.52),tw*.85);",
    "vec3 shC=mix(vec3(.04,.05,.10),vec3(.50,.58,.72),day);",
    "shC=mix(shC,vec3(.45,.36,.50),tw*.7);",
    "float dark=uRain*.42+uStorm*.5+uSnow*.12;",
    "litC=mix(litC,litC*vec3(.62,.66,.72)*lightDay,clamp(dark,0.,.85));",
    "shC=mix(shC,shC*vec3(.45,.48,.58),clamp(dark,0.,.9));",
    "float cloudAcc=0.;vec3 cloudCol=vec3(0.);",
    "for(int L=0;L<3;L++){",
    "float fl=float(L);float sc=mix(1.5,3.1,fl/2.);float spd=(.010+uWind*.016)*(1.+fl*.55);",
    "vec2 q=vec2(p.x*sc+uTime*spd+fl*7.3,p.y*sc*1.55+fl*3.1);",
    "q.y+=.35*vn(q*.9+uTime*.01);",
    "float dn=fbm(q);",
    "float thr=1.02-cover*(.82-fl*.08);",
    "float cl=smoothstep(thr,thr+.30,dn);",
    "float alt=mix(.2,1.,smoothstep(.0,.7,uv.y));",
    "cl*=mix(.45,1.,alt)*(1.-fl*.1);",
    "float dl=fbm(q+sdir*.12);",
    "float shade=clamp((dn-dl)*5.5+.55,0.,1.);",
    "vec3 cc=mix(shC,litC,shade);",
    "cc+=litC*pow(1.-cl,3.)*.18*exp(-d*3.)*day;",
    "cloudCol=mix(cloudCol,cc,cl);cloudAcc=max(cloudAcc,cl)+cl*.0;",
    "float k=cl;col=mix(col,cc,clamp(k*(.92-fl*.06),0.,1.));}",
    // overcast haze
    "float lum=dot(col,vec3(.3,.55,.15));",
    "col=mix(col,vec3(lum)*mix(.8,1.,day)+vec3(.04,.05,.07),clamp(cover*.42+uRain*.18,0.,.62));",
    "col*=1.-dark*.35;",
    // fog / mist
    "float fogN=fbm(vec2(p.x*1.4+uTime*.02,p.y*2.6));",
    "vec3 fogC=mix(vec3(.14,.17,.24),vec3(.80,.84,.88),day);",
    "col=mix(col,fogC,clamp(uFog*(.55+.45*fogN)*(.9-.35*uv.y),0.,.92));",
    // rain: three depths + mist at the bottom
    "if(uRain>.01){",
    "vec2 ru=vec2(p.x,uv.y);",
    "float r=rainLayer(ru,110.,.11,1.35,1.3,uRain)*.26+rainLayer(ru,180.,.08,1.9,5.7,uRain)*.38+rainLayer(ru,290.,.055,2.6,9.1,uRain)*.55;",
    "vec3 rc=mix(vec3(.62,.70,.86),vec3(.88,.93,1.),day);",
    "col+=rc*r*(.55+.45*uRain);",
    "col=mix(col,vec3(lum*.9)+.04,uRain*.10*(1.-uv.y)*fbm(vec2(p.x*3.+uTime*.1,p.y*5.)));}",
    // snow
    "if(uSnow>.01){float s=snowLayer(vec2(p.x,uv.y),9.,.09,1.)*.55+snowLayer(vec2(p.x,uv.y),16.,.14,4.)*.75+snowLayer(vec2(p.x,uv.y),30.,.20,8.)*.9;",
    "col+=vec3(.95,.97,1.)*s*uSnow;}",
    // lightning
    "if(uFlash>.01){",
    "col+=vec3(.55,.62,.85)*uFlash*(.35+cloudAcc*.65)*(1.-uv.y*.35);",
    "float bx=(uFlashX-.5)*asp;float jag=(vn(vec2(uv.y*9.,uFlashX*30.))-.5)*.20+(vn(vec2(uv.y*26.,uFlashX*11.))-.5)*.05;",
    "float bolt=exp(-abs(p.x-bx-jag)*190.)*smoothstep(.30,.78,uv.y)*smoothstep(1.,.92,uv.y);",
    "col+=vec3(.82,.88,1.)*bolt*pow(uFlash,2.)*1.2;}",
    // grade + vignette + grain
    "col=pow(col,vec3(.96));",
    "col*=1.-.22*pow(length(uv-.5)*1.25,2.);",
    "col+=(h21(gl_FragCoord.xy+uTime)-.5)*.012;",
    "o=vec4(clamp(col,0.,1.),1.);}"
  ].join("\n");

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(log || "shader compile failed");
    }
    return s;
  }

  var KEYS = ["cloud", "rain", "snow", "fog", "storm", "elev", "celX", "celY", "wind", "moonA", "moonSide"];
  var DEFAULT = { cloud: 0.15, rain: 0, snow: 0, fog: 0, storm: 0, elev: 0.6, celX: 0.62, celY: 0.62, wind: 0.3, moonA: 1.2, moonSide: 1 };

  function mount(canvas, opts) {
    opts = opts || {};
    var gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "low-power", preserveDrawingBuffer: false });
    if (!gl) return null;
    var prog;
    try {
      var vs = compile(gl, gl.VERTEX_SHADER, VERT), fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs);
      gl.bindAttribLocation(prog, 0, "a");
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) {
      if (window.console) console.warn("WeatherSky: shader failed, using the gradient only.", e && e.message);
      return null;
    }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ["uRes", "uTime", "uCloud", "uRain", "uSnow", "uFog", "uStorm", "uElev", "uCelX", "uCelY", "uWind", "uFlash", "uFlashX", "uMoonA", "uMoonSide", "uLod"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    var coarse = window.matchMedia("(pointer: coarse)").matches;
    var weak = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var scale = opts.scale || (coarse || weak ? 0.42 : 0.6);
    var lod = coarse || weak ? 4 : 5;
    var minFrame = 1000 / (opts.maxFps || (coarse || weak ? 30 : 48));

    var cur = {}, tgt = {};
    KEYS.forEach(function (k) { cur[k] = tgt[k] = (opts.initial && opts.initial[k] != null) ? opts.initial[k] : DEFAULT[k]; });

    var flash = { v: 0, x: 0.5, next: 0, pulses: [] };
    function planFlash(now) {
      flash.next = now + 4000 + Math.random() * 9000;
      flash.x = 0.15 + Math.random() * 0.7;
      var t = now + 0;
      flash.pulses = [{ at: t, p: 1 }, { at: t + 130 + Math.random() * 90, p: 0.75 }, { at: t + 330 + Math.random() * 200, p: 0.45 }];
    }

    var running = true, visible = true, raf = 0, last = 0, t0 = performance.now(), w = 0, h = 0;
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var cw = canvas.clientWidth || window.innerWidth, ch = canvas.clientHeight || window.innerHeight;
      var nw = Math.max(2, Math.round(cw * dpr * scale)), nh = Math.max(2, Math.round(ch * dpr * scale));
      if (nw !== w || nh !== h) { w = canvas.width = nw; h = canvas.height = nh; gl.viewport(0, 0, w, h); }
    }

    function frame(now) {
      raf = 0;
      if (!running || !visible) return;
      raf = requestAnimationFrame(frame);
      if (now - last < minFrame) return;
      var dt = Math.min(0.1, (now - last) / 1000 || 0.016);
      last = now;
      resize();
      var ease = 1 - Math.exp(-dt * 1.6);
      KEYS.forEach(function (k) { cur[k] += (tgt[k] - cur[k]) * ease; });
      // lightning only in thunderstorms
      var fv = 0;
      if (tgt.storm > 0.3) {
        if (!flash.next) planFlash(now);
        if (now > flash.next && flash.pulses.length === 0) planFlash(now);
        flash.pulses.forEach(function (pl) { var age = now - pl.at; if (age >= 0) fv = Math.max(fv, pl.p * Math.exp(-age / 90)); });
        flash.pulses = flash.pulses.filter(function (pl) { return now - pl.at < 700; });
        if (!flash.pulses.length && now < flash.next) fv = 0;
      }
      var time = ((now - t0) / 1000) * (reduce ? 0.25 : 1);
      gl.uniform2f(U.uRes, w, h);
      gl.uniform1f(U.uTime, time);
      gl.uniform1f(U.uCloud, cur.cloud); gl.uniform1f(U.uRain, cur.rain); gl.uniform1f(U.uSnow, cur.snow);
      gl.uniform1f(U.uFog, cur.fog); gl.uniform1f(U.uStorm, cur.storm); gl.uniform1f(U.uElev, cur.elev);
      gl.uniform1f(U.uCelX, cur.celX); gl.uniform1f(U.uCelY, cur.celY); gl.uniform1f(U.uWind, cur.wind);
      gl.uniform1f(U.uFlash, fv); gl.uniform1f(U.uFlashX, flash.x);
      gl.uniform1f(U.uMoonA, cur.moonA); gl.uniform1f(U.uMoonSide, cur.moonSide); gl.uniform1f(U.uLod, lod);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!canvas.classList.contains("is-live")) canvas.classList.add("is-live");
    }
    function kick() { if (!raf && running && visible) { last = 0; raf = requestAnimationFrame(frame); } }

    var onVis = function () { visible = !document.hidden; if (visible) kick(); };
    document.addEventListener("visibilitychange", onVis);
    var io = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(function (es) { visible = !document.hidden && es.some(function (e) { return e.isIntersecting; }); if (visible) kick(); });
      io.observe(canvas);
    }
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); running = false; });
    canvas.addEventListener("webglcontextrestored", function () { running = true; kick(); });
    window.addEventListener("resize", resize);
    resize(); kick();

    return {
      // state: any of cloud, rain, snow, fog, storm (0..1), elev (-1..1), celX/celY (0..1), wind (0..1), moonFrac (0..1), moonWaxing
      set: function (s) {
        KEYS.forEach(function (k) { if (typeof s[k] === "number" && isFinite(s[k])) tgt[k] = s[k]; });
        if (typeof s.moonFrac === "number") { tgt.moonA = Math.acos(Math.max(-1, Math.min(1, 1 - 2 * s.moonFrac))); }
        if (typeof s.moonWaxing === "boolean") tgt.moonSide = s.moonWaxing ? 1 : -1;
        kick();
      },
      flashNow: function () { var n = performance.now(); flash.x = 0.3 + Math.random() * 0.4; flash.pulses = [{ at: n, p: 1 }, { at: n + 160, p: 0.7 }]; flash.next = n + 6000; tgt.storm = Math.max(tgt.storm, 0.5); kick(); },
      snap: function () { KEYS.forEach(function (k) { cur[k] = tgt[k]; }); },
      destroy: function () {
        running = false; if (raf) cancelAnimationFrame(raf);
        document.removeEventListener("visibilitychange", onVis); window.removeEventListener("resize", resize);
        if (io) io.disconnect();
      }
    };
  }

  window.WeatherSky = { mount: mount };
})();
