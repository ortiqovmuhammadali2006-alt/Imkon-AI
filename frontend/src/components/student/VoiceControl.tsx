"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { HelpCircle, Loader2, Mic, MicOff, Turtle, Type, Volume2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  checkServerTts,
  getSpeechRate,
  RATE_EVENT,
  setSpeechRate,
  SPEECH_RATES,
  type SpeechRateKey,
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
  WAKE_EVENT,
  extractWake,
  prefetchSpeech,
} from "@/lib/speech";
import { askRobot, requestVoiceChat } from "@/lib/assistant";
import { LOGIN_WELCOME_KEY, SESSION_STARTED_KEY, voiceMode } from "@/lib/voiceMode";
import { OPEN_PROFILE_EVENT } from "@/components/DashboardShell";
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

const TUTOR_PATH = /^\/student\/lessons\/\d+\/tutor$/;
const TUTOR_HREF = /^\/student\/lessons\/(\d+)$/;

function pageName(pathname: string) {
  if (pathname === "/student") return "Bosh sahifa";
  if (pathname === "/student/schedule") return "Dars jadvali";
  if (pathname === "/student/lessons") return "Darslarim. Ro'yxatni eshitish uchun o'qib ber deb ayting";
  if (TUTOR_PATH.test(pathname)) return "Sun'iy intellekt o'qituvchisi bilan dars. Ovoz bilan javob berish uchun Imkon, mikrofonni yoq deng";
  if (pathname.startsWith("/student/lessons/")) return "Dars sahifasi. Imkon, o'rgat desangiz, sun'iy intellekt o'qituvchisi dars o'tadi";
  if (pathname === "/student/assignments") return "Vazifalar";
  if (pathname === "/student/grades") return "Baholarim";
  if (pathname === "/student/chat") return "Sun'iy intellekt bilan suhbat sahifasi. Suhbatlashish uchun Imkon, mikrofonni yoq deng";
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
  {
    // Ko'rmaydigan o'quvchi tugmani topa olmaydi — sun'iy intellekt bilan ovozli suhbat buyruq bilan boshlanadi.
    // Suhbat yoki o'qituvchi sahifasida — shu yerda, boshqa sahifada — suhbat sahifasi ochilib, darhol boshlanadi
    label: "“Mikrofonni yoq” — sun'iy intellekt bilan ovozli suhbat",
    match: (t) => has(t, "mikrofon", "mikrafon", "gaplashmoqchiman", "savol bermoqchiman") && !has(t, "ochir"),
    run: ({ go, pathname }) => {
      if (pathname === "/student/chat" || TUTOR_PATH.test(pathname)) dispatchVoiceAction("voice-chat");
      else {
        requestVoiceChat();
        go("/student/chat");
      }
    },
  },
  {
    label: "“O'rgat” — ochiq darsni sun'iy intellekt o'qituvchisi bilan o'rganish",
    match: (t) => has(t, "orgat", "tutor", "organamiz"),
    run: ({ go, pathname }) => {
      const m = pathname.match(TUTOR_HREF);
      if (!m) return "Avval darsni oching, keyin o'rgat deb ayting";
      go(`/student/lessons/${m[1]}/tutor`);
      return "Sun'iy intellekt o'qituvchisi ochildi. Darsni boshlash tugmasini bosing";
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
  {
    label: "“Suhbat” — sun'iy intellekt bilan suhbatlashish",
    match: (t) => has(t, "suhbat", "chat", "чат"),
    run: ({ go }) => go("/student/chat"),
    reply: "Sun'iy intellekt bilan suhbat ochildi. Suhbatlashish uchun Imkon, mikrofonni yoq deng",
  },
  {
    label: "“Profil” — ma'lumotlarim",
    match: (t) => has(t, "profil", "malumotlarim"),
    run: () => {
      window.dispatchEvent(new Event(OPEN_PROFILE_EVENT));
    },
    reply: "Profil ochildi",
  },
  { label: "“Jadval” — dars jadvali", match: (t) => has(t, "jadval"), run: ({ go }) => go("/student/schedule"), reply: "Dars jadvali ochildi" },
  { label: "“Vazifalar” — uy vazifalari", match: (t) => has(t, "vazifa", "uy ishi"), run: ({ go }) => go("/student/assignments"), reply: "Vazifalar ochildi" },
  { label: "“Baholar” — baholarim", match: (t) => has(t, "baho"), run: ({ go }) => go("/student/grades"), reply: "Baholar ochildi" },
  { label: "“Darslar” — darslarim", match: (t) => has(t, "dars"), run: ({ go }) => go("/student/lessons"), reply: "Darslar ochildi. Ro'yxatni eshitish uchun o'qib ber deb ayting" },
  { label: "“Bosh sahifa”", match: (t) => has(t, "bosh sahifa", "asosiy"), run: ({ go }) => go("/student"), reply: "Bosh sahifa ochildi" },
  { label: "“Orqaga” — oldingi sahifa", match: (t) => has(t, "orqaga"), run: ({ back }) => back(), reply: "Oldingi sahifaga qaytildi" },
  { label: "“Qayerdaman” — qaysi sahifadaligingiz", match: (t) => has(t, "qayer"), run: ({ pathname }) => pageName(pathname) || "Imkon" },
  {
    label: "“Yordam” — buyruqlarni aytib beradi",
    match: (t) => has(t, "yordam"),
    run: () =>
      "Buyruqdan oldin Imkon deng. Buyruqlar: darslar, vazifalar, jadval, suhbat, mikrofonni yoq, yangi suhbat, profil, baholar, bosh sahifa, ikkinchi darsni och, o'qib ber, tushuntir, keyingi, qayta, " +
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
// Oddiy buyruqlar qisqa bo'ladi ("darslarni och", "ikkinchi darsni och"). Uzun gap ("ertangi matematika darsimni och")
// robotga beriladi — u aniq darsni topadi; aks holda "dars" so'zi har doim darslar ro'yxatini ochib yuborardi
function findCommand(text: string) {
  return text.split(" ").filter(Boolean).length <= 4 ? COMMANDS.find((c) => c.match(text)) : undefined;
}

// Tez-tez aytiladigan javoblar — ovoz rejimi yoqilganda oldindan yuklab qo'yiladi (buyruqdan keyin darhol eshitilsin)
const READY_PHRASES = [
  "Ha, eshitaman",
  "Bu buyruq emas. Sun'iy intellekt bilan suhbatlashish uchun Imkon, mikrofonni yoq deng.",
  ...COMMANDS.map((c) => c.reply).filter((r): r is string => Boolean(r)),
];

// Qaysi sahifa va qaysi rejimdaligini Madina ovozida aytish (server ovozi holati avval aniqlanadi)
function announce(kind: "login" | "reload" | "unsupported", fullName: string, pathname: string) {
  const page = pageName(pathname) || "Imkon";
  const text =
    kind === "login"
      ? `Xush kelibsiz, ${fullName}! Hozir siz turgan sahifa: ${page}. Ovozli yordamchi yoqilgan, men sizni tinglayapman. ` +
        "Buyruq berish uchun avval Imkon deng. Masalan: Imkon, darslarni och."
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
// Ovoz yordamchisi doim yoqiq (Siri kabi — "Imkon" deb chaqiriladi). O'quvchi tugma bilan o'chirsa — faqat shu seans davomida
const VOICE_OFF_KEY = "imkon_voice_off";
function readVoiceOff() {
  try {
    return sessionStorage.getItem(VOICE_OFF_KEY) === "1";
  } catch {
    return false;
  }
}
function writeVoiceOff(off: boolean) {
  try {
    if (off) sessionStorage.setItem(VOICE_OFF_KEY, "1");
    else sessionStorage.removeItem(VOICE_OFF_KEY);
  } catch {}
}
const FONT_SCALES = [100, 115, 130];
const ROUND_BTN =
  "flex size-11 items-center justify-center rounded-full border border-line bg-surface text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-indigo-600";

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
  const autoStartRef = useRef(false); // ovoz rejimi sahifa ochilganda o'zi yoqildi (foydalanuvchi bosmagan)

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
  // Bu yerga faqat buyruq keladi ("Imkon" bilan chaqirilgan yoki mikrofon tugmasi bosilgan) — hech qachon AI'ga savol emas
  const handleRef = useRef<(heard: string) => void>(() => {});
  const setModeRef = useRef<(on: boolean) => void>(() => {});
  const skipAnnounceRef = useRef(false); // buyruq javobini aytgan bo'lsak, sahifa nomini qayta aytmaymiz

  useEffect(() => {
    handleRef.current = (heard: string) => {
      const text = normalizeSpeech(heard);
      if (!text) return;
      setLastHeard(heard);

      // AI suhbat sahifasining o'z buyruqlari ("Imkon, yangi suhbat")
      if (pathname === "/student/chat") {
        if (has(text, "yangi suhbat")) {
          dispatchVoiceAction("new-chat");
          speak("Yangi suhbat boshlandi", { quick: true });
          return;
        }
        if (has(text, "ovozli suhbat")) {
          dispatchVoiceAction("voice-chat");
          return;
        }
      }

      const command = findCommand(text);
      if (!command) {
        // Ro'yxatda yo'q buyruq ("Ertangi matematika darsimni och") — robot AI bilan tushunadi, lekin faqat BUYRUQ sifatida:
        // savol yoki suhbat bo'lsa bajarilmaydi ("AI bilan gaplashish uchun mikrofonni bosing")
        askRobot(heard.trim(), { commandOnly: true });
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

  // "Imkon" chaqiruvi: "Imkon, darslarni och" — darhol; faqat "Imkon" — keyingi 9 soniyadagi gap buyruq bo'ladi.
  // Chaqiruvsiz gap (atrofdagi suhbat, noto'g'ri eshitilgan so'z) butunlay e'tiborsiz qoldiriladi
  const awakeUntilRef = useRef(0);
  const [awake, setAwakeState] = useState(false);
  const setAwake = useCallback((on: boolean) => {
    awakeUntilRef.current = on ? Date.now() + 9000 : 0;
    setAwakeState(on);
    window.dispatchEvent(new CustomEvent<boolean>(WAKE_EVENT, { detail: on }));
  }, []);
  useEffect(() => {
    if (!awake) return;
    const id = setTimeout(() => setAwake(false), 9000);
    return () => clearTimeout(id);
  }, [awake, setAwake]);

  const onUtteranceRef = useRef<(heard: string) => void>(() => {});
  useEffect(() => {
    onUtteranceRef.current = (heard: string) => {
      const { woke, rest } = extractWake(heard);
      if (woke) {
        if (!rest) {
          setAwake(true);
          setLastHeard("");
          speak("Ha, eshitaman", { quick: true });
          return;
        }
        setAwake(false);
        handleRef.current(rest);
        return;
      }
      if (Date.now() < awakeUntilRef.current) {
        setAwake(false);
        handleRef.current(heard);
      }
      // Chaqiruvsiz — hech narsa qilinmaydi
    };
  });

  // Ovozli suhbat oynasida AI gapirayotganda aytilgan buyruq ("Imkon, darslarga o't")
  useEffect(() => {
    const listener = (e: Event) => {
      const said = (e as CustomEvent<string>).detail;
      const { woke, rest } = extractWake(said);
      handleRef.current(woke ? rest : said);
    };
    window.addEventListener(VOICE_COMMAND_EVENT, listener);
    return () => window.removeEventListener(VOICE_COMMAND_EVENT, listener);
  }, []);

  // ---------- Doimiy tinglash (lib/voiceMode) ----------
  useEffect(() => {
    voiceMode.setHandlers({
      onCommand: (text) => onUtteranceRef.current(text),
      isAwake: () => Date.now() < awakeUntilRef.current,
      // Darhol bajariladi: yolg'iz "Imkon", tanish buyruq yoki chaqiruvsiz gap (u baribir e'tiborsiz qoldiriladi)
      isComplete: (text) => {
        const { woke, rest } = extractWake(text);
        const awakeNow = Date.now() < awakeUntilRef.current;
        if (!woke && !awakeNow) return true;
        if (woke && !rest) return true;
        return Boolean(findCommand(normalizeSpeech(woke ? rest : text)));
      },
      // Ekranda faqat chaqirilganda aytilayotgan gap ko'rsatiladi (atrofdagi gap-so'zlar emas)
      onHeard: (text) => {
        if (extractWake(text).woke || Date.now() < awakeUntilRef.current) setLastHeard(text);
      },
      // AI gapirayotganda: "to'xta" — darhol jim; "Imkon, darslarga o't" — to'xtab, buyruqni bajaradi
      onBargeIn: (kind, text) => {
        stopSpeaking();
        dispatchVoiceAction("stop");
        setLastHeard(text);
        if (kind === "command") handleRef.current(extractWake(text).rest);
        // Faqat "Imkon" — gapini to'xtatib, buyruqni kutadi
        if (kind === "wake") onUtteranceRef.current(text);
      },
      onFatal: (message, code) => {
        // Avtomatik yoqishda (sahifa bosishsiz ochilgan) Chrome mikrofonni rad etishi mumkin — rejimni o'chirmaymiz:
        // birinchi bosishda qayta urinamiz. Bosishdan keyin ham rad etilsa — haqiqatan ruxsat yo'q, yo'riqnoma chiqadi
        if (autoStartRef.current && (code === "not-allowed" || code === "service-not-allowed")) {
          autoStartRef.current = false;
          toast("Ovozli yordamchini boshlash uchun sahifaning istalgan joyini bosing", {
            icon: <Mic className="size-5 text-indigo-600" aria-hidden />,
            duration: 10000,
          });
          const retry = () => {
            window.removeEventListener("pointerdown", retry, true);
            window.removeEventListener("keydown", retry, true);
            if (modeRef.current) voiceMode.enable();
          };
          window.addEventListener("pointerdown", retry, true);
          window.addEventListener("keydown", retry, true);
          return;
        }
        // Mikrofon ishlamadi — hozircha o'chadi, lekin keyingi sahifa ochilishida yana urinib ko'riladi
        modeRef.current = false;
        setModeState(false);
        reportMicError(message, code);
      },
    });
  }, [reportMicError]);

  // Ovoz rejimi yoqilganda tayyor javoblar fonda yuklanadi (serverdagi o'zbekcha ovoz holati aniqlangach)
  useEffect(() => {
    if (!mode) return;
    const id = setTimeout(() => checkServerTts().then(() => prefetchSpeech(READY_PHRASES)), 2500);
    return () => clearTimeout(id);
  }, [mode]);

  const setMode = useCallback((on: boolean) => {
    if (on && !isRecognitionSupported()) {
      setMicError("unsupported");
      return;
    }
    autoStartRef.current = false; // foydalanuvchi o'zi bosdi — xato bo'lsa darhol yo'riqnoma ko'rsatiladi
    modeRef.current = on;
    setModeState(on);
    setLastHeard("");
    writeVoiceOff(!on);
    if (on) {
      voiceMode.enable();
      speak("Ovozli yordamchi yoqildi. Buyruq berish uchun Imkon deb chaqiring. Masalan: Imkon, darslarni och.", { quick: true });
    } else {
      voiceMode.disable();
      speak("Ovozli yordamchi o'chirildi", { quick: true });
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
    // Tizimga kirish = login formasi YOKI saytni yangi seansda ochish (token saqlangan bo'lsa, forma ko'rinmaydi).
    // Ikkala holda ham ovoz rejimi o'zi yoqiladi va qayerdaligi aytiladi. Seans davomida o'quvchi o'zi o'chirsa — o'chiq qoladi.
    // Belgi modul darajasida saqlanadi: dasturlash rejimida React komponentni ikki marta yuklaganda ham yo'qolmasin
    try {
      if (sessionStorage.getItem(LOGIN_WELCOME_KEY) === "1") pendingLoginWelcome = true;
      sessionStorage.removeItem(LOGIN_WELCOME_KEY);
      if (!sessionStorage.getItem(SESSION_STARTED_KEY)) {
        pendingLoginWelcome = true;
        sessionStorage.setItem(SESSION_STARTED_KEY, "1");
      }
    } catch {}
    const justLoggedIn = pendingLoginWelcome;
    const supported = isRecognitionSupported();
    // Har kirishda va har sahifa ochilganda yoqiq; yangi kirishda qo'lda o'chirish ham unutiladi
    if (justLoggedIn) writeVoiceOff(false);
    const savedMode = supported && !readVoiceOff();
    // E'lon faqat kirishda (har yangilashda takrorlanmaydi — "Imkon" doim tinglab turadi)
    welcomeRef.current = justLoggedIn ? (supported ? "login" : "unsupported") : null;
    modeRef.current = savedMode;
    autoStartRef.current = savedMode;
    if (savedMode) voiceMode.enable();
    const id = setTimeout(() => {
      setFontIndex(savedFont);
      setModeState(savedMode);
    }, 0);
    return () => {
      clearTimeout(id);
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
          {/* Chaqirilmagan paytda — "Imkon" deb chaqirish eslatmasi; chaqirilganda — eshitilayotgan buyruq */}
          <span className={`mr-2 inline-block size-2 rounded-full ${awake || listening ? "animate-pulse bg-red-500" : "bg-emerald-400"}`} aria-hidden />
          {awake || listening ? "Eshitaman" : "“Imkon” deb chaqiring"}
          {(awake || listening) && lastHeard && <span className="text-gray-300"> · “{lastHeard}”</span>}
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
          aria-label={mode ? "Ovozli yordamchi yoqiq — Imkon deb chaqiring. O'chirish (Alt + O)" : "Ovozli yordamchini yoqish (Alt + O)"}
          className={`flex h-11 items-center gap-2 rounded-full px-3 font-semibold transition-colors sm:px-4 ${
            mode
              ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
              : "bg-slate-100 text-slate-600 ring-1 ring-line hover:bg-slate-200"
          }`}
          title={mode ? "Imkon tinglayapti — “Imkon” deb chaqiring (bosilsa o'chadi)" : "Ovozli yordamchini yoqish"}
        >
          {/* Yoqiq — doim tinglab turadi (Siri kabi), bosish shart emas; tugma faqat holatni ko'rsatadi va o'chirish uchun */}
          {mode ? (
            <span className="relative flex size-2.5" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
          ) : (
            <MicOff className="size-5" aria-hidden />
          )}
          <span className="max-sm:hidden">{mode ? "Imkon tinglayapti" : "Ovozni yoqish"}</span>
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
