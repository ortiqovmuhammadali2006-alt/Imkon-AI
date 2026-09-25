"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Headphones, HelpCircle, Loader2, Mic, Turtle, Type, Volume2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  checkServerTts,
  getSpeechRate,
  RATE_EVENT,
  setSpeechRate,
  SPEECH_RATES,
  type SpeechRateKey,
  askChat,
  dispatchVoiceAction,
  extractNumber,
  isRecognitionSupported,
  listenOnce,
  normalizeSpeech,
  MIC_SETUP_ERRORS,
  OPEN_LESSON_EVENT,
  RecognitionError,
  speak,
  speakOrWaitForClick,
  AUTOPLAY_BLOCKED,
  stopSpeaking,
  VOICE_COMMAND_EVENT,
} from "@/lib/speech";
import { LOGIN_WELCOME_KEY, voiceMode } from "@/lib/voiceMode";
import { setTheme } from "@/lib/theme";
import MicPermissionDialog from "./MicPermissionDialog";
import Modal from "@/components/ui/Modal";

type Ctx = {
  go: (href: string) => void;
  back: () => void;
  logout: () => void;
  setMode: (on: boolean) => void;
  fontStep: (delta: 1 | -1) => string; // javob matnini qaytaradi
  pathname: string;
};
// reply — buyruq bajarilgach ovoz bilan aytiladigan qisqa javob ("Bosh sahifa ochildi")
type Command = {
  label: string;
  match: (t: string) => boolean;
  run: (ctx: Ctx, text: string) => void | string;
  reply?: string;
};

const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w));

function pageName(pathname: string) {
  if (pathname === "/student") return "Bosh sahifa";
  if (pathname === "/student/schedule") return "Dars jadvali";
  if (pathname === "/student/lessons") return "Darslarim. Ro'yxatni eshitish uchun o'qib ber deb ayting";
  if (pathname.startsWith("/student/lessons/")) return "Dars sahifasi. O'qib ber yoki tushuntir deb ayting";
  if (pathname === "/student/assignments") return "Vazifalar";
  if (pathname === "/student/grades") return "Baholarim";
  if (pathname === "/student/chat") return "AI suhbat. Savolingizni ayting, men javob beraman";
  return "";
}

