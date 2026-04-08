const header = document.querySelector(".header");
const heroArt = document.querySelector("#heroArt");
const heroVideo = document.querySelector("#heroVideo");
const aetherForm = document.querySelector("#aetherForm");
const aetherInput = document.querySelector("#aetherInput");
const aetherResults = document.querySelector("#aetherResults");
const raashiTrack = document.querySelector("#raashiTrack");
const raashiGeneratedAt = document.querySelector("#raashiGeneratedAt");
const festivalTimeline = document.querySelector("#festivalTimeline");
const planetariumStage = document.querySelector("#planetariumStage");
const planetariumCanvas = document.querySelector("#planetariumCanvas");
const aetherSearchButton = document.querySelector(".aether-btn");
const aetherSearchButtonText = document.querySelector(".aether-btn__text");

const STATIC_SEARCH_ENTRIES = [
  { title: "Panchang", meta: "Feature • Calendar, festivals, timings", href: "/panchang/", kind: "feature" },
  { title: "Kundali", meta: "Feature • Birth chart generator", href: "/kundali/", kind: "feature" },
  { title: "Horoscope", meta: "Feature • Daily to yearly predictions", href: "/horoscope/", kind: "feature" },
  { title: "Library", meta: "Feature • Aartis and sacred texts", href: "/library/", kind: "feature" },
  { title: "Baby Names", meta: "Feature • Deity-inspired names", href: "/baby-names/", kind: "feature" },
  { title: "Quizzes", meta: "Feature • Dharma learning", href: "/quizzes/", kind: "feature" },
  { title: "Mesha", meta: "Raashi • Horoscope", href: "/horoscope/", kind: "raashi" },
  { title: "Vrishabha", meta: "Raashi • Horoscope", href: "/horoscope/", kind: "raashi" },
  { title: "Mithuna", meta: "Raashi • Horoscope", href: "/horoscope/", kind: "raashi" },
  { title: "Karka", meta: "Raashi • Horoscope", href: "/horoscope/", kind: "raashi" },
  { title: "Simha", meta: "Raashi • Horoscope", href: "/horoscope/", kind: "raashi" },
  { title: "Kanya", meta: "Raashi • Horoscope", href: "/horoscope/", kind: "raashi" },
  { title: "Tula", meta: "Raashi • Horoscope", href: "/horoscope/", kind: "raashi" },
  { title: "Vrischika", meta: "Raashi • Horoscope", href: "/horoscope/", kind: "raashi" },
  { title: "Dhanu", meta: "Raashi • Horoscope", href: "/horoscope/", kind: "raashi" },
  { title: "Makara", meta: "Raashi • Horoscope", href: "/horoscope/", kind: "raashi" },
  { title: "Kumbha", meta: "Raashi • Horoscope", href: "/horoscope/", kind: "raashi" },
  { title: "Meena", meta: "Raashi • Horoscope", href: "/horoscope/", kind: "raashi" },
  { title: "Ashwini", meta: "Constellation • Nakshatra", href: "/panchang/", kind: "constellation" },
  { title: "Rohini", meta: "Constellation • Nakshatra", href: "/panchang/", kind: "constellation" },
  { title: "Mrigashirsha", meta: "Constellation • Nakshatra", href: "/panchang/", kind: "constellation" },
  { title: "Magha", meta: "Constellation • Nakshatra", href: "/panchang/", kind: "constellation" },
  { title: "Swati", meta: "Constellation • Nakshatra", href: "/panchang/", kind: "constellation" },
  { title: "Revati", meta: "Constellation • Nakshatra", href: "/panchang/", kind: "constellation" },
];

