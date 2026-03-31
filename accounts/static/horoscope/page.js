import { fetchHoroscope, getBrowserTimezone, readQueryDefaults, useCurrentLocation } from "./astro-engine.js";
import { averageEnergy, normalizeScopes } from "./prediction-generator.js";
import {
  renderAdvice,
  renderCosmicMessage,
  renderDetails,
  renderLucky,
  renderNatalSummary,
  renderScores,
  renderSummary,
  renderTabs,
  renderTimeline,
} from "./ui-components.js";

const els = {
  date: document.querySelector("#hDate"),
  time: document.querySelector("#hTime"),
  lat: document.querySelector("#hLat"),
  lon: document.querySelector("#hLon"),
  tz: document.querySelector("#hTz"),
  year: document.querySelector("#hYear"),
  loading: document.querySelector("#horoscopeLoading"),
  error: document.querySelector("#horoscopeError"),
  results: document.querySelector("#horoscopeResults"),
  generateBtn: document.querySelector("#generateHoroscopeBtn"),
  useCurrentBtn: document.querySelector("#horoscopeUseCurrent"),
  backToKundaliBtn: document.querySelector("#backToKundaliBtn"),
  tabs: document.querySelector("#scopeTabs"),
  natalSummary: document.querySelector("#natalSummary"),
  cosmicMessageCard: document.querySelector("#cosmicMessageCard"),
  scopeSummary: document.querySelector("#scopeSummary"),
  scoreCard: document.querySelector("#scoreCard"),
  detailsCard: document.querySelector("#detailsCard"),
  adviceCard: document.querySelector("#adviceCard"),
  luckyCard: document.querySelector("#luckyCard"),
  timelineCard: document.querySelector("#timelineCard"),
  energyMeterValue: document.querySelector("#energyMeterValue"),
};

const state = {
  payload: null,
  activeScope: "daily",
};

function setUiState({ loading = false, error = "" } = {}) {
  if (els.loading) els.loading.hidden = !loading;
  if (els.error) {
    els.error.hidden = !error;
    els.error.textContent = error;
  }
  if (els.results) els.results.hidden = loading || !!error || !state.payload;
}

function fillDefaults() {
  const defaults = readQueryDefaults();
  const now = new Date();
  if (els.date && !els.date.value) els.date.value = defaults.date || now.toISOString().slice(0, 10);
  if (els.time && !els.time.value) els.time.value = defaults.time || `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (els.lat && !els.lat.value) els.lat.value = defaults.lat || "28.6139";
  if (els.lon && !els.lon.value) els.lon.value = defaults.lon || "77.2090";
  if (els.tz && !els.tz.value) els.tz.value = defaults.tz || getBrowserTimezone();
  if (els.year && !els.year.value) els.year.value = defaults.year || "2026";
}

function renderActiveScope() {
  if (!state.payload) return;
  const scopes = normalizeScopes(state.payload);
  const active = scopes.find((item) => item.key === state.activeScope) || scopes[0];
  if (!active) return;

  renderTabs(els.tabs, scopes, active.key);
  renderNatalSummary(els.natalSummary, state.payload.natal);
  renderCosmicMessage(els.cosmicMessageCard, active.data);
  renderSummary(els.scopeSummary, active.data);
  renderScores(els.scoreCard, active.data);
  renderDetails(els.detailsCard, active.data);
  renderAdvice(els.adviceCard, active.data);
  renderLucky(els.luckyCard, active.data);
  renderTimeline(els.timelineCard, active.data);
  if (els.energyMeterValue) els.energyMeterValue.textContent = `${averageEnergy(active.data.scores)}%`;

  els.tabs.querySelectorAll("[data-scope]").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.activeScope = tab.getAttribute("data-scope") || "daily";
      renderActiveScope();
    });
  });
}

async function generateHoroscope() {
  const payload = {
    date: els.date.value,
    time: els.time.value,
    lat: els.lat.value,
    lon: els.lon.value,
    tz: els.tz.value,
    year: els.year.value,
  };
  setUiState({ loading: true, error: "" });
  try {
    state.payload = await fetchHoroscope(payload);
    state.activeScope = "daily";
    setUiState({ loading: false, error: "" });
    renderActiveScope();
  } catch (error) {
    state.payload = null;
    setUiState({ loading: false, error: String(error.message || error) });
  }
}

function bindEvents() {
  if (els.generateBtn) els.generateBtn.addEventListener("click", generateHoroscope);
  if (els.useCurrentBtn) {
    els.useCurrentBtn.addEventListener("click", async () => {
      try {
        const coords = await useCurrentLocation();
        els.lat.value = coords.lat;
        els.lon.value = coords.lon;
        els.tz.value = getBrowserTimezone();
      } catch (error) {
        setUiState({ loading: false, error: String(error.message || error) });
      }
    });
  }
  if (els.backToKundaliBtn) {
    els.backToKundaliBtn.addEventListener("click", () => {
      const params = new URLSearchParams({
        dob: els.date.value,
        tob: els.time.value,
        lat: els.lat.value,
        lon: els.lon.value,
        tz: els.tz.value,
      });
      window.location.href = `/kundali/?${params.toString()}`;
    });
  }
}

fillDefaults();
bindEvents();
generateHoroscope();
