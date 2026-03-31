const API_URL = "/api/panchang";

const els = {
  root: document.querySelector("#panchangRoot"),
  sky: document.querySelector("#sky"),
  glyphField: document.querySelector("#glyphField"),
  stars: document.querySelector("#stars"),
  clouds: document.querySelector("#clouds"),
  rain: document.querySelector("#rain"),
  sun: document.querySelector("#sun"),
  moonDisc: document.querySelector("#moonDisc"),
  birds: document.querySelector("#birds"),

  locPrompt: document.querySelector("#locPrompt"),
  locAllowBtn: document.querySelector("#locAllowBtn"),
  locDefaultBtn: document.querySelector("#locDefaultBtn"),
  latInput: document.querySelector("#latInput"),
  lonInput: document.querySelector("#lonInput"),
  locApplyBtn: document.querySelector("#locApplyBtn"),
  changeLocBtn: document.querySelector("#changeLocBtn"),
  weatherPill: document.querySelector("#weatherPill"),
  tempPill: document.querySelector("#tempPill"),

  liveClock: document.querySelector("#liveClock"),
  heroDate: document.querySelector("#heroDate"),
  heroLine1: document.querySelector("#heroLine1"),
  heroLine2: document.querySelector("#heroLine2"),
  heroMeta: document.querySelector("#heroMeta"),

  loadingCard: document.querySelector("#loadingCard"),
  errorCard: document.querySelector("#errorCard"),
  errorText: document.querySelector("#errorText"),
  cards: document.querySelector("#cards"),

  sunriseVal: document.querySelector("#sunriseVal"),
  sunsetVal: document.querySelector("#sunsetVal"),
  tithiVal: document.querySelector("#tithiVal"),
  tithiSub: document.querySelector("#tithiSub"),
  nakVal: document.querySelector("#nakVal"),
  nakSub: document.querySelector("#nakSub"),
  pakshaVal: document.querySelector("#pakshaVal"),
  monthVal: document.querySelector("#monthVal"),
  moonSvg: document.querySelector("#moonSvg"),
  moonPct: document.querySelector("#moonPct"),
  moonSub: document.querySelector("#moonSub"),
  rahuVal: document.querySelector("#rahuVal"),

  calPrevBtn: document.querySelector("#calPrevBtn"),
  calNextBtn: document.querySelector("#calNextBtn"),
  calTodayBtn: document.querySelector("#calTodayBtn"),
  calMonth: document.querySelector("#calMonth"),
  calYear: document.querySelector("#calYear"),
  calGrid: document.querySelector("#calGrid"),

  dayOverlay: document.querySelector("#dayOverlay"),
  dayOverlayBackdrop: document.querySelector("#dayOverlayBackdrop"),
  ovPanel: document.querySelector("#dayOverlayPanel"),
  ovTitle: document.querySelector("#ovTitle"),
  ovCloseBtn: document.querySelector("#ovCloseBtn"),
  ovChips: document.querySelector("#ovChips"),
  ovLoading: document.querySelector("#ovLoading"),
  ovError: document.querySelector("#ovError"),
  ovErrorText: document.querySelector("#ovErrorText"),
  ovGrid: document.querySelector("#ovGrid"),
  ovFest: document.querySelector("#ovFest"),
  ovPrevBtn: document.querySelector("#ovPrevBtn"),
  ovNextBtn: document.querySelector("#ovNextBtn"),

  coreFestBtn: document.querySelector("#coreFestBtn"),
  coreFestOverlay: document.querySelector("#coreFestOverlay"),
  coreFestBackdrop: document.querySelector("#coreFestBackdrop"),
  coreFestCloseBtn: document.querySelector("#coreFestCloseBtn"),
  coreFestChips: document.querySelector("#coreFestChips"),
  coreFestLoading: document.querySelector("#coreFestLoading"),
  coreFestError: document.querySelector("#coreFestError"),
  coreFestErrorText: document.querySelector("#coreFestErrorText"),
  coreFestList: document.querySelector("#coreFestList"),
};

function pad2(n){ return String(n).padStart(2,"0"); }

function getBrowserTz(){
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
}

function formatClock(d){
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

const _timeFmtCache = new Map(); // key -> Intl.DateTimeFormat
function _getTimeFmt(tzName, hour12){
  const tz = tzName || getBrowserTz();
  const key = `${tz}|${hour12 ? "12" : "24"}`;
  if(_timeFmtCache.has(key)) return _timeFmtCache.get(key);
  const fmt = hour12
    ? new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true })
    : new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  _timeFmtCache.set(key, fmt);
  return fmt;
}

function formatTime(iso, tzName){
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return "—";
  return _getTimeFmt(tzName, false).format(d);
}

function formatTime12(iso, tzName){
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return "—";
  return _getTimeFmt(tzName, true).format(d);
}

const _dateTimeFmtCache = new Map(); // tz -> Intl.DateTimeFormat
function _getDateTimeFmt(tzName){
  const tz = tzName || getBrowserTz();
  if(_dateTimeFmtCache.has(tz)) return _dateTimeFmtCache.get(tz);
  const fmt = new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  _dateTimeFmtCache.set(tz, fmt);
  return fmt;
}

function formatDateTime12(iso, tzName){
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return "—";
  return _getDateTimeFmt(tzName).format(d);
}

function formatDateLong(dateStr){
  const d = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat(undefined, { weekday:"long", day:"2-digit", month:"long", year:"numeric" }).format(d);
}

function clamp01(n){ return Math.max(0, Math.min(1, n)); }

function setState({loading=false, error=null, ready=false} = {}){
  if(els.loadingCard) els.loadingCard.hidden = !loading;
  if(els.errorCard) els.errorCard.hidden = !error;
  if(els.errorText) els.errorText.textContent = error || "";
  if(els.cards) els.cards.hidden = !ready;
}

function buildStars(){
  if(!els.stars) return;
  els.stars.innerHTML = "";
  const count = 90;
  for(let i=0;i<count;i++){
    const s = document.createElement("div");
    s.className = "star";
    const x = Math.random() * 100;
    const y = Math.random() * 60;
    const size = 0.6 + Math.random() * 1.8;
    const dur = 1.6 + Math.random() * 3.2;
    const delay = Math.random() * 2.2;
    s.style.left = `${x}%`;
    s.style.top = `${y}%`;
    s.style.width = `${size}px`;
    s.style.height = `${size}px`;
    s.style.animationDuration = `${dur}s`;
    s.style.animationDelay = `${delay}s`;
    els.stars.appendChild(s);
  }
}

