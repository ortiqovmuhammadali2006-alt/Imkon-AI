"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { HelpCircle, Loader2, Mic, Type } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { dispatchVoiceAction, listenOnce, speak, stopSpeaking } from "@/lib/speech";
import Modal from "@/components/ui/Modal";

// Buyruqlar tartibi muhim: aniqroq so'zlar birinchi tekshiriladi
const COMMANDS: { words: string[]; label: string; run: (ctx: Ctx) => void }[] = [
  { words: ["toxta", "stop", "jim"], label: "“To'xta” — ovozni to'xtatadi", run: () => { stopSpeaking(); dispatchVoiceAction("stop"); } },
  { words: ["tushuntir"], label: "“Tushuntir” — ochiq darsni AI tushuntiradi", run: () => dispatchVoiceAction("explain") },
  { words: ["oqi", "oqib"], label: "“O'qib ber” — ochiq darsni ovoz bilan o'qiydi", run: () => dispatchVoiceAction("read") },
  { words: ["jadval"], label: "“Jadval” — dars jadvali", run: ({ go }) => go("/student/schedule") },
  { words: ["vazifa", "uy ishi"], label: "“Vazifalar” — uy vazifalari", run: ({ go }) => go("/student/assignments") },
  { words: ["baho"], label: "“Baholar” — baholarim", run: ({ go }) => go("/student/grades") },
  { words: ["dars"], label: "“Darslar” — darslarim", run: ({ go }) => go("/student/lessons") },
  { words: ["bosh sahifa", "asosiy", "uy"], label: "“Bosh sahifa”", run: ({ go }) => go("/student") },
  { words: ["orqaga"], label: "“Orqaga” — oldingi sahifa", run: ({ back }) => back() },
  { words: ["chiqish"], label: "“Chiqish” — tizimdan chiqish", run: ({ logout }) => logout() },
];

type Ctx = { go: (href: string) => void; back: () => void; logout: () => void };

// "O'qib ber" -> "oqib ber": apostrof va katta harflarsiz solishtirish
function normalize(text: string) {
  return text.toLowerCase().replace(/[''ʻʼ`‘’]/g, "").replace(/\s+/g, " ").trim();
}

const FONT_KEY = "imkon_font_scale";
const FONT_SCALES = [100, 115, 130];

export default function VoiceControl() {
  const router = useRouter();
  const { logout } = useAuth();
  const [listening, setListening] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [fontIndex, setFontIndex] = useState(0);
  const busy = useRef(false);

  // Shrift o'lchami: faqat o'quvchi panelida, saqlangan qiymat bilan
  useEffect(() => {
    let saved = 0;
    try {
      saved = Number(localStorage.getItem(FONT_KEY)) || 0;
    } catch {}
    document.documentElement.style.fontSize = `${FONT_SCALES[saved] ?? 100}%`;
    const id = requestAnimationFrame(() => setFontIndex(saved));
    return () => {
      cancelAnimationFrame(id);
      document.documentElement.style.fontSize = "";
    };
  }, []);

  const cycleFont = () => {
    const next = (fontIndex + 1) % FONT_SCALES.length;
    setFontIndex(next);
    document.documentElement.style.fontSize = `${FONT_SCALES[next]}%`;
    try {
      localStorage.setItem(FONT_KEY, String(next));
    } catch {}
  };

  const listen = async () => {
    if (busy.current) return;
    busy.current = true;
    stopSpeaking();
    setListening(true);
    try {
      const heard = await listenOnce();
      if (!heard) return;
      const text = normalize(heard);
      const command = COMMANDS.find((c) => c.words.some((w) => text.includes(w)));
      if (!command) {
        toast(`“${heard}” — buyruq tushunilmadi. Yordam uchun ? tugmasini bosing`, { icon: "🤔" });
        speak("Buyruq tushunilmadi");
        return;
      }
      toast.success(`“${heard}”`);
      command.run({ go: (href) => router.push(href), back: () => router.back(), logout });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setListening(false);
      busy.current = false;
    }
  };

  // Klaviaturadan: Alt + V — tinglash
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        listen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <div className="fixed right-4 bottom-4 z-40 flex items-center gap-2">
        <button
          onClick={() => setHelpOpen(true)}
          className="rounded-full bg-white p-3 text-slate-600 shadow-lg ring-1 ring-slate-200 hover:text-indigo-700"
          aria-label="Ovozli buyruqlar ro'yxati"
          title="Ovozli buyruqlar"
        >
          <HelpCircle className="size-5" />
        </button>
        <button
          onClick={cycleFont}
          className="rounded-full bg-white p-3 text-slate-600 shadow-lg ring-1 ring-slate-200 hover:text-indigo-700"
          aria-label={`Shrift o'lchami: ${FONT_SCALES[fontIndex]}%. Kattalashtirish`}
          title="Shriftni kattalashtirish"
        >
          <Type className="size-5" />
        </button>
        <button
          onClick={listen}
          className={`flex items-center gap-2 rounded-full px-5 py-4 font-semibold text-white shadow-lg ${
            listening ? "animate-pulse bg-red-600" : "bg-indigo-600 hover:bg-indigo-700"
          }`}
          aria-label={listening ? "Tinglanmoqda" : "Ovozli buyruq berish (Alt + V)"}
          title="Ovozli buyruq (Alt + V)"
        >
          {listening ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <Mic className="size-6" aria-hidden />}
          <span className="hidden sm:inline">{listening ? "Tinglayapman..." : "Ovozli boshqaruv"}</span>
        </button>
      </div>

      <Modal open={helpOpen} title="Ovozli buyruqlar" onClose={() => setHelpOpen(false)}>
        <p className="mb-4 text-slate-600">
          Mikrofon tugmasini bosing (yoki <kbd className="rounded bg-slate-100 px-1.5">Alt</kbd> +{" "}
          <kbd className="rounded bg-slate-100 px-1.5">V</kbd>) va buyruqni ayting:
        </p>
        <ul className="space-y-2">
          {COMMANDS.map((c) => (
            <li key={c.label} className="flex items-center gap-2">
              <Mic className="size-4 shrink-0 text-indigo-600" aria-hidden />
              {c.label}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-500">Ovozni tanish Google Chrome brauzerida eng yaxshi ishlaydi.</p>
      </Modal>
    </>
  );
}
