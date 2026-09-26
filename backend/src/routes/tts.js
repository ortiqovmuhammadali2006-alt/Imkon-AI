// Matnni ovozga aylantirish — barcha rollar uchun (o'quvchi darslari, AI suhbat, o'qituvchi/admin).
// Brauzer uzun matnni gap-gap bo'laklab so'raydi: birinchi bo'lak tez tayyor bo'lib, darhol o'qila boshlaydi
const { Router } = require("express");
const { authenticate } = require("../middleware/auth");
const { HttpError } = require("../utils/validation");
const { synthesize, status } = require("../services/tts");
const { createLimiter } = require("../utils/rateLimit");
const { config } = require("../config");

const router = Router();
router.use(authenticate);

// Cheklov so'rovlar soniga emas, belgilar hajmiga: bo'laklash so'rovlar sonini oshiradi, sarf esa o'zgarmaydi
const ttsLimit = createLimiter("tts", {
  max: config.limits.ttsChars, // .env: LIMIT_TTS_CHARS (10 daqiqada, belgilar)
  message: "Juda ko'p ovozli o'qish so'raldi. Birozdan so'ng urinib ko'ring",
});

// Qaysi manba ishlaydi (azure — haqiqiy o'zbekcha ovoz). Brauzer shunga qarab server yoki o'z ovozini tanlaydi
router.get("/status", (req, res) => {
  res.json(status());
});

// speed: 0.6 (sekin) ... 1.1 (tez)
router.post("/", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, 4000) : "";
  if (!text) throw new HttpError(400, "O'qiladigan matn bo'sh");
  await ttsLimit.hit(req.user.id, text.length);
  const speed = Math.min(Math.max(Number(req.body?.speed) || 0.85, 0.6), 1.1);
  const { audio, provider } = await synthesize(text, speed);
  res.set({ "Content-Type": "audio/mpeg", "X-TTS-Provider": provider, "Cache-Control": "private, max-age=3600" }).send(audio);
});

module.exports = router;
