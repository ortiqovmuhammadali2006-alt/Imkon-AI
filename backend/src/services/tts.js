// Matnni ovozga aylantirish (mp3). Manbalar tartibi:
//  1) Microsoft Azure Speech — tabiiy o'zbekcha neyron ovozlar (uz-UZ-MadinaNeural / uz-UZ-SardorNeural),
//     oyiga 500 000 belgigacha bepul. .env: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, AZURE_SPEECH_VOICE
//  2) OpenAI TTS — .env: OPENAI_API_KEY
// Ikkalasi ham bo'lmasa yoki ishlamasa — brauzer o'z ovozi bilan o'qiydi (frontend: lib/speech.ts).
const crypto = require("crypto");
const { HttpError } = require("../utils/validation");
const { textToSpeech: openaiTts, toHttpError } = require("./ai");

const blockedUntil = { azure: 0, openai: 0 }; // ishlamay qolgan manbani 10 daqiqa chetlab o'tamiz
const BLOCK_MS = 10 * 60 * 1000;

function azureConfigured() {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

function providers() {
  const list = [];
  if (azureConfigured() && Date.now() > blockedUntil.azure) list.push("azure");
  if (process.env.OPENAI_API_KEY && Date.now() > blockedUntil.openai) list.push("openai");
  return list;
}

function escapeXml(text) {
  return text.replace(/[<>&'"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[ch]);
}

async function azureTts(text, speed) {
  const voice = process.env.AZURE_SPEECH_VOICE || "uz-UZ-MadinaNeural";
  const rate = `${Math.round((speed - 1) * 100)}%`; // 0.8 -> "-20%"
  // Gaplar orasida qo'shimcha pauza — shoshilmasdan, tushunarli bo'lsin
  const body = escapeXml(text).replace(/([.!?])\s+/g, `$1<break time="${speed < 0.9 ? 500 : 250}ms"/> `);
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="uz-UZ">` +
    `<voice name="${voice}"><prosody rate="${rate}">${body}</prosody></voice></speak>`;

  const res = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "imkon-ai",
    },
    body: ssml,
  });
  if (!res.ok) {
    const err = new Error(`Azure TTS: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return Buffer.from(await res.arrayBuffer());
}

// Bir xil matn qayta so'ralsa ("Qayta tinglash") — xotiradan beramiz, bepul limit tejaladi
const cache = new Map();
const CACHE_LIMIT = 80;

function cacheKey(provider, text, speed) {
  return crypto.createHash("sha1").update(`${provider}|${process.env.AZURE_SPEECH_VOICE || ""}|${speed}|${text}`).digest("hex");
}

function remember(key, audio) {
  cache.set(key, audio);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
}

async function synthesize(text, speed) {
  const list = providers();
  if (!list.length) throw new HttpError(503, "Server ovozi sozlanmagan yoki vaqtincha ishlamayapti");

  let lastError;
  let lastProvider;
  for (const provider of list) {
    lastProvider = provider;
    const key = cacheKey(provider, text, speed);
    if (cache.has(key)) return { audio: cache.get(key), provider };
    try {
      const audio = provider === "azure" ? await azureTts(text, speed) : await openaiTts(text, speed);
      remember(key, audio);
      return { audio, provider };
    } catch (err) {
      lastError = err;
      // Kalit noto'g'ri, mablag'/limit tugagan — keyingi 10 daqiqa bu manbaga murojaat qilmaymiz
      if (provider === "azure" && [401, 403, 429].includes(err.status)) blockedUntil.azure = Date.now() + BLOCK_MS;
      if (provider === "openai" && toHttpError(err).status === 503) blockedUntil.openai = Date.now() + BLOCK_MS;
      if (provider === "azure") console.error("Azure TTS xatosi:", err.message);
    }
  }
  // OpenAI xatosi tushunarli xabarga ega ("mablag' tugagan"), Azure xatosi — umumiy xabar
  if (lastProvider === "openai") throw toHttpError(lastError);
  throw new HttpError(503, "O'zbekcha ovoz xizmati vaqtincha ishlamayapti");
}

function status() {
  const list = providers();
  return { available: list.length > 0, provider: list[0] || null, uzbek_voice: list[0] === "azure" };
}

module.exports = { synthesize, status };
