import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveClock } from "../components/LiveClock";
import { MoonPhase } from "../components/MoonPhase";
import { SkyBackground } from "../components/SkyBackground";
import { StatCard } from "../components/StatCard";
import { fetchPanchang, PanchangResponse } from "../utils/api";
import { formatDateLong, formatLocalTime } from "../utils/format";
import { fetchWeatherKind, WeatherKind } from "../utils/weather";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function isBetween(now: Date, start: Date, end: Date) {
  return now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
}

export function PanchangDashboard() {
  const [data, setData] = useState<PanchangResponse | null>(null);
  const [weather, setWeather] = useState<WeatherKind>("clear");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const loadSeq = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(async (showLoader: boolean) => {
    const seq = ++loadSeq.current;
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const p = await fetchPanchang();
      if (seq !== loadSeq.current) return;
      setData(p);
      if (showLoader) setLoading(false);
      const wk = await fetchWeatherKind(p.location.lat, p.location.lon);
      if (seq !== loadSeq.current) return;
      setWeather(wk);
    } catch (e: any) {
      if (seq !== loadSeq.current) return;
      setError(String(e?.message || e));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  // Auto-refresh exactly when a timed entity ends (tithi/nakshatra), so UI updates to the next one.
  useEffect(() => {
    if (!data) return;
    const nowMs = Date.now();
    const candidates = [Date.parse(data.tithi_end), Date.parse(data.nak_end)].filter((ms) => Number.isFinite(ms));
    const future = candidates.filter((ms) => ms > nowMs);
    const nextMs = future.length ? Math.min(...future) : null;

    // If the end time is already passed (tab slept / clock drift), refresh immediately.
    const needsImmediateRefresh = candidates.some((ms) => ms <= nowMs - 10_000);
    if (needsImmediateRefresh) {
      const id = window.setTimeout(() => void load(false), 0);
      return () => window.clearTimeout(id);
    }

    if (!nextMs) return;
    const delay = Math.max(1200, nextMs - nowMs + 1500); // small buffer
    const id = window.setTimeout(() => void load(false), delay);
    return () => window.clearTimeout(id);
  }, [data?.tithi_end, data?.nak_end, data?.location.lat, data?.location.lon, load]);

  const sunrise = data ? new Date(data.sunrise) : null;
  const sunset = data ? new Date(data.sunset) : null;

  const isDay = useMemo(() => {
    if (!sunrise || !sunset) return true;
    return isBetween(now, sunrise, sunset);
  }, [now, sunrise, sunset]);

  const dayProgress = useMemo(() => {
    if (!sunrise || !sunset) return 0.5;
    const total = sunset.getTime() - sunrise.getTime();
    if (total <= 0) return 0.5;
    const p = (now.getTime() - sunrise.getTime()) / total;
    return clamp01(p);
  }, [now, sunrise, sunset]);

  const headerLine = useMemo(() => {
    if (!data) return "";
    return `${data.month} • ${data.paksha}`;
  }, [data]);

  const headerLine2 = useMemo(() => {
    if (!data) return "";
    return `${data.tithi} • ${data.nakshatra}`;
  }, [data]);

  const moonPercent = data ? Math.round(data.moon_phase * 100) : 0;

  return (
    <div className="relative min-h-full">
      <SkyBackground
        isDay={isDay}
        dayProgress={dayProgress}
        weather={weather}
        moonVisible={!isDay}
        moonIllumination={data?.moon_phase}
        moonWaxing={data?.moon_waxing}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex items-start justify-between gap-4"
        >
          <div className="min-w-0">
            <div className="text-white/70 font-semibold tracking-wide">Panchang Dashboard</div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mt-1">
              {data ? formatDateLong(data.date) : "—"}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full glass text-white/80 font-semibold">
                {data ? headerLine : "Loading…"}
              </span>
              <span className="px-3 py-1 rounded-full glass text-white/80 font-semibold">
                {data ? headerLine2 : "—"}
              </span>
            </div>
          </div>

          <div className="flex items-end flex-col gap-2">
            <div className="px-4 py-2 rounded-2xl glass shadow-glow">
              <LiveClock />
            </div>
            {data ? (
              <div className="px-3 py-1 rounded-full glass text-white/80 text-sm font-semibold">
                {weather === "clear" ? "☀️ Clear" : weather === "cloudy" ? "☁️ Cloudy" : "🌧️ Rain"}
              </div>
            ) : null}
            <div className="text-white/60 text-sm font-semibold">
              {data ? `${data.location.lat.toFixed(4)}, ${data.location.lon.toFixed(4)} • ${data.location.tz}` : ""}
            </div>
          </div>
        </motion.div>

        <div className="mt-8">
          <AnimatePresence>
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass rounded-3xl p-6 shadow-glass"
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-saffron animate-spin" />
                  <div className="text-white/80 font-semibold">Fetching Panchang…</div>
                </div>
              </motion.div>
            ) : null}

            {error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass rounded-3xl p-6 shadow-glass border border-red-400/30"
              >
                <div className="text-red-200 font-bold">Could not load Panchang</div>
                <div className="text-white/70 font-semibold mt-2">{error}</div>
                <div className="text-white/50 text-sm mt-3">
                  Make sure Django is running on <span className="text-white/80">127.0.0.1:8000</span>.
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Cards */}
        {data ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
          >
            <StatCard
              icon="🌅"
              title="Sunrise"
              value={formatLocalTime(data.sunrise)}
              sub="Local time"
              glow="sunrise"
              weather={weather}
            />
            <StatCard
              icon="🌇"
              title="Sunset"
              value={formatLocalTime(data.sunset)}
              sub="Local time"
              glow="sunset"
              weather={weather}
            />
            <StatCard
              icon="📿"
              title="Tithi"
              value={data.tithi}
              sub={`Ends ${formatLocalTime(data.tithi_end)}`}
              glow="tithi"
              weather={weather}
            />
            <StatCard
              icon="✨"
              title="Nakshatra"
              value={data.nakshatra}
              sub={`Ends ${formatLocalTime(data.nak_end)}`}
              glow="nak"
              weather={weather}
            />

            <StatCard icon="🌙" title="Paksha" value={data.paksha} glow="paksha" weather={weather} />
            <StatCard icon="📅" title="Hindu Month" value={data.month} glow="month" weather={weather} />

            <StatCard
              icon="🌙"
              title="Moon Phase"
              value={`${moonPercent}%`}
              sub={data.moon_waxing ? "Waxing" : "Waning"}
              glow="moon"
              weather={weather}
            >
              <div className="flex items-center justify-between gap-4">
                <MoonPhase illumination={data.moon_phase} waxing={data.moon_waxing} size={92} />
                <div className="text-white/70 font-semibold text-sm leading-relaxed">
                  Illumination is computed from the Moon–Sun elongation at sunrise.
                </div>
              </div>
            </StatCard>

            <StatCard
              icon="⏰"
              title="Rahu Kaal"
              value={`${formatLocalTime(data.rahu_start)}–${formatLocalTime(data.rahu_end)}`}
              sub="Daytime period"
              glow="rahu"
              weather={weather}
            />
          </motion.div>
        ) : null}

        <footer className="mt-10 pb-6 text-center text-white/70 font-semibold">
          Made with devotion 🪔
        </footer>
      </div>
    </div>
  );
}
