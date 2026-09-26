"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck, RotateCcw, Trophy, Volume2, XCircle } from "lucide-react";
import type { QuizQuestion } from "@/lib/student";
import { onVoiceAction, speak, stopSpeaking } from "@/lib/speech";

const ORDINAL = ["Birinchi", "Ikkinchi", "Uchinchi", "To'rtinchi"];

function questionSpeech(q: QuizQuestion, n: number, total: number) {
  return (
    `${n}-savol, jami ${total} ta. ${q.question} ` +
    q.options.map((o, i) => `${ORDINAL[i]} javob: ${o}.`).join(" ") +
    " Javob berish uchun: Imkon, birinchi javob, deng yoki tugmani bosing."
  );
}

// "O'zingizni tekshiring": dars bo'yicha oson savollar, bittadan. Har bir javobdan keyin — to'g'ri/noto'g'ri va izoh.
// Ovoz: "Imkon, test" — boshlanadi va savol o'qiladi; "Imkon, ikkinchi javob" — javob beriladi; keyingi savol o'zi o'qiladi
export default function LessonQuiz({ quiz }: { quiz: QuizQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const voiceRef = useRef(false); // ovoz bilan boshlangan bo'lsa — savollar va natija o'qiladi

  const q = quiz[index];

  const choose = (i: number) => {
    if (chosen !== null || done || !q) return;
    setChosen(i);
    const right = i === q.answer;
    if (right) setScore((s) => s + 1);
    const feedback = right
      ? `To'g'ri! ${q.explanation}`
      : `Afsus, noto'g'ri. To'g'ri javob: ${q.options[q.answer]}. ${q.explanation}`;
    // Ovoz bilan boshlangan bo'lsa — izohdan keyin keyingi savol o'zi o'qiladi
    speak(feedback).then((r) => {
      if (r.ok && voiceRef.current) setTimeout(() => stateRef.current.next(), 700);
    });
  };

  const next = () => {
    if (index + 1 >= quiz.length) {
      setDone(true);
      return;
    }
    setIndex(index + 1);
    setChosen(null);
    if (voiceRef.current) speak(questionSpeech(quiz[index + 1], index + 2, quiz.length));
  };

  const restart = (byVoice = false) => {
    voiceRef.current = byVoice;
    setIndex(0);
    setChosen(null);
    setScore(0);
    setDone(false);
    if (byVoice) speak(questionSpeech(quiz[0], 1, quiz.length));
  };

  // Natija — ovoz bilan ham
  useEffect(() => {
    if (!done) return;
    const text =
      score === quiz.length
        ? `Barakalla! Hamma ${quiz.length} ta savolga to'g'ri javob berdingiz.`
        : `${quiz.length} ta savoldan ${score} tasiga to'g'ri javob berdingiz. ${score < quiz.length / 2 ? "Sodda o'rganish bo'limini yana bir bor tinglang." : "Yaxshi natija!"}`;
    if (voiceRef.current) speak(text);
  }, [done, score, quiz.length]);

  // Ovozli buyruqlar eng so'nggi holat bilan ishlasin
  const stateRef = useRef({ choose, next, restart, started: false });
  useEffect(() => {
    stateRef.current = { choose, next, restart, started: stateRef.current.started };
  });
  useEffect(
    () =>
      onVoiceAction((action, value) => {
        const s = stateRef.current;
        if (action === "quiz") {
          s.started = true;
          sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          s.restart(true);
        } else if (action === "answer" && value) {
          if (!s.started) {
            speak("Avval testni boshlang. Imkon, test deng", { quick: true });
            return;
          }
          voiceRef.current = true;
          s.choose(value - 1);
        }
      }),
    []
  );
  useEffect(() => () => stopSpeaking(), []);

  if (!quiz.length) return null;

  return (
    <section ref={sectionRef} className="card p-6 sm:p-8" aria-labelledby="quiz-title">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <ClipboardCheck className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="quiz-title" className="text-lg font-semibold tracking-tight">
              O&apos;zingizni tekshiring
            </h2>
            <p className="text-sm text-slate-500">Ovoz bilan: &quot;Imkon, test&quot;, keyin &quot;Imkon, birinchi javob&quot;</p>
          </div>
        </div>
        {!done && (
          <span className="badge bg-slate-100 text-slate-600">
            {index + 1} / {quiz.length}
          </span>
        )}
      </div>

      {done ? (
        <div className="rounded-lg border border-line bg-slate-50 p-6 text-center" role="status">
          <Trophy className={`mx-auto size-10 ${score === quiz.length ? "text-amber-500" : "text-indigo-600"}`} aria-hidden />
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {score} / {quiz.length}
          </p>
          <p className="mt-1 text-slate-600">
            {score === quiz.length
              ? "Barakalla! Hamma savolga to'g'ri javob berdingiz."
              : score < quiz.length / 2
                ? "\"Sodda o'rganish\" bo'limini yana bir bor tinglang va qayta urinib ko'ring."
                : "Yaxshi natija! Xato qilgan savollaringizni takrorlang."}
          </p>
          <button onClick={() => restart(false)} className="btn-primary mt-4">
            <RotateCcw className="size-4" aria-hidden /> Qayta boshlash
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-3">
            <p className="text-xl font-semibold text-slate-900">{q.question}</p>
            <button
              onClick={() => speak(questionSpeech(q, index + 1, quiz.length))}
              className="icon-btn shrink-0"
              aria-label="Savolni tinglash"
              title="Savolni tinglash"
            >
              <Volume2 className="size-5" aria-hidden />
            </button>
          </div>

          <div className="mt-4 grid gap-3" role="group" aria-label="Javob variantlari">
            {q.options.map((option, i) => {
              const isAnswer = i === q.answer;
              const state =
                chosen === null
                  ? "border-line bg-surface hover:border-indigo-300 hover:bg-indigo-50"
                  : isAnswer
                    ? "border-emerald-500 bg-emerald-50"
                    : chosen === i
                      ? "border-red-500 bg-red-50"
                      : "border-line bg-surface opacity-60";
              return (
                <button
                  key={i}
                  onClick={() => {
                    voiceRef.current = false;
                    choose(i);
                  }}
                  disabled={chosen !== null}
                  className={`flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left text-lg font-medium text-slate-800 transition-colors ${state}`}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="flex-1">{option}</span>
                  {chosen !== null && isAnswer && <CheckCircle2 className="size-6 text-emerald-600" aria-label="To'g'ri javob" />}
                  {chosen === i && !isAnswer && <XCircle className="size-6 text-red-600" aria-label="Noto'g'ri" />}
                </button>
              );
            })}
          </div>

          {chosen !== null && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" role="status">
              <p className={`font-medium ${chosen === q.answer ? "text-emerald-700" : "text-red-700"}`}>
                {chosen === q.answer ? "To'g'ri! " : `Noto'g'ri. To'g'ri javob: ${q.options[q.answer]}. `}
                <span className="font-normal text-slate-600">{q.explanation}</span>
              </p>
              <button onClick={next} className="btn-primary shrink-0">
                {index + 1 >= quiz.length ? "Natijani ko'rish" : "Keyingi savol"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
