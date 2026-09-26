import { api } from "./api";

// ---------- Matnni ovoz bilan o'qish ----------
// Tartib: 1) OpenAI ovozi (server) — mavjud bo'lsa; 2) brauzerning o'zbekcha ovozi (Edge: Madina/Sardor);
// 3) o'zbekcha ovoz yo'q bo'lsa — ruscha ovoz, matn kirillchaga o'girilib o'qiladi; 4) turkcha; 5) har qanday ovoz.

export type SpeakResult = { ok: boolean; error?: string };

// Sahifa bosishsiz ochilganda brauzer ovozni bloklaydi — birinchi bosishdan keyin qayta aytish kerak
export const AUTOPLAY_BLOCKED = "Ovozni eshitish uchun sahifaning istalgan joyini bosing";

// Ovoz bloklangan bo'lsa — foydalanuvchi birinchi marta bosganda (yoki tugma bosganda) aytiladi
export async function speakOrWaitForClick(text: string, opts: { quick?: boolean } = {}) {
  const result = await speak(text, opts);
  if (result.ok || typeof window === "undefined") return result;
  const blocked = result.error === AUTOPLAY_BLOCKED || /blokladi|not-allowed/i.test(result.error ?? "");
  if (!blocked) return result;
  const retry = () => {
    window.removeEventListener("pointerdown", retry, true);
    window.removeEventListener("keydown", retry, true);
    speak(text, opts);
  };
  window.addEventListener("pointerdown", retry, true);
  window.addEventListener("keydown", retry, true);
  return { ok: false, error: AUTOPLAY_BLOCKED };
}

let audio: HTMLAudioElement | null = null;
let audioUrl: string | null = null;
let session = 0; // har bir yangi speak() oldingisini bekor qiladi
const listeners = new Set<(speaking: boolean) => void>();

// ---------- O'qish tezligi (foydalanuvchi tanlaydi, saqlanadi) ----------

export const SPEECH_RATES = [
  { key: "slow", label: "Sekin", browser: 0.7, server: 0.7, pauseMs: 700 },
  { key: "medium", label: "O'rta", browser: 0.82, server: 0.85, pauseMs: 400 },
  { key: "fast", label: "Tez", browser: 1.0, server: 1.0, pauseMs: 150 },
] as const;
export type SpeechRateKey = (typeof SPEECH_RATES)[number]["key"];
const RATE_KEY = "imkon_speech_rate";

export function getSpeechRate(): SpeechRateKey {
  try {
    const saved = localStorage.getItem(RATE_KEY);
    if (SPEECH_RATES.some((r) => r.key === saved)) return saved as SpeechRateKey;
  } catch {}
  return "medium";
}

// Tezlik o'zgarganda tugmalar yangilanishi uchun
export const RATE_EVENT = "imkon:rate";

export function setSpeechRate(key: SpeechRateKey) {
  try {
    localStorage.setItem(RATE_KEY, key);
  } catch {}
  window.dispatchEvent(new Event(RATE_EVENT));
}

const currentRate = () => SPEECH_RATES.find((r) => r.key === getSpeechRate()) ?? SPEECH_RATES[1];

// Server ovozi holati: null — hali tekshirilmagan. Mavjud bo'lmasa, 10 daqiqa qayta so'ramaymiz
let serverTtsOk: boolean | null = null;
let serverCheckedAt = 0;

// Hozir (yoki yaqinda) aytilayotgan matn — mikrofon AI'ning o'z ovozini buyruq deb olmasligi uchun
let spokenText = "";
let speakingNow = false;
let spokeUntil = 0;

function notify(speaking: boolean) {
  speakingNow = speaking;
  if (!speaking) spokeUntil = Date.now();
  listeners.forEach((fn) => fn(speaking));
}

// Hozir o'qilayotganini kuzatish (tugmalar va mikrofon uchun)
// Aytilayotgan matnni kuzatish (robot yonidagi "ovozli xabar" pufakchasi — eshitishi qiyinlar uchun ham)
const textListeners = new Set<(text: string) => void>();

export function onSpokenText(fn: (text: string) => void) {
  textListeners.add(fn);
  return () => {
    textListeners.delete(fn);
  };
}

