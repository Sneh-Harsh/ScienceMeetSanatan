import {
  fetchHoroscope,
  fetchHoroscopeSummary,
  getBrowserTimezone,
  getSavedBirthProfile,
  readQueryDefaults,
  saveBirthProfile,
  searchPlaces,
  useCurrentLocation,
} from "./astro-engine.js";
import {
  averageEnergy,
  buildFocusPreview,
  buildHeroSignals,
  buildPromptSuggestions,
  confidenceFromScope,
  formatPlaceSummary,
  normalizeScopes,
} from "./prediction-generator.js";
import {
  renderAdvice,
  renderCosmicMessage,
  renderDetails,
  renderFocusPreview,
  renderHeroChips,
  renderHeroSignals,
  renderLucky,
  renderNatalSummary,
  renderOracleHistory,
  renderOracleConversation,
  renderPromptChips,
  renderSavedProfile,
  renderScores,
  renderTabs,
  renderTimeline,
  renderPeriodSummary,
} from "./ui-components.js";
import { getOracleHistory, saveOracleHistory, streamOracleAnswer } from "./oracle-client.js";

const els = {
  page: document.querySelector("#horoscopePage"),
  heroSection: document.querySelector("#heroSection"),
  heroParticles: document.querySelector("#heroParticles"),
  heroRevealBtn: document.querySelector("#heroRevealBtn"),
  heroOracleBtn: document.querySelector("#heroOracleBtn"),
  ambientToggleBtn: document.querySelector("#ambientToggleBtn"),
  cursorBloom: document.querySelector("#cursorBloom"),
  heroGreeting: document.querySelector("#heroGreeting"),
  heroClock: document.querySelector("#heroClock"),
  heroWeather: document.querySelector("#heroWeather"),
  heroLocation: document.querySelector("#heroLocation"),
  heroSignalTiles: document.querySelector("#heroSignalTiles"),
  heroChipRow: document.querySelector("#heroChipRow"),
  energyMeterValue: document.querySelector("#energyMeterValue"),
  date: document.querySelector("#hDate"),
  time: document.querySelector("#hTime"),
  place: document.querySelector("#hPlace"),
  placeResults: document.querySelector("#hPlaceResults"),
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
  savedProfileCard: document.querySelector("#savedProfileCard"),
  focusPreviewCard: document.querySelector("#focusPreviewCard"),
  tabs: document.querySelector("#scopeTabs"),
  natalSummary: document.querySelector("#natalSummary"),
  cosmicMessageCard: document.querySelector("#cosmicMessageCard"),
  scopeSummary: document.querySelector("#scopeSummary"),
  scoreCard: document.querySelector("#scoreCard"),
  detailsCard: document.querySelector("#detailsCard"),
  adviceCard: document.querySelector("#adviceCard"),
  luckyCard: document.querySelector("#luckyCard"),
  timingLensCard: document.querySelector("#timingLensCard"),
  timingMiniCard: document.querySelector("#timingMiniCard"),
  periodMeta: document.querySelector("#periodMeta"),
  oracleForm: document.querySelector("#oracleForm"),
  oracleQuestion: document.querySelector("#oracleQuestion"),
  oracleSubmitBtn: document.querySelector("#oracleSubmitBtn"),
  oracleClearBtn: document.querySelector("#oracleClearBtn"),
  oracleProfileStatus: document.querySelector("#oracleProfileStatus"),
  oracleProfileMeta: document.querySelector("#oracleProfileMeta"),
  oraclePromptChips: document.querySelector("#oraclePromptChips"),
  oracleTypingDot: document.querySelector("#oracleTypingDot"),
  oracleHistory: document.querySelector("#oracleHistory"),
  oracleConversation: document.querySelector("#oracleConversation"),
};

