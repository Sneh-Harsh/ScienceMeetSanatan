const API_URL = "/api/kundali";

const els = {
  root: document.querySelector("#kundaliRoot"),
  heroVideo: document.querySelector("#heroVideo"),

  dob: document.querySelector("#dobInput"),
  tob: document.querySelector("#tobInput"),
  place: document.querySelector("#placeInput"),
  lat: document.querySelector("#latInput"),
  lon: document.querySelector("#lonInput"),
  tz: document.querySelector("#tzInput"),

  useCurrentBtn: document.querySelector("#useCurrentBtn"),
  todayBtn: document.querySelector("#todayBtn"),
  seeHoroscopeBtn: document.querySelector("#seeHoroscopeBtn"),
  generateBtn: document.querySelector("#generateBtn"),

  loading: document.querySelector("#kLoading"),
  error: document.querySelector("#kError"),

  output: document.querySelector("#kOutput"),
  summaryChips: document.querySelector("#summaryChips"),
  phaseShiftPanel: document.querySelector("#phaseShiftPanel"),
  climatePanel: document.querySelector("#planetClimatePanel"),
  heatmapPanel: document.querySelector("#heatmapPanel"),
  chartLegend: document.querySelector("#chartLegend"),

  chartTitle: document.querySelector("#chartTitle"),
  chartSub: document.querySelector("#chartSub"),
  northChart: document.querySelector("#northChart"),
  southChart: document.querySelector("#southChart"),

  housePanelBody: document.querySelector("#houseBody"),
  planetTable: document.querySelector("#planetTable"),
  planetTableSide: document.querySelector("#planetTableSide"),
  dashaList: document.querySelector("#dashaList"),
};

function pad2(n){ return String(n).padStart(2, "0"); }

function getBrowserTz(){
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
}

