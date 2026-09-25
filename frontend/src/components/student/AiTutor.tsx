"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, Bot, Mic, Send, Sparkles } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { explainLesson, type ChatMessage } from "@/lib/student";
import { listenOnce, onVoiceAction, speak } from "@/lib/speech";
import SpeakButton from "./SpeakButton";

const QUICK_QUESTIONS = ["Oddiyroq tushuntir", "Misol keltir", "Asosiy fikrlarni qisqacha ayt", "Menga savol ber"];

// Dars bo'yicha AI yordamchi. autoSpeak — javoblarni avtomatik ovoz bilan o'qish (ko'rish cheklanganlar uchun).
// fallbackText — AI ishlamay qolsa, o'rniga ovoz bilan o'qib beriladigan dars matni
export default function AiTutor({
  lessonId,
  autoSpeak,
  fallbackText,
}: {
  lessonId: number;
  autoSpeak: boolean;
  fallbackText: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ask = async (question?: string) => {
    if (loading) return;
    const history: ChatMessage[] = question ? [...messages, { role: "user", content: question }] : messages;
    setMessages(history);
    setInput("");
    setLoading(true);
    setAiError(null);
    try {
      // Birinchi so'rov bo'sh tarix bilan — backend darsni to'liq tushuntiradi
      const answer = await explainLesson(lessonId, history);
      const next: ChatMessage[] = [
        ...(history.length ? history : [{ role: "user" as const, content: "Darsni batafsil tushuntirib ber" }]),
        { role: "assistant", content: answer },
      ];
      setMessages(next);
      if (autoSpeak) speak(answer);
    } catch (error) {
      const message = getErrorMessage(error);
      setAiError(message);
      setMessages(messages);
      // Ko'rishi cheklangan o'quvchi ekrandagi xabarni ko'rmaydi — ovoz bilan aytib, dars matnini o'qib beramiz
      if (autoSpeak && fallbackText) speak(`AI hozircha ishlamayapti. Dars matnini o'qib beraman. ${fallbackText}`);
    } finally {
      setLoading(false);
    }
  };

  const askByVoice = async () => {
    setListening(true);
    try {
      const text = await listenOnce();
      if (text) ask(text);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setListening(false);
    }
  };

  // Ovozli buyruq: "Tushuntir"
  const askRef = useRef(ask);
  useEffect(() => {
    askRef.current = ask;
  });
  useEffect(() => onVoiceAction((action) => action === "explain" && askRef.current()), []);

  useEffect(() => {
    // Faqat chat ichida aylantiramiz — sahifaning o'zi joyidan qimirlamasin
    const box = scrollRef.current;
    if (box && (messages.length || loading)) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  return (
    <section aria-label="AI yordamchi" className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-5 py-4">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 p-2.5 text-white shadow-md shadow-indigo-500/30">
          <Bot className="size-5" aria-hidden />
        </div>
        <div>
          <h2 className="font-semibold">AI yordamchi</h2>
          <p className="text-sm text-slate-500">Tushunmagan joyingizni so&apos;rang — batafsil tushuntirib beradi</p>
        </div>
      </div>

      <div ref={scrollRef} className="max-h-[32rem] space-y-4 overflow-y-auto p-5" aria-live="polite">
        {aiError && (
          <div role="alert" className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
            <p className="flex items-start gap-2 font-medium text-amber-900">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
              {aiError}
            </p>
            {fallbackText && (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-amber-900/80">
                Hozircha darsni o&apos;zingiz tinglashingiz mumkin:
                <SpeakButton text={fallbackText} label="Dars matnini ovoz bilan tinglash" />
              </div>
            )}
          </div>
        )}

        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center py-6 text-center">
            <button onClick={() => ask()} className="btn-primary rounded-full px-7 py-3.5 text-lg shadow-lg shadow-indigo-500/30">
              <Sparkles className="size-5" aria-hidden /> Darsni batafsil tushuntir
            </button>
            <p className="mt-3 text-sm text-slate-500">yoki pastda savolingizni yozing / ayting</p>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex animate-pop justify-end">
              <p className="max-w-[85%] rounded-3xl rounded-br-md bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2.5 text-white shadow-md shadow-indigo-500/20">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={i} className="flex animate-pop gap-3">
              <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
                <Bot className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="rounded-3xl rounded-tl-md bg-slate-50 px-5 py-3.5 text-[1.05rem] leading-relaxed whitespace-pre-wrap text-slate-800 ring-1 ring-slate-100">
                  {m.content}
                </div>
                <div className="mt-2">
                  <SpeakButton text={m.content} label="Tinglash" />
                </div>
              </div>
            </div>
          )
        )}

        {loading && (
          <div className="flex items-center gap-3" role="status">
            <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <Bot className="size-4" aria-hidden />
            </div>
            <div className="flex items-center gap-1.5 rounded-3xl rounded-tl-md bg-slate-50 px-5 py-4 ring-1 ring-slate-100">
              {[0, 150, 300].map((delay) => (
                <span key={delay} className="size-2 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: `${delay}ms` }} />
              ))}
              <span className="sr-only">AI javob yozmoqda</span>
            </div>
          </div>
        )}
      </div>

      {messages.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 pb-3">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              disabled={loading}
              className="rounded-full bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) ask(input.trim());
        }}
        className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/50 p-4"
      >
        <button
          type="button"
          onClick={askByVoice}
          disabled={loading || listening}
          className={`flex size-11 shrink-0 items-center justify-center rounded-full ${listening ? "animate-pulse bg-red-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          aria-label="Savolni ovoz bilan aytish"
          title="Savolni ovoz bilan aytish"
        >
          <Mic className="size-5" />
        </button>
        <input
          aria-label="Savolingiz"
          className="input flex-1 rounded-full px-5"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Savolingizni yozing..."
          maxLength={2000}
        />
        <button type="submit" disabled={loading || !input.trim()} className="btn-primary size-11 rounded-full p-0" aria-label="Yuborish">
          <Send className="size-5" aria-hidden />
        </button>
      </form>
    </section>
  );
}
