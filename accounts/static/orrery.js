/*!
 * Orrery: a live, 3D solar system for the SanatanSeva home page.
 *
 * Plain WebGL2, no libraries and no downloaded textures: every planet surface is drawn by a small procedural shader (oceans,
 * continents and clouds on Earth, banded Jupiter with its red spot, ringed Saturn with a ring shadow, a boiling Sun...).
 * Positions are real. Each planet is placed from its Keplerian orbital elements for the date being shown (JPL "approximate
 * positions of the major planets", valid 1800-2050), then the distances are compressed so Mercury and Neptune fit one view.
 * An outer ring marks the twelve sidereal rashis, and a ray from Earth through the Sun shows where the Sun is today.
 * Tapping a planet shows the rashi it sits in, seen from Earth, as in Jyotish.
 */
(function () {
  "use strict";

  var root = document.getElementById("orrery");
  if (!root) return;
  var canvas = root.querySelector(".orrery__canvas");
  var labelsEl = root.querySelector(".orrery__labels");
  var infoEl = root.querySelector(".orrery__info");
  var dateEl = root.querySelector(".orrery__date");
  var speedBtns = root.querySelectorAll("[data-speed]");
  var resetBtn = root.querySelector("[data-orrery-reset]");

  var D2R = Math.PI / 180;
  var RING_R = 262;
  var RASHI = [
    ["Mesha", "Aries", "♈"], ["Vrishabha", "Taurus", "♉"], ["Mithuna", "Gemini", "♊"], ["Karka", "Cancer", "♋"],
    ["Simha", "Leo", "♌"], ["Kanya", "Virgo", "♍"], ["Tula", "Libra", "♎"], ["Vrishchika", "Scorpio", "♏"],
    ["Dhanu", "Sagittarius", "♐"], ["Makara", "Capricorn", "♑"], ["Kumbha", "Aquarius", "♒"], ["Meena", "Pisces", "♓"]
  ];

  // [a, a', e, e', I, I', L, L', varpi, varpi', Omega, Omega'] (AU, degrees, per Julian century)
  var PLANETS = [
    { id: "mercury", name: "Mercury", hi: "बुध", kind: 1, r: 3.3, size: 4.8, color: "#b8aa9c", spin: 0.35, period: 87.97, tilt: 0.03,
      el: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.2503235, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081] },
    { id: "venus", name: "Venus", hi: "शुक्र", kind: 2, r: 5.3, size: 5.4, color: "#ecd29b", spin: -0.25, period: 224.7, tilt: 3.1,
      el: [0.72333566, 0.0000039, 0.00677672, -0.00004107, 3.39467605, -0.0007889, 181.9790995, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418] },
    { id: "earth", name: "Earth", hi: "पृथ्वी", kind: 3, r: 5.7, size: 5.6, color: "#5fa2ff", spin: 0.9, period: 365.26, tilt: 0.41,
      el: [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0] },
    { id: "mars", name: "Mars", hi: "मंगल", kind: 4, r: 4.3, size: 5, color: "#d4673f", spin: 0.85, period: 686.98, tilt: 0.44,
      el: [1.52371034, 0.00001847, 0.0933941, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343] },
    { id: "jupiter", name: "Jupiter", hi: "बृहस्पति", kind: 5, r: 12.5, size: 6.5, color: "#d9a470", spin: 1.6, period: 4332.59, tilt: 0.05,
      el: [5.202887, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106] },
    { id: "saturn", name: "Saturn", hi: "शनि", kind: 6, r: 10.6, size: 6.5, color: "#e5cf94", spin: 1.4, period: 10759.22, tilt: 0.47, rings: true,
      el: [9.53667594, -0.0012506, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794] },
    { id: "uranus", name: "Uranus", hi: "अरण", kind: 7, r: 7.6, size: 5.2, color: "#8fe3ea", spin: -0.8, period: 30688.5, tilt: 1.7,
      el: [19.18916464, -0.00196176, 0.04725744, -0.00004397, 0.77263783, -0.00242939, 313.23810451, 428.48202785, 170.9542763, 0.40805281, 74.01692503, 0.04240589] },
    { id: "neptune", name: "Neptune", hi: "वरुण", kind: 8, r: 7.3, size: 5.2, color: "#5b84ff", spin: 0.8, period: 60182, tilt: 0.5,
      el: [30.06992276, 0.00026291, 0.00859048, 0.00005105, 1.77004347, 0.00035372, -55.12002969, 218.45945325, 44.96476227, -0.32241464, 131.78422574, -0.00508664] }
  ];
  var SUN = { id: "sun", name: "Sun", hi: "सूर्य", kind: 0, r: 17, color: "#ffc25e" };
  var MOON = { id: "moon", name: "Moon", hi: "चंद्र", kind: 9, r: 1.7, color: "#cfd4dc" };

  var SCALE = 61.4, Z_EXAGGERATE = 3.4;   // compressed distance R = SCALE * r^0.35: Mercury 44 ... Neptune 215 units
  var SPEEDS = { live: 1, day: 86400, week: 604800, month: 2629800, year: 31557600 };

  // ----------------------------------------------------------------------------------------------------------------- astronomy
  function julian(ms) { return ms / 86400000 + 2440587.5; }
  function norm360(v) { return ((v % 360) + 360) % 360; }

  function helio(p, T) {
    var e = p.el;
    var a = e[0] + e[1] * T, ec = e[2] + e[3] * T, I = (e[4] + e[5] * T) * D2R;
    var L = e[6] + e[7] * T, w = e[8] + e[9] * T, O = (e[10] + e[11] * T) * D2R;
    var M = norm360(L - w) * D2R, om = (w * D2R) - O;
    var E = M + ec * Math.sin(M);
    for (var i = 0; i < 6; i++) E = M + ec * Math.sin(E);
    var xp = a * (Math.cos(E) - ec), yp = a * Math.sqrt(1 - ec * ec) * Math.sin(E);
    var co = Math.cos(om), so = Math.sin(om), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
    return [
      (co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
      (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
      (so * sI) * xp + (co * sI) * yp
    ];
  }

  // ecliptic (x, y, z) in AU -> scene units. Distances are compressed (R = SCALE * r^0.35) and the height above the ecliptic is
  // exaggerated a little so the orbital tilts can be seen.
  function toScene(v) {
    var r = Math.hypot(v[0], v[1], v[2]) || 1e-9, k = (SCALE * Math.pow(r, 0.35)) / r;
    return [v[0] * k, v[2] * k * Z_EXAGGERATE, -v[1] * k];
  }

  function ayanamsa(jd) { return 23.853 + ((jd - 2451545) / 365.25) * 0.013972; }

  function moonLongitude(jd) {
    var d = jd - 2451545;
    var L = 218.3164477 + 13.17639648 * d, Mm = (134.9633964 + 13.06499295 * d) * D2R, Ms = (357.5291092 + 0.98560028 * d) * D2R;
    var D = (297.8501921 + 12.19074912 * d) * D2R;
    return norm360(L + 6.289 * Math.sin(Mm) - 1.274 * Math.sin(Mm - 2 * D) + 0.658 * Math.sin(2 * D) - 0.186 * Math.sin(Ms));
  }

  // ----------------------------------------------------------------------------------------------------------------- state
  var state = {
    simMs: Date.now(), speed: SPEEDS.day, speedKey: "day", yaw: 0.55, pitch: 0.62, dist: 640, targetDist: 640, vYaw: 0, vPitch: 0,
    dragging: false, touches: new Map(), pinch: 0, idleAt: 0, selected: "earth", hover: null, visible: false, w: 1, h: 1, dpr: 1
  };
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  var bodies = [];            // computed each frame: { def, pos (scene), lon (geocentric sidereal), helioAU, earthAU }

  function compute() {
    var jd = julian(state.simMs), T = (jd - 2451545) / 36525;
    var earthV = helio(PLANETS[2], T);
    var ay = ayanamsa(jd);
    bodies.length = 0;
    bodies.push({ def: SUN, pos: [0, 0, 0], sid: norm360(Math.atan2(-earthV[1], -earthV[0]) / D2R - ay), au: 0, earthAU: Math.hypot(earthV[0], earthV[1], earthV[2]), tropical: norm360(Math.atan2(-earthV[1], -earthV[0]) / D2R) });
    var earthScene = null;
    PLANETS.forEach(function (p) {
      var v = helio(p, T), s = toScene(v);
      var g = [v[0] - earthV[0], v[1] - earthV[1], v[2] - earthV[2]];
      var trop = norm360(Math.atan2(g[1], g[0]) / D2R);
      var b = { def: p, pos: s, sid: p.id === "earth" ? NaN : norm360(trop - ay), au: Math.hypot(v[0], v[1], v[2]), earthAU: p.id === "earth" ? 0 : Math.hypot(g[0], g[1], g[2]), tropical: trop };
      if (p.id === "earth") earthScene = s;
      bodies.push(b);
    });
    var ml = moonLongitude(jd), mr = ml * D2R;
    var mdist = 13;
    bodies.push({
      def: MOON, pos: [earthScene[0] + Math.cos(mr) * mdist, earthScene[1] + Math.sin(mr - 1.3) * 0.9, earthScene[2] - Math.sin(mr) * mdist],
      sid: norm360(ml - ay), au: 0.00257, earthAU: 0.00257, tropical: ml
    });
    return { jd: jd, ayan: ay, earth: earthScene };
  }

  // ----------------------------------------------------------------------------------------------------------------- GL
  var gl = canvas && canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });

  var NOISE = [
    "float hash31(vec3 p){p=fract(p*0.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}",
    "float vnoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);",
    " return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),",
    "            mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);}",
    "float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vnoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}"
  ].join("\n");

  var SPHERE_VS = "#version 300 es\nprecision highp float;\nin vec3 aPos;\nuniform mat4 uVP;\nuniform vec3 uCenter;\nuniform float uRadius;\nuniform mat3 uBody;\n" +
    "out vec3 vN;out vec3 vObj;out vec3 vWorld;\nvoid main(){vec3 w=uCenter+aPos*uRadius;vN=aPos;vObj=uBody*aPos;vWorld=w;gl_Position=uVP*vec4(w,1.);}";

  var SPHERE_FS = "#version 300 es\nprecision highp float;\n" + NOISE + "\n" +
    "in vec3 vN;in vec3 vObj;in vec3 vWorld;\nuniform int uKind;uniform float uTime;uniform vec3 uLight;uniform vec3 uCam;uniform float uSeed;uniform float uSelect;\nout vec4 o;\n" +
    "float wrap(float a,float b){float d=a-b;return d-6.2831853*floor((d+3.1415926)/6.2831853);}\n" +
    "void main(){\n" +
    " vec3 N=normalize(vN);vec3 V=normalize(uCam-vWorld);vec3 p=normalize(vObj);float ndl=dot(N,uLight);float ndv=max(dot(N,V),0.);\n" +
    " if(uKind==0){float t=uTime*.035;float g=fbm(p*3.6+vec3(0.,t,0.));float g2=fbm(p*10.-vec3(t*1.7,0.,t));float h=g*.65+g2*.35;\n" +
    "  vec3 col=mix(vec3(.72,.16,.02),vec3(1.,.5,.1),smoothstep(.28,.6,h));col=mix(col,vec3(1.,.92,.62),smoothstep(.56,.86,h));\n" +
    "  float spots=smoothstep(.62,.72,fbm(p*2.4+7.+vec3(t*.4)));col*=1.-.55*spots;col*=.5+.8*pow(ndv,.5);o=vec4(col*1.35,1.);return;}\n" +
    " vec3 col=vec3(.6);vec3 atm=vec3(0.);float atmK=0.;float spec=0.;vec3 glow=vec3(0.);\n" +
    " float lat=abs(p.y);\n" +
    " if(uKind==1){float h=fbm(p*5.+uSeed);float c=1.-smoothstep(0.,.1,abs(fbm(p*9.5+3.)-.5));col=vec3(.56,.52,.48)*(.55+.7*h);col*=1.-.35*c;col=mix(col,vec3(.4,.37,.34),smoothstep(.55,.75,fbm(p*3.)));}\n" +
    " else if(uKind==2){vec3 q=vec3(fbm(p*2.+uTime*.012),fbm(p*2.+4.-uTime*.01),fbm(p*2.+8.));float h=fbm(p*3.2+q*1.8+vec3(uTime*.008,0.,0.));\n" +
    "  col=mix(vec3(.82,.62,.34),vec3(.97,.9,.7),smoothstep(.3,.75,h));atm=vec3(1.,.85,.55);atmK=.9;}\n" +
    " else if(uKind==3){float h=fbm(p*2.3+uSeed);float land=smoothstep(.5,.53,h);\n" +
    "  vec3 ocean=mix(vec3(.01,.07,.25),vec3(.05,.3,.58),smoothstep(.34,.5,h));\n" +
    "  float dry=smoothstep(.3,.72,fbm(p*3.1+7.));vec3 ground=mix(vec3(.1,.3,.1),vec3(.62,.5,.28),dry*(1.-smoothstep(0.,.62,lat)*.5));\n" +
    "  ground=mix(ground,vec3(.38,.33,.28),smoothstep(.6,.8,h));col=mix(ocean,ground,land);\n" +
    "  float ice=smoothstep(.8,.9,lat+.07*fbm(p*8.));col=mix(col,vec3(.93,.96,1.),ice);\n" +
    "  float cl=smoothstep(.5,.8,fbm(p*3.4+vec3(uTime*.012,0.,uTime*.007)+3.));col=mix(col,vec3(1.),cl*.88);\n" +
    "  spec=(1.-land)*(1.-cl)*pow(max(dot(N,normalize(uLight+V)),0.),70.)*1.3;\n" +
    "  glow=vec3(1.,.72,.3)*land*smoothstep(.62,.72,fbm(p*15.))*(1.-cl)*smoothstep(.12,-.3,ndl)*.8;atm=vec3(.32,.58,1.);atmK=1.;}\n" +
    " else if(uKind==4){float h=fbm(p*3.+uSeed);col=mix(vec3(.74,.34,.17),vec3(.34,.18,.12),smoothstep(.45,.7,h));col*=.8+.4*fbm(p*12.);\n" +
    "  col=mix(col,vec3(.95,.93,.92),smoothstep(.86,.93,lat));atm=vec3(.9,.5,.35);atmK=.3;}\n" +
    " else if(uKind==5){float w=fbm(vec3(p.x*2.,p.y*5.,p.z*2.)+uTime*.01)*.5;float band=sin((p.y+w*.3)*24.+fbm(p*3.)*3.)*.5+.5;\n" +
    "  col=mix(vec3(.5,.3,.2),vec3(.84,.63,.43),band);col=mix(col,vec3(.95,.86,.72),smoothstep(.55,.9,fbm(vec3(p.x*3.,p.y*16.,p.z*3.)+1.)));\n" +
    "  float ph=atan(p.z,p.x);vec2 d=vec2(wrap(ph,.9)*.62,(p.y+.27)*2.6);float grs=smoothstep(.34,.12,length(d));col=mix(col,vec3(.74,.27,.16),grs*.9);atm=vec3(.9,.72,.5);atmK=.35;}\n" +
    " else if(uKind==6){float band=sin((p.y+fbm(p*2.)*.15)*30.)*.5+.5;col=mix(vec3(.72,.6,.4),vec3(.93,.84,.62),band);col*=.85+.3*fbm(vec3(p.x*2.,p.y*20.,p.z*2.));atm=vec3(.95,.85,.6);atmK=.25;}\n" +
    " else if(uKind==7){float band=sin(p.y*14.+fbm(p*2.)*2.)*.5+.5;col=mix(vec3(.5,.82,.86),vec3(.66,.92,.94),band);atm=vec3(.6,.95,1.);atmK=.7;}\n" +
    " else if(uKind==8){float band=sin(p.y*20.+fbm(p*2.5)*3.)*.5+.5;col=mix(vec3(.12,.24,.72),vec3(.28,.46,.95),band);\n" +
    "  float ph=atan(p.z,p.x);vec2 d=vec2(wrap(ph,2.2)*.8,(p.y+.3)*2.6);col=mix(col,vec3(.05,.1,.4),smoothstep(.3,.1,length(d))*.8);atm=vec3(.45,.65,1.);atmK=.6;}\n" +
    " else {float m=fbm(p*3.+uSeed);col=mix(vec3(.62,.62,.64),vec3(.3,.3,.33),smoothstep(.45,.62,m));col*=.75+.45*fbm(p*14.);col*=1.-.3*(1.-smoothstep(0.,.1,abs(fbm(p*8.)-.5)));}\n" +
    " float lit=smoothstep(-.1,.55,ndl);vec3 c=col*(lit*1.2+.02)+spec*lit+glow;\n" +
    " float fres=pow(1.-ndv,3.);c+=atm*atmK*fres*(.12+max(ndl+.15,0.)*1.1);\n" +
    " c+=vec3(.55,.8,1.)*uSelect*pow(1.-ndv,2.)*.9;\n" +
    " c=1.-exp(-c*1.5);o=vec4(pow(c,vec3(.92)),1.);}";

  var RING_VS = "#version 300 es\nprecision highp float;\nin vec3 aPos;\nuniform mat4 uVP;\nuniform vec3 uCenter;\nuniform float uRadius;\nuniform mat3 uTilt;\n" +
    "out vec3 vLocal;out vec3 vWorld;\nvoid main(){vLocal=aPos;vec3 w=uCenter+uTilt*aPos*uRadius;vWorld=w;gl_Position=uVP*vec4(w,1.);}";
  var RING_FS = "#version 300 es\nprecision highp float;\n" + NOISE + "\nin vec3 vLocal;in vec3 vWorld;\nuniform vec3 uLight;uniform mat3 uTilt;uniform float uRadius;uniform vec3 uCenter;\nout vec4 o;\n" +
    "void main(){float rr=length(vLocal);float t=(rr-.5)/.5;if(t<0.||t>1.)discard;\n" +
    " float bands=.5+.5*sin(t*80.+sin(t*21.)*2.)+.35*(vnoise(vec3(t*60.,1.,2.))-.5);\n" +
    " float a=smoothstep(0.,.05,t)*smoothstep(1.,.93,t);a*=mix(.55,1.,bands);a*=1.-.92*smoothstep(.04,.0,abs(t-.56)-.015);a*=1.-.5*smoothstep(.0,.2,.2-t);\n" +
    " vec3 col=mix(vec3(.58,.5,.38),vec3(.93,.85,.68),bands);\n" +
    " vec3 P=uTilt*vLocal*uRadius;float along=dot(P,uLight);vec3 perp=P-along*uLight;float shadow=(along<0.&&length(perp)<uRadius*.5)?1.:0.;\n" +
    " col*=1.-.78*shadow;a*=1.-.1*shadow;o=vec4(col*a,a);}";

  var GLOW_VS = "#version 300 es\nprecision highp float;\nin vec2 aQ;\nuniform mat4 uVP;uniform vec3 uCenter;uniform vec3 uRight;uniform vec3 uUp;uniform float uSize;\nout vec2 vQ;\n" +
    "void main(){vQ=aQ;vec3 w=uCenter+(uRight*aQ.x+uUp*aQ.y)*uSize;gl_Position=uVP*vec4(w,1.);}";
  var GLOW_FS = "#version 300 es\nprecision highp float;\n" + NOISE + "\nin vec2 vQ;uniform float uTime;\nout vec4 o;\n" +
    "void main(){float r=length(vQ);if(r>1.)discard;float ang=atan(vQ.y,vQ.x);\n" +
    " float rays=.6+.4*vnoise(vec3(cos(ang)*3.,sin(ang)*3.,uTime*.15))+.25*vnoise(vec3(cos(ang*2.)*7.,sin(ang*2.)*7.,uTime*.3));\n" +
    " float core=exp(-r*5.5)*1.5;float halo=exp(-r*2.4)*.55*rays;float rim=smoothstep(.0,.35,1.-r);\n" +
    " vec3 c=vec3(1.,.62,.22)*halo+vec3(1.,.88,.55)*core;c*=rim;o=vec4(c,max(c.r,max(c.g,c.b))*.0);}";

  var LINE_VS = "#version 300 es\nprecision highp float;\nin vec3 aP;in float aT;\nuniform mat4 uVP;uniform vec3 uOffset;\nout float vT;\nvoid main(){vT=aT;gl_Position=uVP*vec4(aP+uOffset,1.);}";
  var LINE_FS = "#version 300 es\nprecision highp float;\nin float vT;uniform vec3 uColor;uniform float uHead;uniform float uBase;uniform float uBoost;\nout vec4 o;\n" +
    "void main(){float a=uBase;if(uHead>=0.){float d=uHead-vT;d=d-floor(d);float trail=exp(-d*5.5);a=uBase*.45+trail*(.7+uBoost);}o=vec4(uColor*a,a);}";

  var STAR_VS = "#version 300 es\nprecision highp float;\nin vec3 aPos;in float aMag;\nuniform mat4 uRot;uniform float uTime;uniform float uDpr;uniform float uAspect;\nout float vB;\n" +
    "void main(){vec4 p=uRot*vec4(aPos,1.);gl_Position=vec4(p.xy,0.,p.w);vB=.45+.55*aMag*(.7+.3*sin(uTime*(.8+aMag*2.)+aPos.x*40.));gl_PointSize=(.8+aMag*2.1)*uDpr;}";
  var STAR_FS = "#version 300 es\nprecision highp float;\nin float vB;out vec4 o;\nvoid main(){vec2 d=gl_PointCoord-.5;float a=smoothstep(.5,.0,length(d))*vB;o=vec4(vec3(.85,.9,1.)*a,a);}";

  var progs = {};
  var buf = {};

  // Shaders compile in the background (KHR_parallel_shader_compile where the browser has it); finishPrograms() collects the
  // results once they are ready, so the heavy planet shaders never freeze the page while they build.
  var parallel = gl && gl.getExtension("KHR_parallel_shader_compile");
  var pending = [];
  function mkProgram(vs, fs, attrs) {
    var a = gl.createShader(gl.VERTEX_SHADER), b = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(a, vs); gl.compileShader(a);
    gl.shaderSource(b, fs); gl.compileShader(b);
    var p = gl.createProgram();
    gl.attachShader(p, a); gl.attachShader(p, b);
    attrs.forEach(function (n, i) { gl.bindAttribLocation(p, i, n); });
    gl.linkProgram(p);
    var prog = { p: p, u: {}, a: a, b: b };
    pending.push(prog);
    return prog;
  }
  // true when every program is built, false if one failed, null while still compiling
  function finishPrograms() {
    for (var i = 0; i < pending.length; i++) {
      var pr = pending[i];
      if (pr.done) continue;
      if (parallel && !gl.getProgramParameter(pr.p, parallel.COMPLETION_STATUS_KHR)) return null;
      if (!gl.getProgramParameter(pr.p, gl.LINK_STATUS)) { console.error(gl.getShaderInfoLog(pr.b) || gl.getProgramInfoLog(pr.p)); return false; }
      var n = gl.getProgramParameter(pr.p, gl.ACTIVE_UNIFORMS);
      for (var k = 0; k < n; k++) { var info = gl.getActiveUniform(pr.p, k); pr.u[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(pr.p, info.name); }
      pr.done = true;
    }
    return true;
  }

  function sphereMesh(lon, lat) {
    var pos = [], idx = [];
    for (var y = 0; y <= lat; y++) {
      var v = y / lat, th = v * Math.PI;
      for (var x = 0; x <= lon; x++) {
        var u = x / lon, ph = u * Math.PI * 2;
        pos.push(Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th));
      }
    }
    for (var j = 0; j < lat; j++) for (var i = 0; i < lon; i++) {
      var a = j * (lon + 1) + i, b = a + lon + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    return { pos: new Float32Array(pos), idx: new Uint16Array(idx) };
  }

  function ringMesh(seg) {
    var pos = [], idx = [];
    for (var i = 0; i <= seg; i++) {
      var a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(c * 0.5, 0, s * 0.5, c, 0, s);
    }
    for (var k = 0; k < seg; k++) { var o = k * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    return { pos: new Float32Array(pos), idx: new Uint16Array(idx) };
  }

  var meshes = {};
  var orbitLines = [];    // per planet: { vbo, count }
  var ringLine = null, tickLine = null, sunRay = null;

  function glInit() {
    progs.sphere = mkProgram(SPHERE_VS, SPHERE_FS, ["aPos"]);
    progs.ring = mkProgram(RING_VS, RING_FS, ["aPos"]);
    progs.glow = mkProgram(GLOW_VS, GLOW_FS, ["aQ"]);
    progs.line = mkProgram(LINE_VS, LINE_FS, ["aP", "aT"]);
    progs.star = mkProgram(STAR_VS, STAR_FS, ["aPos", "aMag"]);

    var sm = sphereMesh(coarse ? 40 : 56, coarse ? 26 : 36);
    meshes.sphere = { vao: gl.createVertexArray(), n: sm.idx.length };
    gl.bindVertexArray(meshes.sphere.vao);
    var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, sm.pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sm.idx, gl.STATIC_DRAW);

    var rm = ringMesh(96);
    meshes.ring = { vao: gl.createVertexArray(), n: rm.idx.length };
    gl.bindVertexArray(meshes.ring.vao);
    var rb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, rb); gl.bufferData(gl.ARRAY_BUFFER, rm.pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    var rib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, rib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, rm.idx, gl.STATIC_DRAW);

    meshes.quad = { vao: gl.createVertexArray() };
    gl.bindVertexArray(meshes.quad.vao);
    var qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // stars: a sphere of points around everything
    var count = coarse ? 700 : 1400, sp = new Float32Array(count * 4), seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < count; i++) {
      var z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
      sp[i * 4] = r * Math.cos(a); sp[i * 4 + 1] = z; sp[i * 4 + 2] = r * Math.sin(a); sp[i * 4 + 3] = Math.pow(rnd(), 3.2);
    }
    meshes.stars = { vao: gl.createVertexArray(), n: count };
    gl.bindVertexArray(meshes.stars.vao);
    var sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.bufferData(gl.ARRAY_BUFFER, sp, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);

    function lineBuffer(points) {      // points: array of [x,y,z,t]
      var data = new Float32Array(points.length * 4);
      points.forEach(function (p, i) { data.set(p, i * 4); });
      var vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
      return { vao: vao, vbo: b, n: points.length };
    }

    // the zodiac ring and its twelve boundary ticks (the ring's own start follows the ayanamsa, set every frame as an offset)
    var ringPts = [];
    for (var s = 0; s <= 240; s++) { var an = (s / 240) * Math.PI * 2; ringPts.push([Math.cos(an) * RING_R, 0, -Math.sin(an) * RING_R, 0]); }
    ringLine = lineBuffer(ringPts);
    var tickPts = [];
    for (var t = 0; t < 12; t++) { var ta = (t / 12) * Math.PI * 2, c = Math.cos(ta), sn = -Math.sin(ta); tickPts.push([c * (RING_R - 9), 0, sn * (RING_R - 9), 0], [c * (RING_R + 9), 0, sn * (RING_R + 9), 0]); }
    tickLine = lineBuffer(tickPts);
    sunRay = lineBuffer([[0, 0, 0, 0], [0, 0, 0, 0]]);
    meshes.makeLine = lineBuffer;
    return true;
  }

  // orbit curves: the planet's real orbit for the date, compressed the same way as the planets, so the planet sits on its curve
  function buildOrbits(T) {
    orbitLines.forEach(function (o) { gl.deleteBuffer(o.vbo); gl.deleteVertexArray(o.vao); });
    orbitLines.length = 0;
    PLANETS.forEach(function (p) {
      var e = p.el, a = e[0] + e[1] * T, ec = e[2] + e[3] * T, I = (e[4] + e[5] * T) * D2R, w = e[8] + e[9] * T, O = (e[10] + e[11] * T) * D2R;
      var om = w * D2R - O, pts = [], steps = 220;
      for (var i = 0; i <= steps; i++) {
        var E = (i / steps) * Math.PI * 2;
        var xp = a * (Math.cos(E) - ec), yp = a * Math.sqrt(1 - ec * ec) * Math.sin(E);
        var co = Math.cos(om), so = Math.sin(om), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
        var v = [(co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp, (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp, (so * sI) * xp + (co * sI) * yp];
        var s = toScene(v);
        // t is the eccentric anomaly's share of the circle, so the trail can run behind the planet
        pts.push([s[0], s[1], s[2], i / steps]);
      }
      orbitLines.push(meshes.makeLine(pts));
    });
  }

  // ----------------------------------------------------------------------------------------------------------------- matrices
  function perspective(fov, aspect, near, far) {
    var f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  function lookAt(eye, target) {
    var zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2], zl = Math.hypot(zx, zy, zz); zx /= zl; zy /= zl; zz /= zl;
    var xx = zz, xy = 0, xz = -zx, xl = Math.hypot(xx, xz); xx /= xl; xz /= xl;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * eye[0] + xy * eye[1] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1]);
  }
  function mul(a, b) {
    var o = new Float32Array(16);
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) o[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
    return o;
  }
  function rotAxis(ax, ay, az, ang) {      // 3x3, column-major
    var c = Math.cos(ang), s = Math.sin(ang), t = 1 - c, l = Math.hypot(ax, ay, az); ax /= l; ay /= l; az /= l;
    return new Float32Array([t * ax * ax + c, t * ax * ay + s * az, t * ax * az - s * ay, t * ax * ay - s * az, t * ay * ay + c, t * ay * az + s * ax, t * ax * az + s * ay, t * ay * az - s * ax, t * az * az + c]);
  }
  function mul3(a, b) {
    var o = new Float32Array(9);
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) o[j * 3 + i] = a[i] * b[j * 3] + a[3 + i] * b[j * 3 + 1] + a[6 + i] * b[j * 3 + 2];
    return o;
  }

  // ----------------------------------------------------------------------------------------------------------------- DOM labels + info
  var chips = {};
  function hexToRgb(hex) { var n = parseInt(hex.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }

  function buildChips() {
    labelsEl.innerHTML = "";
    var all = [SUN].concat(PLANETS, [MOON]);
    all.forEach(function (d) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "orrery__chip";
      b.setAttribute("data-id", d.id);
      b.style.setProperty("--c", d.color);
      b.innerHTML = '<i aria-hidden="true"></i><span>' + d.name + "</span>";
      b.addEventListener("click", function (e) { e.stopPropagation(); select(d.id); });
      labelsEl.appendChild(b);
      chips[d.id] = b;
    });
    RASHI.forEach(function (r, i) {
      var s = document.createElement("span");
      s.className = "orrery__sign";
      s.textContent = r[2] + "\uFE0E";
      s.title = r[0] + " (" + r[1] + ")";
      s.setAttribute("data-sign", i);
      labelsEl.appendChild(s);
      chips["sign" + i] = s;
    });
  }

  var lastInfoAt = 0, sunSign = 0;
  function rashiOf(sid) { return RASHI[Math.floor(sid / 30) % 12]; }
  function fmtDeg(sid) { var d = sid % 30; return Math.floor(d) + "°" + String(Math.round((d % 1) * 60)).padStart(2, "0") + "′"; }

  function select(id) {
    state.selected = id;
    Object.keys(chips).forEach(function (k) { if (chips[k].classList) chips[k].classList.toggle("is-selected", k === id); });
    lastInfoAt = 0;
    updateInfo(true);
    wake();
  }

  function updateInfo(force) {
    var now = performance.now();
    if (!force && now - lastInfoAt < 250) return;
    lastInfoAt = now;
    var b = bodies.filter(function (x) { return x.def.id === state.selected; })[0] || bodies[3];
    if (!b) return;
    var d = b.def, parts = [];
    var rash = isNaN(b.sid) ? null : rashiOf(b.sid);
    var title = d.name + ' <small lang="hi">' + d.hi + "</small>";
    if (d.id === "earth") {
      parts.push("Our home, " + b.au.toFixed(3) + " AU from the Sun");
      parts.push("Moon: " + rashiOf(bodies[bodies.length - 1].sid)[0]);
    } else if (d.id === "sun") {
      parts.push("Seen from Earth the Sun is in <b>" + rash[0] + "</b> (" + rash[1] + ") at " + fmtDeg(b.sid));
      parts.push("Sun&ndash;Earth " + b.earthAU.toFixed(3) + " AU");
    } else if (d.id === "moon") {
      parts.push("In <b>" + rash[0] + "</b> (" + rash[1] + ") at " + fmtDeg(b.sid));
      parts.push("Orbits Earth in 27.3 days");
    } else {
      parts.push("In <b>" + rash[0] + "</b> (" + rash[1] + ") at " + fmtDeg(b.sid));
      parts.push(b.au.toFixed(2) + " AU from the Sun · " + b.earthAU.toFixed(2) + " AU from Earth");
      parts.push("One orbit: " + (d.period < 700 ? Math.round(d.period) + " days" : (d.period / 365.25).toFixed(1) + " years"));
    }
    infoEl.innerHTML = '<div class="orrery__info-title"><i style="background:' + d.color + '"></i>' + title + "</div><p>" + parts.join("<br>") + "</p>";
  }

  var dateFmt = null;
  function updateDate() {
    if (!dateFmt) { try { dateFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch (e) { dateFmt = { format: function (d) { return d.toDateString(); } }; } }
    var live = state.speedKey === "live";
    dateEl.innerHTML = (live ? '<b class="orrery__live">Live</b> ' : "") + dateFmt.format(new Date(state.simMs));
  }

  // ----------------------------------------------------------------------------------------------------------------- render
  var vp = null, camPos = [0, 0, 1], spinPhase = {};
  var lastOrbitDay = -1e9;
  var raf = 0, last = 0, t0 = performance.now();

  function resize() {
    var w = Math.max(1, root.clientWidth), h = Math.max(1, root.clientHeight);
    state.dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
    state.w = w; state.h = h;
    if (gl) {
      canvas.width = Math.round(w * state.dpr);
      canvas.height = Math.round(h * state.dpr);
    }
    // fit the zodiac ring on the narrower side
    var aspect = w / h, fov = 38 * D2R;
    var fit = (RING_R * 1.1) / (Math.tan(fov / 2) * Math.min(1, aspect));
    state.fit = fit;
    if (!state.userZoom) state.targetDist = fit;
    wake();
  }

  function project(x, y, z) {
    var m = vp, w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 0) return null;
    return [((m[0] * x + m[4] * y + m[8] * z + m[12]) / w * 0.5 + 0.5) * state.w, (0.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w * 0.5) * state.h, w];
  }

  function frame(now) {
    raf = 0;
    if (!state.visible || document.hidden) { last = 0; return; }
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    var time = (now - t0) / 1000;

    if (!reduce) state.simMs += dt * 1000 * state.speed;
    // camera: free orbit with inertia, slow drift when nobody is touching it
    if (!state.dragging) {
      state.yaw += state.vYaw * dt; state.pitch += state.vPitch * dt;
      var damp = Math.exp(-dt * 3.2); state.vYaw *= damp; state.vPitch *= damp;
      if (!reduce && now - state.idleAt > 2500) state.yaw += dt * 0.045;
    }
    state.pitch = Math.max(0.08, Math.min(1.45, state.pitch));
    state.dist += (state.targetDist - state.dist) * (1 - Math.exp(-dt * 6));

    var info = compute();
    var jd = info.jd, T = (jd - 2451545) / 36525;
    if (Math.abs(jd - lastOrbitDay) > 3000) { buildOrbits(T); lastOrbitDay = jd; }   // orbits drift only slowly, rebuild rarely

    var cp = Math.cos(state.pitch), eye = [Math.sin(state.yaw) * cp * state.dist, Math.sin(state.pitch) * state.dist, Math.cos(state.yaw) * cp * state.dist];
    camPos = eye;
    var aspect = state.w / state.h;
    var proj = perspective(38 * D2R, aspect, 8, 3000), view = lookAt(eye, [0, 0, 0]);
    vp = mul(proj, view);
    var rotOnly = view.slice(); rotOnly[12] = rotOnly[13] = rotOnly[14] = 0;
    var starM = mul(perspective(38 * D2R, aspect, 0.1, 10), rotOnly);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);     // additive light for stars, orbits and glow

    // stars
    var sp = progs.star;
    gl.useProgram(sp.p); gl.uniformMatrix4fv(sp.u.uRot, false, starM); gl.uniform1f(sp.u.uTime, time); gl.uniform1f(sp.u.uDpr, state.dpr);
    gl.bindVertexArray(meshes.stars.vao); gl.drawArrays(gl.POINTS, 0, meshes.stars.n);

    // orbit curves with a bright trail behind each planet, zodiac ring, Sun ray
    var lp = progs.line;
    gl.useProgram(lp.p); gl.uniformMatrix4fv(lp.u.uVP, false, vp); gl.uniform3f(lp.u.uOffset, 0, 0, 0);
    PLANETS.forEach(function (p, i) {
      var ol = orbitLines[i]; if (!ol) return;
      var c = hexToRgb(p.color), b = bodies[i + 1];
      // where the planet is along its own curve: the nearest point of the drawn orbit
      var head = nearestT(ol, b.pos, i);
      gl.uniform3f(lp.u.uColor, c[0], c[1], c[2]); gl.uniform1f(lp.u.uHead, head); gl.uniform1f(lp.u.uBase, state.selected === p.id ? 0.4 : 0.2); gl.uniform1f(lp.u.uBoost, state.selected === p.id ? 0.5 : 0);
      gl.bindVertexArray(ol.vao); gl.drawArrays(gl.LINE_STRIP, 0, ol.n);
    });
    // the zodiac ring starts at the sidereal Aries point; rotate its drawing by the ayanamsa through the view of the vertices
    var ay = info.ayan * D2R, cs = Math.cos(ay), sn = Math.sin(ay);
    var zodiacVP = mul(vp, new Float32Array([cs, 0, -sn, 0, 0, 1, 0, 0, sn, 0, cs, 0, 0, 0, 0, 1]));
    gl.uniformMatrix4fv(lp.u.uVP, false, zodiacVP);
    gl.uniform3f(lp.u.uColor, 0.45, 0.62, 1.0); gl.uniform1f(lp.u.uHead, -1); gl.uniform1f(lp.u.uBase, 0.32);
    gl.bindVertexArray(ringLine.vao); gl.drawArrays(gl.LINE_STRIP, 0, ringLine.n);
    gl.uniform1f(lp.u.uBase, 0.55);
    gl.bindVertexArray(tickLine.vao); gl.drawArrays(gl.LINES, 0, tickLine.n);
    // ray from Earth, through the Sun, out to the ring: the Sun's place in the zodiac as seen from Earth
    var earth = info.earth, ex = earth[0], ez = earth[2];
    var sunB = bodies[0], lon = sunB.tropical * D2R;
    var rx = Math.cos(lon) * RING_R, rz = -Math.sin(lon) * RING_R;
    gl.bindBuffer(gl.ARRAY_BUFFER, sunRay.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array([ex, earth[1], ez, 0, rx, 0, rz, 1]));
    gl.uniformMatrix4fv(lp.u.uVP, false, vp); gl.uniform3f(lp.u.uColor, 1.0, 0.78, 0.35); gl.uniform1f(lp.u.uBase, 0.5);
    gl.bindVertexArray(sunRay.vao); gl.drawArrays(gl.LINES, 0, 2);

    // opaque bodies
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    var sph = progs.sphere;
    gl.useProgram(sph.p); gl.uniformMatrix4fv(sph.u.uVP, false, vp); gl.uniform3f(sph.u.uCam, eye[0], eye[1], eye[2]); gl.uniform1f(sph.u.uTime, time);
    gl.bindVertexArray(meshes.sphere.vao);
    var drawList = bodies;
    for (var i = 0; i < drawList.length; i++) {
      var b = drawList[i], d = b.def, pos = b.pos;
      var L = Math.hypot(pos[0], pos[1], pos[2]) || 1;
      var light = d.id === "sun" ? [0, 1, 0] : [-pos[0] / L, -pos[1] / L, -pos[2] / L];
      if (d.id === "moon") { var e = bodies[3].pos; var m2 = Math.hypot(e[0], e[1], e[2]) || 1; light = [-e[0] / m2, -e[1] / m2, -e[2] / m2]; }
      var tilt = d.tilt || 0, spinRate = d.spin || 0.05;
      spinPhase[d.id] = (spinPhase[d.id] || (d.id.length * 1.7)) + (reduce ? 0 : dt * spinRate * 0.55);
      var axis = rotAxis(0, 0, 1, tilt), spin = rotAxis(0, 1, 0, spinPhase[d.id]);
      gl.uniformMatrix3fv(sph.u.uBody, false, mul3(axis, spin));
      gl.uniform3f(sph.u.uCenter, pos[0], pos[1], pos[2]); gl.uniform1f(sph.u.uRadius, d.r);
      gl.uniform1i(sph.u.uKind, d.kind); gl.uniform3f(sph.u.uLight, light[0], light[1], light[2]);
      gl.uniform1f(sph.u.uSeed, d.id.charCodeAt(0) * 0.13); gl.uniform1f(sph.u.uSelect, state.selected === d.id ? 0.35 : 0);
      gl.drawElements(gl.TRIANGLES, meshes.sphere.n, gl.UNSIGNED_SHORT, 0);
    }
    // Saturn's rings
    var sat = bodies[6], sd = sat.def, sl = Math.hypot(sat.pos[0], sat.pos[1], sat.pos[2]) || 1;
    var rp = progs.ring;
    gl.useProgram(rp.p); gl.uniformMatrix4fv(rp.u.uVP, false, vp);
    gl.uniform3f(rp.u.uCenter, sat.pos[0], sat.pos[1], sat.pos[2]); gl.uniform1f(rp.u.uRadius, sd.r * 2.35);
    gl.uniformMatrix3fv(rp.u.uTilt, false, rotAxis(0, 0, 1, sd.tilt));
    gl.uniform3f(rp.u.uLight, -sat.pos[0] / sl, -sat.pos[1] / sl, -sat.pos[2] / sl);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(meshes.ring.vao); gl.drawElements(gl.TRIANGLES, meshes.ring.n, gl.UNSIGNED_SHORT, 0);

    // the Sun's glow, drawn last as light
    gl.depthMask(false);
    gl.blendFunc(gl.ONE, gl.ONE);
    var gp = progs.glow;
    var fx = -Math.sin(state.yaw), fz = Math.cos(state.yaw);   // camera right = (cos yaw, 0, -sin yaw)
    var right = [Math.cos(state.yaw), 0, -Math.sin(state.yaw)];
    var up = [-Math.sin(state.pitch) * Math.sin(state.yaw), Math.cos(state.pitch), -Math.sin(state.pitch) * Math.cos(state.yaw)];
    void fx; void fz;
    gl.useProgram(gp.p); gl.uniformMatrix4fv(gp.u.uVP, false, vp); gl.uniform3f(gp.u.uCenter, 0, 0, 0);
    gl.uniform3f(gp.u.uRight, right[0], right[1], right[2]); gl.uniform3f(gp.u.uUp, up[0], up[1], up[2]); gl.uniform1f(gp.u.uSize, SUN.r * 4.6); gl.uniform1f(gp.u.uTime, time);
    gl.bindVertexArray(meshes.quad.vao); gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.depthMask(true);

    // labels follow their bodies
    placeLabels(info);
    updateInfo(false);
    if (Math.floor(time * 4) !== state._dateTick) { state._dateTick = Math.floor(time * 4); updateDate(); }

    if (!reduce || state.dragging) raf = requestAnimationFrame(frame);
  }

  // nearest parameter of an orbit curve to a point (the curves are stored as 221 points; a coarse scan then refine is plenty)
  var headCache = {};
  function nearestT(ol, pos, i) {
    var pts = ol.cpu; if (!pts) pts = ol.cpu = readBack(ol);
    var best = 1e18, bi = 0, step = 4;
    for (var k = 0; k < pts.length; k += step * 4) {
      var dx = pts[k] - pos[0], dy = pts[k + 1] - pos[1], dz = pts[k + 2] - pos[2], d = dx * dx + dy * dy + dz * dz;
      if (d < best) { best = d; bi = k; }
    }
    for (var j = Math.max(0, bi - step * 4); j <= Math.min(pts.length - 4, bi + step * 4); j += 4) {
      var ex = pts[j] - pos[0], ey = pts[j + 1] - pos[1], ez = pts[j + 2] - pos[2], dd = ex * ex + ey * ey + ez * ez;
      if (dd < best) { best = dd; bi = j; }
    }
    headCache[i] = pts[bi + 3];
    return pts[bi + 3];
  }
  function readBack(ol) {
    var out = new Float32Array(ol.n * 4);
    gl.bindBuffer(gl.ARRAY_BUFFER, ol.vbo);
    gl.getBufferSubData(gl.ARRAY_BUFFER, 0, out);
    return out;
  }

  function placeLabels(info) {
    var showNames = state.w > 520;
    var all = bodies;
    for (var i = 0; i < all.length; i++) {
      var b = all[i], chip = chips[b.def.id];
      if (!chip) continue;
      var p = project(b.pos[0], b.pos[1] + b.def.r * 0.0, b.pos[2]);
      if (!p || p[0] < -20 || p[0] > state.w + 20 || p[1] < -20 || p[1] > state.h + 20) { chip.style.opacity = "0"; chip.style.pointerEvents = "none"; continue; }
      var off = b.def.r * (state.dist < 200 ? 0.5 : 1) * 1.0;
      var below = project(b.pos[0], b.pos[1] - b.def.r * 1.45, b.pos[2]) || p;
      chip.style.opacity = b.def.id === "moon" && state.dist > state.fit * 0.8 ? "0" : "1";
      chip.style.pointerEvents = chip.style.opacity === "0" ? "none" : "auto";
      chip.style.transform = "translate(" + below[0].toFixed(1) + "px," + (below[1] + 4).toFixed(1) + "px) translate(-50%,0)";
      chip.classList.toggle("is-compact", !showNames);
      void off;
    }
    // sign glyphs sit at the middle of each sidereal rashi on the outer ring
    var ay = info.ayan;
    for (var s = 0; s < 12; s++) {
      var mid = (s * 30 + 15 + ay) * D2R, gx = Math.cos(mid) * (RING_R + 22), gz = -Math.sin(mid) * (RING_R + 22);
      var q = project(gx, 0, gz), el = chips["sign" + s];
      if (!q) { el.style.opacity = "0"; continue; }
      el.style.opacity = "1";
      el.style.transform = "translate(" + q[0].toFixed(1) + "px," + q[1].toFixed(1) + "px) translate(-50%,-50%)";
      el.classList.toggle("is-sun", s === Math.floor(bodies[0].sid / 30) % 12);
    }
  }

  // ----------------------------------------------------------------------------------------------------------------- input
  var programsReady = false;
  function wake() { if (!raf && state.visible && !document.hidden && gl && programsReady) { last = 0; raf = requestAnimationFrame(frame); } }

  function onDown(e) {
    if (e.target.closest("button")) return;
    state.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state.touches.size === 2) { var pts = Array.from(state.touches.values()); state.pinch = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); }
    state.dragging = true; state.idleAt = performance.now(); state.vYaw = state.vPitch = 0;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    root.classList.add("is-dragging");
    wake();
  }
  function onMove(e) {
    var t = state.touches.get(e.pointerId);
    if (!t || !state.dragging) return;
    var dx = e.clientX - t.x, dy = e.clientY - t.y;
    t.x = e.clientX; t.y = e.clientY;
    if (state.touches.size >= 2) {
      var pts = Array.from(state.touches.values()), d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (state.pinch) { state.userZoom = true; state.targetDist = Math.max(state.fit * 0.22, Math.min(state.fit * 1.25, state.targetDist * (state.pinch / d))); state.dist = state.targetDist; }
      state.pinch = d;
    } else {
      var ky = 0.0062, kp = 0.0048;
      state.yaw -= dx * ky; state.pitch += dy * kp;
      state.vYaw = (-dx * ky) * 60 * 0.5; state.vPitch = (dy * kp) * 60 * 0.5;
    }
    state.idleAt = performance.now();
    wake();
  }
  function onUp(e) {
    state.touches.delete(e.pointerId);
    if (state.touches.size === 0) { state.dragging = false; state.pinch = 0; root.classList.remove("is-dragging"); }
    state.idleAt = performance.now();
    wake();
  }
  function onWheel(e) {
    // zoom only with ctrl/cmd (or a trackpad pinch), so the page keeps scrolling normally over the orrery
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    state.userZoom = true;
    state.targetDist = Math.max(state.fit * 0.22, Math.min(state.fit * 1.25, state.targetDist * Math.exp(e.deltaY * 0.0022)));
    wake();
  }

  function setSpeed(key) {
    state.speedKey = key; state.speed = SPEEDS[key] || 1;
    if (key === "live") state.simMs = Date.now();
    speedBtns.forEach(function (b) { var on = b.getAttribute("data-speed") === key; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); });
    updateDate(); wake();
  }

  // ----------------------------------------------------------------------------------------------------------------- boot
  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    buildChips();
    compute();
    select("earth");
    updateDate();
    root.setAttribute("data-ready", gl ? "gl" : "static");
    if (!gl || !glInit()) { root.setAttribute("data-ready", "static"); return; }
    function whenBuilt() {
      var ok = finishPrograms();
      if (ok === null) { requestAnimationFrame(whenBuilt); return; }
      if (!ok) { root.setAttribute("data-ready", "static"); return; }
      programsReady = true;
      wake();
    }
    whenBuilt();
    resize();
    root.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    root.addEventListener("wheel", onWheel, { passive: false });
    speedBtns.forEach(function (b) { b.addEventListener("click", function () { setSpeed(b.getAttribute("data-speed")); }); });
    root.querySelectorAll("[data-zoom]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.userZoom = true;
        state.targetDist = Math.max(state.fit * 0.22, Math.min(state.fit * 1.25, state.targetDist * (b.getAttribute("data-zoom") === "in" ? 0.72 : 1.38)));
        wake();
      });
    });
    if (resetBtn) resetBtn.addEventListener("click", function () { state.userZoom = false; state.targetDist = state.fit; state.yaw = 0.55; state.pitch = 0.62; state.vYaw = state.vPitch = 0; setSpeed("day"); wake(); });
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); if (raf) cancelAnimationFrame(raf); raf = 0; });
    canvas.addEventListener("webglcontextrestored", function () { booted = false; location.reload(); });
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(root);
    document.addEventListener("visibilitychange", wake);
    state.dist = state.targetDist = state.fit;
    setSpeed("day");
    wake();
  }

  // Start only when the orrery is about to be seen: nothing here runs while the visitor is still reading the top of the page.
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      var vis = entries.some(function (e) { return e.isIntersecting; });
      state.visible = vis;
      if (vis) { boot(); wake(); }
    }, { rootMargin: "240px 0px" });
    io.observe(root);
  } else { state.visible = true; boot(); }
})();
