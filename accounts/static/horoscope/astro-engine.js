export const HOROSCOPE_API_URL = "/api/horoscope/";

export function readQueryDefaults() {
  const params = new URLSearchParams(window.location.search);
  return {
    date: params.get("dob") || "",
    time: params.get("tob") || "",
    lat: params.get("lat") || "",
    lon: params.get("lon") || "",
    tz: params.get("tz") || "",
    year: params.get("year") || "2026",
  };
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

export function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
}

export function useCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        resolve({
          lat: position.coords.latitude.toFixed(5),
          lon: position.coords.longitude.toFixed(5),
        });
      },
      () => reject(new Error("Location permission denied.")),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}