// Tartib muhim: aniqroq buyruqlar birinchi tekshiriladi ("o'chir" "och" dan, "tushuntir" "qayta" dan oldin).
// run() matn qaytarsa — o'sha aytiladi, aks holda reply
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
      return `${n}-dars ochilmoqda`;
    },
  },
  { label: "“Tushuntir” — ochiq darsni AI tushuntiradi", match: (t) => has(t, "tushuntir"), run: () => dispatchVoiceAction("explain") },
  {
    label: "“Keyingi” / “Oldingi” / “Qayta” — bosqichma-bosqich o'rganishda",
    match: (t) => has(t, "keyingi", "oldingi", "qayta"),
    run: (_, t) => dispatchVoiceAction(has(t, "keyingi") ? "next" : has(t, "oldingi") ? "prev" : "repeat"),
  },
  {
    label: "“Sekinroq” / “Tezroq” — o'qish tezligi",
    match: (t) => has(t, "sekin", "tezroq"),
    run: (_, t) => {
      const next = has(t, "sekin") ? (getSpeechRate() === "fast" ? "medium" : "slow") : getSpeechRate() === "slow" ? "medium" : "fast";
      setSpeechRate(next);
      return `Tezlik: ${SPEECH_RATES.find((r) => r.key === next)?.label}`;
    },
  },
  { label: "“Kattalashtir” — shriftni kattalashtiradi", match: (t) => has(t, "kattalashtir", "katta qil"), run: ({ fontStep }) => fontStep(1) },
  { label: "“Kichraytir” — shriftni kichraytiradi", match: (t) => has(t, "kichraytir", "kichik qil"), run: ({ fontStep }) => fontStep(-1) },
  {
    label: "“Tungi rejim” / “Kunduzgi rejim”",
    match: (t) => has(t, "tungi", "kunduzgi", "qorongi", "yorug"),
    run: (_, t) => {
      const dark = has(t, "tungi", "qorongi");
      setTheme(dark ? "dark" : "light");
      return dark ? "Tungi rejim yoqildi" : "Kunduzgi rejim yoqildi";
    },
  },
  { label: "“O'qib ber” — sahifadagi ma'lumotni o'qiydi", match: (t) => has(t, "oqi", "tingla"), run: () => dispatchVoiceAction("read") },
  { label: "“Suhbat” — AI bilan suhbat", match: (t) => has(t, "suhbat", "chat", "чат"), run: ({ go }) => go("/student/chat"), reply: "AI suhbat ochildi. Savolingizni ayting" },
  { label: "“Jadval” — dars jadvali", match: (t) => has(t, "jadval"), run: ({ go }) => go("/student/schedule"), reply: "Dars jadvali ochildi" },
  { label: "“Vazifalar” — uy vazifalari", match: (t) => has(t, "vazifa", "uy ishi"), run: ({ go }) => go("/student/assignments"), reply: "Vazifalar ochildi" },
  { label: "“Baholar” — baholarim", match: (t) => has(t, "baho"), run: ({ go }) => go("/student/grades"), reply: "Baholar ochildi" },
  { label: "“Darslar” — darslarim", match: (t) => has(t, "dars"), run: ({ go }) => go("/student/lessons"), reply: "Darslar ochildi. Ro'yxatni eshitish uchun o'qib ber deb ayting" },
  { label: "“Bosh sahifa”", match: (t) => has(t, "bosh sahifa", "asosiy"), run: ({ go }) => go("/student"), reply: "Bosh sahifa ochildi" },
  { label: "“Orqaga” — oldingi sahifa", match: (t) => has(t, "orqaga"), run: ({ back }) => back(), reply: "Oldingi sahifaga qaytildi" },
  { label: "“Qayerdaman” — qaysi sahifadaligingiz", match: (t) => has(t, "qayer"), run: ({ pathname }) => pageName(pathname) || "Imkon AI" },
  {
    label: "“Yordam” — buyruqlarni aytib beradi",
    match: (t) => has(t, "yordam"),
    run: () =>
      "Buyruqlar: darslar, vazifalar, jadval, suhbat, yangi suhbat, baholar, bosh sahifa, ikkinchi darsni och, o'qib ber, tushuntir, keyingi, qayta, " +
      "sekinroq, kattalashtir, kichraytir, tungi rejim, to'xta, orqaga, ovoz rejimini o'chir, chiqish.",
  },
  {
    label: "“Chiqish” — tizimdan chiqish",
    match: (t) => has(t, "chiqish"),
    // Avval xayrlashamiz, keyin chiqamiz (chiqqach sahifa almashib, ovoz uzilib qolmasin)
    run: ({ logout }) => {
      speak("Tizimdan chiqildi. Xayr!", { quick: true }).finally(logout);
    },
  },
];
// Qaysi sahifa va qaysi rejimdaligini Madina ovozida aytish (server ovozi holati avval aniqlanadi)
function announce(kind: "login" | "reload" | "unsupported", fullName: string, pathname: string) {
  const page = pageName(pathname) || "Imkon AI";
  const text =
    kind === "login"
      ? `Xush kelibsiz, ${fullName}! Hozir siz turgan sahifa: ${page}. Ovoz rejimi yoqilgan, men sizni tinglayapman. ` +
        "Buyruq ayting, masalan: darslar, suhbat yoki yordam."
      : kind === "unsupported"
        ? `Xush kelibsiz, ${fullName}! Hozir siz turgan sahifa: ${page}. ` +
          "Bu brauzerda ovozli boshqaruv ishlamaydi. Google Chrome yoki Microsoft Edge'dan foydalaning."
        : `Ovoz rejimi yoqilgan. Hozir siz turgan sahifa: ${page}.`;
  checkServerTts().then(() =>
    speakOrWaitForClick(text, { quick: true }).then((r) => {
      if (r.error === AUTOPLAY_BLOCKED) toast(AUTOPLAY_BLOCKED, { icon: <Volume2 className="size-5 text-indigo-600" aria-hidden />, duration: 8000 });
    })
  );
}

