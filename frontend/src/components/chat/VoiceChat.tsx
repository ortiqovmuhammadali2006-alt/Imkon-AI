"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Keyboard, Loader2, Mic, MicOff, Square, X } from "lucide-react";
import { listenOnce, RecognitionError, speak, stopSpeaking } from "@/lib/speech";
import { voiceMode } from "@/lib/voiceMode";

type Phase = "listening" | "thinking" | "speaking" | "paused" | "error";

const PHASE_TEXT: Record<Phase, string> = {
  listening: "Tinglayapman...",
  thinking: "O'ylayapman...",
  speaking: "Gapiryapman...",
  paused: "Gapirish uchun mikrofonni bosing",
  error: "Mikrofon ishlamayapti",
};

// Ovozli suhbat: tinglash -> AI javobi -> ovoz bilan aytish -> yana tinglash (qo'l tegizmasdan).
// onSend — xabarni yuboradi va javob matnini qaytaradi (chat oynasida ham ko'rinadi)
export default function VoiceChat({
  onSend,
  onClose,
}: {
  onSend: (text: string, onDelta: (answer: string) => void, signal: AbortSignal) => Promise<string>;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("listening");
  const [heard, setHeard] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    activeRef.current = false;
    abortRef.current?.abort();
    stopSpeaking();
  }, []);

  const run = useCallback(async () => {
    activeRef.current = true;
    setError(null);
    let silentRounds = 0;
    while (activeRef.current) {
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      // 1. Tinglash
      setPhase("listening");
      setHeard("");
      let text = "";
      try {
        text = await listenOnce(setHeard, ctrl.signal);
      } catch (e) {
        if (!activeRef.current) return;
        const code = e instanceof RecognitionError ? e.code : "";
        if (code === "no-speech") {
          // 2 marta jimlik bo'lsa — to'xtab, bosishni kutamiz
          if (++silentRounds >= 2) {
            activeRef.current = false;
            setPhase("paused");
            return;
          }
          continue;
        }
        activeRef.current = false;
        setPhase("error");
        setError((e as Error).message);
        return;
      }
      silentRounds = 0;
      if (!activeRef.current) return;
      setHeard(text);

      // 2. AI javobi (oqim bilan)
      setPhase("thinking");
      setAnswer("");
      let reply = "";
      try {
        reply = await onSend(text, setAnswer, ctrl.signal);
      } catch {
        reply = "";
      }
      if (!activeRef.current) return;
      if (!reply) {
        setPhase("paused");
        activeRef.current = false;
        return;
      }

      // 3. Ovoz bilan aytish, keyin yana tinglash
      setPhase("speaking");
      const result = await speak(reply);
      if (!result.ok && result.error) setError(result.error);
    }
  }, [onSend]);

  // Ochilganda boshlaymiz; umumiy "Ovoz rejimi" mikrofonni band qilmasligi uchun vaqtincha o'chiriladi
  useEffect(() => {
    const hadVoiceMode = voiceMode.enabled;
    if (hadVoiceMode) voiceMode.disable();
    const id = setTimeout(run, 0);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      document.removeEventListener("keydown", onKey);
      stop();
      if (hadVoiceMode) voiceMode.enable();
    };
  }, [run, stop, onClose]);

  const orbTone =
    phase === "listening"
      ? "from-rose-500 to-orange-400 shadow-rose-500/40"
      : phase === "speaking"
        ? "from-emerald-500 to-teal-400 shadow-emerald-500/40"
        : phase === "error"
          ? "from-slate-500 to-slate-600 shadow-slate-500/30"
          : "from-indigo-500 to-violet-500 shadow-indigo-500/40";

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Ovozli suhbat" className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-gray-950/95 text-white backdrop-blur-xl">
      <div className="flex items-center justify-between px-5 py-4">
        <p className="font-semibold">Ovozli suhbat</p>
        <button onClick={onClose} className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Yopish">
          <X className="size-6" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 text-center">
        {/* Holatga qarab rangi va harakati o'zgaradigan "shar" */}
        <div className="relative flex size-56 items-center justify-center">
          {(phase === "listening" || phase === "speaking") && (
            <>
              <span className={`absolute inset-0 animate-ping rounded-full bg-gradient-to-br opacity-20 ${orbTone}`} />
              <span className={`absolute inset-4 animate-pulse rounded-full bg-gradient-to-br opacity-30 ${orbTone}`} />
            </>
          )}
          <div className={`relative flex size-40 items-center justify-center rounded-full bg-gradient-to-br shadow-2xl transition-all duration-500 ${orbTone} ${phase === "speaking" ? "scale-110" : ""}`}>
            {phase === "thinking" ? (
              <Loader2 className="size-14 animate-spin" aria-hidden />
            ) : phase === "speaking" ? (
              <div className="flex h-14 items-center gap-1.5" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="w-2 animate-bounce rounded-full bg-white" style={{ height: `${28 + (i % 3) * 14}px`, animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
            ) : phase === "error" ? (
              <MicOff className="size-14" aria-hidden />
            ) : (
              <Mic className="size-14" aria-hidden />
            )}
          </div>
        </div>

        <div className="max-w-2xl space-y-4" aria-live="polite">
          <p className="text-lg font-medium text-white/80">{PHASE_TEXT[phase]}</p>
          {heard && <p className="text-2xl font-semibold">“{heard}”</p>}
          {answer && phase !== "listening" && <p className="line-clamp-6 text-lg leading-8 text-white/75">{answer.replace(/[*#`>|]/g, "")}</p>}
          {error && <p className="rounded-xl bg-red-500/15 px-4 py-3 text-red-200">{error}</p>}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 px-6 pb-10">
        {phase === "paused" || phase === "error" ? (
          <button onClick={run} className="flex items-center gap-2 rounded-full bg-white px-6 py-3.5 font-semibold text-gray-900 shadow-lg hover:bg-white/90">
            <Mic className="size-5" aria-hidden /> Gapirish
          </button>
        ) : (
          <button
            onClick={() => {
              stop();
              setPhase("paused");
            }}
            className="flex items-center gap-2 rounded-full bg-white/10 px-6 py-3.5 font-semibold ring-1 ring-white/20 hover:bg-white/20"
          >
            <Square className="size-5" aria-hidden /> To&apos;xtatish
          </button>
        )}
        <button onClick={onClose} className="flex items-center gap-2 rounded-full bg-white/10 px-6 py-3.5 font-semibold ring-1 ring-white/20 hover:bg-white/20">
          <Keyboard className="size-5" aria-hidden /> Yozishga qaytish
        </button>
      </div>
    </div>,
    document.body
  );
}
