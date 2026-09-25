"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  AudioLines,
  Bot,
  Check,
  CheckCircle2,
  CircleDot,
  HelpCircle,
  Loader2,
  Mic,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStudentProfile } from "@/lib/student";
import { createSpeechStream, listenOnce, onChatAsk, RecognitionError, stopSpeaking, type SpeechStream } from "@/lib/speech";
import { streamTutor, useTutor, type Evaluation, type TutorPlan, type TutorState, type TutorTurn } from "@/lib/tutor";
import { getErrorMessage } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import { ErrorState, LoadingState } from "@/components/ui/States";
import Markdown from "@/components/chat/Markdown";
import VoiceChat from "@/components/chat/VoiceChat";
import SpeakButton from "@/components/student/SpeakButton";

type UiTurn = TutorTurn & { streaming?: boolean; error?: boolean };

const EVAL_CHIP: Record<Evaluation, { label: string; className: string }> = {
  correct: { label: "To'g'ri javob", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  partial: { label: "Qisman to'g'ri", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  wrong: { label: "Xato — birga tuzatamiz", className: "bg-red-50 text-red-700 ring-red-200" },
};

const AUTO_READ_KEY = "imkon_tutor_autoread";

// Dars rejasi: qismlar va holati (o'tildi / hozir / navbatda)
function PlanPanel({ plan, current, finished }: { plan: TutorPlan | null; current: number; finished: boolean }) {
  if (!plan) {
    return (
      <div className="space-y-2" aria-label="Reja tayyorlanmoqda">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-12" />
        ))}
      </div>
    );
  }
  const done = finished ? plan.parts.length : current - 1;
  const percent = Math.round((done / plan.parts.length) * 100);
  return (
    <div>
      {plan.goal && (
        <p className="mb-4 rounded-2xl bg-indigo-50 p-3 text-sm leading-6 text-indigo-900">
          <span className="font-semibold">Maqsad: </span>
          {plan.goal}
        </p>
      )}
      <div className="mb-4">
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="font-medium text-slate-600">O&apos;zlashtirish</span>
          <span className="font-semibold text-slate-900">
            {done}/{plan.parts.length}
          </span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Dars bo'yicha jarayon"
        >
          <div className="h-full rounded-full bg-indigo-600 transition-all duration-500" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <ol className="space-y-2">
        {plan.parts.map((p, i) => {
          const n = i + 1;
          const state = finished || n < current ? "done" : n === current ? "now" : "next";
          return (
            <li
              key={n}
              aria-current={state === "now" ? "step" : undefined}
              className={`flex gap-3 rounded-2xl p-3 ${state === "now" ? "bg-surface shadow-sm ring-2 ring-indigo-300" : ""}`}
            >
              <span
                className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  state === "done" ? "bg-emerald-500 text-white" : state === "now" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                }`}
                aria-hidden
              >
                {state === "done" ? <Check className="size-4" /> : n}
              </span>
              <span className="min-w-0">
                <span className={`block font-semibold ${state === "next" ? "text-slate-500" : "text-slate-900"}`}>{p.title}</span>
                {p.summary && <span className="block text-sm text-slate-500">{p.summary}</span>}
                <span className="sr-only">{state === "done" ? "o'zlashtirildi" : state === "now" ? "hozir o'rganilmoqda" : "navbatda"}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const TurnItem = memo(function TurnItem({ t, userName }: { t: UiTurn; userName: string }) {
  if (t.role === "user") {
    return (
      <div className="flex justify-end gap-3">
        <p
          className={`max-w-[85%] rounded-3xl rounded-br-md px-4 py-2.5 text-lg whitespace-pre-wrap ${
            t.kind === "mode" ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200" : "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
          }`}
        >
          {t.kind === "mode" && <HelpCircle className="mr-1.5 inline size-5 align-[-0.2em]" aria-hidden />}
          {t.content}
        </p>
        <Avatar name={userName} size="sm" />
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/25">
        <Bot className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        {t.evaluation && (
          <span className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${EVAL_CHIP[t.evaluation].className}`}>
            {t.evaluation === "correct" ? <CheckCircle2 className="size-4" aria-hidden /> : <CircleDot className="size-4" aria-hidden />}
            {EVAL_CHIP[t.evaluation].label}
          </span>
        )}
        {t.error ? (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-red-800 ring-1 ring-red-100">
            {t.content}
          </p>
        ) : t.content ? (
          <div className="rounded-3xl rounded-tl-md bg-surface px-5 py-4 text-lg leading-8 text-slate-800 shadow-sm ring-1 ring-slate-200/70">
            <Markdown>{t.content}</Markdown>
            {t.streaming && <span className="ml-1 inline-block h-5 w-2 animate-pulse rounded-sm bg-indigo-500 align-middle" aria-hidden />}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 py-3" role="status">
            {[0, 150, 300].map((d) => (
              <span key={d} className="size-2.5 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: `${d}ms` }} />
            ))}
            <span className="sr-only">AI Tutor o&apos;ylamoqda</span>
          </div>
        )}
        {!t.streaming && !t.error && t.content && (
          <div className="mt-2">
            <SpeakButton text={t.content} label="Tinglash" />
          </div>
        )}
      </div>
    </div>
  );
});

