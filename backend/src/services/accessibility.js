// "Qulaylik to'plami": o'qituvchi material yuklaganda o'quvchi uchun qo'shimcha formatlar yaratadi.
//  - audio/video  -> subtitr (.vtt) + to'liq matn (Whisper); o'qituvchi bergan .srt/.vtt bo'lsa — o'shandan
//  - PDF/Word/TXT -> fayl ichidagi matn (AI'siz)
//  - rasm         -> rasm tavsifi (AI)
//  - hammasi      -> oddiy tildagi qisqa variant + atamalar lug'ati (AI)
// Natija lessons.a11y (JSONB) ga yoziladi. Har bir qadam alohida: biri xato bersa, qolganlari ishlayveradi.
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const pool = require("../config/db");
const { UPLOAD_DIR, removeFile } = require("../middleware/upload");
const { transcribe, describeImage, simplifyLesson, toHttpError } = require("./ai");

const AUDIO_EXT = [".mp3", ".wav", ".ogg", ".m4a"];
const VIDEO_EXT = [".mp4", ".webm"];
const IMAGE_EXT = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
const WHISPER_LIMIT = 24 * 1024 * 1024; // OpenAI chegarasi 25 MB
const MAX_TEXT = 60000;

const filePath = (url) => path.join(UPLOAD_DIR, path.basename(url));
const extOf = (name) => path.extname(name || "").toLowerCase();

// ---------- Subtitr formatlari ----------

function vttTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${s}.${String(ms % 1000).padStart(3, "0")}`;
}

function segmentsToVtt(segments) {
  return "WEBVTT\n\n" + segments.map((s, i) => `${i + 1}\n${vttTime(s.start)} --> ${vttTime(s.end)}\n${s.text}\n`).join("\n");
}

function parseTime(t) {
  const parts = t.trim().replace(",", ".").split(":").map(Number);
  while (parts.length < 3) parts.unshift(0);
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

// .srt yoki .vtt matnidan bo'laklar
function parseSubtitles(raw) {
  const blocks = raw.replace(/\r/g, "").replace(/^﻿/, "").split(/\n{2,}/);
  const segments = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    const idx = lines.findIndex((l) => l.includes("-->"));
    if (idx === -1) continue;
    const [from, to] = lines[idx].split("-->").map((x) => x.trim().split(/\s+/)[0]);
    const text = lines
      .slice(idx + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (text) segments.push({ start: parseTime(from), end: parseTime(to), text });
  }
  return segments;
}

async function writeVtt(segments) {
  const name = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.vtt`;
  await fsp.writeFile(path.join(UPLOAD_DIR, name), segmentsToVtt(segments), "utf8");
  return `/uploads/${name}`;
}

// ---------- Fayl ichidagi matn ----------

async function extractText(fileUrl, fileName) {
  const ext = extOf(fileName);
  const full = filePath(fileUrl);
  if (ext === ".txt") return (await fsp.readFile(full, "utf8")).slice(0, MAX_TEXT);
  if (ext === ".pdf") {
    const { PDFParse } = require("pdf-parse");
    const parser = new PDFParse({ data: await fsp.readFile(full) });
    try {
      return (await parser.getText()).text.replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT);
    } finally {
      await parser.destroy();
    }
  }
  if (ext === ".docx") {
    const mammoth = require("mammoth");
    return (await mammoth.extractRawText({ path: full })).value.replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT);
  }
  return null;
}

// Katta yoki video fayldan Whisper uchun yengil audio (mono, 16 kHz, 32 kbps) ajratib olish
function extractAudio(input) {
  // Vaqtinchalik fayl uploads/ da emas — u ochiq manzil orqali ko'rinmasin
  const out = path.join(require("os").tmpdir(), `imkon-${crypto.randomBytes(8).toString("hex")}.mp3`);
  return new Promise((resolve, reject) => {
    const ffmpeg = require("ffmpeg-static");
    const p = spawn(ffmpeg, ["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", out], { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => (err = (err + d).slice(-500)));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`Audioni ajratib bo'lmadi: ${err}`))));
  });
}

// ---------- Asosiy jarayon ----------

async function saveA11y(lessonId, a11y) {
  await pool.query("UPDATE lessons SET a11y = $1 WHERE id = $2", [JSON.stringify(a11y), lessonId]);
}

function stepError(err) {
  return toHttpError(err).message;
}

