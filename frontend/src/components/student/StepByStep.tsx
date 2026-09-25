"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Footprints, Loader2, Pause, Play, RotateCcw, Sparkles, Square } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { explainLesson } from "@/lib/student";
import { onSpeakingChange, onVoiceAction, speak, stopSpeaking } from "@/lib/speech";

// Matnni 1-2 gapdan iborat qismlarga bo'lish (har bir qism ~300 belgidan oshmaydi)
export function splitIntoSteps(text: string, max = 300) {
  const sentences = (text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]*/g) ?? []).map((s) => s.trim()).filter(Boolean);
  const steps: string[] = [];
  let current = "";
  for (const s of sentences) {
    const sentencesInCurrent = (current.match(/[.!?]/g) ?? []).length;
    if (current && (current.length + s.length > max || sentencesInCurrent >= 2)) {
      steps.push(current);
      current = "";
    }
    current = current ? `${current} ${s}` : s;
  }
  if (current) steps.push(current);
  return steps;
}

// Bosqichma-bosqich o'rganish: dars qismlarga bo'linadi, har biri sekin o'qiladi va o'quvchi tayyor bo'lguncha kutiladi.
// "Batafsil tushuntir" — AI aynan shu qismni misollar bilan tushuntiradi. Ovozli buyruqlar: "Keyingi", "Oldingi", "Qayta"
export default function StepByStep({ lessonId, text }: { lessonId: number; text: string }) {
  const steps = useMemo(() => splitIntoSteps(text), [text]);
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(false); // qism tugagach o'zi keyingisiga o'tsinmi
  const [speaking, setSpeaking] = useState(false);
  const [explanation, setExplanation] = useState<{ step: number; text: string } | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRef = useRef(auto);
  // Eng so'nggi holat — setTimeout va ovozli buyruqlar eskirgan qiymatni ishlatmasin
  const stateRef = useRef<{ index: number; play: (i: number) => void }>({ index: 0, play: () => {} });
  useEffect(() => {
    autoRef.current = auto;
  });

  useEffect(() => onSpeakingChange(setSpeaking), []);

  const play = useCallback(
    async (i: number) => {
      const safe = Math.min(Math.max(i, 0), steps.length - 1);
      setIndex(safe);
      setError(null);
      const result = await speak(`${safe + 1}-qism. ${steps[safe]}`);
      if (!result.ok && result.error) setError(result.error);
      // Avtomatik rejim: qism tugagach 1.5 soniya kutib, keyingisiga o'tadi
      else if (result.ok && autoRef.current && safe < steps.length - 1) {
        setTimeout(() => autoRef.current && stateRef.current.play(safe + 1), 1500);
      }
    },
    [steps]
  );

  const explain = async () => {
    setExplaining(true);
    setError(null);
    try {
      const answer = await explainLesson(lessonId, [], steps[index]);
      setExplanation({ step: index, text: answer });
      speak(answer);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setExplaining(false);
    }
  };

  // Ovozli buyruqlar
  useEffect(() => {
    stateRef.current = { index, play };
  });
  useEffect(
    () =>
      onVoiceAction((action) => {
        const { index: i, play: p } = stateRef.current;
        if (action === "next") p(i + 1);
        if (action === "prev") p(i - 1);
        if (action === "repeat") p(i);
      }),
    []
  );

  useEffect(() => () => stopSpeaking(), []);

  if (steps.length < 2) return null;

  const progress = ((index + 1) / steps.length) * 100;

  return (
    <section aria-label="Bosqichma-bosqich o'rganish" className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 p-2 text-white shadow-md shadow-emerald-500/25">
            <Footprints className="size-5" aria-hidden />
          </div>
          <div>
            <h2 className="font-semibold">Bosqichma-bosqich o&apos;rganish</h2>
            <p className="text-sm text-slate-500">Har bir qism sekin o&apos;qiladi — tushunib olgach keyingisiga o&apos;ting</p>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="size-4 accent-emerald-600" />
          O&apos;zi davom etsin
        </label>
      </div>

      <div className="p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between text-sm font-medium text-slate-500">
          <span>
            {index + 1}-qism / {steps.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={steps.length}>
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <p aria-live="polite" className="min-h-[6rem] rounded-2xl bg-slate-50 px-5 py-5 text-xl leading-9 text-slate-800 ring-1 ring-slate-100">
          {steps[index]}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button onClick={() => play(index - 1)} disabled={index === 0} className="btn-secondary" aria-label="Oldingi qism">
            <ChevronLeft className="size-5" aria-hidden /> Oldingi
          </button>
          {speaking ? (
            <button onClick={() => { setAuto(false); stopSpeaking(); }} className="btn-secondary">
              <Square className="size-4" aria-hidden /> To&apos;xtatish
            </button>
          ) : (
            <button onClick={() => play(index)} className="btn-secondary">
              {index === 0 ? <Play className="size-4" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
              {index === 0 ? "Boshlash" : "Qayta tinglash"}
            </button>
          )}
          <button onClick={() => play(index + 1)} disabled={index >= steps.length - 1} className="btn-primary" aria-label="Keyingi qism">
            Keyingi <ChevronRight className="size-5" aria-hidden />
          </button>
          <button onClick={explain} disabled={explaining} className="btn-secondary ml-auto">
            {explaining ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4 text-indigo-500" aria-hidden />}
            Shu qismni batafsil tushuntir
          </button>
        </div>

        {auto && speaking && (
          <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700">
            <Pause className="size-4" aria-hidden /> Avtomatik rejim: har qismdan keyin qisqa pauza qilinadi
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-amber-900 ring-1 ring-amber-200">
            {error}
          </p>
        )}

        {explanation && explanation.step === index && (
          <div className="mt-5 rounded-2xl bg-indigo-50 p-5 ring-1 ring-indigo-100">
            <p className="mb-2 flex items-center gap-2 font-semibold text-indigo-900">
              <Sparkles className="size-4" aria-hidden /> {index + 1}-qism tushuntirishi
            </p>
            <p className="text-lg leading-8 whitespace-pre-wrap text-slate-800">{explanation.text}</p>
          </div>
        )}

        <p className="mt-5 text-sm text-slate-500">
          Ovoz bilan: <b>“Keyingi”</b>, <b>“Oldingi”</b>, <b>“Qayta”</b>. Tezlikni yuqoridagi 🐢 tugmasi bilan o&apos;zgartiring.
        </p>
      </div>
    </section>
  );
}