let pendingLoginWelcome = false; // login'dan keyingi "xush kelibsiz" hali aytilmagan
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
  const { user, logout } = useAuth();
  const welcomeRef = useRef<"login" | "reload" | "unsupported" | null>(null);

  const [mode, setModeState] = useState(false); // doimiy tinglash rejimi
  const [listening, setListening] = useState(false); // bir martalik tinglash
  const [lastHeard, setLastHeard] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [fontIndex, setFontIndex] = useState(0);
  const [rateKey, setRateKey] = useState<SpeechRateKey>("medium");

  // O'qish tezligi: saqlangan qiymat + ovozli buyruq ("Sekinroq") bilan o'zgarsa ham yangilanadi
  useEffect(() => {
    const sync = () => setRateKey(getSpeechRate());
    sync();
    window.addEventListener(RATE_EVENT, sync);
    return () => window.removeEventListener(RATE_EVENT, sync);
  }, []);

  const cycleRate = () => {
    const i = SPEECH_RATES.findIndex((r) => r.key === rateKey);
    const next = SPEECH_RATES[(i + 1) % SPEECH_RATES.length];
    setSpeechRate(next.key);
    speak(`Tezlik: ${next.label}`, { quick: true });
  };
  const rateLabel = SPEECH_RATES.find((r) => r.key === rateKey)?.label;

  const modeRef = useRef(false);
  const [micError, setMicError] = useState<string | null>(null); // mikrofon xatosi kodi -> yo'riqnoma oynasi

  // Mikrofon xatosi: jiddiy bo'lsa — yo'riqnoma oynasi, aks holda qisqa bildirishnoma. Ovoz bilan ham aytiladi
  const reportMicError = useCallback((message: string, code: string) => {
    if (MIC_SETUP_ERRORS.includes(code)) setMicError(code);
    else toast.error(message);
    speak(message, { quick: true });
  }, []);

  const setFont = (index: number) => {
    setFontIndex(index);
    document.documentElement.style.fontSize = `${FONT_SCALES[index]}%`;
    writeStorage(FONT_KEY, String(index));
  };

  // ---------- Buyruqni bajarish ----------
  // asCommand — AI gapirayotganda aytilgan buyruq: suhbat sahifasida ham savol emas, buyruq sifatida bajariladi
  const handleRef = useRef<(heard: string, asCommand?: boolean) => void>(() => {});
  const setModeRef = useRef<(on: boolean) => void>(() => {});
  const skipAnnounceRef = useRef(false); // buyruq javobini aytgan bo'lsak, sahifa nomini qayta aytmaymiz

  useEffect(() => {
    handleRef.current = (heard: string, asCommand = false) => {
      const text = normalizeSpeech(heard);
      if (!text) return;
      setLastHeard(heard);

      // AI suhbat sahifasida: savollar to'g'ridan-to'g'ri AI'ga yuboriladi, javob ovoz bilan aytiladi
      if (pathname === "/student/chat" && !asCommand) {
        if (has(text, "yangi suhbat")) {
          dispatchVoiceAction("new-chat");
          speak("Yangi suhbat boshlandi. Savolingizni ayting", { quick: true });
          return;
        }
        if (has(text, "ovozli suhbat")) {
          dispatchVoiceAction("voice-chat");
          return;
        }
        // Uzun gap — buyruq emas, savol ("darslar haqida gapirib ber" darslar sahifasini ochmasin)
        const chatCommand = text.split(" ").length <= 3 ? COMMANDS.find((c) => c.match(text)) : undefined;
        if (!chatCommand) {
          askChat(heard.trim());
          return;
        }
      }

      const command = COMMANDS.find((c) => c.match(text));
      if (!command) {
        speak("Tushunmadim. Yordam deb ayting", { quick: true });
        return;
      }
      const reply =
        command.run(
          {
            go: (href) => router.push(href),
            back: () => router.back(),
            logout,
            setMode: (on) => setModeRef.current(on),
            fontStep: (delta) => {
              const next = Math.min(Math.max(fontIndex + delta, 0), FONT_SCALES.length - 1);
              if (next === fontIndex) return delta > 0 ? "Shrift eng katta o'lchamda" : "Shrift eng kichik o'lchamda";
              setFont(next);
              return delta > 0 ? "Shrift kattalashtirildi" : "Shrift kichraytirildi";
            },
            pathname,
          },
          text
        ) || command.reply;
      if (reply) {
        skipAnnounceRef.current = true;
        speak(reply, { quick: true });
      }
    };
  });

  // Ovozli suhbat oynasida AI gapirayotganda aytilgan sahifa buyrug'i ("darslarga o't")
  useEffect(() => {
    const listener = (e: Event) => handleRef.current((e as CustomEvent<string>).detail, true);
    window.addEventListener(VOICE_COMMAND_EVENT, listener);
    return () => window.removeEventListener(VOICE_COMMAND_EVENT, listener);
  }, []);

  // ---------- Doimiy tinglash (lib/voiceMode) ----------
  useEffect(() => {
    voiceMode.setHandlers({
      onCommand: (text) => handleRef.current(text),
      onHeard: (text) => setLastHeard(text),
      // AI gapirayotganda "to'xta" / "darslarga o't": ovoz darhol to'xtaydi, buyruq bo'lsa — bajariladi
      onBargeIn: (kind, text) => {
        stopSpeaking();
        dispatchVoiceAction("stop");
        setLastHeard(text);
        if (kind === "command") handleRef.current(text, true);
      },
      onFatal: (message, code) => {
        modeRef.current = false;
        setModeState(false);
        writeStorage(MODE_KEY, "0");
        reportMicError(message, code);
      },
    });
  }, [reportMicError]);

  const setMode = useCallback((on: boolean) => {
    if (on && !isRecognitionSupported()) {
      setMicError("unsupported");
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

  // Saqlangan sozlamalar: shrift va ovoz rejimi. Server ovozi holatini oldindan bilib olamiz —
  // "O'qib ber" bosilganda kutib o'tirmasin (aks holda brauzer kechikkan ovozni bloklaydi)
  useEffect(() => {
    checkServerTts();
    const savedFont = Number(readStorage(FONT_KEY)) || 0;
    document.documentElement.style.fontSize = `${FONT_SCALES[savedFont] ?? 100}%`;
    // Login'dan so'ng birinchi ochilish: ovoz rejimi o'zi yoqiladi (o'quvchi "ovoz rejimini o'chir" deb o'chira oladi)
    // Belgi modul darajasida saqlanadi: dasturlash rejimida React komponentni ikki marta yuklaganda ham yo'qolmasin
    try {
      if (sessionStorage.getItem(LOGIN_WELCOME_KEY) === "1") pendingLoginWelcome = true;
      sessionStorage.removeItem(LOGIN_WELCOME_KEY);
    } catch {}
    const justLoggedIn = pendingLoginWelcome;
    const supported = isRecognitionSupported();
    const savedMode = (justLoggedIn || readStorage(MODE_KEY) === "1") && supported;
    if (justLoggedIn && supported) writeStorage(MODE_KEY, "1");
    welcomeRef.current = justLoggedIn ? (supported ? "login" : "unsupported") : savedMode ? "reload" : null;
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

  // Kirganda (yoki sahifa yangilanganda ovoz rejimi yoniq bo'lsa) — qaysi sahifa va qaysi rejimdaligini aytamiz.
  // Server o'zbekcha ovozi holati avval aniqlanadi, aks holda birinchi xabar ruscha ovozga tushib qoladi
  useEffect(() => {
    const kind = welcomeRef.current;
    if (!kind || !user) return;
    // Biroz kechiktiramiz: komponent darhol qayta yuklansa (dasturlash rejimi), birinchi urinish bekor bo'ladi
    const id = setTimeout(() => {
      welcomeRef.current = null;
      pendingLoginWelcome = false;
      announce(kind, user.full_name, pathname);
    }, 400);
    return () => clearTimeout(id);
  }, [user, pathname]);


  // Ovoz rejimida sahifa o'zgarganda nomini aytamiz
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    if (skipAnnounceRef.current) {
      skipAnnounceRef.current = false; // ovozli buyruq javobi ("Darslar ochildi") allaqachon aytilgan
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
        toast(`“${heard}”`, { icon: <Mic className="size-5 text-indigo-600" aria-hidden /> });
        handleRef.current(heard);
      }
    } catch (e) {
      if (e instanceof RecognitionError) reportMicError(e.message, e.code);
      else toast.error((e as Error).message);
    } finally {
      setListening(false);
    }
  };

  const cycleFont = () => setFont((fontIndex + 1) % FONT_SCALES.length);

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
          onClick={cycleRate}
          className={`${ROUND_BTN} w-auto gap-1.5 px-3 text-sm font-medium`}
          aria-label={`O'qish tezligi: ${rateLabel}. O'zgartirish`}
          title="O'qish tezligi"
        >
          <Turtle className="size-5" aria-hidden />
          <span className="max-sm:hidden">{rateLabel}</span>
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
            mode ? "bg-red-600 shadow-red-600/25 hover:bg-red-700" : "bg-gradient-to-b from-indigo-500 to-indigo-600 shadow-indigo-600/25 hover:to-brand-700"
          }`}
          title="Ovoz rejimi (Alt + O)"
        >
          <Headphones className="size-5" aria-hidden />
          <span className="max-sm:hidden">{mode ? "Ovoz rejimi: yoniq" : "Ovoz rejimi"}</span>
        </button>
      </div>

      <MicPermissionDialog
        code={micError}
        onClose={() => setMicError(null)}
        onRetry={() => {
          setMicError(null);
          setMode(true); // brauzer ruxsatni qayta so'raydi
        }}
      />

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