const SOLAR_SYSTEM_BODIES = [
  {
    name: "Mercury",
    symbol: "☿",
    orbit: 1,
    periodDays: 87.97,
    size: 16,
    phase: 120,
    color: "#b7b2a8",
    texture: "https://www.solarsystemscope.com/textures/download/2k_mercury.jpg",
  },
  {
    name: "Venus",
    symbol: "♀",
    orbit: 2,
    periodDays: 224.7,
    size: 24,
    phase: 260,
    color: "#d3b48b",
    texture: "https://www.solarsystemscope.com/textures/download/2k_venus_surface.jpg",
  },
  {
    name: "Earth",
    symbol: "⊕",
    orbit: 3,
    periodDays: 365.26,
    size: 26,
    phase: 30,
    color: "#7db8ff",
    texture: "https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg",
  },
  {
    name: "Mars",
    symbol: "♂",
    orbit: 4,
    periodDays: 686.98,
    size: 20,
    phase: 320,
    color: "#d7724e",
    texture: "https://www.solarsystemscope.com/textures/download/2k_mars.jpg",
  },
  {
    name: "Jupiter",
    symbol: "♃",
    orbit: 5,
    periodDays: 4332.59,
    size: 58,
    phase: 40,
    color: "#d3a067",
    texture: "https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg",
  },
  {
    name: "Saturn",
    symbol: "♄",
    orbit: 6,
    periodDays: 10759.22,
    size: 50,
    phase: 150,
    color: "#d1bf8a",
    texture: "https://www.solarsystemscope.com/textures/download/2k_saturn.jpg",
    ring: "https://www.solarsystemscope.com/textures/download/2k_saturn_ring_alpha.png",
  },
  {
    name: "Uranus",
    symbol: "⛢",
    orbit: 7,
    periodDays: 30688.5,
    size: 34,
    phase: 220,
    color: "#83ebf5",
    texture: "https://www.solarsystemscope.com/textures/download/2k_uranus.jpg",
  },
  {
    name: "Neptune",
    symbol: "♆",
    orbit: 8,
    periodDays: 60182,
    size: 32,
    phase: 10,
    color: "#5e83ff",
    texture: "https://www.solarsystemscope.com/textures/download/2k_neptune.jpg",
  },
];
const PLANET_SCALE = [0, 92, 148, 200, 258, 326, 398, 470, 540];
const EARTH_YEAR_MS = 60000;
const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
let welcomeInsights = null;
let planetNodes = [];
let animationFrameId = null;

const updateHeaderState = () => {
  if (!header) return;
  header.classList.toggle("scrolled", window.scrollY > 8);
};

const setHeroParallax = (clientX, clientY) => {
  if (!heroArt || !heroVideo) return;
  const rect = heroArt.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = ((clientX - rect.left) / rect.width - 0.5) * 8;
  const y = ((clientY - rect.top) / rect.height - 0.5) * 6;
  heroVideo.style.transform = `scale(1.14) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
};

const formatGeneratedAt = (value) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (_) {
    return "Live now";
  }
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderRaashiPulse = (items = []) => {
  if (!raashiTrack) return;
  if (!items.length) {
    raashiTrack.innerHTML = '<div class="loading-card">Raashi pulse is aligning. Please refresh in a moment.</div>';
    return;
  }
  raashiTrack.innerHTML = items
    .map((item, index) => {
      const sigils = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
      return `
        <article class="raashi-card" style="--accent:${escapeHtml(item.accent)}; --energy:${Number(item.energy || 50)}">
          <div class="raashi-card__top">
            <div>
              <div class="raashi-card__en">${escapeHtml(item.sign_en)}</div>
              <h3>${escapeHtml(item.sign_sa)}</h3>
            </div>
            <div class="raashi-card__sigil">${sigils[index] || "✦"}</div>
          </div>
          <p class="raashi-card__text">${escapeHtml(item.prediction)}</p>
          <div class="raashi-card__foot">
            <div class="raashi-card__energy">
              <strong>Cosmic Energy ${Number(item.energy || 0)}%</strong>
              <div class="raashi-card__meter"><span></span></div>
            </div>
            <div class="raashi-card__planet">${escapeHtml(item.dominant_planet)} leads</div>
          </div>
        </article>
      `;
    })
    .join("");
};

const renderFestivalTimeline = (items = []) => {
  if (!festivalTimeline) return;
  if (!items.length) {
    festivalTimeline.innerHTML = '<div class="timeline-loading">No festival pulse is available right now.</div>';
    return;
  }
  const visibleItems = items.slice(0, 4);
  festivalTimeline.innerHTML = visibleItems
    .map((item, index) => {
      const classes = [
        "timeline-item",
        `timeline-item--${item.status || "upcoming"}`,
        index < 3 ? "timeline-item--focus" : "timeline-item--ghost",
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <article class="${classes}">
          <div class="timeline-dot-wrap"><span class="timeline-dot"></span></div>
          <div class="timeline-content">
            <div class="section-kicker">${escapeHtml(item.icon || "✦")} ${index === 3 ? "Upcoming" : "Festival"}</div>
            <h3>${escapeHtml(item.name)}</h3>
            <div class="timeline-date">${escapeHtml(item.date_label || item.date || "")}</div>
            <div class="timeline-time">${escapeHtml(item.time_label || "Timings updating")}</div>
            <div class="timeline-desc">${escapeHtml(item.description || "Sacred observance from this month's orbit.")}</div>
          </div>
        </article>
      `;
    })
    .join("");
};

