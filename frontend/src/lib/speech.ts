import { api } from "./api";

// ---------- Matnni ovoz bilan o'qish ----------

let audio: HTMLAudioElement | null = null;
let audioUrl: string | null = null;
let session = 0; // har bir yangi speak() oldingisini bekor qiladi
const listeners = new Set<(speaking: boolean) => void>();

// Server (OpenAI) ovozi ishlamasa, keyingi 5 daqiqa davomida uni qayta so'ramaymiz — kechikish bo'lmasin
let serverTtsBlockedUntil = 0;

function notify(speaking: boolean) {
  listeners.forEach((fn) => fn(speaking));
}

// Hozir o'qilayotganini kuzatish (tugmalar va mikrofon uchun)
export function onSpeakingChange(fn: (speaking: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Markdown belgilarini olib tashlash — ovozda "yulduzcha" deb o'qilmasin
function plain(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#`>|]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function stopSpeaking() {
  session++;
  audio?.pause();
  audio = null;
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  notify(false);
}

// Brauzer ovozlari sahifa ochilgach kechroq yuklanadi — kutib olamiz
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  if (voices.length) return Promise.resolve(voices);
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

// O'zbekcha ovoz (Edge'da "Madina/Sardor Online"), bo'lmasa turkcha — lotin yozuvini yaxshi o'qiydi
function pickVoice(voices: SpeechSynthesisVoice[]) {
  const byLang = (prefix: string) => {
    const list = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
    return list.find((v) => /natural|online/i.test(v.name)) ?? list[0];
  };
  return byLang("uz") ?? byLang("tr") ?? null;
}

export async function hasUzbekVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  return (await loadVoices()).some((v) => v.lang.toLowerCase().startsWith("uz"));
}

// Chrome uzun matnni ~15 soniyadan keyin uzib qo'yadi — gaplarga bo'lib o'qiymiz
function chunks(text: string, max = 180) {
  const sentences = text.match(/[^.!?;:\n]+[.!?;:\n]*/g) ?? [text];
  const result: string[] = [];
  let current = "";
  for (const s of sentences) {
    if ((current + s).length > max && current) {
      result.push(current.trim());
      current = "";
    }
    if (s.length > max) {
      for (let i = 0; i < s.length; i += max) result.push(s.slice(i, i + max).trim());
    } else current += s;
  }
  if (current.trim()) result.push(current.trim());
  return result.filter(Boolean);
}

async function speakWithBrowser(text: string, mySession: number) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const voice = pickVoice(await loadVoices());
  for (const part of chunks(text)) {
    if (mySession !== session) return;
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(part);
      u.voice = voice;
      u.lang = voice?.lang ?? "uz-UZ";
      u.rate = 0.95;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
    });
  }
}

async function speakWithServer(text: string, mySession: number) {
  const { data } = await api.post<Blob>("/student/tts", { text: text.slice(0, 4000) }, { responseType: "blob" });
  if (mySession !== session) return;
  audioUrl = URL.createObjectURL(data);
  audio = new Audio(audioUrl);
  await new Promise<void>((resolve) => {
    audio!.onended = () => resolve();
    audio!.onerror = () => resolve();
    audio!.play().catch(() => resolve());
  });
}

// quick=true — qisqa xabarlar (sahifa nomi, javob) uchun darhol brauzer ovozi.
// Aks holda avval AI ovozi (OpenAI), ishlamasa — brauzer ovozi.
export async function speak(text: string, { quick = false }: { quick?: boolean } = {}) {
  stopSpeaking();
  const clean = plain(text);
  if (!clean || typeof window === "undefined") return;
  const mySession = session;
  notify(true);
  try {
    if (!quick && Date.now() > serverTtsBlockedUntil) {
      try {
        await speakWithServer(clean, mySession);
        return;
      } catch {
        serverTtsBlockedUntil = Date.now() + 5 * 60 * 1000;
      }
    }
    await speakWithBrowser(clean, mySession);
  } finally {
    if (mySession === session) notify(false);
  }
}

// ---------- Nutqni tanib olish ----------

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionResultEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
export type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function isRecognitionSupported() {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

// O'zbek tili qo'llab-quvvatlanmasa — rus tiliga o'tamiz (natija kirillchada keladi, normalizeSpeech lotinchaga aylantiradi)
const LANGS = ["uz-UZ", "ru-RU"];
let langIndex = 0;

export function createRecognition(continuous = false, interim = false): Recognition | null {
  if (!isRecognitionSupported()) return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const r = new (w.SpeechRecognition ?? w.webkitSpeechRecognition)!();
  r.lang = LANGS[langIndex];
  r.interimResults = interim;
  r.continuous = continuous;
  return r;
}

// "language-not-supported" bo'lsa, keyingi tilga o'tadi. true — yana urinib ko'rish mumkin
export function fallbackLanguage() {
  if (langIndex >= LANGS.length - 1) return false;
  langIndex++;
  return true;
}

// Nutqni tanish xatolarini tushunarli xabarga aylantirish (null — e'tiborsiz qoldirish mumkin)
export function recognitionErrorMessage(error: string): string | null {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Mikrofonga ruxsat berilmagan. Manzil satridagi qulf belgisini bosib, mikrofonga ruxsat bering";
    case "audio-capture":
      return "Mikrofon topilmadi. Mikrofon ulanganini tekshiring";
    case "network":
      return "Ovozni tanish uchun internet kerak";
    case "language-not-supported":
      return "Brauzeringiz o'zbek tilini tanimaydi. Google Chrome yoki Microsoft Edge'dan foydalaning";
    case "no-speech":
    case "aborted":
      return null;
    default:
      return "Ovozni tanib bo'lmadi, qaytadan urinib ko'ring";
  }
}

