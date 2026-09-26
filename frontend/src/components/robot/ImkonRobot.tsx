"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AudioLines,
  ClipboardList,
  GraduationCap,
  HelpCircle,
  Loader2,
  MessageCircle,
  Mic,
  RotateCcw,
  Send,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStudentProfile } from "@/lib/student";
import { actionHref, askAssistant, requestVoiceChat, ROBOT_ASK_EVENT } from "@/lib/assistant";
import { getErrorMessage } from "@/lib/api";
import { listenOnce, onSpeakingChange, RecognitionError, speak, stopSpeaking } from "@/lib/speech";
import { voiceMode } from "@/lib/voiceMode";
import RobotFace, { type RobotState } from "./RobotFace";

type Line = { from: "robot" | "me"; text: string };

// Tez tugmalar: "text" — robot AI bilan tushunadi; "href" — darhol ochiladi
const QUICK: { label: string; icon: LucideIcon; text?: string; href?: string; voice?: boolean }[] = [
  { label: "Darsni tushuntir", icon: GraduationCap, text: "Darsni tushuntir" },
  { label: "Savolim bor", icon: HelpCircle, href: "/student/chat" },
  { label: "Mavzuni qayta tushuntir", icon: RotateCcw, text: "Oxirgi mavzuni qayta tushuntir" },
  { label: "Bugungi rejam", icon: Target, text: "Bugungi rejamni ayt" },
  { label: "Vazifalarim", icon: ClipboardList, href: "/student/assignments" },
  { label: "Ovozli suhbat", icon: AudioLines, href: "/student/chat", voice: true },
  { label: "Shunchaki suhbatlashish", icon: MessageCircle, href: "/student/chat" },
];

const HINT_KEY = "imkon_robot_hint";
const TUTOR_OR_CHAT = /^\/student\/(chat|lessons\/\d+\/tutor)/;

