import { fetchOracleStream } from "./astro-engine.js";
import { makeProfileKey } from "./prediction-generator.js";

const ORACLE_HISTORY_PREFIX = "sms_oracle_history_v1_";

export function getHistoryKey(profile) {
  return `${ORACLE_HISTORY_PREFIX}${makeProfileKey(profile)}`;
}

export function getOracleHistory(profile) {
  try {
    const raw = localStorage.getItem(getHistoryKey(profile));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export function saveOracleHistory(profile, history) {
  localStorage.setItem(getHistoryKey(profile), JSON.stringify(history.slice(0, 8)));
}

export async function streamOracleAnswer({ profile, year, question, history, onMeta, onDelta, onSection, onDone }) {
  const payload = {
    question,
    year,
    history,
    profile: {
      date: profile.date,
      time: profile.time,
      place: profile.place || "",
      lat: profile.lat,
      lon: profile.lon,
      tz: profile.tz,
    },
  };

  await fetchOracleStream(payload, {
    meta: (data) => onMeta?.(data),
    delta: (data) => onDelta?.(data),
    section: (data) => onSection?.(data),
    done: (data) => onDone?.(data),
  });
}
