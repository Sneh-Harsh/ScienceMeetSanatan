import { motion } from "framer-motion";
import React from "react";
import type { WeatherKind } from "../utils/weather";

type Props = {
  icon: string;
  title: string;
  value: string;
  sub?: string;
  glow: "sunrise" | "sunset" | "tithi" | "nak" | "paksha" | "month" | "moon" | "rahu";
  children?: React.ReactNode;
  weather?: WeatherKind;
};

const glowMap: Record<Props["glow"], string> = {
  sunrise: "from-orange-400/25 to-amber-300/10",
  sunset: "from-pink-400/25 to-fuchsia-300/10",
  tithi: "from-gold/25 to-saffron/10",
  nak: "from-sky-400/25 to-indigo-300/10",
  paksha: "from-violet-400/25 to-purple-300/10",
  month: "from-saffron/25 to-gold/10",
  moon: "from-slate-200/18 to-indigo-300/10",
  rahu: "from-rose-400/20 to-red-300/10",
};

export function StatCard({ icon, title, value, sub, glow, children, weather = "clear" }: Props) {
  return (
    <motion.div
      className={`relative rounded-3xl glass glow-border p-5 shadow-glass overflow-hidden`}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${glowMap[glow]} opacity-70`} />
      {/* Weather layer: subtle, real-time ambience inside cards */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className={`card-weather-layer card-weather-layer--${weather} card-weather-layer--a`} />
        <div className={`card-weather-layer card-weather-layer--${weather} card-weather-layer--b`} />
      </div>
      <div className="relative z-10 flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-xl">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-white/70 text-sm font-semibold">{title}</div>
          <div className="text-white text-xl font-extrabold tracking-tight">{value}</div>
          {sub ? <div className="text-white/65 text-sm font-semibold mt-1">{sub}</div> : null}
        </div>
      </div>
      {children ? <div className="relative z-10 mt-4">{children}</div> : null}
    </motion.div>
  );
}
