// Matnni ovozga aylantirish (mp3). Manbalar tartibi:
//  1) Microsoft Azure Speech — tabiiy o'zbekcha neyron ovozlar (uz-UZ-MadinaNeural / uz-UZ-SardorNeural),
//     oyiga 500 000 belgigacha bepul. .env: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, AZURE_SPEECH_VOICE
//  2) Microsoft Edge "Ovoz bilan o'qish" xizmati — xuddi shu o'zbekcha ovozlar, kalitsiz va bepul.
//     Rasmiy API emas: Microsoft o'zgartirsa ishlamay qolishi mumkin — shunda keyingi manbaga o'tiladi.
//     .env: EDGE_TTS_VOICE (standart: uz-UZ-MadinaNeural), EDGE_TTS=off — o'chirish
//  3) OpenAI TTS — faqat .env: TTS_OPENAI_FALLBACK=on bo'lsa (boshqa ovoz; tizimda faqat Madina eshitilishi uchun o'chiq)
// Hech biri ishlamasa — brauzer o'z ovozi bilan o'qiydi (frontend: lib/speech.ts).
const crypto = require("crypto");
const { EdgeTTS } = require("edge-tts-universal");
const { HttpError } = require("../utils/validation");
const { textToSpeech: openaiTts, toHttpError } = require("./ai");

const blockedUntil = { azure: 0, edge: 0, openai: 0 }; // ishlamay qolgan manbani 10 daqiqa chetlab o'tamiz
const BLOCK_MS = 10 * 60 * 1000;
let edgeFailures = 0; // ketma-ket xatolar soni

function azureConfigured() {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

function providers() {
  const list = [];
  if (azureConfigured() && Date.now() > blockedUntil.azure) list.push("azure");
  if (process.env.EDGE_TTS !== "off" && Date.now() > blockedUntil.edge) list.push("edge");
  if (process.env.TTS_OPENAI_FALLBACK === "on" && process.env.OPENAI_API_KEY && Date.now() > blockedUntil.openai) list.push("openai");
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

async function edgeOnce(text, voice, rate) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Edge TTS: javob kelmadi")), 7000);
  });
  try {
    const result = await Promise.race([new EdgeTTS(text, voice, { rate }).synthesize(), timeout]);
    const audio = Buffer.from(await result.audio.arrayBuffer());
    if (!audio.length) throw new Error("Edge TTS: bo'sh audio");
    return audio;
  } finally {
    clearTimeout(timer);
  }
}

// Edge ba'zan bir martalik kechikadi — Madina ovozi bo'lmay qolmasligi uchun 3 martagacha urinamiz
async function edgeTts(text, speed) {
  const voice = process.env.EDGE_TTS_VOICE || "uz-UZ-MadinaNeural";
  const rate = `${speed >= 1 ? "+" : ""}${Math.round((speed - 1) * 100)}%`; // 0.85 -> "-15%"
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await edgeOnce(text, voice, rate);
    } catch (err) {
      lastError = err;
      console.error(`edge TTS xatosi (${attempt}/3):`, err.message);
    }
  }
  throw lastError;
}

// Bir xil matn qayta so'ralsa ("Qayta tinglash") — xotiradan beramiz, bepul limit tejaladi
const cache = new Map();
const CACHE_LIMIT = 80;

function cacheKey(provider, text, speed) {
  const voice = provider === "edge" ? process.env.EDGE_TTS_VOICE : process.env.AZURE_SPEECH_VOICE;
  return crypto.createHash("sha1").update(`${provider}|${voice || ""}|${speed}|${text}`).digest("hex");
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
      const audio =
        provider === "azure" ? await azureTts(text, speed) : provider === "edge" ? await edgeTts(text, speed) : await openaiTts(text, speed);
      remember(key, audio);
      if (provider === "edge") edgeFailures = 0;
      return { audio, provider };
    } catch (err) {
      lastError = err;
      // Kalit noto'g'ri, mablag'/limit tugagan — keyingi 10 daqiqa bu manbaga murojaat qilmaymiz
      if (provider === "azure" && [401, 403, 429].includes(err.status)) blockedUntil.azure = Date.now() + BLOCK_MS;
      if (provider === "openai" && toHttpError(err).status === 503) blockedUntil.openai = Date.now() + BLOCK_MS;
      // Edge: bitta tasodifiy xato uchun o'chirmaymiz; ketma-ket 3 marta ishlamasa — 2 daqiqa chetlab o'tamiz
      // Madina uchun boshqa manba bo'lmasa — o'chirmaymiz (aks holda hech qanday ovoz qolmaydi)
      if (provider === "edge" && list.length > 1 && ++edgeFailures >= 3) {
        blockedUntil.edge = Date.now() + 2 * 60 * 1000;
        edgeFailures = 0;
      }
      if (provider !== "openai") console.error(`${provider} TTS xatosi:`, err.message);
    }
  }
  // OpenAI xatosi tushunarli xabarga ega ("mablag' tugagan"), boshqalariniki — umumiy xabar
  if (lastProvider === "openai") throw toHttpError(lastError);
  throw new HttpError(503, "O'zbekcha ovoz xizmati vaqtincha ishlamayapti");
}

function status() {
  const list = providers();
  // Edge vaqtincha to'xtagan bo'lsa ham o'zbekcha deb ko'rsatamiz: brauzer bu holatni 10 daqiqa eslab qoladi,
  // har bir so'rov esa baribir o'zi keyingi manbaga o'tadi
  const uzbek = azureConfigured() || process.env.EDGE_TTS !== "off";
  return { available: list.length > 0 || uzbek, provider: list[0] || null, uzbek_voice: uzbek };
}

module.exports = { synthesize, status };