const state = {
  payload: null,
  activeScope: "daily",
  placeTimer: 0,
  lastPlaceQuery: "",
  oracleHistory: [],
  profile: null,
  aiSummaries: {},
  activeSummaryRequestId: 0,
  suppressPlaceFocusUntil: 0,
  oracleConversation: [],
};

function normalizeOracleEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const question = String(entry.question || "").trim();
  if (!question) return null;
  const answer = entry.answer && typeof entry.answer === "object"
    ? entry.answer
    : {
        directAnswer: String(entry.directAnswer || "").trim(),
        chartBasis: String(entry.chartBasis || "").trim(),
        cautions: String(entry.cautions || "").trim(),
        bestTiming: String(entry.bestTiming || "").trim(),
        remedy: String(entry.remedy || "").trim(),
      };
  return {
    question,
    answer,
    createdAt: entry.createdAt || new Date().toISOString(),
  };
}

function getDisplayName() {
  const raw = String(els.page?.dataset.displayName || "").trim();
  return raw || "Seeker";
}

function updateOracleProfileState() {
  const hasBirthCore = Boolean(state.profile?.date && state.profile?.time);
  if (els.oracleProfileStatus) {
    els.oracleProfileStatus.textContent = hasBirthCore ? "Birth profile ready" : "Waiting for birth profile";
  }
  if (els.oracleProfileMeta) {
    if (!hasBirthCore) {
      els.oracleProfileMeta.textContent = "Add your date and time of birth to begin.";
      return;
    }
    const parts = [
      state.profile.date,
      state.profile.time,
      state.profile.place || "",
    ].filter(Boolean);
    const dasha = state.payload?.daily ? `${state.payload.daily.mahadasha} Mahadasha` : "";
    els.oracleProfileMeta.textContent = [parts.join(" • "), dasha].filter(Boolean).join(" · ");
  }
}

function setUiState({ loading = false, error = "" } = {}) {
  if (els.loading) els.loading.hidden = !loading;
  if (els.error) {
    els.error.hidden = !error;
    els.error.textContent = error;
  }
  if (els.results) {
    els.results.hidden = loading || Boolean(error) || !state.payload;
  }
}

function collectProfile() {
  return {
    date: els.date?.value || "",
    time: els.time?.value || "",
    place: els.place?.value || "",
    lat: els.lat?.value || "",
    lon: els.lon?.value || "",
    tz: els.tz?.value || "",
    year: els.year?.value || "2026",
  };
}

