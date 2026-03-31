const API_URL = "/api/kundali";

const els = {
  root: document.querySelector("#kundaliRoot"),

  dob: document.querySelector("#dobInput"),
  tob: document.querySelector("#tobInput"),
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

  const sidePlanetsTitle = document.querySelector("#planetPanelSide .k-panel__title");
  if(sidePlanetsTitle) sidePlanetsTitle.textContent = t("planetsTab");

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
  const chips = [
    `${t("lagna")}: ${trRashi(d.lagna)}`,
    `${t("nakshatra")}: ${String(d.nakshatra)} (${t("pada")} ${String(d.nakshatra_pada)})`,
    `${t("ayanamsa")}: ${fmtDeg(d.ayanamsa)}`,
    `${t("dob")}: ${String(input.date || "")} ${String(input.time || "")}`,
  ];
  els.summaryChips.innerHTML = chips.map((c)=> `<span class="chip">${escapeHtml(c)}</span>`).join("");
}

function buildPlanetTableRows(planets){
  const rows = planets.map((p)=>{
    const name = String(p?.planet || "—");
    const sym = String(p?.symbol || "");
    const rashi = String(p?.rashi || "—");
    const house = Number(p?.house);
    const degIn = fmtDeg(p?.degree_in_sign ?? (Number(p?.degree) % 30));
    return `
      <div class="k-row">
        <div class="k-row__l">
          <div class="k-row__sym" aria-hidden="true">${escapeHtml(sym)}</div>
          <div class="k-row__name">${escapeHtml(trPlanet(name))}</div>
        </div>
        <div class="k-row__meta">${escapeHtml(trRashi(rashi))} • ${escapeHtml(t("house"))}${Number.isFinite(house) ? house : "—"} • ${escapeHtml(degIn)}</div>
      </div>
    `;
  }).join("");
  return rows || `<div class="k-panel__body">No planets found.</div>`;
}

