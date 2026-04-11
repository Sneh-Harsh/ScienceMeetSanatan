export const SCOPE_KEYS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
  { key: "specific_year", label: "2026" },
];

export function normalizeScopes(payload) {
  const yearLabel = String(payload?.specific_year_label || "2026");
  return SCOPE_KEYS.map((scope) => ({
    key: scope.key,
    label: scope.key === "specific_year" ? yearLabel : scope.label,
    data: payload?.[scope.key] || null,
  })).filter((scope) => scope.data);
}

export function averageEnergy(scores) {
  const values = Object.values(scores || {})
    .map(Number)
    .filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function confidenceFromScope(scope) {
  const base = averageEnergy(scope?.scores || {});
  return Math.max(42, Math.min(93, Math.round(base * 0.88)));
}

export function dominantColor(scope) {
  const dominant = String(scope?.dominant_planet || "").toLowerCase();
  if (dominant.includes("venus")) return "#ff9dc2";
  if (dominant.includes("jupiter")) return "#f2ca50";
  if (dominant.includes("mercury")) return "#83aaff";
  if (dominant.includes("saturn")) return "#8ddaf7";
  if (dominant.includes("mars")) return "#ff8c8c";
  return "#ffb779";
}

export function buildHeroSignals(payload, activeScope) {
  const scope = payload?.[activeScope] || payload?.daily || {};
  const lucky = scope?.lucky || {};
  return [
    { label: "Moon Sign", value: payload?.natal?.moon_sign || "—" },
    { label: "Dominant Planet", value: scope?.dominant_planet || "—" },
    { label: "Mahadasha", value: scope?.mahadasha || "—" },
    { label: "Lucky Time", value: lucky?.time || "—" },
    { label: "Love", value: `${scope?.scores?.love ?? "--"} / 100` },
    { label: "Career", value: `${scope?.scores?.career ?? "--"} / 100` },
  ];
}

export function buildPromptSuggestions(payload, activeScope) {
  const scope = payload?.[activeScope] || payload?.daily || {};
  const prompts = [
    "What should I focus on this month?",
    "Why am I feeling emotionally heavy lately?",
  ];
  if ((scope?.scores?.career || 0) < 55) prompts.push("Why is career feeling delayed?");
  else prompts.push("How can I use this career momentum wisely?");
  if ((scope?.scores?.love || 0) < 55) prompts.push("Is this a good time for marriage?");
  else prompts.push("How can I deepen relationships now?");
  return prompts.slice(0, 5);
}

export function formatPlaceSummary(profile) {
  const place = String(profile?.place || "").trim();
  const lat = Number(profile?.lat);
  const lon = Number(profile?.lon);
  const tz = String(profile?.tz || "").trim();
  const pieces = [];
  if (place) pieces.push(place);
  if (Number.isFinite(lat) && Number.isFinite(lon)) pieces.push(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
  if (tz) pieces.push(tz);
  return pieces.join(" • ");
}

export function buildFocusPreview(payload) {
  const daily = payload?.daily || {};
  const yearScope = payload?.specific_year || payload?.yearly || {};
  return {
    title: "Current focus window",
    summary: daily?.summary || "",
    note: yearScope?.summary || "",
  };
}

export function makeProfileKey(profile) {
  const raw = JSON.stringify({
    date: profile?.date || "",
    time: profile?.time || "",
    lat: Number(profile?.lat || 0).toFixed(4),
    lon: Number(profile?.lon || 0).toFixed(4),
    tz: profile?.tz || "",
    year: profile?.year || "",
  });
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `profile_${Math.abs(hash)}`;
}
