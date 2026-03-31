export const SCOPE_KEYS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
  { key: "specific_year", label: "2026" },
];

export function normalizeScopes(payload) {
  const yearLabel = String(payload?.specific_year_label || "2026");
  return SCOPE_KEYS.map((item) => ({
    key: item.key,
    label: item.key === "specific_year" ? yearLabel : item.label,
    data: payload?.[item.key] || null,
  })).filter((item) => item.data);
}

export function averageEnergy(scores) {
  const values = Object.values(scores || {}).filter((value) => Number.isFinite(Number(value))).map(Number);
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
