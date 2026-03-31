import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { WeatherKind } from "../utils/weather";
import { MoonPhase } from "./MoonPhase";

type Props = {
  isDay: boolean;
  dayProgress: number; // 0..1 (sun position)
  weather: WeatherKind;
  moonVisible: boolean;
  moonIllumination?: number; // 0..1
  moonWaxing?: boolean;
};

type Star = { x: number; y: number; s: number; d: number };

export function SkyBackground({ isDay, dayProgress, weather, moonVisible, moonIllumination = 0.55, moonWaxing = true }: Props) {
  const stars = useMemo<Star[]>(() => {
    const out: Star[] = [];
    for (let i = 0; i < 90; i++) {
      out.push({
        x: Math.random() * 100,
        y: Math.random() * 60,
        s: 0.6 + Math.random() * 1.6,
        d: 1.5 + Math.random() * 3.2,
      });
    }
    return out;
  }, []);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1200);
    return () => window.clearInterval(id);
  }, []);

  const sunX = 10 + dayProgress * 80;
  const sunY = 70 - Math.sin(dayProgress * Math.PI) * 52;
  const showClouds = weather === "cloudy" || weather === "rain";
  const showRain = weather === "rain";

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* gradient sky */}
      <motion.div
        className="absolute inset-0"
        animate={{
          opacity: 1,
          background: isDay
            ? "radial-gradient(1200px 800px at 30% 20%, rgba(120,190,255,.45), transparent 60%), linear-gradient(180deg, #1b4b8f 0%, #0f172a 65%)"
            : "radial-gradient(900px 700px at 70% 30%, rgba(180,120,255,.18), transparent 60%), linear-gradient(180deg, #070a14 0%, #0f172a 75%)",
        }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />

      {/* sun */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 130, height: 130, left: `${sunX}%`, top: `${sunY}%` }}
        animate={{ opacity: isDay ? 1 : 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-saffron to-gold blur-[2px]" />
        <div className="absolute inset-0 rounded-full bg-[rgba(255,180,90,.22)] blur-[26px]" />
      </motion.div>

      {/* night stars */}
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: isDay ? 0 : 1 }}
        transition={{ duration: 0.9 }}
      >
        {stars.map((s, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s }}
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ duration: s.d, repeat: Infinity, ease: "easeInOut", delay: (i % 10) * 0.05 + (tick % 3) * 0.02 }}
          />
        ))}
      </motion.div>

      {/* moon (background, not blurry) */}
      <motion.div
        className="absolute right-[8%] top-[10%] relative"
        animate={{ opacity: moonVisible ? 1 : 0, y: [0, -2, 0] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute inset-0 rounded-full bg-[rgba(200,220,255,.14)] blur-[26px]" />
        <MoonPhase illumination={moonIllumination} waxing={moonWaxing} size={160} />
      </motion.div>

      {/* volumetric clouds (Apple Weather-like) */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={
          {
            // Cloud tint shifts a bit at night for depth.
            ["--cloudTint" as any]: isDay ? "rgba(255,255,255,.26)" : "rgba(230,240,255,.18)",
            ["--cloudShadow" as any]: isDay ? "rgba(0,0,0,.20)" : "rgba(0,0,0,.35)",
          } as any
        }
        animate={{ opacity: showClouds ? 1 : 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="sky-cloud sky-cloud--a" />
        <div className="sky-cloud sky-cloud--b" />
        <div className="sky-cloud sky-cloud--c" />
        <div className="sky-cloud sky-cloud--d" />
      </motion.div>

      {/* 3D rain (layered parallax streaks + mist) */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: showRain ? 1 : 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="sky-rain-wrap">
          <div className="sky-rain sky-rain--far" />
          <div className="sky-rain sky-rain--mid" />
          <div className="sky-rain sky-rain--near" />
        </div>
        <div className="sky-rain-mist" />
      </motion.div>

      <style>{`
        /* Clouds */
        .sky-cloud {
          position: absolute;
          left: -40%;
          width: 180%;
          height: 62%;
          border-radius: 999px;
          filter: blur(28px) drop-shadow(0 22px 38px var(--cloudShadow));
          background-image:
            radial-gradient(closest-side at 18% 60%, var(--cloudTint), rgba(255,255,255,0) 70%),
            radial-gradient(closest-side at 32% 45%, rgba(255,255,255,.11), rgba(255,255,255,0) 72%),
            radial-gradient(closest-side at 48% 62%, rgba(255,255,255,.10), rgba(255,255,255,0) 74%),
            radial-gradient(closest-side at 64% 48%, rgba(255,255,255,.10), rgba(255,255,255,0) 74%),
            radial-gradient(closest-side at 80% 60%, rgba(255,255,255,.09), rgba(255,255,255,0) 72%);
          mix-blend-mode: normal;
          opacity: 0.95;
        }
        .sky-cloud--a { top: -10%; transform: translate3d(-6%, 0, 0) scale(1.06); animation: skyCloudA 34s linear infinite; }
        .sky-cloud--b { top: 2%; height: 70%; filter: blur(34px) drop-shadow(0 24px 44px var(--cloudShadow)); opacity: 0.78; animation: skyCloudB 44s linear infinite; }
        .sky-cloud--c { top: 16%; height: 56%; filter: blur(24px) drop-shadow(0 18px 30px var(--cloudShadow)); opacity: 0.58; animation: skyCloudC 56s linear infinite; }
        .sky-cloud--d { top: 8%; height: 48%; filter: blur(18px) drop-shadow(0 12px 26px var(--cloudShadow)); opacity: 0.46; animation: skyCloudD 62s linear infinite; }

        @keyframes skyCloudA {
          0% { transform: translate3d(-10%, -2%, 0) scale(1.08); }
          50% { transform: translate3d(2%, 2%, 0) scale(1.10); }
          100% { transform: translate3d(-10%, -2%, 0) scale(1.08); }
        }
        @keyframes skyCloudB {
          0% { transform: translate3d(4%, 2%, 0) scale(1.14); }
          50% { transform: translate3d(-6%, -1%, 0) scale(1.16); }
          100% { transform: translate3d(4%, 2%, 0) scale(1.14); }
        }
        @keyframes skyCloudC {
          0% { transform: translate3d(-2%, 1%, 0) scale(1.05); }
          50% { transform: translate3d(8%, -1%, 0) scale(1.07); }
          100% { transform: translate3d(-2%, 1%, 0) scale(1.05); }
        }
        @keyframes skyCloudD {
          0% { transform: translate3d(8%, -1%, 0) scale(1.03); }
          50% { transform: translate3d(-2%, 2%, 0) scale(1.05); }
          100% { transform: translate3d(8%, -1%, 0) scale(1.03); }
        }

        /* Rain */
        .sky-rain-wrap {
          position: absolute;
          inset: -12% -8%;
          transform: perspective(900px) rotateX(10deg) rotateZ(-4deg);
          transform-origin: 50% 20%;
          filter: blur(0.2px);
        }
        .sky-rain {
          position: absolute;
          inset: 0;
          background-size: 180% 180%;
          mix-blend-mode: normal;
          opacity: 0.0;
        }
        .sky-rain--far {
          opacity: 0.34;
          background-image: repeating-linear-gradient(
            112deg,
            rgba(190,220,255,0.26) 0 1px,
            rgba(190,220,255,0) 1px 16px
          );
          animation: skyRainFar 1.25s linear infinite;
        }
        .sky-rain--mid {
          opacity: 0.42;
          background-image: repeating-linear-gradient(
            112deg,
            rgba(215,235,255,0.32) 0 1.5px,
            rgba(215,235,255,0) 1.5px 14px
          );
          animation: skyRainMid 0.82s linear infinite;
        }
        .sky-rain--near {
          opacity: 0.36;
          filter: blur(0.6px);
          background-image: repeating-linear-gradient(
            112deg,
            rgba(235,245,255,0.36) 0 2.2px,
            rgba(235,245,255,0) 2.2px 18px
          );
          animation: skyRainNear 0.55s linear infinite;
        }
        .sky-rain-mist {
          position: absolute;
          inset: 0;
          background: radial-gradient(800px 420px at 40% 18%, rgba(255,255,255,.10), rgba(255,255,255,0) 65%),
                      linear-gradient(180deg, rgba(120,160,255,.10), rgba(15,23,42,0) 42%, rgba(15,23,42,.15));
          opacity: 0.55;
          filter: blur(10px);
          animation: skyMist 6.5s ease-in-out infinite;
        }
        @keyframes skyRainFar { from { background-position: 0% -40%; } to { background-position: -25% 160%; } }
        @keyframes skyRainMid { from { background-position: 0% -55%; } to { background-position: -35% 180%; } }
        @keyframes skyRainNear { from { background-position: 0% -80%; } to { background-position: -55% 220%; } }
        @keyframes skyMist { 0%, 100% { transform: translateY(0); opacity: 0.48; } 50% { transform: translateY(1.5%); opacity: 0.62; } }
      `}</style>
    </div>
  );
}
