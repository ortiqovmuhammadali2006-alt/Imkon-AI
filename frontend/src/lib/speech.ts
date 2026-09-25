import { api } from "./api";

// ---------- Matnni ovoz bilan o'qish ----------

let audio: HTMLAudioElement | null = null;
let audioUrl: string | null = null;
const listeners = new Set<(speaking: boolean) => void>();

function notify(speaking: boolean) {
  listeners.forEach((fn) => fn(speaking));
}

// Hozir o'qilayotganini kuzatish (tugmalar holati uchun)
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
  audio?.pause();
  audio = null;
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  notify(false);
}

// Brauzerning o'z ovozi (AI ovozi ishlamasa zaxira)
function speakWithBrowser(text: string) {
  return new Promise<void>((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) return resolve();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    utterance.voice = voices.find((v) => v.lang.startsWith("uz")) ?? voices.find((v) => v.lang.startsWith("tr")) ?? null;
    utterance.lang = utterance.voice?.lang ?? "uz-UZ";
    utterance.rate = 0.95;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    synth.speak(utterance);
  });
}

// Avval AI ovozi (OpenAI TTS), bo'lmasa — brauzer ovozi
export async function speak(text: string) {
  stopSpeaking();
  const clean = plain(text);
  if (!clean) return;
  notify(true);
  try {
    const { data } = await api.post<Blob>("/student/tts", { text: clean.slice(0, 4000) }, { responseType: "blob" });
    audioUrl = URL.createObjectURL(data);
    audio = new Audio(audioUrl);
    await new Promise<void>((resolve) => {
      audio!.onended = () => resolve();
      audio!.onerror = () => resolve();
      audio!.play().catch(() => resolve());
    });
  } catch {
    await speakWithBrowser(clean);
  } finally {
    notify(false);
  }
}

// ---------- Nutqni tanib olish (ovozli boshqaruv va savol aytish) ----------

type RecognitionResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
export type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function createRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = "uz-UZ";
  r.interimResults = false;
  r.continuous = false;
  return r;
}

// Bir marta tinglab, aytilgan matnni qaytaradi
export function listenOnce(): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = createRecognition();
    if (!r) return reject(new Error("Brauzeringiz ovozni tanishni qo'llab-quvvatlamaydi. Google Chrome'dan foydalaning"));
    let text = "";
    r.onresult = (e) => {
      text = e.results[0]?.[0]?.transcript ?? "";
    };
    r.onerror = (e) =>
      reject(new Error(e.error === "not-allowed" ? "Mikrofonga ruxsat berilmagan" : "Ovoz eshitilmadi, qaytadan urinib ko'ring"));
    r.onend = () => resolve(text.trim());
    r.start();
  });
}

// ---------- Sahifalar orasidagi ovozli buyruqlar ----------

export type VoiceAction = "read" | "explain" | "stop";
export const VOICE_EVENT = "imkon:voice";

export function dispatchVoiceAction(action: VoiceAction) {
  window.dispatchEvent(new CustomEvent<VoiceAction>(VOICE_EVENT, { detail: action }));
}