function renderPlanetTable(){
  if(!kundaliState.data) return;
  const active = getActiveData();
  const planets = Array.isArray(active?.planets) ? active.planets : (kundaliState.chart === "d1" ? kundaliState.data.planets : []);
  const html = buildPlanetTableRows(planets);
  if(els.planetTable) els.planetTable.innerHTML = html;
  if(els.planetTableSide) els.planetTableSide.innerHTML = html;
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

function planetKind(name){
  return PLANET_KIND[String(name)] || "neutral";
}

function renderDasha(){
  if(!els.dashaList || !kundaliState.data) return;
  const dasha = Array.isArray(kundaliState.data?.dasha) ? kundaliState.data.dasha : [];
  const items = dasha.slice(0, 9).map((x)=>{
    const name = String(x?.planet || "—");
    const years = Number(x?.years);
    const start = String(x?.start || "");
    const end = String(x?.end || "");
    const range = start && end ? `${shortDt(start)} → ${shortDt(end)}` : "—";
    return `
      <div class="dasha-item">
        <div class="dasha-item__name">${escapeHtml(trPlanet(name))}${Number.isFinite(years) ? ` • ${years.toFixed(2)}y` : ""}</div>
        <div class="dasha-item__range">${escapeHtml(range)}</div>
      </div>
    `;
  }).join("");
  els.dashaList.innerHTML = items || `<div class="k-panel__body">Dasha not available.</div>`;
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

function renderNorthChart(houses, lagna){
  if(!els.northChart) return;
  const map = getHouseMap(houses);
  const active = getActiveData();
  const planetsByHouse = getPlanetsByHouse(active);
  const svg = `
    <svg class="north-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-label="North Indian Kundali chart">
      <rect x="4" y="4" width="92" height="92" class="north-frame"></rect>
      <path d="M4 4 L96 96" class="north-grid"></path>
      <path d="M96 4 L4 96" class="north-grid"></path>
      <path d="M4 50 L50 4 L96 50 L50 96 Z" class="north-grid"></path>
      ${NORTH_HOUSE_REGIONS.map((config)=>{
        const houseNum = Number(config.house);
        const houseData = map.get(houseNum) || null;
        const planets = planetsByHouse.get(houseNum) || [];
        const sign = String(houseData?.rashi || "—");
        const selected = houseNum === Number(kundaliState.selectedHouse);
        const lagnaHouse = houseNum === 1;
        return `
          <g class="north-region${selected ? " is-selected" : ""}${lagnaHouse ? " is-lagna" : ""}" data-house="${houseNum}" role="button" tabindex="0" aria-label="House ${houseNum}">
            <polygon points="${config.points}" class="north-region__fill"></polygon>
            <polygon points="${config.points}" class="north-region__hit"></polygon>
            <text x="${config.corner.x}" y="${config.corner.y}" text-anchor="${config.anchor}" class="north-sign-num">${houseNum}</text>
            ${buildNorthPlanetContent(planets, config)}
          </g>
        `;
      }).join("")}
    </svg>
  `;
  els.northChart.innerHTML = svg;
  els.northChart.querySelectorAll(".north-region").forEach((el)=>{
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
  const active = getActiveData();
  const planetsByHouse = getPlanetsByHouse(active);
  const houseBySign = new Map();
  (Array.isArray(houses) ? houses : []).forEach((h)=> houseBySign.set(Number(h?.rashi_index), h));

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
    const planets = planetsByHouse.get(houseNum) || [];
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
      <div class="s-cell${isLagna ? " is-lagna" : ""}${isSelected ? " is-selected" : ""}" data-house="${Number.isFinite(houseNum) ? houseNum : ""}">
        <div class="s-top">
          <div class="s-sign">${escapeHtml(trRashi(sign))}</div>
          <div class="s-house">H${Number.isFinite(houseNum) ? houseNum : "—"}</div>
        </div>
        <div class="house-lines" aria-label="${escapeHtml(t("planets"))}">${planetLines}</div>
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
  const active = getActiveData();
  const houses = Array.isArray(active?.houses) ? active.houses : [];
  const planets = Array.isArray(active?.planets) ? active.planets : [];
  const houseNum = kundaliState.selectedHouse || 1;
  const h = houses.find((x)=> Number(x?.house) === Number(houseNum)) || null;
  if(!h){
    els.housePanelBody.innerHTML = "House not found.";
    return;
  }
  const sign = String(h?.rashi || "—");
  const inHouse = planets.filter((p)=> Number(p?.house) === Number(houseNum));
  const list = inHouse.map((p)=>{
    const nm = String(p?.planet || "—");
    const sym = String(p?.symbol || "");
    const degIn = fmtDeg(p?.degree_in_sign ?? (Number(p?.degree) % 30));
    const cls = planetKind(nm);
    return `
      <div class="k-planetline">
        <div class="k-planetline__sym planet-badge planet-badge--${escapeHtml(cls)}" aria-hidden="true">${escapeHtml(sym)}</div>
        <div class="k-planetline__name">${escapeHtml(trPlanet(nm))}</div>
        <div class="k-planetline__deg">${escapeHtml(degIn)}</div>
      </div>
    `;
  }).join("");
  els.housePanelBody.innerHTML = `
    <div class="k-panel__body">
      <div class="k-househead">${escapeHtml(t("house"))} ${escapeHtml(String(houseNum))} • ${escapeHtml(trRashi(sign))}</div>
      <div class="k-houselist">
        ${list || `<div class="k-empty">${escapeHtml(t("noPlanets"))}</div>`}
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
  const active = getActiveData();
  const lagna = String(active?.lagna || d.lagna || "—");
  const moon = getMoonFromActive();
  const chandra = String(moon?.rashi || "—");
  pane.innerHTML = `
    <div class="k-section">
      <div class="k-section__title">${escapeHtml(t("overview"))}</div>
      <div class="k-kv">
        <div class="k-kv__item"><div class="k-kv__k">${escapeHtml(t("lagna"))}</div><div class="k-kv__v">${escapeHtml(trRashi(lagna))}</div></div>
        <div class="k-kv__item"><div class="k-kv__k">Chandra Rashi</div><div class="k-kv__v">${escapeHtml(trRashi(chandra))}</div></div>
        <div class="k-kv__item"><div class="k-kv__k">${escapeHtml(t("nakshatra"))}</div><div class="k-kv__v">${escapeHtml(String(d.nakshatra))} • ${escapeHtml(t("pada"))} ${escapeHtml(String(d.nakshatra_pada))}</div></div>
        <div class="k-kv__item"><div class="k-kv__k">${escapeHtml(t("ayanamsa"))}</div><div class="k-kv__v">${escapeHtml(fmtDeg(d.ayanamsa))}</div></div>
      </div>
      <div class="k-note">${escapeHtml(kundaliState.lang === "hi" ? "चार्ट में किसी भाव पर टैप करें — उसका विवरण कार्ड खुलेगा।" : "Tap any house in the chart to open its details card.")}</div>
    </div>
  `;
}

function buildDoshaHtml(){
  const d1 = getD1Data();
  const planets = Array.isArray(d1?.planets) ? d1.planets : [];
  if(!planets.length) return "";

  const getPlanet = (name)=> planets.find((p)=> String(p?.planet) === name) || null;
  const mars = getPlanet("Mars");
  const moon = getPlanet("Moon");
  const venus = getPlanet("Venus");
  const saturn = getPlanet("Saturn");
  const rahu = getPlanet("Rahu");
  const ketu = getPlanet("Ketu");

  const relHouseFromSign = (refSignIdx, targetSignIdx)=>{
    const a = Number(refSignIdx);
    const b = Number(targetSignIdx);
    if(!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return ((b - a + 12) % 12) + 1;
  };

  const manglikHouses = new Set([1, 2, 4, 7, 8, 12]);
  const lagnaManglik = Number(mars?.house);
  const moonManglik = relHouseFromSign(moon?.rashi_index, mars?.rashi_index);
  const venusManglik = relHouseFromSign(venus?.rashi_index, mars?.rashi_index);
  const manglikRefs = [];
  if(Number.isFinite(lagnaManglik) && manglikHouses.has(lagnaManglik)) manglikRefs.push(`Lagna ${t("house")}${lagnaManglik}`);
  if(Number.isFinite(moonManglik) && manglikHouses.has(moonManglik)) manglikRefs.push(`Moon ${t("house")}${moonManglik}`);
  if(Number.isFinite(venusManglik) && manglikHouses.has(venusManglik)) manglikRefs.push(`Venus ${t("house")}${venusManglik}`);
  const hasManglik = manglikRefs.length > 0;
  const hasManglikException = new Set(["Mesha", "Vrischika", "Makara"]).has(String(mars?.rashi || ""));

  const inArc = (lon, start, end)=>{
    lon = ((lon % 360) + 360) % 360;
    start = ((start % 360) + 360) % 360;
    end = ((end % 360) + 360) % 360;
    if(start <= end) return lon >= start && lon <= end;
    return lon >= start || lon <= end;
  };
  const classical = planets.filter((p)=> ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn"].includes(String(p?.planet)));
  const rahuLon = Number(rahu?.degree);
  const ketuLon = Number(ketu?.degree);
  let kaalDir = "";
  if(Number.isFinite(rahuLon) && Number.isFinite(ketuLon) && classical.length === 7){
    const rahuToKetu = classical.every((p)=> inArc(Number(p.degree), rahuLon, ketuLon));
    const ketuToRahu = classical.every((p)=> inArc(Number(p.degree), ketuLon, rahuLon));
    if(rahuToKetu) kaalDir = kundaliState.lang === "hi" ? "राहु से केतु" : "Rahu to Ketu";
    if(ketuToRahu) kaalDir = kundaliState.lang === "hi" ? "केतु से राहु" : "Ketu to Rahu";
  }

  const saturnHouse = Number(saturn?.house);
  const saturnFromMoon = relHouseFromSign(moon?.rashi_index, saturn?.rashi_index);
  const hasShaniDosha =
    (Number.isFinite(saturnHouse) && [1, 4, 7, 8, 10].includes(saturnHouse)) ||
    (Number.isFinite(saturnFromMoon) && [1, 4, 7, 8].includes(saturnFromMoon));

  const items = [];
  if(hasManglik){
    items.push({
      name: kundaliState.lang === "hi" ? "मांगलिक दोष" : "Manglik Dosha",
      detail: `${manglikRefs.join(" • ")}${hasManglikException ? (kundaliState.lang === "hi" ? " • संभावित अपवाद राशि" : " • possible sign exception") : ""}`,
    });
  }
  if(kaalDir){
    items.push({
      name: kundaliState.lang === "hi" ? "कालसर्प दोष" : "Kaal Sarp Dosha",
      detail: kundaliState.lang === "hi" ? `सभी 7 ग्रह ${kaalDir} अक्ष में आते हैं।` : `All 7 classical planets fall on the ${kaalDir} axis.`,
    });
  }
  if(hasShaniDosha){
    items.push({
      name: kundaliState.lang === "hi" ? "शनि प्रभाव" : "Shani Dosha",
      detail: kundaliState.lang === "hi" ? "शनि संवेदनशील भाव या चंद्र संबंध में है।" : "Saturn is placed in a sensitive house or Moon-linked position.",
    });
  }

  if(!items.length) return "";

  return `
    <div class="k-alerts">
      ${items.map((x)=> `
        <div class="k-alert k-alert--warn">
          <div class="k-alert__name">${escapeHtml(x.name)}</div>
          <div class="k-alert__desc">${escapeHtml(x.detail)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderDoshaPane(){
  const pane = document.querySelector("#tabDosha");
  if(!pane || !kundaliState.data) return;
  const doshaHtml = buildDoshaHtml();
  pane.innerHTML = `
    <div class="k-section">
      ${doshaHtml ? `<div class="k-section__title">${escapeHtml(t("dosha"))}</div>${doshaHtml}` : ""}
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

  return `<div class="k-cards">${mk(lang==="hi" ? "व्यक्तित्व" : "Personality", personality)}${mk(lang==="hi" ? "करियर" : "Career", career)}${mk(lang==="hi" ? "विवाह/संबंध" : "Marriage", marriage)}</div>`;
}

function renderPredictionsPane(){
  const pane = document.querySelector("#tabPredictions");
  if(!pane || !kundaliState.data) return;
  pane.innerHTML = `
    <div class="k-section">
      <div class="k-section__title">${escapeHtml(t("predictions"))}</div>
      ${buildPredictionsHtml()}
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
  pane.innerHTML = `
    <div class="k-section">
      <div class="k-section__title">${escapeHtml(t("remedies"))}</div>
      ${buildRemediesHtml()}
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