// Imkon — o'quvchi panelining har bir sahifasida pastki o'ng burchakda turadigan robot-yordamchi.
// Tez tugmalar yoki erkin gap ("Ertangi matematika darsimni och") — AI tushunadi va sahifani ochadi / javob beradi
export default function ImkonRobot() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { data: profile } = useStudentProfile();
  const firstName = user?.full_name.split(/\s+/)[0] ?? "";

  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [hint, setHint] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const state: RobotState = listening ? "listening" : busy ? "thinking" : speaking ? "speaking" : "idle";

  // Platformada ovoz o'qilayotganda robot "gapiradi"
  useEffect(() => onSpeakingChange(setSpeaking), []);

  // Seansda bir marta: "Salom! Men Imkonman" pufakchasi
  useEffect(() => {
    let shown = false;
    try {
      shown = sessionStorage.getItem(HINT_KEY) === "1";
      sessionStorage.setItem(HINT_KEY, "1");
    } catch {}
    if (shown) return;
    const show = setTimeout(() => setHint(true), 1500);
    const hide = setTimeout(() => setHint(false), 9000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, busy]);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  // Ochilganda — fokus yozish maydoniga; tashqariga bosilsa yoki Esc — yopiladi
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Javobni ovoz bilan aytish: ovoz bilan so'ralgan, ovoz rejimi yoqiq yoki o'quvchining ko'rishi cheklangan bo'lsa
  const shouldSpeak = (byVoice: boolean) => byVoice || voiceMode.enabled || profile?.category === "visual";

  const run = useCallback(
    async (text: string, byVoice = false) => {
      const clean = text.trim();
      if (!clean || busy) return;
      setLines((l) => [...l, { from: "me", text: clean }]);
      setBusy(true);
      try {
        const r = await askAssistant(clean, pathname);
        setLines((l) => [...l, { from: "robot", text: r.reply }]);
        const href = actionHref(r);
        if (shouldSpeak(byVoice)) speak(r.reply, { quick: true });
        if (href) {
          router.push(href);
          // Sahifa ochilgach panel yopiladi — javob ovoz bilan aytiladi yoki qisqa ko'rinib qoladi
          setTimeout(() => setOpen(false), 1200);
        }
      } catch (e) {
        const msg = getErrorMessage(e);
        setLines((l) => [...l, { from: "robot", text: msg }]);
        if (shouldSpeak(byVoice)) speak(msg, { quick: true });
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, pathname, router, profile]
  );

  // Ovozli boshqaruv tanimagan gap — robotga ("Ertangi matematika darsimni och")
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  useEffect(() => {
    const listener = (e: Event) => {
      setOpen(true);
      void runRef.current((e as CustomEvent<string>).detail, true);
    };
    window.addEventListener(ROBOT_ASK_EVENT, listener);
    return () => window.removeEventListener(ROBOT_ASK_EVENT, listener);
  }, []);

  // Alt+I — robotni ochish/yopish
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setOpen((v) => !v);
        setHint(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const quick = (q: (typeof QUICK)[number]) => {
    if (q.href) {
      if (q.voice) requestVoiceChat();
      setLines((l) => [...l, { from: "me", text: q.label }]);
      router.push(q.href);
      setTimeout(() => setOpen(false), 400);
    } else if (q.text) run(q.text);
  };

  const listen = async () => {
    if (listening || busy) return;
    stopSpeaking();
    setListening(true);
    try {
      const heard = await listenOnce((t) => setInput(t), undefined, { pauseMs: 1500 });
      setInput("");
      setListening(false);
      await run(heard, true);
    } catch (e) {
      setListening(false);
      if (!(e instanceof RecognitionError && e.code === "aborted")) setLines((l) => [...l, { from: "robot", text: (e as Error).message }]);
    }
  };

  const raised = TUTOR_OR_CHAT.test(pathname); // yozish maydoni bor sahifalarda robot biroz yuqorida — tugmalarni to'smasin

  return (
    <div className={`fixed right-4 z-40 flex flex-col items-end gap-3 sm:right-6 ${raised ? "bottom-28" : "bottom-5 sm:bottom-6"}`}>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Imkon — AI yordamchi"
          className="flex max-h-[min(600px,calc(100dvh-11rem))] w-[min(380px,calc(100vw-2rem))] animate-pop flex-col overflow-hidden rounded-3xl bg-surface shadow-2xl ring-1 ring-slate-200"
        >
          <div className="flex items-center gap-3 bg-indigo-600 px-4 py-3 text-white">
            <RobotFace state={state} className="size-11 shrink-0 rounded-2xl bg-white/15 p-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">Imkon</p>
              <p className="text-sm text-brand-100">
                {state === "thinking" ? "O'ylayapman..." : state === "listening" ? "Tinglayapman..." : state === "speaking" ? "Gapiryapman..." : "AI yordamchingiz"}
              </p>
            </div>
            <button onClick={close} className="rounded-full p-2 text-white/80 hover:bg-white/15 hover:text-white" aria-label="Yopish">
              <X className="size-5" />
            </button>
          </div>

          <div ref={logRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            <p className="rounded-2xl rounded-tl-md bg-indigo-50 px-4 py-3 text-slate-800">
              Salom{firstName && `, ${firstName}`}! Men Imkonman. Bugun sizga nimada yordam beray?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK.map((q) => (
                <button
                  key={q.label}
                  onClick={() => quick(q)}
                  disabled={busy}
                  className={`flex items-center gap-2 rounded-2xl bg-surface px-3 py-2.5 text-left text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-indigo-50 hover:text-indigo-700 hover:ring-indigo-200 disabled:opacity-50 ${
                    q.label === "Shunchaki suhbatlashish" ? "col-span-2" : ""
                  }`}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                    <q.icon className="size-4" aria-hidden />
                  </span>
                  {q.label}
                </button>
              ))}
            </div>
            {lines.map((l, i) =>
              l.from === "me" ? (
                <p key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-white">
                  {l.text}
                </p>
              ) : (
                <p key={i} className="max-w-[90%] rounded-2xl rounded-tl-md bg-slate-100 px-4 py-2.5 text-slate-800">
                  {l.text}
                </p>
              )
            )}
            {busy && (
              <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Imkon o&apos;ylayapti...
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = input;
              setInput("");
              run(t);
            }}
            className="flex items-center gap-2 border-t border-slate-100 p-3"
          >
            <button
              type="button"
              onClick={listen}
              disabled={busy}
              className={`flex size-10 shrink-0 items-center justify-center rounded-full ${listening ? "animate-pulse bg-red-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
              aria-label="Ovoz bilan aytish"
            >
              <Mic className="size-5" />
            </button>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? "Tinglayapman..." : "Masalan: ertangi darsimni och"}
              aria-label="Imkonga yozing"
              className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2.5 outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-300"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white disabled:opacity-40"
              aria-label="Yuborish"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}

      {hint && !open && (
        <button
          onClick={() => {
            setHint(false);
            setOpen(true);
          }}
          className="max-w-[240px] animate-pop rounded-2xl rounded-br-md bg-surface px-4 py-3 text-left text-sm text-slate-700 shadow-xl ring-1 ring-slate-200"
        >
          <b className="text-indigo-700">Salom! Men Imkonman.</b> Yordam kerak bo&apos;lsa, meni bosing.
        </button>
      )}

      <button
        ref={buttonRef}
        onClick={() => {
          setHint(false);
          setOpen((v) => !v);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Imkon — AI yordamchi (Alt + I)"
        title="Imkon — AI yordamchi (Alt + I)"
        className="robot-float group relative rounded-full focus-visible:outline-offset-4"
      >
        <span className="absolute inset-1 rounded-full bg-indigo-500/30 blur-xl transition-opacity group-hover:opacity-100" aria-hidden />
        <span className="relative flex size-16 items-center justify-center rounded-full bg-surface shadow-xl shadow-indigo-600/25 ring-1 ring-indigo-100 transition-transform group-hover:scale-105 sm:size-[72px]">
          <RobotFace state={state} className="size-12 sm:size-14" />
        </span>
      </button>
    </div>
  );
}
