// YouTube video darslik: havoladan video ID, nomi (oEmbed) va subtitr matni.
// Subtitr — YouTube'ning ochiq bo'lmagan ichki API'si orqali (ANDROID mijozi): o'zgarib qolsa, xato beradi va
// qulaylik to'plami video nomi va dars matni bilan davom etadi.
const { HttpError } = require("../utils/validation");

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

// youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, /embed/ID, /live/ID, m.youtube.com, music.youtube.com
function parseYoutubeId(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (ID_RE.test(raw)) return raw;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/)?.[1] || null;
  }
  return id && ID_RE.test(id) ? id : null;
}

// Forma maydoni: bo'sh — null, noto'g'ri havola — 400, aks holda standart ko'rinish
function normalizeVideoUrl(input) {
  if (!String(input || "").trim()) return null;
  const id = parseYoutubeId(input);
  if (!id) throw new HttpError(400, "YouTube havolasi noto'g'ri. Masalan: https://www.youtube.com/watch?v=... yoki https://youtu.be/...");
  return `https://www.youtube.com/watch?v=${id}`;
}

async function fetchWithTimeout(url, options = {}, ms = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Video nomi va kanal (rasmiy oEmbed)
async function fetchVideoInfo(id) {
  const res = await fetchWithTimeout(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`);
  if (res.status === 404 || res.status === 401) throw new Error("Video topilmadi yoki yopiq (shaxsiy video)");
  if (!res.ok) throw new Error(`YouTube javob bermadi (${res.status})`);
  const data = await res.json();
  return { title: String(data.title || ""), author: String(data.author_name || "") };
}

// Subtitr: o'zbekcha > ruscha > inglizcha > boshqasi; qo'lda yozilgani avtomatikdan afzal
async function fetchTranscript(id) {
  const res = await fetchWithTimeout("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context: { client: { clientName: "ANDROID", clientVersion: "20.10.38", hl: "uz" } }, videoId: id }),
  });
  if (!res.ok) throw new Error(`YouTube javob bermadi (${res.status})`);
  const data = await res.json();
  const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  if (!tracks.length) return null;
  const rank = (t) => {
    const lang = String(t.languageCode || "").slice(0, 2);
    const langScore = { uz: 0, ru: 1, en: 2 }[lang] ?? 3;
    return langScore * 2 + (t.kind === "asr" ? 1 : 0);
  };
  const track = [...tracks].sort((a, b) => rank(a) - rank(b))[0];
  const tt = await fetchWithTimeout(`${track.baseUrl.replace(/&fmt=[^&]*/, "")}&fmt=json3`);
  if (!tt.ok) throw new Error(`Subtitrni yuklab bo'lmadi (${tt.status})`);
  const body = await tt.text();
  if (!body) return null;
  const segments = (JSON.parse(body).events || [])
    .filter((e) => e.segs)
    .map((e) => ({
      start: (e.tStartMs || 0) / 1000,
      end: ((e.tStartMs || 0) + (e.dDurationMs || 0)) / 1000,
      text: e.segs.map((s) => s.utf8 || "").join("").replace(/\s+/g, " ").trim(),
    }))
    .filter((s) => s.text);
  if (!segments.length) return null;
  return {
    language: String(track.languageCode || ""),
    auto: track.kind === "asr",
    segments: segments.slice(0, 3000),
    text: segments.map((s) => s.text).join(" ").slice(0, 60000),
  };
}

module.exports = { parseYoutubeId, normalizeVideoUrl, fetchVideoInfo, fetchTranscript };
