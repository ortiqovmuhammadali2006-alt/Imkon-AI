// Imkon robotchasining yuzi (SVG). Holat: idle — suzadi va ko'z pirpiratadi, listening — antenna qizil,
// thinking — ko'zlar yuqoriga qaraydi, antenna tez yonib-o'chadi, speaking — og'iz qimirlaydi.
// Animatsiyalar globals.css (robot-*), "harakatni kamaytirish" yoqilgan bo'lsa to'xtaydi
export type RobotState = "idle" | "listening" | "thinking" | "speaking";

const ANTENNA: Record<RobotState, string> = {
  idle: "#fcd34d",
  listening: "#ef4444",
  thinking: "#a5b4fc",
  speaking: "#34d399",
};

export default function RobotFace({ state = "idle", className = "" }: { state?: RobotState; className?: string }) {
  const eyeY = state === "thinking" ? 26.5 : 29;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      {/* antenna */}
      <line x1="32" y1="6" x2="32" y2="13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-indigo-700" />
      <circle cx="32" cy="5.5" r="3.6" fill={ANTENNA[state]} className={state === "thinking" ? "robot-antenna-fast" : "robot-antenna"} />
      {/* quloqlar */}
      <rect x="5" y="25" width="7" height="12" rx="3.5" className="fill-indigo-400" />
      <rect x="52" y="25" width="7" height="12" rx="3.5" className="fill-indigo-400" />
      {/* bosh */}
      <rect x="10" y="12" width="44" height="37" rx="15" className="fill-indigo-600" />
      <rect x="10" y="12" width="44" height="18" rx="15" fill="white" opacity="0.08" />
      {/* yuz ekrani */}
      <rect x="16" y="19" width="32" height="23" rx="10" fill="#eef2ff" />
      {/* ko'zlar */}
      <g className={state === "idle" || state === "speaking" ? "robot-blink" : ""} style={{ transformOrigin: `32px ${eyeY}px` }}>
        <ellipse cx="25.5" cy={eyeY} rx="3.2" ry="3.6" fill="#1e1b4b" />
        <ellipse cx="38.5" cy={eyeY} rx="3.2" ry="3.6" fill="#1e1b4b" />
        <circle cx="26.6" cy={eyeY - 1.3} r="1" fill="white" />
        <circle cx="39.6" cy={eyeY - 1.3} r="1" fill="white" />
      </g>
      {/* yonoqlar */}
      <circle cx="21" cy="35" r="2.4" className="fill-indigo-200" opacity="0.9" />
      <circle cx="43" cy="35" r="2.4" className="fill-indigo-200" opacity="0.9" />
      {/* og'iz */}
      {state === "speaking" ? (
        <ellipse cx="32" cy="36" rx="3.6" ry="2.2" fill="#1e1b4b" className="robot-talk" style={{ transformOrigin: "32px 36px" }} />
      ) : state === "listening" ? (
        <circle cx="32" cy="36" r="2" fill="#1e1b4b" />
      ) : (
        <path d="M27 35 Q32 39.5 37 35" fill="none" stroke="#1e1b4b" strokeWidth="2.2" strokeLinecap="round" />
      )}
      {/* tana */}
      <rect x="21" y="48" width="22" height="11" rx="5.5" className="fill-indigo-500" />
      <circle cx="32" cy="53.5" r="2.2" fill={ANTENNA[state]} />
    </svg>
  );
}