const renderPlanetarium = () => {
  if (planetariumCanvas) return;
  if (!planetariumStage) return;
  planetariumStage.querySelectorAll(".planet-orbit").forEach((node) => node.remove());
  planetNodes = SOLAR_SYSTEM_BODIES.map((planet) => {
    const orbitSize = PLANET_SCALE[Number(planet.orbit || 1)] || 160;
    const orbit = document.createElement("div");
    orbit.className = "planet-orbit";
    orbit.style.setProperty("--orbit-size", String(orbitSize));
    orbit.style.setProperty("--base-tilt", `${((Number(planet.orbit) % 2 === 0 ? 1 : -1) * 7)}deg`);

    const node = document.createElement("div");
    node.className = `planet-node${planet.ring ? " planet-node--saturn" : ""}`;
    node.style.setProperty("--planet-color", planet.color);
    node.style.setProperty("--planet-size", String(planet.size));
    node.style.setProperty("--spin-duration", String(Math.max(8, Math.min(planet.periodDays / 18, 80))));
    node.innerHTML = `
      ${planet.ring ? '<span class="planet-node__ring"></span>' : ""}
      <div class="planet-node__body">
        <span class="planet-node__texture"></span>
        <span class="planet-node__atmosphere"></span>
      </div>
      <div class="planet-node__label">${escapeHtml(planet.name)}</div>
    `;
    const body = node.querySelector(".planet-node__body");
    const texture = node.querySelector(".planet-node__texture");
    if (body && texture) {
      texture.style.backgroundImage = `url('${planet.texture}')`;
      body.setAttribute("data-symbol", planet.symbol);
    }
    const ring = node.querySelector(".planet-node__ring");
    if (ring && planet.ring) {
      ring.style.backgroundImage = `radial-gradient(circle at center, transparent 0 38%, rgba(0,0,0,0.12) 39% 46%, transparent 47%), url('${planet.ring}')`;
    }
    orbit.appendChild(node);
    planetariumStage.appendChild(orbit);
    return { orbit, node, planet };
  });
  startPlanetAnimation();
};

const buildSearchEntries = () => {
  const dynamicEntries = [];
  if (welcomeInsights?.rashi_pulse?.length) {
    welcomeInsights.rashi_pulse.forEach((item) => {
      dynamicEntries.push({
        title: item.sign_sa,
        meta: `Raashi • ${item.sign_en}`,
        href: "/horoscope/",
        kind: "raashi",
      });
    });
  }
  if (welcomeInsights?.monthly_festivals?.length) {
    welcomeInsights.monthly_festivals.forEach((item) => {
      dynamicEntries.push({
        title: item.name,
        meta: `Festival • ${item.date_label || item.date}`,
        href: "/panchang/",
        kind: "festival",
      });
    });
  }
  return [...STATIC_SEARCH_ENTRIES, ...dynamicEntries];
};

const getSearchResults = (query) => {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return [];
  return buildSearchEntries()
    .filter((item) => `${item.title} ${item.meta}`.toLowerCase().includes(normalized))
    .sort((a, b) => {
      const aStarts = a.title.toLowerCase().startsWith(normalized) ? -1 : 0;
      const bStarts = b.title.toLowerCase().startsWith(normalized) ? -1 : 0;
      return aStarts - bStarts;
    })
    .slice(0, 8);
};

const renderSearchResults = (query) => {
  if (!aetherResults) return;
  const normalized = String(query || "").trim();
  if (!normalized) {
    aetherResults.hidden = true;
    aetherResults.innerHTML = "";
    if (aetherSearchButtonText) aetherSearchButtonText.textContent = "Aether Search";
    return;
  }
  const results = getSearchResults(normalized);
  if (!results.length) {
    aetherResults.hidden = false;
    aetherResults.innerHTML = `
      <div class="aether-results__head">
        <span>No exact cosmic match yet</span>
        <span>Search: ${escapeHtml(normalized)}</span>
      </div>
      <div class="loading-card">Try a raashi, festival, or constellation name such as Rohini, Ram Navami, or Meena.</div>
    `;
    if (aetherSearchButtonText) aetherSearchButtonText.textContent = "Try Another";
    return;
  }
  aetherResults.hidden = false;
  if (aetherSearchButtonText) aetherSearchButtonText.textContent = "Refine Search";
  aetherResults.innerHTML = results
    .map(
      (item) => `
        <a class="aether-result" href="${escapeHtml(item.href)}">
          <div>
            <div class="aether-result__title">${escapeHtml(item.title)}</div>
            <div class="aether-result__meta">${escapeHtml(item.meta)}</div>
          </div>
          <div class="aether-result__meta">Open →</div>
        </a>
      `
    )
    .join("");
  aetherResults.innerHTML = `
    <div class="aether-results__head">
      <span>${results.length} result${results.length > 1 ? "s" : ""} for “${escapeHtml(normalized)}”</span>
      <span>Tap the one you want</span>
    </div>
    ${aetherResults.innerHTML}
  `;
};

