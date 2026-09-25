"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Headphones, HelpCircle, Loader2, Mic, Type } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  dispatchVoiceAction,
  extractNumber,
  isRecognitionSupported,
  listenOnce,
  normalizeSpeech,
  OPEN_LESSON_EVENT,
  speak,
  stopSpeaking,
} from "@/lib/speech";
import { voiceMode } from "@/lib/voiceMode";
import Modal from "@/components/ui/Modal";

type Ctx = { go: (href: string) => void; back: () => void; logout: () => void; setMode: (on: boolean) => void; pathname: string };
type Command = { label: string; match: (t: string) => boolean; run: (ctx: Ctx, text: string) => void };

const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w));

function pageName(pathname: string) {
  if (pathname === "/student") return "Bosh sahifa";
  if (pathname === "/student/schedule") return "Dars jadvali";
  if (pathname === "/student/lessons") return "Darslarim. Ro'yxatni eshitish uchun o'qib ber deb ayting";
  if (pathname.startsWith("/student/lessons/")) return "Dars sahifasi. O'qib ber yoki tushuntir deb ayting";
  if (pathname === "/student/assignments") return "Vazifalar";
  if (pathname === "/student/grades") return "Baholarim";
  return "";
}

// Tartib muhim: aniqroq buyruqlar birinchi tekshiriladi ("o'chir" "och" dan oldin)
const COMMANDS: Command[] = [
  { label: "“To'xta” — ovozni to'xtatadi", match: (t) => has(t, "toxta", "stop", "jim"), run: () => { stopSpeaking(); dispatchVoiceAction("stop"); } },
  { label: "“Ovoz rejimini o'chir”", match: (t) => has(t, "ovoz") && has(t, "ochir"), run: ({ setMode }) => setMode(false) },
  {
    label: "“2-darsni och” — darslar ro'yxatidagi tartib raqami bo'yicha",
    match: (t) => extractNumber(t) !== null && has(t, "dars", "och"),
    run: ({ go, pathname }, t) => {
      const n = extractNumber(t);
      if (pathname === "/student/lessons") window.dispatchEvent(new CustomEvent(OPEN_LESSON_EVENT, { detail: n }));
      else go(`/student/lessons?open=${n}`);
    },
  },
  { label: "“Tushuntir” — ochiq darsni AI tushuntiradi", match: (t) => has(t, "tushuntir"), run: () => dispatchVoiceAction("explain") },
  { label: "“O'qib ber” — sahifadagi ma'lumotni o'qiydi", match: (t) => has(t, "oqi", "tingla"), run: () => dispatchVoiceAction("read") },
  { label: "“Jadval” — dars jadvali", match: (t) => has(t, "jadval"), run: ({ go }) => go("/student/schedule") },
  { label: "“Vazifalar” — uy vazifalari", match: (t) => has(t, "vazifa", "uy ishi"), run: ({ go }) => go("/student/assignments") },
  { label: "“Baholar” — baholarim", match: (t) => has(t, "baho"), run: ({ go }) => go("/student/grades") },
  { label: "“Darslar” — darslarim", match: (t) => has(t, "dars"), run: ({ go }) => go("/student/lessons") },
  { label: "“Bosh sahifa”", match: (t) => has(t, "bosh sahifa", "asosiy"), run: ({ go }) => go("/student") },
  { label: "“Orqaga” — oldingi sahifa", match: (t) => has(t, "orqaga"), run: ({ back }) => back() },
  { label: "“Qayerdaman” — qaysi sahifadaligingiz", match: (t) => has(t, "qayer"), run: ({ pathname }) => speak(pageName(pathname) || "Imkon AI", { quick: true }) },
  {
    label: "“Yordam” — buyruqlarni aytib beradi",
    match: (t) => has(t, "yordam"),
    run: () =>
      speak(
        "Buyruqlar: darslar, vazifalar, jadval, baholar, bosh sahifa, ikkinchi darsni och, o'qib ber, tushuntir, to'xta, orqaga, ovoz rejimini o'chir, chiqish.",
        { quick: true }
      ),
  },
  { label: "“Chiqish” — tizimdan chiqish", match: (t) => has(t, "chiqish"), run: ({ logout }) => logout() },
];