function isoToday(){
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isoNowTime(){
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function initHeroVideo(){
  const video = els.heroVideo;
  if(!video) return;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("muted", "");
  video.setAttribute("autoplay", "");
  video.setAttribute("playsinline", "");
  video.currentTime = 0.05;
  video.load();
  const tryPlay = () => {
    if(video.readyState === 0) video.load();
    const playPromise = video.play();
    if(playPromise && typeof playPromise.catch === "function"){
      playPromise.catch(() => {});
    }
  };
  if(video.readyState >= 2){
    tryPlay();
  } else {
    video.addEventListener("canplay", tryPlay, { once:true });
    video.addEventListener("loadeddata", tryPlay, { once:true });
  }
  document.addEventListener("visibilitychange", () => {
    if(document.visibilityState === "visible"){
      tryPlay();
    }
  });
  ["pointerdown", "touchstart", "click"].forEach((eventName) => {
    window.addEventListener(eventName, tryPlay, { once:true, passive:true });
  });
  let attempts = 0;
  const keepAlive = window.setInterval(() => {
    attempts += 1;
    if(!video.paused && !video.ended){
      window.clearInterval(keepAlive);
      return;
    }
    tryPlay();
    if(attempts >= 10){
      window.clearInterval(keepAlive);
    }
  }, 1500);
  if(video.paused){
    video.addEventListener("error", () => {
      video.style.display = "none";
    }, { once:true });
  }
}

function setState({ loading=false, error=null, ready=false } = {}){
  if(els.loading) els.loading.hidden = !loading;
  if(els.error){
    els.error.hidden = !error;
    els.error.textContent = error || "";
  }
  if(els.output) els.output.hidden = !ready;
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll("\"","&quot;")
    .replaceAll("'","&#039;");
}

function shortDt(iso){
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { year:"numeric", month:"short", day:"2-digit" }).format(d);
}

function fmtDeg(deg){
  const n = Number(deg);
  if(!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}°`;
}

const kundaliState = {
  data: null,
  chart: "d1",   // d1 | d9
  style: "north", // north | south
  selectedHouse: 1,
  lang: "en", // en | hi
};

function getActiveData(){
  if(!kundaliState.data) return null;
  if(kundaliState.chart === "d9") return kundaliState.data.navamsa;
  return kundaliState.data;
}

function getD1Data(){
  return kundaliState.data || null;
}

const I18N = {
  rashi_hi: {
    Mesha: "मेष",
    Vrishabha: "वृषभ",
    Mithuna: "मिथुन",
    Karka: "कर्क",
    Simha: "सिंह",
    Kanya: "कन्या",
    Tula: "तुला",
    Vrischika: "वृश्चिक",
    Dhanu: "धनु",
    Makara: "मकर",
    Kumbha: "कुम्भ",
    Meena: "मीन",
  },
  planet_hi: {
    Sun: "सूर्य",
    Moon: "चन्द्र",
    Mars: "मंगल",
    Mercury: "बुध",
    Jupiter: "गुरु",
    Venus: "शुक्र",
    Saturn: "शनि",
    Rahu: "राहु",
    Ketu: "केतु",
  },
  labels: {
    en: {
      chartSummary: "Chart Summary",
      lagna: "Lagna",
      nakshatra: "Nakshatra",
      pada: "Pada",
      ayanamsa: "Ayanamsa",
      dob: "DOB",
      house: "House",
      planets: "Planets",
      noPlanets: "No planets in this house.",
      selectHouse: "Tap a house to view details.",
      overview: "Overview",
      planetsTab: "Planets",
      dosha: "Dosha",
      dasha: "Dasha",
      predictions: "Predictions",
      remedies: "Remedies",
      houseDetails: "House Details",
      vimDasha: "Vimshottari Dasha",
      today: "Today",
      autoToday: "Show Today Kundali by default",
    },
    hi: {
      chartSummary: "कुंडली सार",
      lagna: "लग्न",
      nakshatra: "नक्षत्र",
      pada: "पाद",
      ayanamsa: "अयनांश",
      dob: "जन्म तिथि",
      house: "भाव",
      planets: "ग्रह",
      noPlanets: "इस भाव में कोई ग्रह नहीं।",
      selectHouse: "किसी भाव पर टैप करके विवरण देखें।",
      overview: "सारांश",
      planetsTab: "ग्रह",
      dosha: "दोष",
      dasha: "दशा",
      predictions: "फलादेश",
      remedies: "उपाय",
      houseDetails: "भाव विवरण",
      vimDasha: "विम्शोत्तरी दशा",
      today: "आज",
      autoToday: "डिफ़ॉल्ट रूप से आज की कुंडली दिखाएं",
    },
  },
};

function t(key){
  const lang = kundaliState.lang === "hi" ? "hi" : "en";
  return String(I18N.labels[lang]?.[key] ?? I18N.labels.en[key] ?? key);
}

function trRashi(name){
  const s = String(name || "—");
  if(kundaliState.lang !== "hi") return s;
  return String(I18N.rashi_hi[s] || s);
}

function trPlanet(name){
  const s = String(name || "—");
  if(kundaliState.lang !== "hi") return s;
  return String(I18N.planet_hi[s] || s);
}

function setActiveToggle(group, value){
  document.querySelectorAll(`.k-toggle__btn[data-${group}]`).forEach((btn)=>{
    btn.classList.toggle("is-active", btn.getAttribute(`data-${group}`) === value);
  });
}

function setActiveTab(value){
  document.querySelectorAll(".k-tab__btn[data-tab]").forEach((btn)=>{
    btn.classList.toggle("is-active", btn.getAttribute("data-tab") === value);
  });
  document.querySelectorAll(".k-tab__pane[data-pane]").forEach((pane)=>{
    pane.hidden = pane.getAttribute("data-pane") !== value;
  });
}

function renderStaticLabels(){
  const summaryTitle = document.querySelector(".k-summary__title");
  if(summaryTitle) summaryTitle.textContent = t("chartSummary");

  const houseTitle = document.querySelector("#housePanel .k-panel__title");
  if(houseTitle) houseTitle.textContent = t("houseDetails");

  const observatoryTitle = kundaliState.lang === "hi" ? "ग्रह वेधशाला" : "Planetary Observatory";
  const sidePlanetsTitle = document.querySelector("#planetPanelSide .k-panel__title");
  if(sidePlanetsTitle) sidePlanetsTitle.textContent = observatoryTitle;

  if(els.todayBtn) els.todayBtn.textContent = t("today");

  const tabTextKey = {
    overview: "overview",
    planets: "planetsTab",
    dosha: "dosha",
    dasha: "dasha",
    predictions: "predictions",
    remedies: "remedies",
  };
  document.querySelectorAll(".k-tab__btn[data-tab]").forEach((btn)=>{
    const key = tabTextKey[String(btn.getAttribute("data-tab") || "")];
    if(key) btn.textContent = t(key);
  });

  const tabPlanetsTitle = document.querySelector("#tabPlanets .k-panel__title");
  if(tabPlanetsTitle) tabPlanetsTitle.textContent = t("planetsTab");
  const tabDashaTitle = document.querySelector("#tabDasha .k-panel__title");
  if(tabDashaTitle) tabDashaTitle.textContent = t("vimDasha");
}

function renderSummary(){
  if(!els.summaryChips || !kundaliState.data) return;
  const d = kundaliState.data;
  const input = d.input || {};
  const phase = d.experience?.phase_shift || {};
  const moon = (Array.isArray(d.planets) ? d.planets : []).find((planet)=> String(planet?.planet || "") === "Moon");
  const placeValue = String(input.place || els.place?.value || "").trim() || (kundaliState.lang === "hi" ? "स्थान समन्वयित हो रहा है" : "Location syncing");
  const cards = [
    { label: t("lagna"), value: trRashi(d.lagna) },
    { label: kundaliState.lang === "hi" ? "राशि" : "Raashi", value: trRashi(moon?.rashi || "—") },
    { label: t("nakshatra"), value: `${String(d.nakshatra || "—")} • ${t("pada")} ${String(d.nakshatra_pada || "—")}` },
    { label: t("ayanamsa"), value: fmtDeg(d.ayanamsa) },
    { label: t("dob"), value: `${String(input.date || "—")} • ${String(input.time || "—")}` },
    { label: kundaliState.lang === "hi" ? "स्थान" : "Place", value: placeValue },
    { label: kundaliState.lang === "hi" ? "समय क्षेत्र" : "Timezone", value: String(input.tz || "—") },
    { label: kundaliState.lang === "hi" ? "सक्रिय चक्र" : "Active Cycle", value: phase.active ? String(phase.active) : (kundaliState.lang === "hi" ? "संरेखित हो रहा है" : "Aligning") },
  ];
  els.summaryChips.innerHTML = cards.map((card)=> `
    <div class="summary-chip">
      <span class="summary-chip__label">${escapeHtml(card.label)}</span>
      <strong class="summary-chip__value">${escapeHtml(card.value)}</strong>
    </div>
  `).join("");
}

function renderPhaseShift(){
  if(!els.phaseShiftPanel) return;
  const phase = kundaliState.data?.experience?.phase_shift;
  if(!phase){
    els.phaseShiftPanel.innerHTML = `<div class="k-panel__title">Past · Present · Next</div><div class="k-panel__body">Generate the chart to reveal the timing shift panel.</div>`;
    return;
  }
  const transition = phase.transition_date ? shortDt(phase.transition_date) : "—";
  els.phaseShiftPanel.innerHTML = `
    <div class="k-insight-card__kicker">Past / Present / Next Shift</div>
    <div class="k-panel__title">Timing transition</div>
    <div class="shift-track">
      <div class="shift-pill">
        <span>Fading</span>
        <strong>${escapeHtml(trPlanet(phase.fading || "—"))}</strong>
      </div>
      <div class="shift-pill shift-pill--active">
        <span>Active</span>
        <strong>${escapeHtml(trPlanet(phase.active || "—"))}</strong>
      </div>
      <div class="shift-pill">
        <span>Next</span>
        <strong>${escapeHtml(trPlanet(phase.next || "—"))}</strong>
      </div>
    </div>
    <div class="k-note">Next major transition window begins around ${escapeHtml(transition)}.</div>
  `;
}

function renderPlanetClimate(){
  if(!els.climatePanel) return;
  const climate = kundaliState.data?.experience?.planetary_climate;
  if(!climate){
    els.climatePanel.innerHTML = `<div class="k-panel__title">Planetary Climate</div><div class="k-panel__body">Generate the chart to inspect current support and pressure.</div>`;
    return;
  }
  const support = Array.isArray(climate.supportive) ? climate.supportive.slice(0, 3) : [];
  const pressure = Array.isArray(climate.pressurizing) ? climate.pressurizing.slice(0, 2) : [];
  els.climatePanel.innerHTML = `
    <div class="k-insight-card__kicker">Planetary Climate</div>
    <div class="k-panel__title">Support vs pressure now</div>
    <div class="climate-meters">
      <div class="climate-meter">
        <span>Chart stability</span>
        <strong>${escapeHtml(Math.round(Number(climate.stability_score || 0)))}%</strong>
        <div class="climate-meter__bar"><span style="width:${Number(climate.stability_score || 0)}%"></span></div>
      </div>
      <div class="climate-meter">
        <span>Period sensitivity</span>
        <strong>${escapeHtml(Math.round(Number(climate.sensitivity_score || 0)))}%</strong>
        <div class="climate-meter__bar is-copper"><span style="width:${Number(climate.sensitivity_score || 0)}%"></span></div>
      </div>
    </div>
    <div class="climate-grid">
      <div>
        <div class="pill-label">Supporting planets</div>
        <div class="climate-chip-row">
          ${support.map((row)=> `<span class="climate-chip climate-chip--support">${escapeHtml(row.glyph || "")} ${escapeHtml(trPlanet(row.planet))}</span>`).join("")}
        </div>
      </div>
      <div>
        <div class="pill-label">Pressurizing planets</div>
        <div class="climate-chip-row">
          ${pressure.map((row)=> `<span class="climate-chip climate-chip--pressure">${escapeHtml(row.glyph || "")} ${escapeHtml(trPlanet(row.planet))}</span>`).join("")}
        </div>
      </div>
    </div>
    <div class="k-note">${escapeHtml(climate.summary || "")}</div>
  `;
}

function renderHeatmapPanel(){
  if(!els.heatmapPanel) return;
  const heatmap = Array.isArray(kundaliState.data?.experience?.house_heatmap) ? kundaliState.data.experience.house_heatmap : [];
  if(!heatmap.length){
    els.heatmapPanel.innerHTML = `<div class="k-panel__title">House Focus Map</div><div class="k-panel__body">Generate the chart to reveal which houses are most activated now.</div>`;
    return;
  }
  els.heatmapPanel.innerHTML = `
    <div class="k-panel__title">House Focus Map</div>
    <div class="heatmap-grid">
      ${heatmap
        .map(
          (item)=> `
            <button type="button" class="heat-cell ${heatToneClass(item.tone)}${Number(item.house) === Number(kundaliState.selectedHouse) ? " is-selected" : ""}" data-heat-house="${escapeHtml(item.house)}">
              <span class="heat-cell__house">H${escapeHtml(item.house)}</span>
              <strong>${escapeHtml(Math.round(Number(item.score || 0)))}%</strong>
              <span class="heat-cell__label">${escapeHtml(houseLabel(item.house))}</span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
  els.heatmapPanel.querySelectorAll("[data-heat-house]").forEach((button)=>{
    button.addEventListener("click", ()=>{
      const houseNum = Number(button.getAttribute("data-heat-house"));
      if(!Number.isFinite(houseNum)) return;
      kundaliState.selectedHouse = houseNum;
      renderChart();
    });
  });
}

function buildPlanetTableRows(planets){
  const rows = planets.map((p)=>{
    const name = String(p?.planet || "—");
    const sym = String(p?.symbol || "");
    const rashi = String(p?.rashi || "—");
    const house = Number(p?.house);
    const degIn = fmtDeg(p?.degree_in_sign ?? (Number(p?.degree) % 30));
    const dignity = String(p?.dignity || "Neutral");
    const style = planetStyle(name);
    return `
      <button class="k-row k-row--planet" type="button" data-planet-house="${Number.isFinite(house) ? house : ""}">
        <div class="k-row__l">
          <div class="k-row__sym planet-badge planet-badge--${escapeHtml(style)}" aria-hidden="true">${escapeHtml(sym)}</div>
          <div>
            <div class="k-row__name">${escapeHtml(trPlanet(name))}</div>
            <div class="k-row__dignity">${escapeHtml(dignity)}</div>
          </div>
        </div>
        <div class="k-row__meta">${escapeHtml(trRashi(rashi))} • ${escapeHtml(t("house"))}${Number.isFinite(house) ? house : "—"} • ${escapeHtml(degIn)}</div>
      </button>
    `;
  }).join("");
  return rows || `<div class="k-panel__body">No planets found.</div>`;
}

function zodiacLongitude(planet){
  const signIndex = Number(planet?.rashi_index);
  const degreeInSign = Number(
    planet?.degree_in_sign ?? (((Number(planet?.degree) || 0) % 30 + 30) % 30),
  );
  const signBase = Number.isFinite(signIndex) ? signIndex * 30 : 0;
  return (signBase + (Number.isFinite(degreeInSign) ? degreeInSign : 0) + 360) % 360;
}

let kundaliPlanetariumModulePromise = null;

function ensureKundaliPlanetariumModule(){
  if(!kundaliPlanetariumModulePromise){
    kundaliPlanetariumModulePromise = import("/static/kundali-planetarium.js?v=2");
  }
  return kundaliPlanetariumModulePromise;
}

function renderPlanetTable(){
  if(!kundaliState.data) return;
  const active = getActiveData();
  const experience = kundaliState.chart === "d1" ? (kundaliState.data?.experience?.house_details || {}) : {};
  const rawPlanets = Array.isArray(active?.planets) ? active.planets : (kundaliState.chart === "d1" ? kundaliState.data.planets : []);
  const planets = rawPlanets.map((planet)=> {
    const houseInfo = experience[String(planet.house)] || {};
    const enriched = (Array.isArray(houseInfo.planets) ? houseInfo.planets : []).find((row)=> String(row.planet) === String(planet.planet));
    return {
      ...planet,
      dignity: enriched?.dignity || "Neutral",
      displayName: trPlanet(planet?.planet || "—"),
      signLabel: trRashi(planet?.rashi || "—"),
      degreeLabel: fmtDeg(planet?.degree_in_sign ?? (Number(planet?.degree) % 30)),
    };
  });
  if(els.planetTable){
    const html = buildPlanetTableRows(planets);
    els.planetTable.innerHTML = html;
    els.planetTable.querySelectorAll("[data-planet-house]").forEach((row)=>{
      row.addEventListener("click", ()=>{
        const houseNum = Number(row.getAttribute("data-planet-house"));
        if(!Number.isFinite(houseNum)) return;
        kundaliState.selectedHouse = houseNum;
        renderChart();
      });
    });
  }
  if(els.planetTableSide){
    els.planetTableSide.innerHTML = `
      <div class="kundali-planetarium-shell">
        <div class="kundali-planetarium-copy">
          <span class="kundali-planetarium-copy__kicker">${escapeHtml(kundaliState.lang === "hi" ? "ग्रह वेधशाला" : "Planetary Observatory")}</span>
          <p>${escapeHtml(kundaliState.lang === "hi" ? "यह सूर्य-केंद्रित मॉडल नहीं है। ग्रह अपनी वैदिक राशि-डिग्री स्थिति पर स्थिर हैं। दृश्य को घुमाकर निरीक्षण करें।" : "This is not a solar-system view. Each planet is fixed to its Vedic sign-degree position on the zodiac field. Drag to inspect the field.")}</p>
        </div>
        <div class="kundali-planetarium" id="kundaliPlanetariumMount">
          <div class="kundali-planetarium-canvas"></div>
          <div class="kundali-planetarium-stage kundali-planetarium-stage--fallback">
            <div class="kundali-planetarium-core">ॐ</div>
          </div>
        </div>
      </div>
    `;
    const mount = els.planetTableSide.querySelector(".kundali-planetarium");
    ensureKundaliPlanetariumModule()
      .then((mod)=> {
        mod.renderKundaliPlanetarium?.(mount, planets, {
          chart: kundaliState.chart,
          lang: kundaliState.lang,
          onSelectHouse: (houseNum)=>{
            if(!Number.isFinite(houseNum)) return;
            kundaliState.selectedHouse = houseNum;
            renderChart();
          },
        });
      })
      .catch(()=>{
        if(mount){
          mount.classList.add("is-fallback-only");
        }
      });
  }
}

function getPlanetsByHouse(active){
  const m = new Map();
  (Array.isArray(active?.planets) ? active.planets : []).forEach((p)=>{
    const house = Number(p?.house);
    if(!Number.isFinite(house)) return;
    if(!m.has(house)) m.set(house, []);
    m.get(house).push(p);
  });
  return m;
}

const PLANET_KIND = {
  Jupiter: "benefic",
  Venus: "benefic",
  Mercury: "benefic",
  Moon: "benefic",
  Sun: "malefic",
  Mars: "malefic",
  Saturn: "malefic",
  Rahu: "malefic",
  Ketu: "malefic",
};

const PLANET_STYLE = {
  Sun: "sun",
  Moon: "moon",
  Mars: "mars",
  Mercury: "mercury",
  Jupiter: "jupiter",
  Venus: "venus",
  Saturn: "saturn",
  Rahu: "rahu",
  Ketu: "ketu",
};

const HOUSE_CARD_LAYOUT = [
  { house: 2, top: 6, left: 18, width: 24, height: 14 },
  { house: 1, top: 11, left: 36, width: 28, height: 15 },
  { house: 12, top: 6, left: 58, width: 24, height: 14 },
  { house: 3, top: 21, left: 4, width: 16, height: 18 },
  { house: 4, top: 39, left: 4, width: 19, height: 18 },
  { house: 5, top: 61, left: 4, width: 16, height: 18 },
  { house: 6, top: 80, left: 18, width: 24, height: 13 },
  { house: 7, top: 75, left: 36, width: 28, height: 17 },
  { house: 8, top: 80, left: 58, width: 24, height: 13 },
  { house: 9, top: 61, left: 80, width: 16, height: 18 },
  { house: 10, top: 39, left: 77, width: 19, height: 18 },
  { house: 11, top: 21, left: 80, width: 16, height: 18 },
];

const HOUSE_LABELS = {
  en: {
    1: "Self",
    2: "Wealth",
    3: "Courage",
    4: "Home",
    5: "Creativity",
    6: "Work",
    7: "Partnership",
    8: "Change",
    9: "Fortune",
    10: "Career",
    11: "Gains",
    12: "Release",
  },
  hi: {
    1: "स्व",
    2: "धन",
    3: "पराक्रम",
    4: "सुख",
    5: "विद्या",
    6: "ऋण",
    7: "संबंध",
    8: "रूपांतरण",
    9: "भाग्य",
    10: "कर्म",
    11: "लाभ",
    12: "मोक्ष",
  },
};

function planetKind(name){
  return PLANET_KIND[String(name)] || "neutral";
}

function planetStyle(name){
  return PLANET_STYLE[String(name)] || "neutral";
}

function houseLabel(houseNum){
  const lang = kundaliState.lang === "hi" ? "hi" : "en";
  return HOUSE_LABELS[lang]?.[Number(houseNum)] || `H${houseNum}`;
}

function formatIsoRange(start, end){
  return `${shortDt(start)} → ${shortDt(end)}`;
}

function severityTone(label){
  const v = String(label || "").toLowerCase();
  if(v.includes("strong") || v.includes("high")) return "warn";
  if(v.includes("medium") || v.includes("moderate")) return "mixed";
  if(v.includes("mild")) return "soft";
  return "ok";
}

function heatToneClass(tone){
  const v = String(tone || "quiet");
  if(v === "support") return "is-support";
  if(v === "stress") return "is-stress";
  if(v === "active") return "is-active";
  return "is-quiet";
}

function buildPlanetChip(planet, { compact=false } = {}){
  const name = String(planet?.planet || "—");
  const glyph = String(planet?.glyph || planet?.symbol || "");
  const sign = String(planet?.sign || planet?.rashi || "—");
  const degree = String(planet?.degree || fmtDeg(planet?.degree_in_sign ?? (Number(planet?.degree) % 30)));
  const title = `${trPlanet(name)} • ${trRashi(sign)} • ${degree}`;
  return `
    <span class="planet-chip planet-chip--${escapeHtml(planetStyle(name))}${compact ? " is-compact" : ""}" title="${escapeHtml(title)}">
      <span class="planet-chip__glyph" aria-hidden="true">${escapeHtml(glyph)}</span>
      <span class="planet-chip__name">${escapeHtml(trPlanet(name))}</span>
      ${compact ? "" : `<span class="planet-chip__meta">${escapeHtml(degree)}</span>`}
    </span>
  `;
}

function planetShortLabel(name){
  const value = String(name || "").trim();
  if(!value) return "—";
  const map = {
    Sun: "Su",
    Moon: "Mo",
    Mars: "Ma",
    Mercury: "Me",
    Jupiter: "Ju",
    Venus: "Ve",
    Saturn: "Sa",
    Rahu: "Ra",
    Ketu: "Ke",
  };
  return map[value] || value.slice(0, 2);
}

function buildNorthPlanetMark(planet){
  const name = String(planet?.planet || "—");
  const glyph = String(planet?.glyph || planet?.symbol || "");
  const sign = String(planet?.sign || planet?.rashi || "—");
  const degree = String(planet?.degree || fmtDeg(planet?.degree_in_sign ?? (Number(planet?.degree) % 30)));
  const title = `${trPlanet(name)} • ${trRashi(sign)} • ${degree}`;
  return `
    <span class="north-planet-mark planet-chip--${escapeHtml(planetStyle(name))}" title="${escapeHtml(title)}">
      <span class="north-planet-mark__glyph" aria-hidden="true">${escapeHtml(glyph)}</span>
      <span class="north-planet-mark__name">${escapeHtml(planetShortLabel(name))}</span>
    </span>
  `;
}

function getHouseExperience(houseNum, activeData){
  if(kundaliState.chart === "d1"){
    return kundaliState.data?.experience?.house_details?.[String(houseNum)] || null;
  }
  const houses = Array.isArray(activeData?.houses) ? activeData.houses : [];
  const planets = Array.isArray(activeData?.planets) ? activeData.planets : [];
  const house = houses.find((row)=> Number(row?.house) === Number(houseNum));
  if(!house) return null;
  const occupants = planets.filter((row)=> Number(row?.house) === Number(houseNum));
  return {
    house: houseNum,
    sign: String(house?.rashi || "—"),
    signLabel: String(house?.rashi || "—").slice(0, 2),
    signRuler: "—",
    theme: houseLabel(houseNum),
    tags: occupants.length ? ["occupied"] : ["quiet"],
    supportiveAspects: [],
    pressuringAspects: [],
    planets: occupants.map((row)=> ({
      planet: String(row?.planet || "—"),
      glyph: String(row?.symbol || ""),
      style: planetStyle(row?.planet),
      sign: String(row?.rashi || "—"),
      house: Number(row?.house || houseNum),
      degree: fmtDeg(row?.degree_in_sign ?? (Number(row?.degree) % 30)),
      dignity: "Navamsa view",
    })),
  };
}

function renderDasha(){
  if(!els.dashaList || !kundaliState.data) return;
  const dashaExp = kundaliState.data?.dasha_experience;
  const timeline = Array.isArray(dashaExp?.timeline) ? dashaExp.timeline : [];
  const currentSummary = dashaExp?.current_summary || {};
  const currentAntara = dashaExp?.current_antardasha || {};
  const items = timeline.map((item)=>{
    const summary = item.summary || {};
    const range = formatIsoRange(item.start, item.end);
    return `
      <button class="dasha-item${item.isCurrent ? " is-current" : ""}" type="button">
        <div class="dasha-item__rail"></div>
        <div class="dasha-item__content">
          <div class="dasha-item__top">
            <div class="dasha-item__name">${escapeHtml(trPlanet(item.planet || "—"))}</div>
            <div class="dasha-item__range">${escapeHtml(range)}</div>
          </div>
          <div class="dasha-item__meta">Age ${escapeHtml(item.ageStart)} → ${escapeHtml(item.ageEnd)} • ${escapeHtml(Number(item.years || 0).toFixed(2))} years</div>
          <div class="dasha-item__headline">${escapeHtml(summary.headline || "")}</div>
          <div class="dasha-item__tone">${escapeHtml(summary.periodTone || "")}</div>
        </div>
      </button>
    `;
  }).join("");
  els.dashaList.innerHTML = `
    <div class="dasha-hero">
      <div class="dasha-hero__current">
        <div class="pill-label">Current Antardasha</div>
        <h3>${escapeHtml(trPlanet(currentAntara.planet || "—"))}</h3>
        <p>${escapeHtml(dashaExp?.why_now || "")}</p>
      </div>
      <div class="dasha-hero__summary">
        <div class="pill-label">This period feels like</div>
        <strong>${escapeHtml(currentSummary.headline || "Dasha insight")}</strong>
        <p>${escapeHtml(currentSummary.advice || "")}</p>
      </div>
    </div>
    <div class="dasha-timeline">${items || `<div class="k-panel__body">Dasha not available.</div>`}</div>
  `;
}

function getHouseMap(houses){
  const m = new Map();
  (Array.isArray(houses) ? houses : []).forEach((h)=> m.set(Number(h?.house), h));
  return m;
}

function buildHouseHtml(h, planetsInHouse){
  const houseNum = Number(h?.house);
  const sign = String(h?.rashi || "—");
  const planets = Array.isArray(planetsInHouse) ? planetsInHouse : [];
  const planetLines = planets.length
    ? planets.map((p)=>{
        const nm = String(p?.planet || "");
        const degIn = fmtDeg(p?.degree_in_sign ?? (Number(p?.degree) % 30));
        return `
          <div class="house-line">
            <span class="house-line__n">${escapeHtml(trPlanet(nm))}</span>
            <span class="house-line__d">${escapeHtml(degIn)}</span>
          </div>
        `;
      }).join("")
    : `<div class="house-empty">—</div>`;
  return `
    <div class="house__inner">
      <div class="house__meta">
        <div class="house__house">H${Number.isFinite(houseNum) ? houseNum : "—"}</div>
        <div class="house__sign">${escapeHtml(trRashi(sign))}</div>
      </div>
      <div class="house-lines" aria-label="${escapeHtml(t("planets"))}">${planetLines}</div>
    </div>
  `;
}

const NORTH_HOUSE_REGIONS = [
  { house: 2, points: "4,4 50,4 27,27", corner: { x: 38, y: 11.5 }, anchor: "middle", text: { x: 27, y: 12.5 }, lineAnchor: "middle" },
  { house: 1, points: "50,4 73,27 50,50 27,27", corner: { x: 50, y: 12 }, anchor: "middle", text: { x: 50, y: 16 }, lineAnchor: "middle" },
  { house: 12, points: "50,4 96,4 73,27", corner: { x: 62, y: 11.5 }, anchor: "middle", text: { x: 73, y: 12.5 }, lineAnchor: "middle" },
  { house: 3, points: "4,4 27,27 4,50", corner: { x: 12.5, y: 18 }, anchor: "middle", text: { x: 11.5, y: 24 }, lineAnchor: "start" },
  { house: 4, points: "4,50 27,27 50,50 27,73", corner: { x: 16, y: 50 }, anchor: "middle", text: { x: 10.5, y: 42.5 }, lineAnchor: "start" },
  { house: 5, points: "4,50 27,73 4,96", corner: { x: 12.5, y: 82 }, anchor: "middle", text: { x: 11.5, y: 66.5 }, lineAnchor: "start" },
  { house: 6, points: "4,96 27,73 50,96", corner: { x: 38, y: 88.5 }, anchor: "middle", text: { x: 27, y: 82.5 }, lineAnchor: "middle" },
  { house: 7, points: "27,73 50,50 73,73 50,96", corner: { x: 50, y: 86 }, anchor: "middle", text: { x: 50, y: 79.5 }, lineAnchor: "middle" },
  { house: 8, points: "50,96 73,73 96,96", corner: { x: 62, y: 88.5 }, anchor: "middle", text: { x: 73, y: 82.5 }, lineAnchor: "middle" },
  { house: 9, points: "96,50 73,73 96,96", corner: { x: 87.5, y: 82 }, anchor: "middle", text: { x: 88.5, y: 66.5 }, lineAnchor: "end" },
  { house: 10, points: "96,50 73,27 50,50 73,73", corner: { x: 84, y: 50 }, anchor: "middle", text: { x: 89.5, y: 42.5 }, lineAnchor: "end" },
  { house: 11, points: "96,4 73,27 96,50", corner: { x: 87.5, y: 18 }, anchor: "middle", text: { x: 88.5, y: 24 }, lineAnchor: "end" },
];

function buildNorthPlanetContent(planets, config){
  const x = config.text.x;
  const y = config.text.y;
  const anchor = config.lineAnchor || "middle";
  const lines = Array.isArray(planets) && planets.length
    ? planets.map((p)=> {
        const symbol = String(p?.symbol || "");
        const planetName = String(trPlanet(p?.planet || "")).replace(/\s+/g, " ").trim();
        return `${symbol} ${planetName}`;
      })
    : ["-"];
  return `
    <text x="${x}" y="${y}" text-anchor="${anchor}" class="north-planet">
      ${lines.map((line, index)=> `<tspan x="${x}" dy="${index === 0 ? 0 : 3.55}">${escapeHtml(line)}</tspan>`).join("")}
    </text>
  `;
}

function parseNorthPoints(points){
  return String(points || "")
    .trim()
    .split(/\s+/)
    .map((pair)=> pair.split(",").map(Number))
    .filter((pair)=> pair.length === 2 && pair.every((value)=> Number.isFinite(value)));
}

function northRegionBounds(points){
  const parsed = parseNorthPoints(points);
  const xs = parsed.map((pair)=> pair[0]);
  const ys = parsed.map((pair)=> pair[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    parsed,
  };
}

function northClipPath(points, bounds){
  return bounds.parsed
    .map(([x, y])=>{
      const relX = ((x - bounds.minX) / Math.max(bounds.width, 1)) * 100;
      const relY = ((y - bounds.minY) / Math.max(bounds.height, 1)) * 100;
      return `${relX}% ${relY}%`;
    })
    .join(", ");
}

function northCardStyle(cfg){
  const bounds = northRegionBounds(cfg.points);
  return {
    style: `top:${bounds.minY}%;left:${bounds.minX}%;width:${bounds.width}%;height:${bounds.height}%;clip-path:polygon(${northClipPath(cfg.points, bounds)});`,
    alignClass: cfg.lineAnchor === "start" ? "north-card--start" : cfg.lineAnchor === "end" ? "north-card--end" : "north-card--center",
  };
}

function renderChartLegend(){
  if(!els.chartLegend) return;
  els.chartLegend.innerHTML = `
    <span class="legend-chip"><span class="legend-chip__dot is-support"></span>Support</span>
    <span class="legend-chip"><span class="legend-chip__dot is-pressure"></span>Pressure</span>
    <span class="legend-chip"><span class="legend-chip__dot is-selected"></span>Selected</span>
  `;
}

function renderNorthChart(houses, lagna){
  if(!els.northChart) return;
  const map = getHouseMap(houses);
  const activeData = getActiveData();
  const html = `
    <div class="north-chart__glow" aria-hidden="true"></div>
    <svg class="north-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x="4" y="4" width="92" height="92" class="north-frame"></rect>
      <path d="M4 4 L96 96" class="north-grid"></path>
      <path d="M96 4 L4 96" class="north-grid"></path>
      <path d="M4 50 L50 4 L96 50 L50 96 Z" class="north-grid"></path>
    </svg>
    <div class="north-layer">
      ${NORTH_HOUSE_REGIONS.map((regionCfg)=>{
        const houseNum = Number(regionCfg.house);
        const info = getHouseExperience(houseNum, activeData) || {};
        const houseData = map.get(houseNum) || null;
        const selected = houseNum === Number(kundaliState.selectedHouse);
        const planets = Array.isArray(info.planets) ? info.planets : [];
        const region = northCardStyle(regionCfg);
        return `
          <button class="north-card ${region.alignClass}${selected ? " is-selected" : ""}${houseNum === 1 ? " is-lagna" : ""}" style="${region.style}" data-house="${houseNum}" type="button" aria-label="House ${houseNum}">
            <div class="north-card__inner">
              <div class="north-card__head">
                <span class="north-card__num">H${houseNum}</span>
                <span class="north-card__sign">${escapeHtml(trRashi(info.sign || houseData?.rashi || lagna || "—"))}</span>
              </div>
              <div class="north-card__chips">
                ${planets.length ? planets.map((planet)=> buildNorthPlanetMark(planet)).join("") : `<span class="north-card__empty"></span>`}
              </div>
            </div>
          </button>
        `;
      }).join("")}
    </div>
  `;
  els.northChart.innerHTML = html;
  els.northChart.querySelectorAll(".north-card").forEach((el)=>{
    const activate = ()=>{
      const houseNum = Number(el.getAttribute("data-house"));
      if(!Number.isFinite(houseNum)) return;
      kundaliState.selectedHouse = houseNum;
      renderHousePanel();
      renderChart();
    };
    el.addEventListener("click", activate);
    el.addEventListener("keydown", (event)=>{
      if(event.key === "Enter" || event.key === " "){
        event.preventDefault();
        activate();
      }
    });
  });
}

const SOUTH_SIGN_POSITIONS = [
  // 4x4 grid; null = empty
  [0, 1, 2, 3],
  [11, null, null, 4],
  [10, null, null, 5],
  [9, 8, 7, 6],
];

function renderSouthChart(houses, lagna){
  if(!els.southChart) return;
  const houseBySign = new Map();
  (Array.isArray(houses) ? houses : []).forEach((h)=> houseBySign.set(Number(h?.rashi_index), h));
  const activeData = getActiveData();

  const lagnaSignIdx = (Array.isArray(houses) ? houses : []).find((h)=> Number(h?.house) === 1)?.rashi_index;

  const html = SOUTH_SIGN_POSITIONS.flat().map((signIdx)=>{
    if(signIdx === null){
      return `<div class="s-cell is-empty" aria-hidden="true"></div>`;
    }
    const h = houseBySign.get(signIdx) || {};
    const sign = String(h?.rashi || "—");
    const houseNum = Number(h?.house);
    const isLagna = Number(signIdx) === Number(lagnaSignIdx);
    const isSelected = Number(houseNum) === Number(kundaliState.selectedHouse);
    const info = getHouseExperience(houseNum, activeData) || {};
    const planets = Array.isArray(info.planets) ? info.planets : [];

    return `
      <div class="s-cell${isLagna ? " is-lagna" : ""}${isSelected ? " is-selected" : ""}" data-house="${Number.isFinite(houseNum) ? houseNum : ""}">
        <div class="s-top">
          <div class="s-sign">${escapeHtml(trRashi(sign))}</div>
          <div class="s-house">H${Number.isFinite(houseNum) ? houseNum : "—"}</div>
        </div>
        <div class="south-card__chips" aria-label="${escapeHtml(t("planets"))}">
          ${planets.length ? planets.slice(0, 3).map((planet)=> buildPlanetChip(planet, { compact: true })).join("") : `<div class="house-empty">${escapeHtml(houseLabel(houseNum))}</div>`}
        </div>
      </div>
    `;
  }).join("");

  els.southChart.innerHTML = html;
  els.southChart.querySelectorAll(".s-cell[data-house]").forEach((cell)=>{
    cell.onclick = ()=>{
      const houseNum = Number(cell.getAttribute("data-house"));
      if(!Number.isFinite(houseNum)) return;
      kundaliState.selectedHouse = houseNum;
      renderHousePanel();
      renderChart();
    };
  });
}

function renderHousePanel(){
  if(!els.housePanelBody || !kundaliState.data) return;
  const houseNum = kundaliState.selectedHouse || 1;
  const detail = getHouseExperience(houseNum, getActiveData());
  if(!detail){
    els.housePanelBody.innerHTML = "House not found.";
    return;
  }
  const planets = Array.isArray(detail.planets) ? detail.planets : [];
  const list = planets.map((planet)=> `
      <div class="k-planetline">
        <div class="k-planetline__sym planet-badge planet-badge--${escapeHtml(planet.style || planetStyle(planet.planet))}" aria-hidden="true">${escapeHtml(planet.glyph || "")}</div>
        <div>
          <div class="k-planetline__name">${escapeHtml(trPlanet(planet.planet || "—"))}</div>
          <div class="k-planetline__dignity">${escapeHtml(planet.dignity || "Neutral")} • ${escapeHtml(trRashi(planet.sign || "—"))}</div>
        </div>
        <div class="k-planetline__deg">${escapeHtml(planet.degree || "—")}</div>
      </div>
    `).join("");
  els.housePanelBody.innerHTML = `
    <div class="detail-console">
      <div class="detail-console__top">
        <div>
          <div class="detail-console__eyebrow">${escapeHtml(t("house"))} ${escapeHtml(String(houseNum))}</div>
          <div class="k-househead">${escapeHtml(trRashi(detail.sign || "—"))}</div>
        </div>
        <div class="detail-console__ruler">
          <span>Ruler</span>
          <strong>${escapeHtml(trPlanet(detail.signRuler || "—"))}</strong>
        </div>
      </div>
      <p class="detail-console__theme">${escapeHtml(detail.theme || "")}</p>
      <div class="detail-console__tags">
        ${(Array.isArray(detail.tags) ? detail.tags : []).map((tag)=> `<span class="detail-tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
      <div class="k-houselist">
        ${list || `<div class="k-empty">${escapeHtml(t("noPlanets"))}</div>`}
      </div>
      <div class="detail-console__footer">
        <div>
          <span>Support</span>
          <strong>${escapeHtml((detail.supportiveAspects || []).map((planet)=> trPlanet(planet)).join(", ") || "—")}</strong>
        </div>
        <div>
          <span>Pressure</span>
          <strong>${escapeHtml((detail.pressuringAspects || []).map((planet)=> trPlanet(planet)).join(", ") || "—")}</strong>
        </div>
      </div>
    </div>
  `;
}

function renderChart(){
  if(!kundaliState.data) return;
  const active = getActiveData();
  const houses = Array.isArray(active?.houses) ? active.houses : [];
  const lagna = String(active?.lagna || kundaliState.data.lagna || "—");

  if(els.chartTitle){
    const label = `${kundaliState.chart.toUpperCase()} • ${kundaliState.style === "north" ? "North Indian" : "South Indian"}`;
    els.chartTitle.textContent = label;
  }
  if(els.chartSub){
    els.chartSub.textContent = t("selectHouse");
  }
  renderChartLegend();

  if(els.northChart){
    els.northChart.classList.toggle("is-hidden", kundaliState.style !== "north");
    els.northChart.hidden = kundaliState.style !== "north";
  }
  if(els.southChart){
    els.southChart.classList.toggle("is-hidden", kundaliState.style !== "south");
    els.southChart.hidden = kundaliState.style !== "south";
  }

  if(kundaliState.style === "north"){
    renderNorthChart(houses, lagna);
  }else{
    renderSouthChart(houses, lagna);
  }

  renderHousePanel();
  renderHeatmapPanel();
}

function getMoonFromActive(){
  const active = getActiveData();
  const planets = Array.isArray(active?.planets) ? active.planets : [];
  return planets.find((p)=> String(p?.planet) === "Moon") || null;
}

function renderOverviewPane(){
  const pane = document.querySelector("#tabOverview");
  if(!pane || !kundaliState.data) return;
  const d = kundaliState.data;
  const climate = d?.experience?.planetary_climate || {};
  const heatmap = Array.isArray(d?.experience?.house_heatmap) ? d.experience.house_heatmap.slice().sort((a,b)=> Number(b.score||0) - Number(a.score||0)).slice(0,3) : [];
  const lagna = String(d.lagna || "—");
  const moon = (Array.isArray(d?.planets) ? d.planets : []).find((p)=> String(p?.planet) === "Moon") || null;
  const chandra = String(moon?.rashi || "—");
  pane.innerHTML = `
    <div class="k-section">
      <div class="k-section__title">${escapeHtml(t("overview"))}</div>
      <div class="k-overview-hero">
        <div class="k-overview-message">
          <div class="k-overview-message__kicker">Destiny console</div>
          <h3>${escapeHtml(trRashi(lagna))} rising with ${escapeHtml(String(d.nakshatra || "—"))} nakshatra.</h3>
          <p>${escapeHtml(climate.summary || "Your chart climate becomes clearer once the houses, planets, and timing cycles are read together.")}</p>
        </div>
        <div class="k-kv">
        <div class="k-kv__item"><div class="k-kv__k">${escapeHtml(t("lagna"))}</div><div class="k-kv__v">${escapeHtml(trRashi(lagna))}</div></div>
        <div class="k-kv__item"><div class="k-kv__k">Chandra Rashi</div><div class="k-kv__v">${escapeHtml(trRashi(chandra))}</div></div>
        <div class="k-kv__item"><div class="k-kv__k">${escapeHtml(t("nakshatra"))}</div><div class="k-kv__v">${escapeHtml(String(d.nakshatra))} • ${escapeHtml(t("pada"))} ${escapeHtml(String(d.nakshatra_pada))}</div></div>
        <div class="k-kv__item"><div class="k-kv__k">${escapeHtml(t("ayanamsa"))}</div><div class="k-kv__v">${escapeHtml(fmtDeg(d.ayanamsa))}</div></div>
      </div>
      </div>
      <div class="k-cards k-cards--overview">
        ${heatmap.map((item)=> `
          <div class="k-card k-card--glow ${heatToneClass(item.tone)}">
            <div class="k-card__t">House ${escapeHtml(item.house)} • ${escapeHtml(houseLabel(item.house))}</div>
            <div class="k-card__b">${escapeHtml(item.label || "")}</div>
          </div>
        `).join("")}
      </div>
      <div class="k-note">${escapeHtml(kundaliState.lang === "hi" ? "चार्ट में किसी भाव पर टैप करें — उसका विवरण कार्ड खुलेगा।" : "Tap any house in the chart to open its details card.")}</div>
    </div>
  `;
}

function renderDoshaPane(){
  const pane = document.querySelector("#tabDosha");
  if(!pane || !kundaliState.data) return;
  const items = Array.isArray(kundaliState.data?.dosha_analysis) ? kundaliState.data.dosha_analysis : [];
  pane.innerHTML = `
    <div class="k-section">
      <div class="k-section__title">${escapeHtml(t("dosha"))}</div>
      <div class="k-alerts">
        ${items.map((item)=> `
          <div class="k-alert k-alert--${severityTone(item.severity)}">
            <div class="k-alert__name">${escapeHtml(item.name || "")}</div>
            <div class="k-alert__badge">${escapeHtml(item.severity || "none")}</div>
            <div class="k-alert__desc">${escapeHtml(item.whyDetected || "")}</div>
            <div class="k-alert__desc">${escapeHtml(item.likelyThemes || "")}</div>
            <div class="k-alert__meta">${escapeHtml((item.mitigatingFactors || []).join(" • ") || "")}</div>
          </div>
        `).join("") || `<div class="k-note">No dosha pattern detected.</div>`}
      </div>
    </div>
  `;
}

function buildPredictionsHtml(){
  const active = getActiveData();
  const houses = Array.isArray(active?.houses) ? active.houses : [];
  const planets = Array.isArray(active?.planets) ? active.planets : [];

  const house = (n)=> houses.find((h)=> Number(h?.house) === Number(n)) || {};
  const planetsIn = (n)=> planets.filter((p)=> Number(p?.house) === Number(n)).map((p)=> String(p?.planet));

  const lang = kundaliState.lang === "hi" ? "hi" : "en";
  const mk = (title, body)=> `<div class="k-card"><div class="k-card__t">${escapeHtml(title)}</div><div class="k-card__b">${escapeHtml(body)}</div></div>`;

  const h1 = house(1);
  const h7 = house(7);
  const h10 = house(10);

  const p1 = planetsIn(1);
  const p7 = planetsIn(7);
  const p10 = planetsIn(10);

  const personality = lang === "hi"
    ? `${trRashi(h1.rashi)} लग्न के अनुसार आपका स्वभाव आत्मविश्वासी और विकासशील हो सकता है। भाव 1 में ${p1.length ? p1.map(trPlanet).join(", ") : "कोई प्रमुख ग्रह नहीं"} होने से व्यक्तित्व में विशेषता आती है।`
    : `With ${trRashi(h1.rashi)} rising, you may appear confident and growth-oriented. Planets in H1 (${p1.length ? p1.map(trPlanet).join(", ") : "none"}) add nuance to how you express yourself.`;

  const career = lang === "hi"
    ? `करियर भाव 10 (${trRashi(h10.rashi)}) से प्रभावित होता है। भाव 10 में ${p10.length ? p10.map(trPlanet).join(", ") : "कोई ग्रह नहीं"} — काम में पहचान, जिम्मेदारी और दिशा का संकेत देते हैं।`
    : `Career themes are shaped by H10 (${trRashi(h10.rashi)}). Planets in H10 (${p10.length ? p10.map(trPlanet).join(", ") : "none"}) indicate work style, responsibilities, and recognition.`;

  const marriage = lang === "hi"
    ? `विवाह/साझेदारी भाव 7 (${trRashi(h7.rashi)}) से देखी जाती है। भाव 7 में ${p7.length ? p7.map(trPlanet).join(", ") : "कोई ग्रह नहीं"} — संबंधों की प्रकृति पर असर डालते हैं।`
    : `Relationships are seen from H7 (${trRashi(h7.rashi)}). Planets in H7 (${p7.length ? p7.map(trPlanet).join(", ") : "none"}) influence partnership dynamics and expectations.`;

  return `${mk(lang==="hi" ? "व्यक्तित्व" : "Personality", personality)}${mk(lang==="hi" ? "करियर" : "Career", career)}${mk(lang==="hi" ? "विवाह/संबंध" : "Marriage", marriage)}`;
}

function renderPredictionsPane(){
  const pane = document.querySelector("#tabPredictions");
  if(!pane || !kundaliState.data) return;
  const dashaExp = kundaliState.data?.dasha_experience || {};
  const current = dashaExp?.current_summary || {};
  const climate = kundaliState.data?.experience?.planetary_climate || {};
  pane.innerHTML = `
    <div class="k-section">
      <div class="k-section__title">${escapeHtml(t("predictions"))}</div>
      <div class="k-cards">
        ${buildPredictionsHtml()}
        <div class="k-card">
          <div class="k-card__t">Current period tone</div>
          <div class="k-card__b">${escapeHtml(current.periodTone || "Timing becomes clearer once the current Mahadasha and Antardasha are active.")}</div>
        </div>
        <div class="k-card">
          <div class="k-card__t">Career focus now</div>
          <div class="k-card__b">${escapeHtml(current.career || "Career themes are read through the houses activated by the period lords.")}</div>
        </div>
        <div class="k-card">
          <div class="k-card__t">Relationship atmosphere</div>
          <div class="k-card__b">${escapeHtml(current.relationships || "Relationships are influenced by the current dasha climate and house support.")}</div>
        </div>
        <div class="k-card">
          <div class="k-card__t">Planetary climate</div>
          <div class="k-card__b">${escapeHtml(climate.summary || "Planetary support and pressure help explain where life feels smooth or effortful.")}</div>
        </div>
      </div>
    </div>
  `;
}

function buildRemediesHtml(){
  const lang = kundaliState.lang === "hi" ? "hi" : "en";
  const items = lang === "hi"
    ? [
        { t: "मंत्र", b: "ॐ नमः शिवाय (108 जप), सोमवार या शनिवार।" },
        { t: "दान", b: "शनिवार को काला तिल/उड़द/कंबल दान (क्षमता अनुसार)।" },
        { t: "पाठ", b: "हनुमान चालीसा मंगलवार/शनिवार, यदि मंगल/राहु प्रभाव अधिक हो।" },
      ]
    : [
        { t: "Mantra", b: "Chant “Om Namah Shivaya” (108 times), on Monday/Saturday." },
        { t: "Charity", b: "On Saturday, donate black sesame/blanket as per capacity." },
        { t: "Recitation", b: "Hanuman Chalisa on Tue/Sat if Mars/Rahu influence feels strong." },
      ];
  const cards = items.map((x)=> `<div class="k-card"><div class="k-card__t">${escapeHtml(x.t)}</div><div class="k-card__b">${escapeHtml(x.b)}</div></div>`).join("");
  const note = lang === "hi"
    ? "नोट: ये सामान्य उपाय हैं। व्यक्तिगत परामर्श के लिए अनुभवी ज्योतिषी से सलाह लें।"
    : "Note: These are general remedies. For personalized guidance, consult an experienced astrologer.";
  return `<div class="k-cards">${cards}</div><div class="k-note" style="margin-top:.65rem;">${escapeHtml(note)}</div>`;
}

function renderRemediesPane(){
  const pane = document.querySelector("#tabRemedies");
  if(!pane || !kundaliState.data) return;
  const remedies = Array.isArray(kundaliState.data?.remedies_analysis) ? kundaliState.data.remedies_analysis : [];
  pane.innerHTML = `
    <div class="k-section">
      <div class="k-section__title">${escapeHtml(t("remedies"))}</div>
      <div class="k-cards">
        ${remedies.map((item)=> `
          <div class="k-card k-card--remedy">
            <div class="k-card__eyebrow">${escapeHtml(item.category || "")}</div>
            <div class="k-card__t">${escapeHtml(item.title || "")}</div>
            <div class="k-card__b">${escapeHtml(item.why || "")}</div>
            <div class="k-card__footer">
              <span>${escapeHtml(item.target || "")}</span>
              <span>${escapeHtml(item.frequency || "")}</span>
            </div>
          </div>
        `).join("") || buildRemediesHtml()}
      </div>
    </div>
  `;
}

function renderExtraPanes(){
  renderOverviewPane();
  renderDoshaPane();
  renderPredictionsPane();
  renderRemediesPane();
}

function hydrateAll(){
  renderStaticLabels();
  renderSummary();
  renderPhaseShift();
  renderPlanetClimate();
  renderChart();
  renderPlanetTable();
  renderDasha();
  renderExtraPanes();
  setState({loading:false, error:null, ready:true});
}

function qs(params){
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k,v])=> s.set(k, String(v)));
  return s.toString();
}

async function fetchKundali({ date, time, lat, lon, tz }){
  const url = `${API_URL}?${qs({ date, time, lat, lon, tz })}`;
  const res = await fetch(url, { headers: { Accept:"application/json" }});
  const text = await res.text();
  let data = null;
  try{ data = JSON.parse(text); }catch{}
  if(!res.ok){
    throw new Error(String(data?.error || text || `API error ${res.status}`));
  }
  if(data?.error) throw new Error(String(data.error));
  return data;
}

function loadSavedInputs(){
  try{
    const raw = localStorage.getItem("sms_kundali_inputs");
    if(!raw) return;
    const j = JSON.parse(raw);
    if(els.dob && j.dob) els.dob.value = String(j.dob);
    if(els.tob && j.tob) els.tob.value = String(j.tob);
    if(els.place && j.place) els.place.value = String(j.place);
    if(els.lat && j.lat) els.lat.value = String(j.lat);
    if(els.lon && j.lon) els.lon.value = String(j.lon);
    if(els.tz && j.tz) els.tz.value = String(j.tz);
  }catch{}
}

function saveInputs(){
  try{
    localStorage.setItem("sms_kundali_inputs", JSON.stringify({
      dob: els.dob?.value || "",
      tob: els.tob?.value || "",
      place: els.place?.value || "",
      lat: els.lat?.value || "",
      lon: els.lon?.value || "",
      tz: els.tz?.value || "",
    }));
  }catch{}
}

async function detectTimezone(lat, lon){
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=auto`;
    const res = await fetch(url);
    if(!res.ok) return null;
    const j = await res.json();
    return typeof j?.timezone === "string" ? j.timezone : null;
  }catch{
    return null;
  }
}

async function useCurrentLocation(){
  if(!navigator.geolocation){
    alert("Geolocation not supported.");
    return;
  }
  navigator.geolocation.getCurrentPosition(async (pos)=>{
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    if(els.lat) els.lat.value = String(lat.toFixed(5));
    if(els.lon) els.lon.value = String(lon.toFixed(5));
    const tzName = await detectTimezone(lat, lon);
    if(els.tz) els.tz.value = tzName || getBrowserTz();
    saveInputs();
  }, ()=>{
    alert("Location permission denied.");
  }, { enableHighAccuracy: true, timeout: 12000 });
}

async function generate(){
  const dob = String(els.dob?.value || "").trim();
  const tob = String(els.tob?.value || "").trim();
  const lat = Number(els.lat?.value);
  const lon = Number(els.lon?.value);
  const tz = String(els.tz?.value || getBrowserTz()).trim() || getBrowserTz();

  if(!dob || !tob){
    setState({loading:false, error:"Please enter date and time of birth.", ready:false});
    return;
  }
  if(!Number.isFinite(lat) || !Number.isFinite(lon)){
    setState({loading:false, error:"Please enter valid latitude and longitude.", ready:false});
    return;
  }

  saveInputs();
  setState({loading:true, error:null, ready:false});

  try{
    const data = await fetchKundali({ date: dob, time: tob, lat, lon, tz });
    const currentChart = kundaliState.chart;
    const currentStyle = kundaliState.style;
    kundaliState.data = data;
    kundaliState.chart = currentChart === "d9" ? "d9" : "d1";
    kundaliState.style = currentStyle === "south" ? "south" : "north";
    kundaliState.selectedHouse = 1;
    setActiveToggle("chart", kundaliState.chart);
    setActiveToggle("style", kundaliState.style);
    setActiveToggle("lang", kundaliState.lang);
    setActiveTab("overview");
    hydrateAll();
  }catch(err){
    setState({loading:false, error:String(err?.message || err), ready:false});
  }
}

function initToggles(){
  document.querySelectorAll(".k-toggle__btn[data-chart]").forEach((btn)=>{
    btn.addEventListener("click", ()=>{
      const v = btn.getAttribute("data-chart");
      if(v !== "d1" && v !== "d9") return;
      kundaliState.chart = v;
      setActiveToggle("chart", v);
      renderChart();
      renderPlanetTable();
      renderDasha();
      renderExtraPanes();
    });
  });
  document.querySelectorAll(".k-toggle__btn[data-style]").forEach((btn)=>{
    btn.addEventListener("click", ()=>{
      const v = btn.getAttribute("data-style");
      if(v !== "north" && v !== "south") return;
      kundaliState.style = v;
      setActiveToggle("style", v);
      renderChart();
    });
  });

  document.querySelectorAll(".k-toggle__btn[data-lang]").forEach((btn)=>{
    btn.addEventListener("click", ()=>{
      const v = btn.getAttribute("data-lang");
      if(v !== "en" && v !== "hi") return;
      kundaliState.lang = v;
      try{ localStorage.setItem("sms_kundali_lang", v); }catch{}
      setActiveToggle("lang", v);
      if(kundaliState.data) hydrateAll();
    });
  });

  document.querySelectorAll(".k-tab__btn[data-tab]").forEach((btn)=>{
    btn.addEventListener("click", ()=>{
      const v = btn.getAttribute("data-tab");
      if(!v) return;
      setActiveTab(v);
    });
  });
}

function initDefaults(){
  const params = new URLSearchParams(window.location.search);
  if(els.dob && !els.dob.value) els.dob.value = isoToday();
  if(els.tz && !els.tz.value) els.tz.value = getBrowserTz();
  if(els.lat && !els.lat.value) els.lat.value = "28.6139";
  if(els.lon && !els.lon.value) els.lon.value = "77.2090";
  if(els.tob && !els.tob.value) els.tob.value = isoNowTime();
  if(els.dob && params.get("dob")) els.dob.value = String(params.get("dob"));
  if(els.tob && params.get("tob")) els.tob.value = String(params.get("tob"));
  if(els.place && params.get("place")) els.place.value = String(params.get("place"));
  if(els.lat && params.get("lat")) els.lat.value = String(params.get("lat"));
  if(els.lon && params.get("lon")) els.lon.value = String(params.get("lon"));
  if(els.tz && params.get("tz")) els.tz.value = String(params.get("tz"));
}

function setInputsToNow(){
  if(els.dob) els.dob.value = isoToday();
  if(els.tob) els.tob.value = isoNowTime();
}

function init(){
  try{
    const lang = localStorage.getItem("sms_kundali_lang");
    if(lang === "hi" || lang === "en") kundaliState.lang = lang;
  }catch{}
  loadSavedInputs();
  initDefaults();
  initHeroVideo();
  initToggles();
  if(els.useCurrentBtn) els.useCurrentBtn.addEventListener("click", useCurrentLocation);
  if(els.todayBtn) els.todayBtn.addEventListener("click", ()=>{
    setInputsToNow();
    generate();
  });
  if(els.seeHoroscopeBtn) {
    els.seeHoroscopeBtn.addEventListener("click", ()=>{
      const params = new URLSearchParams({
        dob: String(els.dob?.value || ""),
        tob: String(els.tob?.value || ""),
        place: String(els.place?.value || ""),
        lat: String(els.lat?.value || ""),
        lon: String(els.lon?.value || ""),
        tz: String(els.tz?.value || ""),
        year: "2026",
      });
      window.location.href = `/horoscope/?${params.toString()}`;
    });
  }
  if(els.generateBtn) els.generateBtn.addEventListener("click", generate);
  setActiveToggle("lang", kundaliState.lang);
  setActiveTab("overview");
  renderStaticLabels();
  setInputsToNow();
  generate();
}

init();
