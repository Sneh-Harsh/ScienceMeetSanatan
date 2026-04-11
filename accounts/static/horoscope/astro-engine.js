export const HOROSCOPE_API_URL = "/api/horoscope/";
export const ORACLE_STREAM_API_URL = "/api/oracle/stream/";
export const HOROSCOPE_SUMMARY_API_URL = "/api/horoscope-summary/";
export const HOROSCOPE_PROFILE_STORAGE_KEY = "sms_horoscope_profile_v1";

export function readQueryDefaults() {
  const params = new URLSearchParams(window.location.search);
  return {
    date: params.get("dob") || "",
    time: params.get("tob") || "",
    lat: params.get("lat") || "",
    lon: params.get("lon") || "",
    tz: params.get("tz") || "",
    year: params.get("year") || "2026",
    place: params.get("place") || "",
  };
}

export function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
}

export async function fetchHoroscope(payload) {
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => params.set(key, String(value)));
  const response = await fetch(`${HOROSCOPE_API_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = null;
  }
  if (!response.ok) {
    throw new Error(String(data?.error || text || `API error ${response.status}`));
  }
  return data;
}

export function useCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Number(position.coords.latitude.toFixed(5));
        const lon = Number(position.coords.longitude.toFixed(5));
        let place = "";
        try {
          place = (await reverseLookupPlace(lat, lon)) || "";
        } catch (_) {}
        resolve({ lat, lon, place, tz: getBrowserTimezone() });
      },
      () => reject(new Error("Location permission denied.")),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

export function getSavedBirthProfile() {
  try {
    const raw = localStorage.getItem(HOROSCOPE_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

export function saveBirthProfile(profile) {
  localStorage.setItem(HOROSCOPE_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export async function reverseLookupPlace(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const data = await response.json();
  return typeof data?.display_name === "string" ? data.display_name.trim() : null;
}

export async function searchPlaces(query) {
  const q = String(query || "").trim();
  if (q.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&q=${encodeURIComponent(q)}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Location search failed.");
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchHoroscopeSummary(payload) {
  const response = await fetch(HOROSCOPE_SUMMARY_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRFToken": getCsrfToken(),
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = null;
  }
  if (!response.ok) {
    throw new Error(String(data?.error || text || `Summary API ${response.status}`));
  }
  return data;
}

function getCsrfToken() {
  const cookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("csrftoken="));
  if (!cookie) return "";
  return decodeURIComponent(cookie.split("=")[1] || "");
}

function parseEventChunk(rawChunk) {
  const lines = rawChunk.split("\n");
  let event = "message";
  const payloadLines = [];
  lines.forEach((line) => {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) payloadLines.push(line.slice(5).trim());
  });
  if (!payloadLines.length) return null;
  try {
    return { event, data: JSON.parse(payloadLines.join("\n")) };
  } catch (_) {
    return { event, data: null };
  }
}

export async function fetchOracleStream(payload, handlers = {}) {
  const response = await fetch(ORACLE_STREAM_API_URL, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      "X-CSRFToken": getCsrfToken(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Oracle API ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Streaming is unavailable in this browser.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex !== -1) {
      const rawChunk = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const parsed = parseEventChunk(rawChunk);
      if (parsed && typeof handlers[parsed.event] === "function") {
        handlers[parsed.event](parsed.data);
      }
      separatorIndex = buffer.indexOf("\n\n");
    }

    if (done) break;
  }
}
