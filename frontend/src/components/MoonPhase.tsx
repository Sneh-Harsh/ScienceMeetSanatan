import { motion } from "framer-motion";

type Props = {
  illumination: number; // 0..1
  waxing: boolean;
  size?: number;
};

// SVG moon phase using a mask: base circle + shifted circle to create terminator.
export function MoonPhase({ illumination, waxing, size = 96 }: Props) {
  const frac = Math.max(0, Math.min(1, illumination));
  // terminator offset: 1 full -> 0 offset; 0 new -> max offset
  // Map illumination to offset in [-r, r]
  const r = 50;
  const k = 1 - 2 * frac; // full= -1, new=1 (we invert below)
  const offset = (waxing ? 1 : -1) * k * r;

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className="drop-shadow-[0_0_18px_rgba(200,220,255,.14)]"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <defs>
        <radialGradient id="glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="rgba(255,255,255,.95)" />
          <stop offset="60%" stopColor="rgba(220,230,255,.70)" />
          <stop offset="100%" stopColor="rgba(170,190,255,.25)" />
        </radialGradient>
        <mask id="phaseMask">
          <rect x="0" y="0" width="120" height="120" fill="black" />
          <circle cx="60" cy="60" r={r} fill="white" />
          <circle cx={60 + offset} cy="60" r={r} fill="black" />
        </mask>
      </defs>

      {/* dark disk */}
      <circle cx="60" cy="60" r={r} fill="rgba(15,23,42,.85)" />

      {/* illuminated portion */}
      <g mask="url(#phaseMask)">
        <circle cx="60" cy="60" r={r} fill="url(#glow)" />
      </g>

      {/* subtle pulse */}
      <motion.circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="rgba(200,220,255,.10)"
        strokeWidth="2"
        animate={{ opacity: [0.25, 0.65, 0.25] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.svg>
  );
}

