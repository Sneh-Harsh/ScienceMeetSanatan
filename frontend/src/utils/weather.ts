export type WeatherKind = "clear" | "cloudy" | "rain";

// Optional: you can plug a real weather service here.
// For now, derive a simple kind from Open-Meteo if available, else default clear.
export async function fetchWeatherKind(lat: number, lon: number): Promise<WeatherKind> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,cloud_cover&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return "clear";
    const data = await res.json();
    const code = Number(data?.current?.weather_code ?? 0);
    const cloud = Number(data?.current?.cloud_cover ?? 0);
    if (code >= 51 && code <= 99) return "rain";
    if (cloud >= 55) return "cloudy";
    return "clear";
  } catch {
    return "clear";
  }
}