// Bir marta tinglab, aytilgan matnni qaytaradi (buyruq, savol yoki javobni ovoz bilan yozish uchun).
// onInterim — gapirayotgan paytda eshitilayotgan matn (ekranda ko'rsatish uchun)
export function listenOnce(onInterim?: (text: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = createRecognition(false, true);
    if (!r) return reject(new Error("Brauzeringiz ovozni tanishni qo'llab-quvvatlamaydi. Google Chrome yoki Microsoft Edge'dan foydalaning"));
    stopSpeaking();
    let finalText = "";
    let latest = "";
    let settled = false;
    const fail = (message: string) => {
      settled = true;
      reject(new Error(message));
    };

    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      latest = (finalText + interim).trim();
      onInterim?.(latest);
    };
    r.onerror = (e) => {
      if (settled) return;
      if (e.error === "language-not-supported" && fallbackLanguage()) {
        settled = true;
        listenOnce(onInterim).then(resolve, reject);
        return;
      }
      if (e.error === "no-speech") return fail("Ovoz eshitilmadi. Mikrofonga yaqinroq gapiring");
      const message = recognitionErrorMessage(e.error);
      if (message) fail(message);
    };
    r.onend = () => {
      if (settled) return;
      settled = true;
      const text = (finalText || latest).trim();
      if (text) resolve(text);
      else reject(new Error("Ovoz eshitilmadi. Mikrofonga yaqinroq gapiring"));
    };
    try {
      r.start();
    } catch {
      fail("Mikrofonni ishga tushirib bo'lmadi. Sahifani yangilab, qayta urinib ko'ring");
    }
  });
}

// Kirillcha o'zbek matnini lotinchaga (ba'zi brauzerlar kirillcha qaytaradi)
const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ғ: "g'", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y",
  к: "k", қ: "q", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ў: "o'",
  ф: "f", х: "x", ҳ: "h", ц: "ts", ч: "ch", ш: "sh", ъ: "", ь: "", э: "e", ю: "yu", я: "ya", ы: "i",
};

// "O'qib ber" / "Ўқиб бер" -> "oqib ber": kichik harf, lotin, apostrofsiz
export function normalizeSpeech(text: string) {
  return text
    .toLowerCase()
    .replace(/[а-яёўқғҳ]/g, (ch) => CYRILLIC[ch] ?? ch)
    .replace(/['ʻʼ`‘’]/g, "")
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NUMBER_WORDS: Record<string, number> = {
  bir: 1, birinchi: 1, ikki: 2, ikkinchi: 2, uch: 3, uchinchi: 3, tort: 4, tortinchi: 4, besh: 5, beshinchi: 5,
  olti: 6, oltinchi: 6, yetti: 7, yettinchi: 7, sakkiz: 8, sakkizinchi: 8, toqqiz: 9, toqqizinchi: 9, on: 10, oninchi: 10,
};

// "2-darsni och", "ikkinchi dars" -> 2
export function extractNumber(normalized: string): number | null {
  const digit = normalized.match(/\d+/);
  if (digit) return Number(digit[0]);
  for (const word of normalized.split(" ")) if (NUMBER_WORDS[word]) return NUMBER_WORDS[word];
  return null;
}

// ---------- Sahifalar orasidagi ovozli buyruqlar ----------

// Darslar sahifasida turganda "N-darsni och" (detail — tartib raqami)
export const OPEN_LESSON_EVENT = "imkon:open-lesson";

export type VoiceAction = { action: "read" | "explain" | "stop" };
export const VOICE_EVENT = "imkon:voice";

export function dispatchVoiceAction(action: VoiceAction["action"]) {
  window.dispatchEvent(new CustomEvent<VoiceAction>(VOICE_EVENT, { detail: { action } }));
}

// Sahifa ovozli buyruqqa ("o'qib ber", "tushuntir", "to'xta") javob berishi uchun
export function onVoiceAction(handler: (action: VoiceAction["action"]) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<VoiceAction>).detail.action);
  window.addEventListener(VOICE_EVENT, listener);
  return () => window.removeEventListener(VOICE_EVENT, listener);
}