async function processLesson(lessonId) {
  const { rows } = await pool.query("SELECT * FROM lessons WHERE id = $1", [lessonId]);
  const lesson = rows[0];
  if (!lesson) return;

  // Oldingi avtomatik subtitrni o'chiramiz (qayta yaratiladi)
  if (lesson.a11y?.auto_subtitle_url) removeFile(lesson.a11y.auto_subtitle_url);

  const a11y = { status: "processing", steps: {}, started_at: new Date().toISOString() };
  await saveA11y(lessonId, a11y);

  const ext = extOf(lesson.file_name);
  const isMedia = AUDIO_EXT.includes(ext) || VIDEO_EXT.includes(ext);

  // 1. Subtitr va nutq matni
  if (lesson.subtitle_url) {
    try {
      const segments = parseSubtitles(await fsp.readFile(filePath(lesson.subtitle_url), "utf8"));
      if (!segments.length) throw new Error("Subtitr faylida matn topilmadi");
      a11y.segments = segments;
      a11y.transcript = segments.map((s) => s.text).join(" ");
      // .srt ni brauzer tushunadigan .vtt ga aylantiramiz
      a11y.subtitle_vtt_url = extOf(lesson.subtitle_name) === ".vtt" ? lesson.subtitle_url : await writeVtt(segments);
      if (a11y.subtitle_vtt_url !== lesson.subtitle_url) a11y.auto_subtitle_url = a11y.subtitle_vtt_url;
      a11y.steps.subtitle = { status: "done", source: "teacher" };
    } catch (err) {
      a11y.steps.subtitle = { status: "failed", error: err.message };
    }
  } else if (isMedia && lesson.file_url) {
    let tmp = null;
    try {
      const full = filePath(lesson.file_url);
      const size = (await fsp.stat(full)).size;
      const input = VIDEO_EXT.includes(ext) || size > WHISPER_LIMIT ? (tmp = await extractAudio(full)) : full;
      if ((await fsp.stat(input)).size > WHISPER_LIMIT) throw new Error("Material juda uzun (taxminan 1,5 soatdan ortiq)");
      const { text, segments } = await transcribe(input);
      a11y.transcript = text;
      if (segments.length) {
        a11y.segments = segments;
        a11y.subtitle_vtt_url = a11y.auto_subtitle_url = await writeVtt(segments);
      }
      a11y.steps.subtitle = { status: "done", source: "ai" };
    } catch (err) {
      a11y.steps.subtitle = { status: "failed", error: stepError(err) };
    } finally {
      if (tmp) fs.unlink(tmp, () => {});
    }
  }
  await saveA11y(lessonId, a11y);

  // 2. Fayl ichidagi matn (PDF, Word, TXT)
  if (lesson.file_url && [".pdf", ".docx", ".txt"].includes(ext)) {
    try {
      a11y.extracted_text = await extractText(lesson.file_url, lesson.file_name);
      a11y.steps.text = a11y.extracted_text
        ? { status: "done" }
        : { status: "failed", error: "Faylda matn topilmadi (skanerlangan rasm bo'lishi mumkin)" };
    } catch (err) {
      a11y.steps.text = { status: "failed", error: `Matnni o'qib bo'lmadi: ${err.message}` };
    }
    await saveA11y(lessonId, a11y);
  }

  // 3. Rasm tavsifi
  if (lesson.file_url && IMAGE_EXT[ext]) {
    try {
      a11y.image_description = await describeImage(await fsp.readFile(filePath(lesson.file_url)), IMAGE_EXT[ext]);
      a11y.steps.image = { status: "done" };
    } catch (err) {
      a11y.steps.image = { status: "failed", error: stepError(err) };
    }
    await saveA11y(lessonId, a11y);
  }

  // 4. Oddiy til + atamalar lug'ati — barcha mavjud matn asosida
  const source = [lesson.description, lesson.content, a11y.extracted_text, a11y.transcript, a11y.image_description]
    .filter(Boolean)
    .join("\n\n");
  if (source.trim().length >= 80) {
    try {
      Object.assign(a11y, await simplifyLesson(lesson.title, source));
      a11y.steps.simple = { status: "done" };
    } catch (err) {
      a11y.steps.simple = { status: "failed", error: stepError(err) };
    }
  }

  const statuses = Object.values(a11y.steps).map((s) => s.status);
  a11y.status = statuses.every((s) => s === "done") ? "done" : statuses.some((s) => s === "done") ? "partial" : statuses.length ? "failed" : "done";
  a11y.finished_at = new Date().toISOString();
  await saveA11y(lessonId, a11y);
}

// Bir vaqtda bittadan ishlov beramiz (og'ir: ffmpeg, AI so'rovlari)
let chain = Promise.resolve();
function enqueueLesson(lessonId) {
  chain = chain
    .then(() => processLesson(lessonId))
    .catch(async (err) => {
      console.error("Qulaylik to'plami xatosi:", err);
      await saveA11y(lessonId, { status: "failed", steps: {}, error: "Ichki xatolik" }).catch(() => {});
    });
  return chain;
}

// Dars o'chirilganda avtomatik yaratilgan fayllarni ham o'chirish
function removeGeneratedFiles(a11y) {
  if (a11y?.auto_subtitle_url) removeFile(a11y.auto_subtitle_url);
}

module.exports = { enqueueLesson, processLesson, removeGeneratedFiles, parseSubtitles, segmentsToVtt };
