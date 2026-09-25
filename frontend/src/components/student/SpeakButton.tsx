"use client";

import { useEffect, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { onSpeakingChange, speak, stopSpeaking } from "@/lib/speech";

// Matnni ovoz bilan o'qib berish / to'xtatish
export default function SpeakButton({ text, label = "Ovoz bilan o'qish" }: { text: string; label?: string }) {
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
      className="btn-secondary px-3 py-1.5 text-sm"
      aria-pressed={active}
    >
      {active ? <Square className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
      {active ? "To'xtatish" : label}
    </button>
  );
}