export function onSpeakingChange(fn: (speaking: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

let serverUzbek = false; // server Azure orqali haqiqiy o'zbekcha ovoz beradimi

// Sahifa ochilganda oldindan tekshirib qo'yamiz — tugma bosilganda kutish bo'lmasin
let statusRequest: Promise<boolean> | null = null; // bir vaqtda bir nechta tugma so'rasa — bitta so'rov

export async function checkServerTts() {
  if (Date.now() - serverCheckedAt < 10 * 60 * 1000 && serverTtsOk !== null) return serverTtsOk;
  statusRequest ??= api
    .get<{ available: boolean; uzbek_voice?: boolean }>("/tts/status")
    .then(({ data }) => {
      serverTtsOk = data.available;
      serverUzbek = Boolean(data.uzbek_voice);
      return serverTtsOk;
    })
    .catch(() => {
      serverTtsOk = false;
      serverUzbek = false;
      return false;
    })
    .finally(() => {
      serverCheckedAt = Date.now();
      statusRequest = null;
    });
  return statusRequest;
}

// O'quvchi aniq o'zbekcha talaffuzni eshitadimi: server (Azure) yoki brauzerdagi o'zbekcha ovoz orqali
export async function hasClearUzbekVoice() {
  await checkServerTts();
  return (serverTtsOk && serverUzbek) || (await hasUzbekVoice());
}

// Markdown belgilarini olib tashlash — ovozda "yulduzcha" deb o'qilmasin
function plain(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\(\s*\[[^\]]*\]\([^)]*\)\s*\)/g, "") // internet manbasi havolasi: "([sayt](url))" — o'qilmaydi
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>|]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const activeStreams = new Set<() => void>(); // to'xtatilganda kutib turgan oqimlarni uyg'otish uchun

export function stopSpeaking() {
  session++;
  activeStreams.forEach((wakeUp) => wakeUp());
  finishPlayback?.();
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

const FEMALE_VOICE = /madina|female|woman|zira|svetlana|dariya|irina|milena|ekaterina|elena|anna|tatyana|filiz|emel|seda|google русский|google türkçe/i;
const MALE_VOICE = /sardor|(?<!fe)male|pavel|dmitr|ahmet|tolga|david|mark|guy|yuri|maxim/i;

function pickVoice(voices: SpeechSynthesisVoice[]): VoiceChoice {
  // Butun tizimda bitta ayol ovozi eshitilsin (asosiy server ovozi — Madina): ayol ovozlari birinchi,
  // erkak ovozlari oxirgi navbatda. Tabiiy (Natural/Online) ovozlar sifatliroq
  const score = (v: SpeechSynthesisVoice) =>
    (FEMALE_VOICE.test(v.name) ? 4 : 0) + (MALE_VOICE.test(v.name) ? -4 : 0) + (/natural|online/i.test(v.name) ? 1 : 0);
  const byLang = (prefix: string) =>
    voices.filter((v) => v.lang.toLowerCase().startsWith(prefix)).sort((a, b) => score(b) - score(a))[0];
  const same = (t: string) => t;
  const uz = byLang("uz");
  if (uz) return { voice: uz, lang: uz.lang, transform: same, label: "o'zbekcha" };
  const ru = byLang("ru");
  if (ru) return { voice: ru, lang: ru.lang, transform: uzLatinToCyrillic, label: "ruscha" };
  const tr = byLang("tr");
  if (tr) return { voice: tr, lang: tr.lang, transform: same, label: "turkcha" };
  const any = [...voices].sort((a, b) => score(b) - score(a))[0] ?? null;
  return { voice: any, lang: any?.lang ?? "en-US", transform: same, label: "standart" };
}

export async function hasUzbekVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  return (await loadVoices()).some((v) => v.lang.toLowerCase().startsWith("uz"));
}