const glyphState = {
  started: false,
  items: [],
  w: 0,
  h: 0,
  lastT: 0,
};

function startGlyphField(){
  if(glyphState.started) return;
  if(!els.glyphField) return;
  glyphState.started = true;

  const field = els.glyphField;
  field.innerHTML = "";

  function measure(){
    const rect = field.getBoundingClientRect();
    glyphState.w = Math.max(1, rect.width);
    glyphState.h = Math.max(1, rect.height);
  }
  measure();
  window.addEventListener("resize", measure);

  const glyphs = ["ॐ", "卐", "ॐ", "ॐ", "卐", "ॐ", "卐"];
  const pad = 18;

  glyphState.items = glyphs.map((ch, idx)=>{
    const el = document.createElement("div");
    el.className = ch === "ॐ" ? "glyph glyph--om" : "glyph glyph--swastik";
    el.textContent = ch;
    const size = 22 + Math.random() * 34;
    el.style.fontSize = `${size}px`;
    el.style.opacity = String(0.10 + Math.random() * 0.10);
    field.appendChild(el);

    const x = pad + Math.random() * (glyphState.w - pad * 2);
    const y = pad + Math.random() * (glyphState.h - pad * 2);
    const speed = 10 + Math.random() * 18;
    const ang = Math.random() * Math.PI * 2;
    const vx = Math.cos(ang) * speed;
    const vy = Math.sin(ang) * speed;
    const rot = Math.random() * 360;
    const vr = (Math.random() * 18 - 9); // deg/s

    return {
      id: idx,
      el,
      ch,
      size,
      r: size * 0.52,
      x,
      y,
      vx,
      vy,
      rot,
      vr,
    };
  });

  function tick(t){
    if(!glyphState.started) return;
    if(!glyphState.lastT) glyphState.lastT = t;
    const dt = Math.min(0.04, Math.max(0.0, (t - glyphState.lastT) / 1000));
    glyphState.lastT = t;

    const w = glyphState.w;
    const h = glyphState.h;

    // Move + wall bounce
    glyphState.items.forEach((g)=>{
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.rot += g.vr * dt;

      const minX = pad;
      const maxX = w - pad;
      const minY = pad;
      const maxY = h - pad;

      if(g.x < minX){ g.x = minX; g.vx *= -1; }
      if(g.x > maxX){ g.x = maxX; g.vx *= -1; }
      if(g.y < minY){ g.y = minY; g.vy *= -1; }
      if(g.y > maxY){ g.y = maxY; g.vy *= -1; }
    });

    // Simple collisions (swap velocities)
    for(let i=0;i<glyphState.items.length;i++){
      for(let j=i+1;j<glyphState.items.length;j++){
        const a = glyphState.items[i];
        const b = glyphState.items[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist2 = dx*dx + dy*dy;
        const minDist = (a.r + b.r) * 0.92;
        if(dist2 > 0 && dist2 < minDist * minDist){
          const tmpVx = a.vx;
          const tmpVy = a.vy;
          a.vx = b.vx;
          a.vy = b.vy;
          b.vx = tmpVx;
          b.vy = tmpVy;

          // Push apart a bit to avoid sticking
          const dist = Math.sqrt(dist2);
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) / 2;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
        }
      }
    }

    // Apply transforms
    glyphState.items.forEach((g)=>{
      g.el.style.transform = `translate3d(${g.x}px, ${g.y}px, 0) rotate(${g.rot}deg)`;
    });

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function setWeather(kind){
  if(!els.clouds || !els.rain || !els.sky) return;
  els.clouds.innerHTML = "";
  els.rain.innerHTML = "";
  if(els.birds) els.birds.innerHTML = "";

  els.sky.classList.toggle("is-rain", kind === "rain");
  els.sky.classList.toggle("is-cloudy", kind === "cloudy");
  els.sky.classList.toggle("is-sunny", kind === "clear");

  if(els.root){
    els.root.dataset.weather = kind;
  }

  if(els.weatherPill){
    const label = kind === "rain" ? "Rain" : kind === "cloudy" ? "Cloudy" : "Sunny";
    els.weatherPill.textContent = `Weather: ${label}`;
  }

  if(kind === "cloudy" || kind === "rain"){
    const defsLR = [
      { top: "-2%", left: "-65%", opacity: 0.88, dur: 34, scale: 1.12 },
      { top: "8%", left: "-75%", opacity: 0.74, dur: 44, scale: 1.28 },
      { top: "18%", left: "-70%", opacity: 0.56, dur: 56, scale: 1.08 },
      { top: "2%", left: "-55%", opacity: 0.44, dur: 62, scale: 1.02 },
    ];
    const defsRL = [
      { top: "1%", left: "95%", opacity: 0.82, dur: 38, scale: 1.20 },
      { top: "12%", left: "105%", opacity: 0.66, dur: 52, scale: 1.34 },
      { top: "20%", left: "110%", opacity: 0.52, dur: 64, scale: 1.10 },
      { top: "6%", left: "100%", opacity: 0.42, dur: 70, scale: 1.02 },
    ];

    function addCloud(def, i, reverse){
      const c = document.createElement("div");
      c.className = reverse ? "cloud cloud--rl" : "cloud";
      c.style.top = def.top;
      c.style.left = def.left;
      c.style.opacity = String(def.opacity);
      c.style.animationDuration = `${def.dur}s`;
      c.style.setProperty("--c-scale", String(def.scale));
      c.style.setProperty("--c-drift-y", `${(i % 2 === 0 ? 10 : -10)}px`);
      c.style.animationDelay = `${-i * 8}s`;
      els.clouds.appendChild(c);
    }

    defsLR.forEach((d, i)=> addCloud(d, i, false));
    defsRL.forEach((d, i)=> addCloud(d, i, true));
  }

  if(kind === "rain"){
    const far = document.createElement("div");
    far.className = "rain-layer rain--far";
    const mid = document.createElement("div");
    mid.className = "rain-layer rain--mid";
    const near = document.createElement("div");
    near.className = "rain-layer rain--near";
    const mist = document.createElement("div");
    mist.className = "rain-mist";
    els.rain.appendChild(far);
    els.rain.appendChild(mid);
    els.rain.appendChild(near);
    els.rain.appendChild(mist);
  }

  if(kind === "clear" && els.birds){
    for(let i=0;i<6;i++){
      const b = document.createElement("div");
      b.className = "bird";
      b.style.top = `${12 + Math.random() * 26}%`;
      b.style.left = `${-10 - Math.random() * 30}%`;
      b.style.opacity = String(0.55 + Math.random() * 0.4);
      b.style.animationDuration = `${12 + Math.random() * 12}s`;
      b.style.animationDelay = `${Math.random() * 6}s`;
      els.birds.appendChild(b);
    }
  }
}

async function fetchWeather(lat, lon){
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,cloud_cover&timezone=auto`;
    const res = await fetch(url);
    if(!res.ok) return { kind: "clear", tempC: null, tzName: null };
    const data = await res.json();
    const code = Number(data?.current?.weather_code ?? 0);
    const cloud = Number(data?.current?.cloud_cover ?? 0);
    const tempC = Number.isFinite(Number(data?.current?.temperature_2m)) ? Number(data.current.temperature_2m) : null;
    const tzName = typeof data?.timezone === "string" && data.timezone ? data.timezone : null;
    if(code >= 51 && code <= 99) return { kind: "rain", tempC, tzName };
    if(cloud >= 55) return { kind: "cloudy", tempC, tzName };
    return { kind: "clear", tempC, tzName };
  }catch{
    return { kind: "clear", tempC: null, tzName: null };
  }
}

function setTemperature(tempC){
  if(!els.tempPill) return;
  if(tempC === null || !Number.isFinite(Number(tempC))){
    els.tempPill.textContent = "—";
    return;
  }
  els.tempPill.textContent = `${Math.round(Number(tempC))}°C`;
}

function setDayNight(now, sunrise, sunset){
  if(!els.sky) return {isDay:true, dayProgress:0.5};
  const isDay = now >= sunrise && now <= sunset;
  els.sky.classList.toggle("is-night", !isDay);

  const total = sunset - sunrise;
  const p = total > 0 ? (now - sunrise) / total : 0.5;
  const dayProgress = clamp01(p);

  // Sun arc using simple parabola
  const sunX = 10 + dayProgress * 80; // %
  const sunY = 70 - Math.sin(dayProgress * Math.PI) * 52; // %
  els.sky.style.setProperty("--sun-x", `${sunX}%`);
  els.sky.style.setProperty("--sun-y", `${sunY}%`);

  return {isDay, dayProgress};
}

function moonSvgMarkup({illumination, waxing, size=92, prefix="moon"}){
  const frac = clamp01(Number(illumination || 0));
  const r = 50;
  const k = 1 - 2 * frac;
  const offset = (waxing ? 1 : -1) * k * r;
  const glowId = `glow_${prefix}`;
  const maskId = `phaseMask_${prefix}`;
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 120 120" aria-label="Moon phase" role="img">
    <defs>
      <radialGradient id="${glowId}" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="rgba(255,255,255,.95)"></stop>
        <stop offset="60%" stop-color="rgba(220,230,255,.70)"></stop>
        <stop offset="100%" stop-color="rgba(170,190,255,.25)"></stop>
      </radialGradient>
      <mask id="${maskId}">
        <rect x="0" y="0" width="120" height="120" fill="black"></rect>
        <circle cx="60" cy="60" r="${r}" fill="white"></circle>
        <circle cx="${60 + offset}" cy="60" r="${r}" fill="black"></circle>
      </mask>
    </defs>
    <circle cx="60" cy="60" r="${r}" fill="rgba(15,23,42,.85)"></circle>
    <g mask="url(#${maskId})">
      <circle cx="60" cy="60" r="${r}" fill="url(#${glowId})"></circle>
    </g>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(200,220,255,.10)" stroke-width="2"></circle>
  </svg>
  `;
}

function startClock(){
  function tick(){
    if(els.liveClock) els.liveClock.textContent = formatClock(new Date());
  }
  tick();
  window.setInterval(tick, 1000);
}

let rolloverTimer = null;
function scheduleRolloverRefresh(p){
  if(rolloverTimer) window.clearTimeout(rolloverTimer);
  const now = Date.now();
  const candidates = [Date.parse(p?.tithi_end), Date.parse(p?.nak_end)].filter((ms)=> Number.isFinite(ms));
  if(!candidates.length) return;

  // If already ended (tab slept / clock drift), refresh quickly.
  const alreadyEnded = candidates.some((ms)=> ms <= now - 10_000);
  if(alreadyEnded){
    rolloverTimer = window.setTimeout(()=> initReload(), 250);
    return;
  }

  const future = candidates.filter((ms)=> ms > now);
  if(!future.length) return;
  const next = Math.min(...future);
  const delay = Math.max(1200, next - now + 1500);
  rolloverTimer = window.setTimeout(()=> initReload(), delay);
}

async function loadPanchang(tzOverride){
  const { lat, lon, tz } = getSavedLocation();
  const tzName = tzOverride || tz || getBrowserTz();
  const qs = new URLSearchParams({ lat: String(lat), lon: String(lon), tz: tzName });
  const res = await fetch(`${API_URL}?${qs.toString()}`, {headers: {Accept:"application/json"}});
  const contentType = (res.headers.get("Content-Type") || "").toLowerCase();
  const bodyText = await res.text();
  if(!res.ok){
    throw new Error(`API error: ${res.status} ${bodyText.slice(0, 180)}`);
  }
  if(!contentType.includes("application/json")){
    throw new Error(`Unexpected response. ${bodyText.slice(0, 180)}`);
  }
  return JSON.parse(bodyText);
}

function hydrateUI(p){
  const tzName = p?.location?.tz || getBrowserTz();
  if(els.heroDate) els.heroDate.textContent = formatDateLong(p.date);
  if(els.heroLine1) els.heroLine1.textContent = `${p.month} • ${p.paksha}`;
  if(els.heroLine2) els.heroLine2.textContent = `${p.tithi} • Vikram Samvat ${p.vikram_samvat ?? "—"}`;
  if(els.heroMeta) els.heroMeta.textContent = `${Number(p.location.lat).toFixed(4)}, ${Number(p.location.lon).toFixed(4)} • ${p.location.tz}`;

  if(els.sunriseVal) els.sunriseVal.textContent = formatTime(p.sunrise, tzName);
  if(els.sunsetVal) els.sunsetVal.textContent = formatTime(p.sunset, tzName);
  if(els.tithiVal) els.tithiVal.textContent = p.tithi;
  if(els.tithiSub) els.tithiSub.textContent = `Ends ${formatDateTime12(p.tithi_end, tzName)}`;
  if(els.nakVal) els.nakVal.textContent = p.nakshatra;
  if(els.nakSub) els.nakSub.textContent = `Ends ${formatDateTime12(p.nak_end, tzName)}`;
  if(els.pakshaVal) els.pakshaVal.textContent = p.paksha;
  if(els.monthVal) els.monthVal.textContent = p.month;

  const moonPct = Math.round(clamp01(p.moon_phase) * 100);
  if(els.moonPct) els.moonPct.textContent = `${moonPct}%`;
  if(els.moonSub) els.moonSub.textContent = p.moon_waxing ? "Waxing" : "Waning";
  if(els.moonSvg) els.moonSvg.innerHTML = moonSvgMarkup({illumination: p.moon_phase, waxing: !!p.moon_waxing, size: 92, prefix: "card"});
  if(els.moonDisc){
    els.moonDisc.innerHTML = `<div class="moon-glow"></div>${moonSvgMarkup({illumination: p.moon_phase, waxing: !!p.moon_waxing, size: 170, prefix: "sky"})}`;
  }

  if(els.rahuVal) els.rahuVal.textContent = `${formatTime(p.rahu_start, tzName)}–${formatTime(p.rahu_end, tzName)}`;
}

const skyState = {
  started: false,
  sunrise: 0,
  sunset: 0,
  nextSunrise: null,
  nextSunriseFor: null,
  baseDate: null,
  tzName: null,
  lat: null,
  lon: null,
};

function startSkyLoop(p){
  skyState.sunrise = new Date(p.sunrise).getTime();
  skyState.sunset = new Date(p.sunset).getTime();
  skyState.nextSunrise = null;
  skyState.nextSunriseFor = null;
  skyState.baseDate = String(p?.date || "");
  skyState.tzName = String(p?.location?.tz || "") || null;
  skyState.lat = Number.isFinite(Number(p?.location?.lat)) ? Number(p.location.lat) : null;
  skyState.lon = Number.isFinite(Number(p?.location?.lon)) ? Number(p.location.lon) : null;

  if(!skyState.started){
    skyState.started = true;
    (function loop(){
      const now = Date.now();
      const sunrise = skyState.sunrise;
      const sunset = skyState.sunset;
      const isDay = setDayNight(now, sunrise, sunset).isDay;

      // Moon arc after sunset until next sunrise
      if(!isDay){
        const nightStart = sunset;
        const nightEnd = skyState.nextSunrise || (sunrise + 24 * 60 * 60 * 1000);
        const total = nightEnd - nightStart;
        const pN = total > 0 ? (now - nightStart) / total : 0.5;
        const nightProgress = clamp01(pN);

        const moonX = 15 + nightProgress * 70;
        const moonY = 65 - Math.sin(nightProgress * Math.PI) * 44;
        if(els.sky){
          els.sky.style.setProperty("--moon-x", `${moonX}%`);
          els.sky.style.setProperty("--moon-y", `${moonY}%`);
        }

        // Fetch next sunrise once per night for realistic moon movement
        if(now > sunset && !skyState.nextSunriseFor){
          const base = skyState.baseDate || isoDateLocal(new Date());
          const dateStr = stepDate(base, 1);
          skyState.nextSunriseFor = dateStr;
          const { lat, lon, tz } = getSavedLocation();
          const tzName = skyState.tzName || tz || getBrowserTz();
          const qs = new URLSearchParams({
            date: dateStr,
            lat: String(skyState.lat ?? lat),
            lon: String(skyState.lon ?? lon),
            tz: tzName,
          });
          fetch(`${API_URL}?${qs.toString()}`, { headers: { Accept:"application/json" } })
            .then((r)=> r.ok ? r.json() : null)
            .then((j)=> { if(j?.sunrise) skyState.nextSunrise = new Date(j.sunrise).getTime(); })
            .catch(()=>{});
        }
      }
      requestAnimationFrame(loop);
    })();
  }
}

function getSavedLocation(){
  try{
    const raw = localStorage.getItem("sms_panchang_location");
    if(raw){
      const j = JSON.parse(raw);
      const lat = Number(j.lat);
      const lon = Number(j.lon);
      const tz = typeof j.tz === "string" && j.tz ? j.tz : null;
      if(Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon, tz };
    }
  }catch{}
  return { lat: 28.6139, lon: 77.2090, tz: null };
}

function saveLocation(lat, lon, tz){
  const payload = { lat, lon };
  if(tz) payload.tz = tz;
  localStorage.setItem("sms_panchang_location", JSON.stringify(payload));
}

function isoDateLocal(d){
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthKey(year, monthIndex){
  return `${year}-${pad2(monthIndex + 1)}`;
}

const FESTIVAL_ICONS = {
  Diwali: "🪔",
  Holi: "🎨",
  Shivratri: "🕉️",
  "Maha Shivratri": "🕉️",
  "Maha Shivaratri": "🕉️",
  Navratri: "🌺",
  "Navratri Begins": "🏺",
  "Sharad Navratri Begins": "🏺",
  Dussehra: "🏹",
  Janmashtami: "🦚",
  Ekadashi: "✨",
  Purnima: "🌕",
  Amavasya: "🌑",
};

const panchangCache = new Map(); // key -> payload
const coreFestYearCache = new Map(); // key -> list

async function fetchPanchangForDate(dateStr, { signal } = {}){
  const { lat, lon, tz } = getSavedLocation();
  const tzName = tz || getBrowserTz();
  const key = `${dateStr}|${Number(lat).toFixed(4)}|${Number(lon).toFixed(4)}|${tzName}`;
  if(panchangCache.has(key)) return panchangCache.get(key);

  const controller = new AbortController();
  const timeoutMs = 12_000;
  const timeoutId = window.setTimeout(()=> controller.abort(), timeoutMs);
  const mergedSignal = signal
    ? (function merge(){
        // Best-effort merge: abort when either aborts.
        const c = new AbortController();
        const abort = ()=> { try{ c.abort(); }catch{} };
        if(signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
        controller.signal.addEventListener("abort", abort, { once: true });
        return c.signal;
      })()
    : controller.signal;

  const qs = new URLSearchParams({ date: dateStr, lat: String(lat), lon: String(lon), tz: tzName });
  try{
    const res = await fetch(`${API_URL}?${qs.toString()}`, { headers: { Accept:"application/json" }, signal: mergedSignal });
    const contentType = (res.headers.get("Content-Type") || "").toLowerCase();
    const bodyText = await res.text();
    if(!res.ok){
      throw new Error(`API error: ${res.status} ${bodyText.slice(0, 160)}`);
    }
    if(!contentType.includes("application/json")){
      throw new Error(`Unexpected response. ${bodyText.slice(0, 160)}`);
    }
    const j = JSON.parse(bodyText);
    panchangCache.set(key, j);
    return j;
  }catch(err){
    if(String(err?.name || "").toLowerCase() === "aborterror"){
      throw new Error("Request timed out. Please try again.");
    }
    throw err;
  }finally{
    window.clearTimeout(timeoutId);
  }
}

function openCoreFestOverlay(){
  if(!els.coreFestOverlay) return;
  els.coreFestOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  loadCoreFestivals();
}

function closeCoreFestOverlay(){
  if(!els.coreFestOverlay) return;
  els.coreFestOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

async function loadCoreFestivals(){
  if(!els.coreFestLoading || !els.coreFestList) return;
  els.coreFestLoading.hidden = false;
  if(els.coreFestError) els.coreFestError.hidden = true;
  els.coreFestList.hidden = true;
  els.coreFestList.innerHTML = "";

  try{
    const year = Number(els.calYear?.value) || calendarState.year;
    const { lat, lon, tz } = getSavedLocation();
    const tzName = tz || getBrowserTz();
    const cacheKey = `${year}|${Number(lat).toFixed(3)}|${Number(lon).toFixed(3)}|${tzName}`;

    if(els.coreFestChips){
      els.coreFestChips.innerHTML = `
        <span class="chip">${year}</span>
        <span class="chip">${Number(lat).toFixed(3)}, ${Number(lon).toFixed(3)}</span>
        <span class="chip">${escapeHtml(tzName)}</span>
      `;
    }

    let list = coreFestYearCache.get(cacheKey) || null;
    if(!list){
      const qs = new URLSearchParams({ year: String(year), lat: String(lat), lon: String(lon), tz: tzName });
      const res = await fetch(`/api/core-festivals-dates/?${qs.toString()}`, { headers: { Accept:"application/json" } });
      const bodyText = await res.text();
      if(!res.ok) throw new Error(`API error: ${res.status} ${bodyText.slice(0, 160)}`);
      const parsed = JSON.parse(bodyText);
      list = Array.isArray(parsed) ? parsed : [];
      coreFestYearCache.set(cacheKey, list);
    }

    const html = list.map((r)=>{
      const dateStr = String(r?.date || "");
      const icon = String(r?.icon || "🎉");
      const name = String(r?.name || "—");
      const month = String(r?.month || "—");
      const paksha = String(r?.paksha || "—");
      const tithi = String(r?.tithi || "—");
      const timeRule = String(r?.time_rule || "sunrise");
      const label = dateStr ? new Intl.DateTimeFormat(undefined, { month:"short", day:"2-digit", year:"numeric" }).format(new Date(dateStr + "T00:00:00")) : "—";
      const rule = `${month} • ${paksha} • ${tithi}${timeRule && timeRule !== "sunrise" ? ` • ${timeRule}` : ""}`;
      return `
        <button class="corefest-item" type="button" data-date="${escapeHtml(dateStr)}">
          <div class="corefest-date">${escapeHtml(label)}</div>
          <div class="corefest-name"><span class="corefest-icon" aria-hidden="true">${escapeHtml(icon)}</span> ${escapeHtml(name)}</div>
          <div class="corefest-rule">${escapeHtml(rule)}</div>
        </button>
      `;
    }).join("");

    els.coreFestLoading.hidden = true;
    els.coreFestList.hidden = false;
    els.coreFestList.innerHTML = html || `<div class="state-text" style="padding:.6rem 0;">No core festivals found.</div>`;

    // Clicking a festival jumps to the day details overlay.
    els.coreFestList.querySelectorAll("[data-date]").forEach((btn)=>{
      btn.addEventListener("click", ()=>{
        const dateStr = btn.getAttribute("data-date") || "";
        if(!dateStr) return;
        closeCoreFestOverlay();
        openDayOverlay(dateStr);
      });
    });
  }catch(err){
    els.coreFestLoading.hidden = true;
    if(els.coreFestError) els.coreFestError.hidden = false;
    if(els.coreFestErrorText) els.coreFestErrorText.textContent = String(err?.message || err);
  }
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll("\"","&quot;")
    .replaceAll("'","&#039;");
}

const calendarState = {
  year: new Date().getFullYear(),
  monthIndex: new Date().getMonth(),
  activeMonthToken: 0,
};

let lastLivePanchang = null;

function syncTodayCalendarCell(){
  if(!lastLivePanchang || !els.calGrid) return;
  const dateStr = String(lastLivePanchang.date || "");
  if(!dateStr) return;
  const cell = els.calGrid.querySelector(`.cal-cell[data-date="${dateStr}"]`);
  if(!cell) return;
  hydrateCalendarCell(dateStr, lastLivePanchang);
}

function ensureCalendarControls(){
  if(!els.calMonth || !els.calYear) return;
  if(els.calMonth.options.length === 0){
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    months.forEach((m, idx)=>{
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = m;
      els.calMonth.appendChild(opt);
    });
  }
  if(els.calYear.options.length === 0){
    const nowY = new Date().getFullYear();
    const start = nowY - 50;
    const end = nowY + 50;
    for(let y=start; y<=end; y++){
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      els.calYear.appendChild(opt);
    }
  }
}

function startOfMonthGrid(year, monthIndex){
  const first = new Date(year, monthIndex, 1);
  // Monday-first: 0..6
  const dow = (first.getDay() + 6) % 7;
  const start = new Date(year, monthIndex, 1 - dow);
  return start;
}

function renderCalendar(year, monthIndex){
  if(!els.calGrid || !els.calMonth || !els.calYear) return;
  calendarState.year = year;
  calendarState.monthIndex = monthIndex;
  els.calMonth.value = String(monthIndex);
  els.calYear.value = String(year);

  const token = ++calendarState.activeMonthToken;
  els.calGrid.innerHTML = "";
  els.calGrid.classList.remove("cal-anim");
  // force reflow for restartable animation
  void els.calGrid.offsetWidth;
  els.calGrid.classList.add("cal-anim");

  const gridStart = startOfMonthGrid(year, monthIndex);
  const todayStr = isoDateLocal(new Date());
  const datesToLoad = [];

  for(let i=0;i<42;i++){
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const inMonth = d.getMonth() === monthIndex;
    const dateStr = isoDateLocal(d);

    if(inMonth){
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cal-cell";
      btn.dataset.date = dateStr;
      if(dateStr === todayStr) btn.classList.add("is-today");
      btn.innerHTML = `
        <div class="cal-time">—</div>
        <div class="cal-stickers" aria-hidden="true"></div>
        <div class="cal-date">${d.getDate()}</div>
        <div class="cal-tithi">—</div>
      `;
      btn.addEventListener("click", ()=> openDayOverlay(dateStr));
      els.calGrid.appendChild(btn);
      datesToLoad.push(dateStr);
    }else{
      const empty = document.createElement("div");
      empty.className = "cal-cell";
      empty.setAttribute("aria-hidden", "true");
      empty.setAttribute("disabled", "true");
      empty.style.opacity = "0.18";
      empty.style.cursor = "default";
      empty.innerHTML = `<div class="cal-date">${d.getDate()}</div>`;
      els.calGrid.appendChild(empty);
    }
  }

  loadCalendarMonthData(datesToLoad, token);
  // If we've already loaded the live dashboard payload, keep "today" consistent.
  syncTodayCalendarCell();
}

async function loadCalendarMonthData(dateStrs, token){
  const controller = new AbortController();
  const limit = 6;
  let idx = 0;

  async function worker(){
    while(idx < dateStrs.length){
      const my = idx++;
      const dateStr = dateStrs[my];
      if(token !== calendarState.activeMonthToken) return;
      try{
        const p = await fetchPanchangForDate(dateStr, { signal: controller.signal });
        if(token !== calendarState.activeMonthToken) return;
        hydrateCalendarCell(dateStr, p);
      }catch{
        // keep cell usable; show placeholder
        const cell = els.calGrid?.querySelector?.(`.cal-cell[data-date="${dateStr}"]`);
        const t = cell?.querySelector?.(".cal-tithi");
        if(t) t.textContent = "—";
      }
    }
  }

  const workers = [];
  for(let i=0;i<limit;i++) workers.push(worker());
  await Promise.all(workers);
  controller.abort();
}

function hydrateCalendarCell(dateStr, p){
  if(!els.calGrid) return;
  const cell = els.calGrid.querySelector(`.cal-cell[data-date="${dateStr}"]`);
  if(!cell) return;
  const tzName = p?.location?.tz || getSavedLocation()?.tz || getBrowserTz();

  const tt = cell.querySelector(".cal-time");
  if(tt){
    if(p?.tithi_end){
      tt.textContent = `Ends ${formatDateTime12(p.tithi_end, tzName)}`;
      if(p?.tithi_start){
        tt.title = `${formatDateTime12(p.tithi_start, tzName)}–${formatDateTime12(p.tithi_end, tzName)}`;
      }
    }else{
      tt.textContent = "—";
      tt.removeAttribute("title");
    }
  }
  const t = cell.querySelector(".cal-tithi");
  if(t) t.textContent = p?.tithi || "—";

  cell.classList.toggle("is-ekadashi", p?.tithi === "Ekadashi");
  cell.classList.toggle("is-purnima", p?.tithi === "Purnima");
  cell.classList.toggle("is-amavasya", p?.tithi === "Amavasya");

  const stickers = cell.querySelector(".cal-stickers");
  if(stickers){
    stickers.innerHTML = "";
    const details = Array.isArray(p?.festivals_detail) ? p.festivals_detail : null;
    const itemsAll = details ? details : (Array.isArray(p?.festivals) ? p.festivals.map((name)=> ({ name, icon: FESTIVAL_ICONS[name] || "🎉", anim: "glow", source: "unknown" })) : []);
    const coreItems = itemsAll.filter((f)=> String(f?.source || "") === "core");

    cell.classList.toggle("has-core", coreItems.length > 0);
    if(coreItems.length){
      const anim = String(coreItems[0]?.anim || "glow");
      cell.dataset.coreAnim = anim;
      cell.dataset.coreName = String(coreItems[0]?.name || "");
    }else{
      delete cell.dataset.coreAnim;
      delete cell.dataset.coreName;
    }

    coreItems.slice(0, 3).forEach((f)=>{
      const s = document.createElement("div");
      const anim = String(f?.anim || "glow");
      s.className = `sticker sticker--${anim}`;
      s.title = String(f?.name || "");
      s.textContent = String(f?.icon || FESTIVAL_ICONS[f?.name] || "🎉");
      stickers.appendChild(s);
    });

    // Calendar hover media: use first CORE festival only
    const primary = coreItems[0] || null;
    if(primary?.anim){
      cell.dataset.fanim = String(primary.anim);
      cell.dataset.fname = String(primary.name || "");
      cell.dataset.ficon = String(primary.icon || FESTIVAL_ICONS[primary.name] || "🎉");
    }else{
      delete cell.dataset.fanim;
      delete cell.dataset.fname;
      delete cell.dataset.ficon;
    }
  }
}

const overlayState = {
  dateStr: null,
  swipeStart: null,
};

function openDayOverlay(dateStr){
  if(!els.dayOverlay) return;
  overlayState.dateStr = dateStr;
  els.dayOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  loadOverlayDay(dateStr);
}

function closeDayOverlay(){
  if(!els.dayOverlay) return;
  els.dayOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  overlayState.dateStr = null;
}

function stepDate(dateStr, deltaDays){
  const [y,m,d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

async function loadOverlayDay(dateStr){
  if(els.ovTitle) els.ovTitle.textContent = formatDateLong(dateStr);
  if(els.ovChips) els.ovChips.innerHTML = "";
  if(els.ovFest) els.ovFest.innerHTML = "";
  if(els.ovLoading) els.ovLoading.hidden = false;
  if(els.ovError) els.ovError.hidden = true;
  if(els.ovGrid) els.ovGrid.hidden = true;
  if(els.ovGrid) els.ovGrid.innerHTML = "";

  try{
    const p = await fetchPanchangForDate(dateStr);
    if(overlayState.dateStr !== dateStr) return;
    const tzName = p?.location?.tz || getBrowserTz();

    if(els.ovLoading) els.ovLoading.hidden = true;
    if(els.ovGrid) els.ovGrid.hidden = false;

    const chips = [];
    chips.push(`${p.month} • ${p.paksha}`);
    chips.push(`${p.tithi} • ${p.nakshatra}`);
    const festDetails = Array.isArray(p?.festivals_detail) ? p.festivals_detail : null;
    const festivals = festDetails ? festDetails.map((x)=> x?.name).filter(Boolean) : (Array.isArray(p?.festivals) ? p.festivals : []);

    if(els.ovChips){
      els.ovChips.innerHTML = chips.map((c)=> `<span class="chip">${c}</span>`).join("");
    }

    function fmtRange(a, b){
      if(!a || !b) return "—";
      return `${formatDateTime12(a, tzName)}–${formatDateTime12(b, tzName)}`;
    }
    function durHrsMins(ms){
      if(!Number.isFinite(ms) || ms <= 0) return "—";
      const mins = Math.round(ms / 60000);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h ? `${h}h ${m}m` : `${m}m`;
    }

    const sunriseMs = Date.parse(p.sunrise);
    const sunsetMs = Date.parse(p.sunset);
    const dayLen = Number.isFinite(sunriseMs) && Number.isFinite(sunsetMs) ? (sunsetMs - sunriseMs) : NaN;
    const brahmaStart = Number.isFinite(sunriseMs) ? new Date(sunriseMs - 96 * 60000).toISOString() : null;
    const brahmaEnd = Number.isFinite(sunriseMs) ? new Date(sunriseMs - 48 * 60000).toISOString() : null;

    const rows = [
      ["Vikram Samvat", p.vikram_samvat ? String(p.vikram_samvat) : "—"],
      ["Tithi", p.tithi],
      ["Tithi Time", fmtRange(p.tithi_start, p.tithi_end)],
      ["Nakshatra", p.nakshatra],
      ["Nakshatra Time", fmtRange(p.nak_start, p.nak_end)],
      ["Paksha", p.paksha],
      ["Hindu Month", p.month],
      ["Sunrise", formatTime12(p.sunrise, tzName)],
      ["Sunset", formatTime12(p.sunset, tzName)],
      ["Day Length", durHrsMins(dayLen)],
      ["Brahma Muhurat", brahmaStart ? `${formatTime12(brahmaStart, tzName)}–${formatTime12(brahmaEnd, tzName)}` : "—"],
      ["Rahu Kaal", fmtRange(p.rahu_start, p.rahu_end)],
      ["Abhijit Muhurat", p.abhijit_start ? fmtRange(p.abhijit_start, p.abhijit_end) : "—"],
      ["Moon Phase", `${Math.round(clamp01(p.moon_phase) * 100)}% (${p.moon_waxing ? "Waxing" : "Waning"})`],
      ["Location", p.location ? `${Number(p.location.lat).toFixed(4)}, ${Number(p.location.lon).toFixed(4)} • ${p.location.tz}` : "—"],
    ];
    if(els.ovGrid){
      els.ovGrid.innerHTML = rows.map(([k,v])=> `<div class="ov-row"><div class="ov-row__k">${k}</div><div class="ov-row__v">${v}</div></div>`).join("");
    }

    if(els.ovFest){
      const details = festDetails || festivals.map((name)=> ({ name, icon: FESTIVAL_ICONS[name] || "🎉", description: "Festival day.", anim: "glow" }));
      if(details.length){
        const uniq = [];
        const seen = new Set();
        details.forEach((f)=>{ const n = String(f?.name || "").trim(); if(n && !seen.has(n)){ seen.add(n); uniq.push(f); }});
        const cards = uniq.map((f)=>{
          const anim = String(f?.anim || "glow");
          const icon = String(f?.icon || FESTIVAL_ICONS[f?.name] || "🎉");
          const name = String(f?.name || "");
          const desc = String(f?.description || "Festival day.");
          return `
            <div class="fest-card">
              <div class="fest-anim fest-anim--${anim}" aria-hidden="true">${icon}</div>
              <div class="fest-meta">
                <div class="fest-name">${name}</div>
                <div class="fest-desc">${desc}</div>
              </div>
            </div>
          `;
        }).join("");
        els.ovFest.innerHTML = `<div class="fest-head">Festivals</div><div class="fest-list">${cards}</div>`;
      }else{
        els.ovFest.innerHTML = "";
      }
    }
  }catch(err){
    if(overlayState.dateStr !== dateStr) return;
    if(els.ovLoading) els.ovLoading.hidden = true;
    if(els.ovError) els.ovError.hidden = false;
    if(els.ovErrorText) els.ovErrorText.textContent = String(err?.message || err);
  }
}

function initCalendar(){
  ensureCalendarControls();
  if(els.calPrevBtn){
    els.calPrevBtn.addEventListener("click", ()=>{
      const d = new Date(calendarState.year, calendarState.monthIndex - 1, 1);
      renderCalendar(d.getFullYear(), d.getMonth());
    });
  }
  if(els.calNextBtn){
    els.calNextBtn.addEventListener("click", ()=>{
      const d = new Date(calendarState.year, calendarState.monthIndex + 1, 1);
      renderCalendar(d.getFullYear(), d.getMonth());
    });
  }
  if(els.calTodayBtn){
    els.calTodayBtn.addEventListener("click", ()=>{
      const now = new Date();
      renderCalendar(now.getFullYear(), now.getMonth());
      openDayOverlay(isoDateLocal(now));
    });
  }
  if(els.calMonth){
    els.calMonth.addEventListener("change", ()=>{
      const m = Number(els.calMonth.value);
      renderCalendar(calendarState.year, m);
    });
  }
  if(els.calYear){
    els.calYear.addEventListener("change", ()=>{
      const y = Number(els.calYear.value);
      renderCalendar(y, calendarState.monthIndex);
    });
  }

  // Overlay interactions
  if(els.ovCloseBtn) els.ovCloseBtn.addEventListener("click", closeDayOverlay);
  if(els.dayOverlayBackdrop) els.dayOverlayBackdrop.addEventListener("click", closeDayOverlay);
  window.addEventListener("keydown", (e)=>{
    const dayOpen = els.dayOverlay?.getAttribute("aria-hidden") === "false";
    const coreOpen = els.coreFestOverlay?.getAttribute("aria-hidden") === "false";
    if(!dayOpen && !coreOpen) return;
    if(e.key === "Escape"){
      if(dayOpen) closeDayOverlay();
      if(coreOpen) closeCoreFestOverlay();
    }
    if(dayOpen){
      if(e.key === "ArrowLeft" && overlayState.dateStr) openDayOverlay(stepDate(overlayState.dateStr, -1));
      if(e.key === "ArrowRight" && overlayState.dateStr) openDayOverlay(stepDate(overlayState.dateStr, 1));
    }
  });
  if(els.ovPrevBtn) els.ovPrevBtn.addEventListener("click", ()=> overlayState.dateStr && openDayOverlay(stepDate(overlayState.dateStr, -1)));
  if(els.ovNextBtn) els.ovNextBtn.addEventListener("click", ()=> overlayState.dateStr && openDayOverlay(stepDate(overlayState.dateStr, 1)));

  // Core festivals overlay
  if(els.coreFestBtn) els.coreFestBtn.addEventListener("click", openCoreFestOverlay);
  if(els.coreFestCloseBtn) els.coreFestCloseBtn.addEventListener("click", closeCoreFestOverlay);
  if(els.coreFestBackdrop) els.coreFestBackdrop.addEventListener("click", closeCoreFestOverlay);

  if(els.ovPanel){
    els.ovPanel.addEventListener("pointerdown", (e)=>{
      overlayState.swipeStart = { x: e.clientX, y: e.clientY, t: Date.now() };
    });
    els.ovPanel.addEventListener("pointerup", (e)=>{
      if(!overlayState.swipeStart || !overlayState.dateStr) return;
      const dx = e.clientX - overlayState.swipeStart.x;
      const dy = e.clientY - overlayState.swipeStart.y;
      const dt = Date.now() - overlayState.swipeStart.t;
      overlayState.swipeStart = null;
      if(dt > 900) return;
      if(Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy)) return;
      if(dx > 0) openDayOverlay(stepDate(overlayState.dateStr, -1));
      else openDayOverlay(stepDate(overlayState.dateStr, 1));
    });
  }

  const now = new Date();
  renderCalendar(now.getFullYear(), now.getMonth());
}

function openLocationPrompt(){
  if(!els.locPrompt) return;
  syncLocationPromptCtas();
  els.locPrompt.setAttribute("aria-hidden", "false");
}

function closeLocationPrompt(){
  if(!els.locPrompt) return;
  els.locPrompt.setAttribute("aria-hidden", "true");
}

async function syncLocationPromptCtas(){
  if(!els.locAllowBtn) return;
  if(!navigator.geolocation){
    els.locAllowBtn.textContent = "Location unavailable";
    els.locAllowBtn.disabled = true;
    return;
  }

  els.locAllowBtn.disabled = false;

  let state = null;
  try{
    if(navigator.permissions?.query){
      const perm = await navigator.permissions.query({ name: "geolocation" });
      state = perm?.state || null;
    }
  }catch{
    state = null;
  }

  if(!state){
    state = localStorage.getItem("sms_panchang_geo_granted") === "1" ? "granted" : null;
  }

  if(state === "granted"){
    els.locAllowBtn.textContent = "Current location";
  }else{
    els.locAllowBtn.textContent = "Allow Location";
  }
}

async function init(){
  startClock();
  buildStars();
  startGlyphField();
  initCalendar();

  // Location prompt (first time)
  const saved = getSavedLocation();
  if(els.latInput) els.latInput.value = String(saved.lat);
  if(els.lonInput) els.lonInput.value = String(saved.lon);

  const hasSaved = localStorage.getItem("sms_panchang_location") !== null;
  const onboarded = localStorage.getItem("sms_panchang_loc_onboarded") === "1";
  if(!hasSaved && !onboarded){
    localStorage.setItem("sms_panchang_loc_onboarded", "1");
    openLocationPrompt();
  }

  if(els.changeLocBtn){
    els.changeLocBtn.addEventListener("click", openLocationPrompt);
  }

  if(els.locDefaultBtn){
    els.locDefaultBtn.addEventListener("click", ()=>{
      saveLocation(28.6139, 77.2090);
      panchangCache.clear();
      renderCalendar(calendarState.year, calendarState.monthIndex);
      closeLocationPrompt();
      initReload();
    });
  }

  if(els.locApplyBtn){
    els.locApplyBtn.addEventListener("click", ()=>{
      const lat = Number(els.latInput?.value);
      const lon = Number(els.lonInput?.value);
      if(!Number.isFinite(lat) || !Number.isFinite(lon)){
        alert("Please enter valid lat/lon numbers.");
        return;
      }
      saveLocation(lat, lon);
      panchangCache.clear();
      renderCalendar(calendarState.year, calendarState.monthIndex);
      closeLocationPrompt();
      initReload();
    });
  }

  if(els.locAllowBtn){
    els.locAllowBtn.addEventListener("click", ()=>{
      if(!navigator.geolocation){
        alert("Geolocation not supported in this browser.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos)=>{
          localStorage.setItem("sms_panchang_geo_granted", "1");
          saveLocation(pos.coords.latitude, pos.coords.longitude);
          if(els.latInput) els.latInput.value = String(pos.coords.latitude);
          if(els.lonInput) els.lonInput.value = String(pos.coords.longitude);
          panchangCache.clear();
          renderCalendar(calendarState.year, calendarState.monthIndex);
          closeLocationPrompt();
          initReload();
        },
        ()=>{
          alert("Location permission denied. You can use Delhi or manual coordinates.");
        },
        { enableHighAccuracy: true, timeout: 12000 }
      );
    });
  }

  initReload();
}

let reloadInFlight = false;
async function initReload(){
  if(reloadInFlight) return;
  reloadInFlight = true;
  setState({loading:true, error:null, ready:false});
  try{
    const { lat, lon, tz: savedTz } = getSavedLocation();

    // Weather first: gives us realistic visuals + best-effort timezone for this lat/lon.
    const weather = await fetchWeather(lat, lon);
    setWeather(weather.kind);
    setTemperature(weather.tempC);

    const tzName = weather.tzName || savedTz || getBrowserTz();
    if(weather.tzName && weather.tzName !== savedTz){
      saveLocation(lat, lon, weather.tzName);
    }

    const p = await loadPanchang(tzName);
    lastLivePanchang = p;
    hydrateUI(p);
    syncTodayCalendarCell();
    setState({loading:false, error:null, ready:true});
    startSkyLoop(p);
    scheduleRolloverRefresh(p);
  }catch(err){
    setState({loading:false, error: String(err?.message || err), ready:false});
  }finally{
    reloadInFlight = false;
  }
}

init();
