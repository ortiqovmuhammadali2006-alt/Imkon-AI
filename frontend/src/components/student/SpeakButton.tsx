"use client";

import { useEffect, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { onSpeakingChange, speak, stopSpeaking } from "@/lib/speech";

// Matnni ovoz bilan o'qib berish / to'xtatish
// variant="hero" — rangli fon ustida katta oq tugma
export default function SpeakButton({
  text,
  label = "Ovoz bilan o'qish",
  variant = "default",
}: {
  text: string;
  label?: string;
  variant?: "default" | "hero";
}) {
  const [mine, setMine] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => onSpeakingChange(setSpeaking), []);
  const active = mine && speaking;

  return (
    <button
      type="button"
      onClick={() => {
        if (active) {
          stopSpeaking();
          return;
        }
        setMine(true);
        speak(text).finally(() => setMine(false));
      }}
      className={
        variant === "hero"
          ? "inline-flex items-center gap-2 rounded-xl bg-surface px-5 py-3 font-semibold text-indigo-700 shadow-lg shadow-black/10 transition-all hover:bg-indigo-50 active:scale-[0.98]"
          : "btn-secondary px-3 py-1.5 text-sm"
      }
      aria-pressed={active}
    >
      {active ? <Square className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
      {active ? "To'xtatish" : label}
    </button>
  );
}