const initializeSearch = () => {
  aetherInput?.addEventListener("input", (event) => renderSearchResults(event.target.value));
  aetherForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = aetherInput?.value || "";
    renderSearchResults(query);
  });
  document.addEventListener("click", (event) => {
    if (!aetherResults || !aetherForm) return;
    if (!aetherForm.contains(event.target) && !aetherResults.contains(event.target)) {
      aetherResults.hidden = true;
    }
  });
};

const startPlanetAnimation = () => {
  if (!planetNodes.length) return;
  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  const tick = () => {
    const elapsed = Date.now() - EPOCH_MS;
    planetNodes.forEach(({ orbit, node, planet }) => {
      const cycleMs = EARTH_YEAR_MS * (planet.periodDays / 365.26);
      const angle = ((elapsed % cycleMs) / cycleMs) * 360 + planet.phase;
      const radians = (angle * Math.PI) / 180;
      const depth = Math.sin(radians) * 44;
      const scale = 0.88 + ((Math.sin(radians) + 1) / 2) * 0.26;
      const brightness = 0.78 + ((Math.cos(radians) + 1) / 2) * 0.34;
      node.style.setProperty("--angle", angle.toFixed(2));
      node.style.setProperty("--planet-depth", depth.toFixed(2));
      node.style.setProperty("--planet-scale", scale.toFixed(3));
      node.style.setProperty("--planet-brightness", brightness.toFixed(3));
      orbit.style.setProperty("--orbit-rotation", `${(angle / 8).toFixed(2)}deg`);
    });
    animationFrameId = window.requestAnimationFrame(tick);
  };
  tick();
};

const enablePlanetariumInteraction = () => {
  if (planetariumCanvas) return;
  if (!planetariumStage) return;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let baseRotateX = -12;
  let baseRotateY = 16;
  let rotateX = -12;
  let rotateY = 16;

  const applyRotation = () => {
    planetariumStage.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  };

  const startDrag = (event) => {
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    baseRotateX = rotateX;
    baseRotateY = rotateY;
    planetariumStage.classList.add("is-dragging");
    planetariumStage.setPointerCapture?.(event.pointerId);
  };

  const moveDrag = (event) => {
    if (!dragging) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    rotateY = baseRotateY + deltaX * 0.12;
    rotateX = baseRotateX - deltaY * 0.08;
    rotateX = Math.max(-38, Math.min(18, rotateX));
    applyRotation();
  };

  const endDrag = (event) => {
    dragging = false;
    planetariumStage.classList.remove("is-dragging");
    planetariumStage.releasePointerCapture?.(event.pointerId);
  };

  planetariumStage.addEventListener("pointerdown", startDrag);
  window.addEventListener("pointermove", moveDrag);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
  applyRotation();
};

const fetchWelcomeInsights = async () => {
  const requests = await Promise.allSettled([
    fetch("/api/welcome-raashi/", { credentials: "same-origin" }).then((response) => response.json()),
    fetch("/api/welcome-festivals/", { credentials: "same-origin" }).then((response) => response.json()),
  ]);

  const [raashiResult, festivalResult] = requests;

  if (raashiResult.status === "fulfilled" && Array.isArray(raashiResult.value?.rashi_pulse)) {
    welcomeInsights = { ...(welcomeInsights || {}), ...raashiResult.value };
    renderRaashiPulse(raashiResult.value.rashi_pulse || []);
    if (raashiGeneratedAt && raashiResult.value.generated_at) {
      raashiGeneratedAt.textContent = `Live transits • ${formatGeneratedAt(raashiResult.value.generated_at)}`;
    }
  } else {
    if (raashiGeneratedAt) raashiGeneratedAt.textContent = "Live transits unavailable";
    renderRaashiPulse([]);
  }

  if (festivalResult.status === "fulfilled" && Array.isArray(festivalResult.value?.monthly_festivals)) {
    welcomeInsights = { ...(welcomeInsights || {}), ...festivalResult.value };
    renderFestivalTimeline(festivalResult.value.monthly_festivals || []);
  } else {
    renderFestivalTimeline([]);
  }

  renderPlanetarium();
};

window.addEventListener("scroll", updateHeaderState, { passive: true });
updateHeaderState();

heroArt?.addEventListener("pointermove", (event) => setHeroParallax(event.clientX, event.clientY));
heroArt?.addEventListener("pointerleave", () => {
  if (!heroVideo) return;
  heroVideo.style.transform = "scale(1.14)";
});

initializeSearch();
enablePlanetariumInteraction();
fetchWelcomeInsights();
