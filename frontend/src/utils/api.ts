export type PanchangResponse = {
  date: string;
  location: { lat: number; lon: number; tz: string };
  sunrise: string;
  sunset: string;
  rahu_start: string;
  rahu_end: string;
  tithi: string;
  tithi_start: string;
  tithi_end: string;
  nakshatra: string;
  nak_start: string;
  nak_end: string;
  paksha: string;
  month: string;
  moon_phase: number; // 0..1 illumination
  moon_waxing: boolean;
};

export async function fetchPanchang() {
  const res = await fetch("/api/panchang", { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return (await res.json()) as PanchangResponse;
}