function fillDefaults() {
  const query = readQueryDefaults();
  const saved = getSavedBirthProfile() || {};
  const now = new Date();

  const chosenDate = query.date || saved.date || now.toISOString().slice(0, 10);
  const chosenTime = query.time || saved.time || `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const chosenPlace = query.place || saved.place || "New Delhi, India";
  const chosenLat = query.lat || saved.lat || "28.6139";
  const chosenLon = query.lon || saved.lon || "77.2090";
  const chosenTz = query.tz || saved.tz || getBrowserTimezone();
  const chosenYear = query.year || saved.year || "2026";

  if (els.date) els.date.value = chosenDate;
  if (els.time) els.time.value = chosenTime;
  if (els.place) els.place.value = chosenPlace;
  if (els.lat) els.lat.value = chosenLat;
  if (els.lon) els.lon.value = chosenLon;
  if (els.tz) els.tz.value = chosenTz;
  if (els.year) els.year.value = chosenYear;

  state.profile = collectProfile();
  renderSavedProfile(els.savedProfileCard, state.profile, formatPlaceSummary(state.profile));
  renderFocusPreview(els.focusPreviewCard, buildFocusPreview({}));
  updateOracleProfileState();
}

function updateLiveClock() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : hour < 21 ? "Good Evening" : "Good Night";
  if (els.heroGreeting) els.heroGreeting.textContent = `${greeting}, ${getDisplayName()}`;
  if (els.heroClock) {
    els.heroClock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
}

function startClock() {
  updateLiveClock();
  window.setInterval(updateLiveClock, 1000);
}

function startCursorBloom() {
  if (!els.cursorBloom || window.matchMedia("(pointer: coarse)").matches) return;
  window.addEventListener("pointermove", (event) => {
    els.cursorBloom.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
  });
}

function startHeroParticles() {
  const canvas = els.heroParticles;
  if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  let width = 0;
  let height = 0;
  let rafId = 0;
  const particles = Array.from({ length: 22 }).map(() => ({
    x: Math.random(),
    y: Math.random(),
    radius: 1 + Math.random() * 2.6,
    speed: 0.0006 + Math.random() * 0.0012,
    drift: -0.3 + Math.random() * 0.6,
    alpha: 0.1 + Math.random() * 0.5,
  }));

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.floor(width * window.devicePixelRatio);
    canvas.height = Math.floor(height * window.devicePixelRatio);
    context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  };

  const tick = () => {
    context.clearRect(0, 0, width, height);
    particles.forEach((particle) => {
      particle.y -= particle.speed;
      particle.x += particle.drift * 0.0004;
      if (particle.y < -0.06) particle.y = 1.06;
      if (particle.x < -0.1) particle.x = 1.1;
      if (particle.x > 1.1) particle.x = -0.1;
      const x = particle.x * width;
      const y = particle.y * height;
      context.beginPath();
      context.fillStyle = `rgba(242,202,80,${particle.alpha})`;
      context.shadowColor = "rgba(242,202,80,0.35)";
      context.shadowBlur = 18;
      context.arc(x, y, particle.radius, 0, Math.PI * 2);
      context.fill();
      context.closePath();
    });
    rafId = window.requestAnimationFrame(tick);
  };

  resize();
  tick();
  window.addEventListener("resize", resize);
  window.addEventListener("beforeunload", () => window.cancelAnimationFrame(rafId), { once: true });
}

function renderPlaceResults(items, message = "") {
  if (!els.placeResults) return;
  if (!items.length) {
    els.placeResults.hidden = !message;
    els.placeResults.innerHTML = message ? `<div class="place-empty">${message}</div>` : "";
    return;
  }
  els.placeResults.hidden = false;
  els.placeResults.innerHTML = items
    .map(
      (item) => `
        <button class="place-result" type="button" data-place="${(item.display_name || "").replaceAll('"', "&quot;")}" data-lat="${item.lat}" data-lon="${item.lon}">
          <strong>${(item.display_name || "").split(",").slice(0, 2).join(", ")}</strong>
          <span>${item.display_name || ""}</span>
        </button>
      `,
    )
    .join("");

  els.placeResults.querySelectorAll(".place-result").forEach((button) => {
    button.addEventListener("click", () => {
      if (els.place) els.place.value = button.dataset.place || "";
      if (els.lat) els.lat.value = Number(button.dataset.lat || 0).toFixed(5);
      if (els.lon) els.lon.value = Number(button.dataset.lon || 0).toFixed(5);
      if (els.tz) els.tz.value = getBrowserTimezone();
      hidePlaceResults();
      state.suppressPlaceFocusUntil = Date.now() + 250;
      els.place?.blur();
      state.profile = collectProfile();
      renderSavedProfile(els.savedProfileCard, state.profile, formatPlaceSummary(state.profile));
    });
  });
}

function hidePlaceResults() {
  if (!els.placeResults) return;
  els.placeResults.hidden = true;
  els.placeResults.innerHTML = "";
}

async function runPlaceSearch(query) {
  const trimmed = String(query || "").trim();
  state.lastPlaceQuery = trimmed;
  if (trimmed.length < 3) {
    renderPlaceResults([], "");
    return;
  }
  renderPlaceResults([], "Searching locations...");
  try {
    const results = await searchPlaces(trimmed);
    if (state.lastPlaceQuery !== trimmed) return;
    renderPlaceResults(results, "No matching places found.");
  } catch (_) {
    if (state.lastPlaceQuery !== trimmed) return;
    renderPlaceResults([], "Location search failed. Try again.");
  }
}

function currentScope() {
  if (!state.payload) return null;
  const scopes = normalizeScopes(state.payload);
  return scopes.find((scope) => scope.key === state.activeScope)?.data || scopes[0]?.data || null;
}

function scrollOracleToBottom() {
  if (!els.oracleConversation) return;
  window.requestAnimationFrame(() => {
    els.oracleConversation.scrollTop = els.oracleConversation.scrollHeight;
  });
}

async function loadAiSummary(scopeKey = state.activeScope) {
  if (!state.payload || !state.profile) return;
  const requestId = ++state.activeSummaryRequestId;
  const cached = state.aiSummaries[scopeKey];
  if (cached) return;
  try {
    const response = await fetchHoroscopeSummary({
      scope: scopeKey,
      year: state.profile.year,
      profile: {
        date: state.profile.date,
        time: state.profile.time,
        place: state.profile.place,
        lat: state.profile.lat,
        lon: state.profile.lon,
        tz: state.profile.tz,
      },
    });
    if (requestId !== state.activeSummaryRequestId) return;
    state.aiSummaries[scopeKey] = response.summary || null;
    if (scopeKey === state.activeScope) renderActiveScope();
  } catch (_) {}
}

function updateHero(payload, scope) {
  if (!payload || !scope) return;
  const energy = averageEnergy(scope.scores);
  const mood = energy >= 74 ? "Radiant" : energy >= 60 ? "Clear" : energy >= 48 ? "Shifting" : "Dense";
  if (els.energyMeterValue) els.energyMeterValue.textContent = `${energy}%`;
  if (els.heroWeather) els.heroWeather.textContent = mood;
  if (els.heroLocation) els.heroLocation.textContent = formatPlaceSummary(state.profile);
  renderHeroSignals(els.heroSignalTiles, buildHeroSignals(payload, state.activeScope));
  renderHeroChips(els.heroChipRow, [
    { label: "Lagna", value: payload.natal.lagna },
    { label: "Moon", value: payload.natal.moon_sign },
    { label: "Nakshatra", value: `${payload.natal.nakshatra} • Pada ${payload.natal.nakshatra_pada}` },
    { label: "Best Time", value: scope.lucky.time },
  ]);
}

function bindTabEvents() {
  els.tabs?.querySelectorAll("[data-scope]").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.activeScope = tab.getAttribute("data-scope") || "daily";
      renderActiveScope();
    });
  });
}

function bindOraclePromptEvents() {
  els.oraclePromptChips?.querySelectorAll("[data-prompt]").forEach((chip) => {
    chip.addEventListener("click", () => {
      if (els.oracleQuestion) els.oracleQuestion.value = chip.getAttribute("data-prompt") || "";
      autoResizeOracleInput();
      els.oracleQuestion?.focus();
    });
  });
}

function bindOracleHistoryEvents() {
  els.oracleHistory?.querySelectorAll("[data-question]").forEach((chip) => {
    chip.addEventListener("click", () => {
      if (els.oracleQuestion) els.oracleQuestion.value = chip.getAttribute("data-question") || "";
      autoResizeOracleInput();
      els.oracleQuestion?.focus();
    });
  });
}

function bindOracleConversationEvents() {
  els.oracleConversation?.querySelectorAll("[data-followup]").forEach((chip) => {
    chip.addEventListener("click", () => {
      if (els.oracleQuestion) els.oracleQuestion.value = chip.getAttribute("data-followup") || "";
      autoResizeOracleInput();
      els.oracleQuestion?.focus();
    });
  });
  els.oracleConversation?.querySelectorAll("[data-oracle-basis-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const body = button.parentElement?.querySelector("[data-oracle-basis-body]");
      if (!body) return;
      const nextHidden = !body.hasAttribute("hidden") ? true : false;
      if (nextHidden) {
        body.setAttribute("hidden", "");
      } else {
        body.removeAttribute("hidden");
      }
      const arrow = button.querySelector("span:last-child");
      if (arrow) arrow.textContent = nextHidden ? "▾" : "▴";
    });
  });
}

function renderActiveScope() {
  if (!state.payload) return;
  const scopes = normalizeScopes(state.payload);
  const scope = currentScope();
  if (!scope) return;
  const aiSummary = state.aiSummaries[state.activeScope] || null;

  renderTabs(els.tabs, scopes, state.activeScope);
  renderNatalSummary(els.natalSummary, state.payload.natal, scope);
  renderCosmicMessage(els.cosmicMessageCard, scope, aiSummary);
  renderPeriodSummary(els.scopeSummary, scope);
  renderScores(els.scoreCard, scope);
  renderDetails(els.detailsCard, scope);
  renderAdvice(els.adviceCard, scope);
  renderLucky(els.luckyCard, scope);
  renderTimeline(els.timingLensCard, scope);
  renderTimeline(els.timingMiniCard, scope);
  if (els.periodMeta) {
    els.periodMeta.textContent = `${scope.scope} • Confidence ${confidenceFromScope(scope)}%`;
  }
  updateHero(state.payload, scope);
  renderPromptChips(els.oraclePromptChips, buildPromptSuggestions(state.payload, state.activeScope));
  renderOracleConversation(els.oracleConversation, state.oracleConversation, {
    title: state.profile?.date && state.profile?.time ? "Ask anything grounded in your birth chart." : "Enter your moment of arrival above.",
    body: state.profile?.date && state.profile?.time
      ? "The Oracle interprets your active kundali, dasha, and transits. It does not invent new astrology."
      : "Generate your horoscope first. The Oracle only answers after it has your actual birth profile and live horoscope context.",
  });
  scrollOracleToBottom();
  bindTabEvents();
  bindOraclePromptEvents();
  bindOracleConversationEvents();
  updateOracleProfileState();
  loadAiSummary(state.activeScope);
}

async function generateHoroscope() {
  const profile = collectProfile();
  setUiState({ loading: true, error: "" });
  try {
    const payload = await fetchHoroscope({
      date: profile.date,
      time: profile.time,
      lat: profile.lat,
      lon: profile.lon,
      tz: profile.tz,
      year: profile.year,
    });
    state.payload = payload;
    state.activeScope = "daily";
    state.profile = profile;
    state.aiSummaries = {};
    saveBirthProfile(profile);
    state.oracleHistory = getOracleHistory(profile).map(normalizeOracleEntry).filter(Boolean);
    state.oracleConversation = [];
    renderSavedProfile(els.savedProfileCard, profile, formatPlaceSummary(profile));
    renderFocusPreview(els.focusPreviewCard, buildFocusPreview(payload));
    updateOracleProfileState();
    renderOracleHistory(els.oracleHistory, []);
    setUiState({ loading: false, error: "" });
    renderActiveScope();
  } catch (error) {
    state.payload = null;
    setUiState({ loading: false, error: String(error.message || error) });
  }
}

function resetOracleOutput() {
  state.oracleConversation = [];
  renderOracleHistory(els.oracleHistory, []);
  renderOracleConversation(els.oracleConversation, state.oracleConversation, {
    title: state.profile?.date && state.profile?.time ? "Start a conversation." : "Birth details required.",
    body: state.profile?.date && state.profile?.time
      ? ""
      : "Enter date and time of birth above, then generate the horoscope.",
  });
  bindOracleConversationEvents();
}

async function handleOracleSubmit(event) {
  event?.preventDefault?.();
  if (!els.date?.value || !els.time?.value) {
    resetOracleOutput();
    document.querySelector(".birth-shell")?.scrollIntoView({ behavior: "smooth", block: "start" });
    els.date?.focus();
    return;
  }
  if (!state.payload) {
    await generateHoroscope();
    if (!state.payload) return;
  }

  const question = String(els.oracleQuestion?.value || "").trim();
  if (!question) return;

  const history = state.oracleHistory.slice(0, 4);
  if (els.oracleTypingDot) els.oracleTypingDot.hidden = false;
  if (els.oracleSubmitBtn) els.oracleSubmitBtn.disabled = true;
  if (els.oracleProfileStatus) els.oracleProfileStatus.textContent = "Consulting active chart";
  const pendingEntry = {
    question,
    answer: {
      directAnswer: "",
      chartBasis: "",
      cautions: "",
      bestTiming: "",
      remedy: "",
      opportunities: "",
      astroBasisUsed: [],
      suggestedFollowUps: [],
    },
    pending: true,
    createdAt: new Date().toISOString(),
  };
  state.oracleConversation = [...state.oracleConversation.filter((entry) => !entry.pending), pendingEntry].slice(-8);
  renderOracleConversation(els.oracleConversation, state.oracleConversation);
  scrollOracleToBottom();

  let finalAnswer = null;
  try {
    await streamOracleAnswer({
      profile: state.profile,
      year: state.profile.year,
      question,
      history,
      onMeta: (data) => {
        if (Array.isArray(data?.suggested_prompts)) {
          renderPromptChips(els.oraclePromptChips, data.suggested_prompts);
          bindOraclePromptEvents();
        }
      },
      onDelta: (data) => {
        if (data?.text) {
          pendingEntry.answer.directAnswer = data.text;
          renderOracleConversation(els.oracleConversation, state.oracleConversation);
          scrollOracleToBottom();
        }
      },
      onSection: (data) => {
        if (!finalAnswer) finalAnswer = {};
        finalAnswer[data.section] = data.text || "";
        pendingEntry.answer[data.section] = data.text || "";
        renderOracleConversation(els.oracleConversation, state.oracleConversation);
        scrollOracleToBottom();
      },
      onDone: (data) => {
        finalAnswer = data?.answer || finalAnswer;
      },
    });
  } catch (error) {
    pendingEntry.answer.directAnswer = String(error.message || error || "Oracle response failed.");
    pendingEntry.pending = false;
    renderOracleConversation(els.oracleConversation, state.oracleConversation);
    scrollOracleToBottom();
  } finally {
    if (els.oracleTypingDot) els.oracleTypingDot.hidden = true;
    if (els.oracleSubmitBtn) els.oracleSubmitBtn.disabled = false;
    updateOracleProfileState();
  }

  if (!finalAnswer) return;
  pendingEntry.pending = false;
  pendingEntry.answer = finalAnswer;
  const entry = {
    question,
    answer: finalAnswer,
    createdAt: new Date().toISOString(),
  };
  state.oracleConversation = [...state.oracleConversation.filter((item) => item !== pendingEntry && !item.pending), entry].slice(-8);
  state.oracleHistory = [entry, ...state.oracleHistory].slice(0, 8);
  saveOracleHistory(state.profile, state.oracleHistory);
  renderOracleHistory(els.oracleHistory, state.oracleHistory);
  renderOracleConversation(els.oracleConversation, state.oracleConversation);
  scrollOracleToBottom();
  bindOracleHistoryEvents();
  bindOracleConversationEvents();
  if (els.oracleQuestion) els.oracleQuestion.value = "";
  autoResizeOracleInput();
}

function bindEvents() {
  els.generateBtn?.addEventListener("click", generateHoroscope);
  document.querySelector("#horoscopeForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    generateHoroscope();
  });

  els.useCurrentBtn?.addEventListener("click", async () => {
    try {
      const current = await useCurrentLocation();
      if (els.place) els.place.value = current.place || "";
      if (els.lat) els.lat.value = Number(current.lat).toFixed(5);
      if (els.lon) els.lon.value = Number(current.lon).toFixed(5);
      if (els.tz) els.tz.value = current.tz || getBrowserTimezone();
      state.profile = collectProfile();
      renderSavedProfile(els.savedProfileCard, state.profile, formatPlaceSummary(state.profile));
      updateOracleProfileState();
    } catch (error) {
      setUiState({ loading: false, error: String(error.message || error) });
    }
  });

  els.backToKundaliBtn?.addEventListener("click", () => {
    const profile = collectProfile();
    const params = new URLSearchParams({
      dob: profile.date,
      tob: profile.time,
      lat: profile.lat,
      lon: profile.lon,
      tz: profile.tz,
    });
    if (profile.place) params.set("place", profile.place);
    window.location.href = `/kundali/?${params.toString()}`;
  });

  els.heroRevealBtn?.addEventListener("click", () => {
    document.querySelector(".birth-shell")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  els.heroOracleBtn?.addEventListener("click", async () => {
    if (!state.payload) await generateHoroscope();
    document.querySelector("#oracleCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    els.oracleQuestion?.focus();
  });

  els.ambientToggleBtn?.addEventListener("click", () => {
    const pressed = els.ambientToggleBtn.getAttribute("aria-pressed") === "true";
    els.ambientToggleBtn.setAttribute("aria-pressed", pressed ? "false" : "true");
    els.ambientToggleBtn.textContent = pressed ? "Ambient sound • Soon" : "Ambient sound • queued";
  });

  els.oracleForm?.addEventListener("submit", handleOracleSubmit);
  els.oracleClearBtn?.addEventListener("click", () => {
    state.oracleConversation = [];
    if (els.oracleQuestion) els.oracleQuestion.value = "";
    renderOracleConversation(els.oracleConversation, state.oracleConversation, {
      title: state.profile?.date && state.profile?.time ? "Start a new conversation." : "Birth details required.",
      body: state.profile?.date && state.profile?.time ? "Ask a fresh question grounded in the same birth profile." : "Enter date and time of birth above, then generate the horoscope.",
    });
    scrollOracleToBottom();
    autoResizeOracleInput();
  });

  els.oracleQuestion?.addEventListener("input", autoResizeOracleInput);
  els.oracleQuestion?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleOracleSubmit(event);
    }
  });

  els.place?.addEventListener("input", () => {
    window.clearTimeout(state.placeTimer);
    const value = els.place?.value || "";
    if (value.trim().length < 3) {
      hidePlaceResults();
      return;
    }
    state.placeTimer = window.setTimeout(() => runPlaceSearch(value), 220);
  });

  els.place?.addEventListener("focus", () => {
    if (Date.now() < state.suppressPlaceFocusUntil) return;
    const value = els.place?.value || "";
    if (value.trim().length >= 3) runPlaceSearch(value);
  });

  els.place?.addEventListener("blur", () => {
    window.setTimeout(() => {
      if (document.activeElement !== els.place) hidePlaceResults();
    }, 120);
  });

  document.addEventListener("pointerdown", (event) => {
    if (!els.placeResults || !els.place) return;
    if (els.place.contains(event.target) || els.placeResults.contains(event.target)) return;
    hidePlaceResults();
  }, true);

  ["date", "time", "place", "lat", "lon", "tz", "year"].forEach((key) => {
    const input = els[key];
    input?.addEventListener("change", () => {
      state.profile = collectProfile();
      renderSavedProfile(els.savedProfileCard, state.profile, formatPlaceSummary(state.profile));
      updateOracleProfileState();
      resetOracleOutput();
    });
  });
}

function autoResizeOracleInput() {
  if (!els.oracleQuestion) return;
  els.oracleQuestion.style.height = "auto";
  els.oracleQuestion.style.height = `${Math.min(els.oracleQuestion.scrollHeight, 220)}px`;
}

fillDefaults();
startClock();
startCursorBloom();
startHeroParticles();
bindEvents();
resetOracleOutput();
autoResizeOracleInput();
generateHoroscope();
