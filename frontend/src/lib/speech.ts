import { api } from "./api";

// ---------- Matnni ovoz bilan o'qish ----------
// Tartib: 1) OpenAI ovozi (server) — mavjud bo'lsa; 2) brauzerning o'zbekcha ovozi (Edge: Madina/Sardor);
// 3) o'zbekcha ovoz yo'q bo'lsa — ruscha ovoz, matn kirillchaga o'girilib o'qiladi; 4) turkcha; 5) har qanday ovoz.

export type SpeakResult = { ok: boolean; error?: string };

let audio: HTMLAudioElement | null = null;
let audioUrl: string | null = null;
let session = 0; // har bir yangi speak() oldingisini bekor qiladi
const listeners = new Set<(speaking: boolean) => void>();

// Server ovozi holati: null — hali tekshirilmagan. Mavjud bo'lmasa, 10 daqiqa qayta so'ramaymiz
let serverTtsOk: boolean | null = null;
let serverCheckedAt = 0;

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

// Sahifa ochilganda oldindan tekshirib qo'yamiz — tugma bosilganda kutish bo'lmasin
export async function checkServerTts() {
  if (Date.now() - serverCheckedAt < 10 * 60 * 1000 && serverTtsOk !== null) return serverTtsOk;
  serverCheckedAt = Date.now();
  try {
    const { data } = await api.get<{ available: boolean }>("/student/tts/status");
    serverTtsOk = data.available;
  } catch {
    serverTtsOk = false;
  }
  return serverTtsOk;
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

// O'zbek lotin yozuvi -> kirill (ruscha ovoz uchun: "o'simlik" -> "осимлик", "shahar" -> "шахар")
export function uzLatinToCyrillic(text: string) {
  // Tartib muhim: so'z boshidagi "e" birinchi (\b faqat lotin harflarini "so'z" deb biladi)
  const digraphs: [RegExp, string][] = [
    [/\be/gi, "э"],
    [/o[''ʻʼ`‘’]/gi, "о"],
    [/g[''ʻʼ`‘’]/gi, "г"],
    [/sh/gi, "ш"],
    [/ch/gi, "ч"],
    [/yo/gi, "ё"],
    [/yu/gi, "ю"],
    [/ya/gi, "я"],
    [/ye/gi, "е"],
  ];
  const single: Record<string, string> = {
    a: "а", b: "б", c: "ц", d: "д", e: "е", f: "ф", g: "г", h: "х", i: "и", j: "ж", k: "к", l: "л", m: "м",
    n: "н", o: "о", p: "п", q: "к", r: "р", s: "с", t: "т", u: "у", v: "в", w: "в", x: "х", y: "й", z: "з",
  };
  let out = text.toLowerCase();
  for (const [re, to] of digraphs) out = out.replace(re, to);
  return out.replace(/[a-z]/g, (ch) => single[ch] ?? ch).replace(/[''ʻʼ`‘’]/g, "");
}

type VoiceChoice = { voice: SpeechSynthesisVoice | null; lang: string; transform: (t: string) => string; label: string };

function pickVoice(voices: SpeechSynthesisVoice[]): VoiceChoice {
  const byLang = (prefix: string) => {
    const list = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
    return list.find((v) => /natural|online/i.test(v.name)) ?? list[0];
  };
  const same = (t: string) => t;
  const uz = byLang("uz");
  if (uz) return { voice: uz, lang: uz.lang, transform: same, label: "o'zbekcha" };
  const ru = byLang("ru");
  if (ru) return { voice: ru, lang: ru.lang, transform: uzLatinToCyrillic, label: "ruscha" };
  const tr = byLang("tr");
  if (tr) return { voice: tr, lang: tr.lang, transform: same, label: "turkcha" };
  const any = voices.find((v) => v.default) ?? voices[0] ?? null;
  return { voice: any, lang: any?.lang ?? "en-US", transform: same, label: "standart" };
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

async function speakWithBrowser(text: string, mySession: number): Promise<SpeakResult> {
  const synth = window.speechSynthesis;
  if (!synth) return { ok: false, error: "Brauzeringiz ovozli o'qishni qo'llab-quvvatlamaydi" };
  const choice = pickVoice(await loadVoices());
  if (!choice.voice && !synth.getVoices().length) {
    return { ok: false, error: "Kompyuterda birorta ham ovoz o'rnatilmagan. Microsoft Edge'dan foydalanib ko'ring" };
  }
  let spoke = false;
  for (const part of chunks(choice.transform(text))) {
    if (mySession !== session) return { ok: true };
    const error = await new Promise<string | null>((resolve) => {
      const u = new SpeechSynthesisUtterance(part);
      u.voice = choice.voice;
      u.lang = choice.lang;
      u.rate = 0.95;
      u.onstart = () => (spoke = true);
      u.onend = () => resolve(null);
      u.onerror = (e) => resolve(e.error === "interrupted" || e.error === "canceled" ? null : e.error);
      synth.resume(); // Chrome ba'zan "pauza" holatida qotib qoladi
      synth.speak(u);
    });
    if (error) {
      return {
        ok: false,
        error: error === "not-allowed" ? "Brauzer ovozni blokladi. Tugmani yana bir marta bosing" : `Ovozni ijro etib bo'lmadi (${error})`,
      };
    }
  }
  return spoke || mySession !== session ? { ok: true } : { ok: false, error: "Ovoz chiqmadi. Kompyuter ovozi yoqilganini tekshiring" };
}

async function speakWithServer(text: string, mySession: number) {
  const { data } = await api.post<Blob>("/student/tts", { text: text.slice(0, 4000) }, { responseType: "blob" });
  if (mySession !== session) return;
  audioUrl = URL.createObjectURL(data);
  audio = new Audio(audioUrl);
  await new Promise<void>((resolve, reject) => {
    audio!.onended = () => resolve();
    audio!.onerror = () => reject(new Error("audio"));
    audio!.play().catch(reject);
  });
}

// Tugma bosilgan zahoti (hali await'dan oldin) brauzer ovozini "uyg'otamiz" —
// aks holda Chrome kechikib kelgan ovozni foydalanuvchi bosmagan deb bloklaydi
function primeBrowserVoice() {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const warm = new SpeechSynthesisUtterance(" ");
  warm.volume = 0;
  synth.speak(warm);
}

// quick=true — qisqa xabarlar (sahifa nomi, javob) uchun darhol brauzer ovozi.
// Aks holda: server ovozi mavjud bo'lsa — u, bo'lmasa yoki xato bersa — brauzer ovozi.
export async function speak(text: string, { quick = false }: { quick?: boolean } = {}): Promise<SpeakResult> {
  stopSpeaking();
  const clean = plain(text);
  if (!clean || typeof window === "undefined") return { ok: false, error: "O'qiladigan matn yo'q" };
  const mySession = session;
  primeBrowserVoice();
  notify(true);
  try {
    if (!quick && serverTtsOk !== false) {
      try {
        await speakWithServer(clean, mySession);
        serverTtsOk = true;
        return { ok: true };
      } catch {
        serverTtsOk = false;
        serverCheckedAt = Date.now();
        if (mySession !== session) return { ok: true };
      }
    }
    return await speakWithBrowser(clean, mySession);
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
