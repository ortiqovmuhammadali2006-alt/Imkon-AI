// Nutqni matnga aylantirish (barcha rollar uchun). Brauzerning o'zbekcha nutqni tanishi sifatsiz
// ("amerikadagi so'raydi" kabi buzilgan matn) — shuning uchun yozib olingan ovoz serverda gpt-4o-transcribe bilan taniladi
const express = require("express");
const { toFile } = require("openai");
const { authenticate } = require("../middleware/auth");
const { HttpError } = require("../utils/validation");
const { getClient, toHttpError } = require("../services/ai");

const router = express.Router();
router.use(authenticate);

// Yozuv xom holda keladi (audio/webm, audio/ogg, audio/mp4...), 8 MB gacha (~5 daqiqa)
router.post("/", express.raw({ type: ["audio/*", "application/octet-stream"], limit: "8mb" }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length < 1000) throw new HttpError(400, "Ovoz yozilmadi. Qaytadan gapiring");
  checkLimit(req.user.id);
  const type = String(req.headers["content-type"] || "audio/webm").split(";")[0];
  const ext = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4", "audio/mpeg": "mp3", "audio/wav": "wav" }[type] || "webm";
  try {
    const result = await getClient().audio.transcriptions.create({
      file: await toFile(req.body, `speech.${ext}`, { type }),
      model: process.env.OPENAI_STT_MODEL || "gpt-4o-transcribe",
      // OpenAI "uz" kodini qabul qilmaydi — prompt o'zbekcha lotin yozuviga yo'naltiradi
      prompt: "O‘quvchi o‘zbek tilida gapiryapti. Lotin yozuvida yoz: o‘quvchi, g‘oya, qo‘shish, fotosintez, matematika.",
    });
    res.json({ text: String(result.text || "").trim() });
  } catch (err) {
    throw toHttpError(err);
  }
});

// Oddiy limit: 10 daqiqada 60 ta yozuv
const usage = new Map();
function checkLimit(userId) {
  const now = Date.now();
  const recent = (usage.get(userId) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 60) throw new HttpError(429, "Juda ko'p so'rov. Birozdan so'ng urinib ko'ring");
  recent.push(now);
  usage.set(userId, recent);
}

module.exports = router;