// Har bir gap alohida o'qiladi — gaplar orasida pauza bo'lsin (shoshilmasdan) va
// Chrome uzun matnni ~15 soniyadan keyin uzib qo'ymasin. Juda uzun gap vergullar bo'yicha bo'linadi
function chunks(text: string, max = 180) {
  const sentences = text.match(/[^.!?;:\n]+[.!?;:\n]*/g) ?? [text];
  const result: string[] = [];
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length <= max) {
      result.push(s);
      continue;
    }
    let current = "";
    for (const part of s.split(/(?<=,)\s+/)) {
      if ((current + " " + part).length > max && current) {
        result.push(current.trim());
        current = "";
      }
      current += " " + part;
    }
    if (current.trim()) result.push(current.trim());
  }
  return result.flatMap((c) => (c.length > max * 1.5 ? c.match(new RegExp(`.{1,${max}}(\\s|$)`, "g")) ?? [c] : [c])).map((c) => c.trim()).filter(Boolean);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function speakWithBrowser(text: string, mySession: number): Promise<SpeakResult> {
  const synth = window.speechSynthesis;
  if (!synth) return { ok: false, error: "Brauzeringiz ovozli o'qishni qo'llab-quvvatlamaydi" };
  const choice = pickVoice(await loadVoices());
  // Tizimda faqat Madina (o'zbekcha ayol) ovozi eshitilsin: brauzerda o'zbekcha ovoz bo'lmasa — boshqa ovozga o'tmaymiz
  if (choice.label !== "o'zbekcha") {
    return { ok: false, error: "Madina ovozi vaqtincha ishlamayapti. Birozdan so'ng qayta urinib ko'ring" };
  }
  let spoke = false;
  const rate = currentRate();
  const parts = chunks(choice.transform(text));
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (mySession !== session) return { ok: true };
    if (i > 0) {
      await wait(rate.pauseMs); // gaplar orasida pauza — tinglovchi fikrni hazm qilsin
      if (mySession !== session) return { ok: true };
    }
    const error = await new Promise<string | null>((resolve) => {
      const u = new SpeechSynthesisUtterance(part);
      u.voice = choice.voice;
      u.lang = choice.lang;
      u.rate = rate.browser;
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

// ---------- Ovoz oqimi: bo'laklab, oldindan tayyorlab o'qish ----------
// Butun matnni bitta mp3 qilish uzun javobda 10+ soniya kuttiradi. Shuning uchun matn gap-gap bo'laklanadi:
// birinchi (qisqa) bo'lak ~1 soniyada tayyor bo'lib o'qila boshlaydi, keyingisi shu payt serverda tayyorlanadi.
// AI javobi hali yozilayotgan bo'lsa ham (push), tugagan gaplar darhol o'qiladi.

const SENTENCE_END = /[.!?…;:\n]+["”»)]*(?=\s|$)/g;

// Buferdan o'qishga tayyor bo'lakni ajratish. null — hali to'liq gap yo'q, ko'proq matn kutamiz
function takeSegment(buf: string, first: boolean, final: boolean): [string, string] | null {
  const min = first ? 25 : 160;
  const max = first ? 160 : 420;
  if (!buf.trim()) return null;
  if (final && buf.length <= max) return [buf, ""];
  let lastOk = -1;
  let firstAfter = -1;
  for (const m of buf.matchAll(SENTENCE_END)) {
    const end = m.index + m[0].length;
    if (end <= max) lastOk = end;
    else {
      firstAfter = end;
      break;
    }
  }
  let cut = -1;
  if (lastOk >= min || (final && lastOk > 0)) cut = lastOk;
  else if (buf.length > max) {
    // Nuqtasiz juda uzun gap — vergul yoki bo'shliqdan bo'lamiz
    const comma = buf.lastIndexOf(", ", max);
    const space = buf.lastIndexOf(" ", max);
    cut = firstAfter > 0 && firstAfter <= max * 1.4 ? firstAfter : comma > min ? comma + 1 : space > min ? space : max;
  } else if (final) cut = buf.length;
  if (cut <= 0) return null;
  return [buf.slice(0, cut), buf.slice(cut)];
}

// Qisqa, takrorlanadigan iboralar ("Darslar ochildi", "Tushunmadim") brauzerda saqlanadi — ikkinchi marta darhol aytiladi
const audioCache = new Map<string, Blob>();
const AUDIO_CACHE_LIMIT = 60;

async function fetchAudio(text: string): Promise<Blob> {
  const speed = currentRate().server;
  const key = `${speed}|${text}`;
  const cached = audioCache.get(key);
  if (cached) return cached;
  const { data } = await api.post<Blob>("/tts", { text, speed }, { responseType: "blob" });
  if (text.length <= 200) {
    audioCache.set(key, data);
    if (audioCache.size > AUDIO_CACHE_LIMIT) audioCache.delete(audioCache.keys().next().value!);
  }
  return data;
}

// Tayyor iboralarni oldindan yuklash (ovoz rejimi yoqilganda): buyruqdan keyin javob darhol eshitiladi.
// Ketma-ket yuklanadi — serverga bir vaqtda ko'p so'rov ketmasin; xato bo'lsa jim o'tkazib yuboriladi
let prefetching = false;
export async function prefetchSpeech(texts: string[]) {
  if (prefetching || serverTtsOk === false || typeof window === "undefined") return;
  prefetching = true;
  try {
    for (const text of texts) {
      const clean = plain(text);
      if (clean && clean.length <= 160) await fetchAudio(clean).catch(() => {});
    }
  } finally {
    prefetching = false;
  }
}

// stopSpeaking() hozirgi ijroni darhol tugatadi — brauzer "pause" hodisasini chiqarmasa ham ("to'xta" buyrug'i)
let finishPlayback: (() => void) | null = null;

function playBlob(blob: Blob, mySession: number) {
  if (mySession !== session) return Promise.resolve();
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = URL.createObjectURL(blob);
  audio = new Audio(audioUrl);
  const el = audio;
  return new Promise<void>((resolve, reject) => {
    finishPlayback = resolve;
    el.onended = () => resolve();
    el.onpause = () => mySession !== session && resolve(); // stopSpeaking() to'xtatdi
    el.onerror = () => reject(new Error("audio"));
    el.play().catch(reject);
  }).finally(() => {
    finishPlayback = null;
  });
}

export type SpeechStream = {
  // Hozirgacha yozilgan TO'LIQ matn (har safar kattalashib boradi)
  push: (fullText: string) => void;
  // Matn tugadi — qolganini o'qib, tugashini kutish
  end: (fullText?: string) => Promise<SpeakResult>;
  stop: () => void;
};

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

// quick — qisqa xabarlar (buyruq javoblari); endi ular ham Madina (server) ovozida aytiladi, parametr moslik uchun qoldirilgan
export function createSpeechStream(_opts: { quick?: boolean } = {}): SpeechStream {
  stopSpeaking();
  spokenText = ""; // yangi ovoz — bir xil matn qayta aytilsa ham pufakcha yangilansin
  const mySession = session;
  if (typeof window !== "undefined") primeBrowserVoice();
  notify(true);

  let received = 0; // push qilingan matndan qancha qismi bo'laklarga ajratildi
  let buffer = "";
  let ended = false;
  const segments: string[] = [];
  const audios: (Promise<Blob> | undefined)[] = [];
  // Server (Madina) ovozi — asosiy va yagona. Xato bergan bo'lsa ham 30 soniyadan keyin yana urinib ko'ramiz
  const serverDown = serverTtsOk === false && Date.now() - serverCheckedAt < 30_000;
  let useServer = !serverDown;
  let wake: (() => void) | null = null;
  const signal = () => {
    wake?.();
    wake = null;
  };
  activeStreams.add(signal);

  let current = 0; // hozir o'qilayotgan bo'lak

  // Keyingi bo'laklarni oldindan so'rab qo'yamiz (joriydan tashqari 2 tagacha) — gaplar orasida sukut bo'lmasin
  const prefetch = (i: number) => {
    if (!useServer) return;
    for (let j = i; j < Math.min(i + 3, segments.length); j++) {
      if (!audios[j]) {
        audios[j] = fetchAudio(segments[j]);
        audios[j]!.catch(() => {}); // xato player ichida ushlanadi
      }
    }
  };

  // Yangi to'liq gaplar paydo bo'lishi bilan ovozini darhol so'raymiz (oldingisi o'qilayotgan paytda tayyor bo'lsin)
  const split = () => {
    for (;;) {
      const taken = takeSegment(buffer, segments.length === 0, ended);
      if (!taken) break;
      const text = plain(taken[0]);
      buffer = taken[1];
      if (text) segments.push(text);
    }
    if (mySession === session) prefetch(current);
    signal();
  };

  const player = (async (): Promise<SpeakResult> => {
    let spokeAny = false;
    let lastError: string | undefined;
    for (let i = 0; ; i++) {
      while (i >= segments.length) {
        if (ended || mySession !== session) return spokeAny || mySession !== session ? { ok: true } : { ok: false, error: lastError ?? "O'qiladigan matn yo'q" };
        await new Promise<void>((r) => (wake = r));
      }
      if (mySession !== session) return { ok: true };
      current = i;
      if (useServer) {
        prefetch(i);
        try {
          const blob = await audios[i]!;
          await playBlob(blob, mySession);
          serverTtsOk = true;
          spokeAny = true;
          continue;
        } catch (err) {
          // Brauzer foydalanuvchi bosmaguncha ovozni bloklagan (sahifa bosishsiz ochilgan) — server aybdor emas
          if ((err as Error)?.name === "NotAllowedError") {
            if (mySession === session) stopSpeaking();
            return { ok: false, error: AUTOPLAY_BLOCKED };
          }
          // Server ovozi ishlamadi — shu va qolgan bo'laklarni brauzer ovozi o'qiydi
          useServer = false;
          serverTtsOk = false;
          serverCheckedAt = Date.now();
          if (mySession !== session) return { ok: true };
        }
      }
      const result = await speakWithBrowser(segments[i], mySession);
      if (result.ok) spokeAny = true;
      else lastError = result.error;
    }
  })().finally(() => {
    activeStreams.delete(signal);
    if (mySession === session) notify(false);
  });

  const push = (fullText: string) => {
    if (mySession !== session || ended) return;
    if (fullText !== spokenText) textListeners.forEach((fn) => fn(fullText));
    spokenText = fullText;
    buffer += fullText.slice(received);
    received = fullText.length;
    split();
  };

  return {
    push,
    end(fullText) {
      if (fullText !== undefined) push(fullText);
      ended = true;
      split();
      return player;
    },
    stop() {
      if (mySession === session) stopSpeaking();
      signal();
    },
  };
}

// Matnni o'qish: server ovozi (bo'laklab) mavjud bo'lsa — u, bo'lmasa yoki xato bersa — brauzer ovozi
export function speak(text: string, opts: { quick?: boolean } = {}): Promise<SpeakResult> {
  if (typeof window === "undefined" || !plain(text)) return Promise.resolve({ ok: false, error: "O'qiladigan matn yo'q" });
  return createSpeechStream(opts).end(text);
}
// ---------- AI gapirayotganda buyruq ("to'xta", "darslarga o't") ----------
// Mikrofon AI gapirayotganda ham tinglaydi, lekin faqat to'xtatish va sahifa buyruqlarini qabul qiladi.
// Eshitilgan gap AI'ning hozir aytayotgan matnida bo'lsa — bu karnaydan kelgan aks-sado, e'tiborsiz qoldiriladi.

const STOP_WORDS = ["toxta", "toxtat", "toxtang", "stop", "jim", "bas", "yetarli", "boldi", "бас", "стоп"];
const COMMAND_WORDS = ["dars", "vazifa", "jadval", "baho", "bosh sahifa", "orqaga", "chiqish", "suhbat", "ovoz rejim", "qayer", "yordam"];

export function isEcho(heard: string) {
  const h = normalizeSpeech(heard);
  if (!h) return true;
  if (!speakingNow && Date.now() - spokeUntil > 3000) return false;
  return normalizeSpeech(spokenText).includes(h);
}

// "stop" — ovozni to'xtatish, "command" — sahifa/rejim buyrug'i, null — buyruq emas (yoki aks-sado)
export type BargeInKind = "stop" | "command" | "wake";

// Sahifa buyrug'i faqat "Imkon" bilan ("Imkon, darslarga o't"); to'xtatish ("to'xta", "jim") — chaqiruvsiz ham;
// yolg'iz "Imkon" (wake) — AI jim bo'lib, buyruqni tinglaydi
export function bargeInKind(heard: string): BargeInKind | null {
  const t = normalizeSpeech(heard);
  const words = t.split(" ").filter(Boolean);
  if (!words.length || words.length > 8 || isEcho(heard)) return null;
  if (words.some((w) => STOP_WORDS.includes(w) || w.startsWith("toxta"))) return "stop";
  const { woke, rest } = extractWake(heard);
  if (woke && !rest) return "wake";
  if (woke && COMMAND_WORDS.some((w) => normalizeSpeech(rest).includes(w))) return "command";
  return null;
}

// ---------- Chaqiruv so'zi: "Imkon" ----------
// Ovoz rejimi faqat "Imkon" deb chaqirilganda buyruq qabul qiladi — atrofdagi gap-so'zlar buyruq yoki savol bo'lib ketmasin.
// Nutqni tanish so'zni biroz boshqacha yozishi mumkin — yaqin variantlar ham qabul qilinadi ("imkoniyat" esa emas)
const WAKE_WORDS = ["imkon", "imkom", "inkon", "imqon", "imkan", "emkon", "ymkon", "hey imkon"];

// { woke: chaqirildimi, rest: chaqiruvdan keyingi buyruq (asl yozuvda) }
export function extractWake(heard: string): { woke: boolean; rest: string } {
  const tokens = heard.trim().split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const w = normalizeSpeech(tokens[i]).replace(/[^a-z]/g, "");
    if (WAKE_WORDS.includes(w)) {
      return { woke: true, rest: tokens.slice(i + 1).join(" ").replace(/^[\s,.!?:;—-]+/, "").trim() };
    }
  }
  return { woke: false, rest: "" };
}

// Chaqiruv holati (robotcha "tinglayapman" ko'rinishiga o'tadi)
export const WAKE_EVENT = "imkon:wake";

// Ovozli suhbat oynasi uchun: AI gapirayotganda buyruqni kutish. Qaytgan funksiya — tinglashni to'xtatadi
export function listenForBargeIn(onHit: (kind: BargeInKind, text: string) => void): () => void {
  let active = true;
  let rec: Recognition | null = null;
  const stop = () => {
    active = false;
    const r = rec;
    rec = null;
    if (r) {
      r.onend = null;
      r.onresult = null;
      r.onerror = null;
      try {
        r.abort();
      } catch {}
    }
  };
  const start = () => {
    if (!active) return;
    const r = createRecognition(true, true);
    if (!r) return;
    rec = r;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        const kind = bargeInKind(text);
        // "To'xta" — darhol (oraliq natijada ham), sahifa buyrug'i — gap tugagach
        // "To'xta" — darhol (oraliq natijada ham); "Imkon" va buyruq — gap tugagach
        if (kind === "stop" || (kind && e.results[i].isFinal)) {
          stop();
          onHit(kind, text);
          return;
        }
      }
    };
    r.onerror = () => {};
    r.onend = () => {
      rec = null;
      if (active) setTimeout(start, 200);
    };
    try {
      r.start();
    } catch {
      rec = null;
    }
  };
  start();
  return stop;
}

// Ovozli suhbat oynasidan sahifa buyrug'ini umumiy ovozli boshqaruvga (VoiceControl) uzatish
export const VOICE_COMMAND_EVENT = "imkon:voice-command";

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

// Nutqni tanish xatosi: code — "not-allowed" (ruxsat yo'q), "audio-capture" (mikrofon yo'q), "no-speech" va h.k.
export class RecognitionError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

// Mikrofon bilan bog'liq jiddiy xatolar — foydalanuvchiga batafsil ko'rsatma oynasi kerak
export const MIC_SETUP_ERRORS = ["not-allowed", "service-not-allowed", "audio-capture", "unsupported", "language-not-supported"];

// Bir marta tinglab, aytilgan matnni qaytaradi (buyruq, savol yoki javobni ovoz bilan yozish uchun).
// onInterim — gapirayotgan paytda eshitilayotgan matn (ekranda ko'rsatish uchun)
// signal — tinglashni tashqaridan to'xtatish (masalan, ovozli suhbatni yopganda); to'xtatilsa "aborted" xatosi qaytadi
// pauseMs — o'quvchi gap orasida to'xtab o'ylasa ham tinglash uzilmasin: shuncha jimlikdan keyin tugaydi
// (berilmasa — brauzer birinchi pauzadayoq to'xtatadi, qisqa buyruqlar uchun yetarli)
export function listenOnce(
  onInterim?: (text: string) => void,
  signal?: AbortSignal,
  opts: { pauseMs?: number } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new RecognitionError("To'xtatildi", "aborted"));
    const continuous = Boolean(opts.pauseMs);
    const r = createRecognition(continuous, true);
    if (!r) {
      return reject(
        new RecognitionError("Brauzeringiz ovozni tanishni qo'llab-quvvatlamaydi. Google Chrome yoki Microsoft Edge'dan foydalaning", "unsupported")
      );
    }
    stopSpeaking();
    let finalText = "";
    let latest = "";
    let settled = false;
    let silenceTimer: ReturnType<typeof setTimeout> | undefined;
    // Uzluksiz rejimda tinglashni o'zimiz tugatamiz: gap boshlanmasa — 8 s, gapirgandan keyin — pauseMs jimlik
    const armSilence = (ms: number) => {
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        try {
          r.stop();
        } catch {}
      }, ms);
    };
    if (continuous) armSilence(8000);
    const fail = (message: string, code: string) => {
      settled = true;
      clearTimeout(silenceTimer);
      reject(new RecognitionError(message, code));
    };

    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += (finalText ? " " : "") + t.trim();
        else interim += t;
      }
      latest = `${finalText} ${interim}`.trim();
      onInterim?.(latest);
      if (continuous && latest) armSilence(opts.pauseMs!);
    };
    r.onerror = (e) => {
      if (settled) return;
      if (e.error === "language-not-supported" && fallbackLanguage()) {
        settled = true;
        clearTimeout(silenceTimer);
        listenOnce(onInterim, signal, opts).then(resolve, reject);
        return;
      }
      if (e.error === "no-speech") return fail("Ovoz eshitilmadi. Mikrofonga yaqinroq gapiring", "no-speech");
      const message = recognitionErrorMessage(e.error);
      if (message) fail(message, e.error);
    };
    r.onend = () => {
      if (settled) return;
      settled = true;
      clearTimeout(silenceTimer);
      const text = (finalText || latest).trim();
      if (text) resolve(text);
      else reject(new RecognitionError("Ovoz eshitilmadi. Mikrofonga yaqinroq gapiring", "no-speech"));
    };
    signal?.addEventListener(
      "abort",
      () => {
        if (settled) return;
        fail("To'xtatildi", "aborted");
        try {
          r.abort();
        } catch {}
      },
      { once: true }
    );
    try {
      r.start();
    } catch {
      fail("Mikrofonni ishga tushirib bo'lmadi. Sahifani yangilab, qayta urinib ko'ring", "start-failed");
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

// next / prev / repeat — bosqichma-bosqich o'rganish rejimi uchun
// simple / examples / terms — dars sahifasida sodda o'rganish yorliqlari; quiz / answer (value — variant raqami) — o'zini tekshirish
export type VoiceAction = {
  action:
    | "read" | "explain" | "stop" | "next" | "prev" | "repeat" | "new-chat" | "voice-chat"
    | "simple" | "examples" | "terms" | "quiz" | "answer" | "video";
  value?: number;
};

// AI suhbat sahifasida ovoz bilan aytilgan savol (buyruq bo'lmagan gap) — chatga yuboriladi
export const CHAT_ASK_EVENT = "imkon:chat-ask";

export function askChat(text: string) {
  window.dispatchEvent(new CustomEvent<string>(CHAT_ASK_EVENT, { detail: text }));
}

export function onChatAsk(handler: (text: string) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<string>).detail);
  window.addEventListener(CHAT_ASK_EVENT, listener);
  return () => window.removeEventListener(CHAT_ASK_EVENT, listener);
}
export const VOICE_EVENT = "imkon:voice";

export function dispatchVoiceAction(action: VoiceAction["action"], value?: number) {
  window.dispatchEvent(new CustomEvent<VoiceAction>(VOICE_EVENT, { detail: { action, value } }));
}

// Sahifa ovozli buyruqqa ("o'qib ber", "tushuntir", "to'xta") javob berishi uchun
export function onVoiceAction(handler: (action: VoiceAction["action"], value?: number) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<VoiceAction>).detail.action, (e as CustomEvent<VoiceAction>).detail.value);
  window.addEventListener(VOICE_EVENT, listener);
  return () => window.removeEventListener(VOICE_EVENT, listener);
}
