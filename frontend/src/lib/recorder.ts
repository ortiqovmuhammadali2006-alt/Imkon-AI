import { api } from "./api";
import { listenOnce, RecognitionError, stopSpeaking } from "./speech";

// Aniq nutqni tanish: ovoz yozib olinadi va serverda (gpt-4o-transcribe) matnga aylantiriladi.
// Brauzerning o'zbekcha nutqni tanishi sifatsiz ("amerikadagi so'raydi" kabi buzilgan matn), server esa aniq taniydi.
// Gap tugashi ovoz balandligi bo'yicha aniqlanadi (brauzer o'zbekchani tanimasa ham ishlaydi).

export type ListenState = "listening" | "transcribing";

const SILENCE_MS = 1200; // gapdan keyin shuncha jimlik — gap tugadi
const NO_SPEECH_MS = 8000; // shuncha vaqt gapirilmasa — "ovoz eshitilmadi"
const MAX_MS = 30000;

function pickMime() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) || "";
}

export function canRecord() {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined" && !!pickMime();
}

function micError(err: unknown) {
  const name = (err as Error)?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return new RecognitionError("Mikrofonga ruxsat berilmagan. Manzil satridagi qulf belgisini bosib, mikrofonga ruxsat bering", "not-allowed");
  if (name === "NotFoundError" || name === "NotReadableError") return new RecognitionError("Mikrofon topilmadi. Mikrofon ulanganini tekshiring", "audio-capture");
  return new RecognitionError("Mikrofonni ishga tushirib bo'lmadi", "start-failed");
}

// Bitta gapni yozib olish: gapirish boshlanishini kutadi, jimlik bo'lganda to'xtaydi. onLevel — ovoz balandligi (0..1+)
async function recordUtterance(signal?: AbortSignal, onLevel?: (level: number) => void): Promise<Blob> {
  if (signal?.aborted) throw new RecognitionError("To'xtatildi", "aborted");
  let stream: MediaStream;
  try {
    // Aks-sado va shovqinni o'chirish — karnaydagi AI ovozi yozuvga kamroq tushadi
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (err) {
    throw micError(err);
  }
  const mime = pickMime();
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);

  return new Promise<Blob>((resolve, reject) => {
    const start = Date.now();
    let noise = 0;
    let noiseN = 0;
    let voiced = 0; // gapirilgan vaqt (ms)
    let lastVoice = 0;
    let done = false;

    const finish = (result: "ok" | "no-speech" | "aborted") => {
      if (done) return;
      done = true;
      clearInterval(timer);
      signal?.removeEventListener("abort", onAbort);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
        if (result === "aborted") reject(new RecognitionError("To'xtatildi", "aborted"));
        else if (result === "no-speech" || voiced < 300) reject(new RecognitionError("Ovoz eshitilmadi. Mikrofonga yaqinroq gapiring", "no-speech"));
        else resolve(new Blob(chunks, { type: mime.split(";")[0] }));
      };
      if (recorder.state !== "inactive") recorder.stop();
      else recorder.onstop(new Event("stop"));
    };
    const onAbort = () => finish("aborted");
    signal?.addEventListener("abort", onAbort, { once: true });

    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const v of samples) sum += v * v;
      const rms = Math.sqrt(sum / samples.length);
      const now = Date.now();
      // Birinchi 300 ms — xonadagi shovqin darajasi
      if (now - start < 300) {
        noise += rms;
        noiseN++;
        return;
      }
      const threshold = Math.max((noise / Math.max(noiseN, 1)) * 2.5, 0.012);
      onLevel?.(rms / threshold);
      if (rms > threshold) {
        voiced += 50;
        lastVoice = now;
      }
      if (lastVoice && voiced >= 300 && now - lastVoice > SILENCE_MS) finish("ok");
      else if (!lastVoice && now - start > NO_SPEECH_MS) finish("no-speech");
      else if (now - start > MAX_MS) finish(lastVoice ? "ok" : "no-speech");
    }, 50);

    recorder.start(250);
  });
}

async function transcribe(blob: Blob): Promise<string> {
  const { data } = await api.post<{ text: string }>("/stt", blob, { headers: { "Content-Type": blob.type || "audio/webm" } });
  return data.text.trim();
}

// Bitta gapni tinglab, aniq matn qaytaradi. onState — "listening" (gapiring) / "transcribing" (tanilmoqda).
// Yozib olish imkoni bo'lmasa — brauzerning o'z nutqni tanishiga qaytadi
export async function listenAccurate(
  onState?: (state: ListenState) => void,
  signal?: AbortSignal,
  onLevel?: (level: number) => void
): Promise<string> {
  if (!canRecord()) return listenOnce(undefined, signal, { pauseMs: 1800 });
  stopSpeaking();
  onState?.("listening");
  const blob = await recordUtterance(signal, onLevel);
  onState?.("transcribing");
  let text = "";
  try {
    text = await transcribe(blob);
  } catch {
    throw new RecognitionError("Nutqni tanib bo'lmadi. Qaytadan gapiring", "network");
  }
  if (signal?.aborted) throw new RecognitionError("To'xtatildi", "aborted");
  if (!text) throw new RecognitionError("Ovoz eshitilmadi. Mikrofonga yaqinroq gapiring", "no-speech");
  return text;
}