// AI Tutor seansi: tushuntirish → pauza → savol → javob → baho → moslashtirilgan davom.
// Serverdagi holat yuklangach, sahifa shu holat bilan darhol chiziladi (oldingi navbatlar, joriy qism)
export default function TutorSession({ lessonId }: { lessonId: number }) {
  const { data, isLoading, error } = useTutor(lessonId);
  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={getErrorMessage(error)} />;
  return <TutorView lessonId={lessonId} data={data} />;
}

function TutorView({ lessonId, data }: { lessonId: number; data: TutorState }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useStudentProfile();

  const [turns, setTurns] = useState<UiTurn[]>(data.turns);
  const [plan, setPlan] = useState<TutorPlan | null>(data.plan);
  const [current, setCurrent] = useState(data.session?.current_part ?? 1);
  const [finished, setFinished] = useState(data.session?.finished ?? false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [dictating, setDictating] = useState(false);
  const [modesOpen, setModesOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [autoRead, setAutoRead] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busyRef = useRef(false);

  // AI javobini ovoz bilan o'qish: saqlangan tanlov, bo'lmasa — ko'rishi cheklangan o'quvchiga yoqiq
  useEffect(() => {
    if (autoRead !== null || !profile) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(AUTO_READ_KEY);
    } catch {}
    const id = setTimeout(() => setAutoRead(saved ? saved === "1" : profile.category === "visual"), 0);
    return () => clearTimeout(id);
  }, [profile, autoRead]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  // "Tushunmadim" menyusi: tashqariga bosilsa yoki Esc — yopiladi
  const modesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!modesOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!modesRef.current?.contains(e.target as Node)) setModesOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setModesOpen(false);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [modesOpen]);

  const toggleAutoRead = () => {
    const next = !autoRead;
    setAutoRead(next);
    try {
      localStorage.setItem(AUTO_READ_KEY, next ? "1" : "0");
    } catch {}
    if (!next) stopSpeaking();
  };

  // Bitta navbat: o'quvchi xabari (yoki usul) → AI javobi oqim bilan. Javob matnini qaytaradi (ovozli dars uchun)
  const send = useCallback(
    async (
      body: { message?: string; mode?: string; restart?: boolean },
      opts: { voice?: boolean; onDelta?: (t: string) => void; signal?: AbortSignal; shown?: string } = {}
    ) => {
      if (busyRef.current) return "";
      busyRef.current = true;
      setBusy(true);
      setModesOpen(false);
      const userTurn: UiTurn | null =
        body.message || body.mode
          ? { role: "user", content: opts.shown ?? body.message ?? "", kind: body.mode ? "mode" : "message", evaluation: null, part: null }
          : null;
      const pending: UiTurn = { role: "assistant", content: "", kind: "message", evaluation: null, part: null, streaming: true };
      setTurns((ts) => [...(body.restart ? [] : ts), ...(userTurn ? [userTurn] : []), pending]);
      if (body.restart) {
        setFinished(false);
        setCurrent(1);
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      opts.signal?.addEventListener("abort", () => ctrl.abort(), { once: true });
      // Matnli rejimda "AI ovoz bilan o'qisin" yoqilgan bo'lsa — gap tayyor bo'lishi bilan o'qiladi
      const reader: SpeechStream | null = !opts.voice && autoRead ? createSpeechStream() : null;

      const updateLast = (patch: Partial<UiTurn>) =>
        setTurns((ts) => {
          const copy = [...ts];
          copy[copy.length - 1] = { ...copy[copy.length - 1], ...patch };
          return copy;
        });

      const result = await streamTutor(lessonId, { ...body, voice: opts.voice }, {
        signal: ctrl.signal,
        onPlan: setPlan,
        onDelta: (t) => {
          updateLast({ content: t });
          opts.onDelta?.(t);
          reader?.push(t);
        },
      });

      if (result.text) {
        updateLast({ streaming: false, evaluation: result.done?.evaluation ?? null });
        if (result.done) {
          setCurrent(result.done.part);
          setFinished(result.done.finished);
        }
        reader?.end(result.text);
      } else {
        reader?.stop();
        updateLast({ streaming: false, error: true, content: result.aborted ? "To'xtatildi." : result.error ?? "AI javob bermadi." });
      }
      busyRef.current = false;
      setBusy(false);
      queryClient.invalidateQueries({ queryKey: ["student", "tutor", lessonId] });
      return result.text;
    },
    [lessonId, autoRead, queryClient]
  );

  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });

  // Ovozli boshqaruv ("Ovoz rejimi"): aytilgan gap javob sifatida yuboriladi
  useEffect(() => onChatAsk((text) => void sendRef.current({ message: text })), []);

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    send({ message: text });
  };

  const dictate = async () => {
    setDictating(true);
    try {
      const heard = await listenOnce((t) => setInput(t), undefined, { pauseMs: 1800 });
      setInput(heard);
      inputRef.current?.focus();
    } catch (e) {
      if (!(e instanceof RecognitionError && e.code === "aborted")) toast.error((e as Error).message);
    } finally {
      setDictating(false);
    }
  };

  const voiceSend = useCallback(
    (text: string, onDelta: (t: string) => void, signal: AbortSignal) => sendRef.current({ message: text }, { voice: true, onDelta, signal }),
    []
  );
  const closeVoice = useCallback(() => setVoiceOpen(false), []);

  const started = turns.length > 0;
  const lastAi = [...turns].reverse().find((t) => t.role === "assistant" && !t.error && t.content)?.content;
  const evals = turns.filter((t) => t.evaluation).map((t) => t.evaluation as Evaluation);
  const count = (e: Evaluation) => evals.filter((x) => x === e).length;

  return (
    <section className="space-y-4">
      <Link
        href={`/student/lessons/${lessonId}`}
        className="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-slate-500 hover:bg-surface hover:text-indigo-700"
      >
        <ArrowLeft className="size-4" aria-hidden /> Darsga qaytish
      </Link>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Dars rejasi */}
        <aside className="card h-fit p-5 lg:sticky lg:top-24" aria-label="Dars rejasi">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-indigo-700">
            <Sparkles className="size-4" aria-hidden /> AI Tutor
          </p>
          <h1 className="mb-4 text-xl font-bold tracking-tight text-slate-900">{data.lesson.title}</h1>
          <PlanPanel plan={plan} current={current} finished={finished} />
        </aside>

        {/* Dars jarayoni */}
        <div className="card flex h-[calc(100dvh-10rem)] min-h-[520px] flex-col overflow-hidden">
          <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
            <p className="min-w-0 flex-1 truncate text-sm text-slate-500">
              {data.lesson.subject && <span className="font-semibold text-slate-700">{data.lesson.subject} · </span>}
              {data.lesson.teacher_name}
            </p>
            <button
              onClick={toggleAutoRead}
              aria-pressed={!!autoRead}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ring-1 transition-colors ${
                autoRead ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "text-slate-600 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {autoRead ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
              AI ovoz bilan o&apos;qisin
            </button>
            {started && (
              <button
                onClick={() => {
                  stopSpeaking();
                  setVoiceOpen(true);
                }}
                disabled={busy || finished}
                className="btn-primary px-3 py-2 text-sm"
              >
                <AudioLines className="size-4" aria-hidden /> Ovozli dars
              </button>
            )}
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto bg-indigo-50/30" aria-live="polite">
            {!started ? (
              <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center px-6 py-10 text-center">
                <div className="mb-5 flex size-20 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-600/30">
                  <Bot className="size-10" aria-hidden />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Darsni AI Tutor bilan o&apos;rganamiz</h2>
                <p className="mt-3 text-lg leading-8 text-slate-600">
                  Men darsni kichik qismlarga bo&apos;lib tushuntiraman va har qismdan keyin savol beraman. Javobingizni yozing yoki ayting —
                  tushunmasangiz, boshqacha tushuntiraman.
                </p>
                <button onClick={() => send({})} disabled={busy} className="btn-primary mt-8 px-8 py-4 text-lg">
                  {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Sparkles className="size-5" aria-hidden />}
                  {busy ? "Dars tayyorlanmoqda..." : "Darsni boshlash"}
                </button>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
                {turns.map((t, i) => (
                  <TurnItem key={t.id ?? `n${i}`} t={t} userName={user?.full_name ?? "?"} />
                ))}
                {finished && !busy && (
                  <div className="rounded-3xl bg-surface p-6 text-center shadow-sm ring-2 ring-emerald-200">
                    <Trophy className="mx-auto size-10 text-amber-500" aria-hidden />
                    <h2 className="mt-2 text-xl font-bold text-slate-900">Dars yakunlandi!</h2>
                    <p className="mt-1 text-slate-600">
                      To&apos;g&apos;ri: <b className="text-emerald-700">{count("correct")}</b> · Qisman: <b className="text-amber-700">{count("partial")}</b> ·
                      Xato: <b className="text-red-700">{count("wrong")}</b>
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-3">
                      <button onClick={() => send({ restart: true })} className="btn-secondary">
                        <RotateCcw className="size-4" aria-hidden /> Qaytadan o&apos;tish
                      </button>
                      <Link href={`/student/lessons/${lessonId}`} className="btn-primary">
                        Darsga qaytish
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Javob berish */}
          {started && !finished && (
            <div className="border-t border-slate-100 bg-surface p-3 sm:p-4">
              <div ref={modesRef} className="relative mx-auto max-w-3xl">
                {modesOpen && (
                  <div role="menu" aria-label="Qanday tushuntiray?" className="absolute bottom-full left-0 z-10 mb-2 w-72 animate-pop rounded-2xl bg-surface p-2 shadow-2xl ring-1 ring-slate-200">
                    <p className="px-3 py-2 text-sm font-semibold text-slate-900">Qanday tushuntiray?</p>
                    {data.modes.map((m) => (
                      <button
                        key={m.key}
                        role="menuitem"
                        onClick={() => {
                          if (m.key === "voice" && !autoRead) toggleAutoRead();
                          send({ mode: m.key }, { shown: `Tushunmadim — ${m.label.toLowerCase()} tushuntiring` });
                        }}
                        className="block w-full rounded-xl px-3 py-2.5 text-left font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mb-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => setModesOpen((v) => !v)}
                    disabled={busy}
                    aria-haspopup="menu"
                    aria-expanded={modesOpen}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 font-semibold text-amber-900 ring-1 ring-amber-200 transition-colors hover:bg-amber-100 disabled:opacity-50"
                  >
                    <HelpCircle className="size-5" aria-hidden /> Tushunmadim
                  </button>
                  {lastAi && <SpeakButton text={lastAi} label="Savolni qayta eshitish" />}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                  className="flex items-end gap-2 rounded-3xl border border-slate-200 bg-surface p-2 shadow-sm focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100"
                >
                  <button
                    type="button"
                    onClick={dictate}
                    disabled={dictating || busy}
                    className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
                      dictating ? "animate-pulse bg-red-600 text-white" : "text-slate-500 hover:bg-slate-100"
                    }`}
                    aria-label="Javobni ovoz bilan aytish"
                    title="Javobni ovoz bilan aytish"
                  >
                    <Mic className="size-5" />
                  </button>
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submit();
                      }
                    }}
                    placeholder={dictating ? "Tinglayapman..." : "Javobingizni yozing..."}
                    aria-label="Javobingiz"
                    className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-lg outline-none placeholder:text-slate-400"
                  />
                  {busy ? (
                    <button
                      type="button"
                      onClick={() => abortRef.current?.abort()}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-700"
                      aria-label="To'xtatish"
                    >
                      <Square className="size-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md shadow-indigo-600/25 disabled:opacity-40"
                      aria-label="Javobni yuborish"
                    >
                      <Send className="size-4" />
                    </button>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {voiceOpen && <VoiceChat title="Ovozli dars — AI Tutor" intro={lastAi} onSend={voiceSend} onClose={closeVoice} />}
    </section>
  );
}