const FONT_KEY = "imkon_font_scale";
const MODE_KEY = "imkon_voice_mode";
const FONT_SCALES = [100, 115, 130];
const ROUND_BTN =
  "flex size-11 items-center justify-center rounded-full border border-slate-200 bg-surface text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-indigo-600";

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export default function VoiceControl() {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();

  const [mode, setModeState] = useState(false); // doimiy tinglash rejimi
  const [listening, setListening] = useState(false); // bir martalik tinglash
  const [lastHeard, setLastHeard] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [fontIndex, setFontIndex] = useState(0);

  const modeRef = useRef(false);

  // ---------- Buyruqni bajarish ----------
  const handleRef = useRef<(heard: string) => void>(() => {});
  const setModeRef = useRef<(on: boolean) => void>(() => {});

  useEffect(() => {
    handleRef.current = (heard: string) => {
      const text = normalizeSpeech(heard);
      if (!text) return;
      setLastHeard(heard);
      const command = COMMANDS.find((c) => c.match(text));
      if (!command) {
        speak("Tushunmadim. Yordam deb ayting", { quick: true });
        return;
      }
      command.run(
        { go: (href) => router.push(href), back: () => router.back(), logout, setMode: (on) => setModeRef.current(on), pathname },
        text
      );
    };
  });

  // ---------- Doimiy tinglash (lib/voiceMode) ----------
  useEffect(() => {
    voiceMode.setHandlers({
      onCommand: (text) => handleRef.current(text),
      onHeard: (text) => setLastHeard(text),
      onFatal: (message) => {
        toast.error(message);
        modeRef.current = false;
        setModeState(false);
        writeStorage(MODE_KEY, "0");
      },
    });
  }, []);

  const setMode = useCallback((on: boolean) => {
    if (on && !isRecognitionSupported()) {
      toast.error("Brauzeringiz ovozni tanishni qo'llab-quvvatlamaydi. Google Chrome yoki Microsoft Edge'dan foydalaning");
      return;
    }
    modeRef.current = on;
    setModeState(on);
    setLastHeard("");
    writeStorage(MODE_KEY, on ? "1" : "0");
    if (on) {
      voiceMode.enable();
      speak("Ovoz rejimi yoqildi. Buyruqni ayting. Yordam uchun yordam deb ayting.", { quick: true });
    } else {
      voiceMode.disable();
      speak("Ovoz rejimi o'chirildi", { quick: true });
    }
  }, []);
  useEffect(() => {
    setModeRef.current = setMode;
  }, [setMode]);

  // Saqlangan sozlamalar: shrift va ovoz rejimi
  useEffect(() => {
    const savedFont = Number(readStorage(FONT_KEY)) || 0;
    document.documentElement.style.fontSize = `${FONT_SCALES[savedFont] ?? 100}%`;
    const savedMode = readStorage(MODE_KEY) === "1" && isRecognitionSupported();
    modeRef.current = savedMode;
    if (savedMode) voiceMode.enable();
    const id = requestAnimationFrame(() => {
      setFontIndex(savedFont);
      setModeState(savedMode);
    });
    return () => {
      cancelAnimationFrame(id);
      document.documentElement.style.fontSize = "";
      modeRef.current = false;
      voiceMode.disable();
      stopSpeaking();
    };
  }, []);

  // Ovoz rejimida sahifa o'zgarganda nomini aytamiz
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    if (modeRef.current) {
      const name = pageName(pathname);
      if (name) speak(name, { quick: true });
    }
  }, [pathname]);

  // ---------- Bir martalik buyruq (mikrofon tugmasi) ----------
  const listenOnceForCommand = async () => {
    if (listening || mode) return;
    setListening(true);
    setLastHeard("");
    try {
      const heard = await listenOnce(setLastHeard);
      if (heard) {
        toast(`“${heard}”`, { icon: "🎙️" });
        handleRef.current(heard);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setListening(false);
    }
  };

  const cycleFont = () => {
    const next = (fontIndex + 1) % FONT_SCALES.length;
    setFontIndex(next);
    document.documentElement.style.fontSize = `${FONT_SCALES[next]}%`;
    writeStorage(FONT_KEY, String(next));
  };

  // Klaviatura: Alt+O — ovoz rejimi, Alt+V — bir martalik buyruq, Esc — ovozni to'xtatish
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyRef.current = (e) => {
      if (e.key === "Escape") stopSpeaking();
      if (!e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "o") {
        e.preventDefault();
        setMode(!modeRef.current);
      } else if (key === "v") {
        e.preventDefault();
        listenOnceForCommand();
      }
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {(mode || listening) && (
        <div
          role="status"
          className="fixed top-20 right-4 z-40 max-w-xs animate-pop rounded-xl bg-gray-900/90 px-4 py-2 text-sm text-white shadow-lg sm:right-6 lg:right-10"
        >
          <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-red-500" aria-hidden />
          Tinglayapman{lastHeard && <span className="text-gray-300"> · “{lastHeard}”</span>}
        </div>
      )}

      {/* Yuqori paneldagi tugmalar: yordam, shrift, bitta buyruq, ovoz rejimi */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setHelpOpen(true)}
          className={`${ROUND_BTN} max-sm:hidden`}
          aria-label="Ovozli buyruqlar ro'yxati"
          title="Ovozli buyruqlar"
        >
          <HelpCircle className="size-5" />
        </button>
        <button
          onClick={cycleFont}
          className={ROUND_BTN}
          aria-label={`Shrift o'lchami: ${FONT_SCALES[fontIndex]}%. Kattalashtirish`}
          title="Shriftni kattalashtirish"
        >
          <Type className="size-5" />
        </button>
        {!mode && (
          <button
            onClick={listenOnceForCommand}
            className={listening ? "flex size-11 animate-pulse items-center justify-center rounded-full bg-red-600 text-white" : ROUND_BTN}
            aria-label="Bitta ovozli buyruq berish (Alt + V)"
            title="Bitta buyruq (Alt + V)"
          >
            {listening ? <Loader2 className="size-5 animate-spin" /> : <Mic className="size-5" />}
          </button>
        )}
        <button
          onClick={() => setMode(!mode)}
          aria-pressed={mode}
          aria-label={mode ? "Ovoz rejimini o'chirish (Alt + O)" : "Ovoz rejimini yoqish (Alt + O)"}
          className={`flex h-11 items-center gap-2 rounded-full px-3 font-semibold text-white shadow-md transition-colors sm:px-5 ${
            mode ? "bg-red-600 shadow-red-600/25 hover:bg-red-700" : "bg-gradient-to-b from-indigo-500 to-indigo-600 shadow-indigo-600/25 hover:to-indigo-700"
          }`}
          title="Ovoz rejimi (Alt + O)"
        >
          <Headphones className="size-5" aria-hidden />
          <span className="max-sm:hidden">{mode ? "Ovoz rejimi: yoniq" : "Ovoz rejimi"}</span>
        </button>
      </div>

      <Modal open={helpOpen} title="Ovozli boshqaruv" onClose={() => setHelpOpen(false)}>
        <div className="space-y-3 text-slate-700">
          <p>
            <b>Ovoz rejimi</b> (<kbd className="rounded bg-slate-100 px-1.5">Alt</kbd> + <kbd className="rounded bg-slate-100 px-1.5">O</kbd>) —
            doimiy tinglaydi, har safar tugma bosish shart emas. Sahifa o&apos;zgarganda nomini aytadi.
          </p>
          <p>
            <b>Mikrofon</b> (<kbd className="rounded bg-slate-100 px-1.5">Alt</kbd> + <kbd className="rounded bg-slate-100 px-1.5">V</kbd>) — bitta
            buyruq. <kbd className="rounded bg-slate-100 px-1.5">Esc</kbd> — ovozni to&apos;xtatish.
          </p>
        </div>
        <h3 className="mt-5 mb-2 font-semibold">Buyruqlar</h3>
        <ul className="space-y-2">
          {COMMANDS.map((c) => (
            <li key={c.label} className="flex items-center gap-2">
              <Mic className="size-4 shrink-0 text-indigo-600" aria-hidden />
              {c.label}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-500">
          Ovozni tanish Google Chrome va Microsoft Edge&apos;da ishlaydi. Birinchi marta brauzer mikrofonga ruxsat so&apos;raydi —
          &quot;Ruxsat berish&quot; ni bosing.
        </p>
      </Modal>
    </>
  );
}
