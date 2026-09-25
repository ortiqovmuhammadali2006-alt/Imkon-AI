"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Bot, Loader2, Mic, Send, Sparkles } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { explainLesson, type ChatMessage } from "@/lib/student";
import { listenOnce, speak, VOICE_EVENT, type VoiceAction } from "@/lib/speech";
import SpeakButton from "./SpeakButton";

const QUICK_QUESTIONS = ["Oddiyroq tushuntir", "Misol keltir", "Asosiy fikrlarni qisqacha ayt", "Menga savol ber"];

// Dars bo'yicha AI yordamchi. autoSpeak — javoblarni avtomatik ovoz bilan o'qish (ko'rish cheklanganlar uchun)
export default function AiTutor({ lessonId, autoSpeak }: { lessonId: number; autoSpeak: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const ask = async (question?: string) => {
    if (loading) return;
    const history: ChatMessage[] = question ? [...messages, { role: "user", content: question }] : messages;
    setMessages(history);
    setInput("");
    setLoading(true);
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
      toast.error(getErrorMessage(error));
      setMessages(messages);
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
  useEffect(() => {
    const onVoice = (e: Event) => {
      if ((e as CustomEvent<VoiceAction>).detail === "explain") askRef.current();
    };
    window.addEventListener(VOICE_EVENT, onVoice);
    return () => window.removeEventListener(VOICE_EVENT, onVoice);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  return (
    <section aria-label="AI yordamchi" className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-5 py-4">
        <div className="rounded-xl bg-indigo-600 p-2 text-white">
          <Bot className="size-5" aria-hidden />
        </div>
        <div>
          <h2 className="font-semibold">AI yordamchi</h2>
          <p className="text-sm text-slate-500">Tushunmagan joyingizni so&apos;rang — batafsil tushuntirib beradi</p>
        </div>
      </div>

      <div className="max-h-[32rem] space-y-4 overflow-y-auto p-5" aria-live="polite">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center py-6 text-center">
            <button onClick={() => ask()} className="btn-primary px-6 py-3 text-lg">
              <Sparkles className="size-5" aria-hidden /> Darsni batafsil tushuntir
            </button>
            <p className="mt-3 text-sm text-slate-500">yoki pastda savolingizni yozing / ayting</p>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-white">{m.content}</p>
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <div className="mt-1 h-fit rounded-lg bg-indigo-100 p-1.5 text-indigo-700">
                <Bot className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="rounded-2xl rounded-tl-sm bg-slate-50 px-4 py-3 leading-relaxed whitespace-pre-wrap ring-1 ring-slate-100">
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
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="size-5 animate-spin" aria-hidden /> AI o&apos;ylayapti...
          </div>
        )}
        <div ref={endRef} />
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
        className="flex gap-2 border-t border-slate-100 p-4"
      >
        <button
          type="button"
          onClick={askByVoice}
          disabled={loading || listening}
          className={`rounded-lg p-3 ${listening ? "animate-pulse bg-red-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          aria-label="Savolni ovoz bilan aytish"
          title="Savolni ovoz bilan aytish"
        >
          <Mic className="size-5" />
        </button>
        <input
          aria-label="Savolingiz"
          className="input flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Savolingizni yozing..."
          maxLength={2000}
        />
        <button type="submit" disabled={loading || !input.trim()} className="btn-primary" aria-label="Yuborish">
          <Send className="size-5" aria-hidden />
        </button>
      </form>
    </section>
  );
}
