// Markaziy sozlamalar: hamma chegara va limitlar shu yerda, qiymatlar .env'dan olinadi (bo'lmasa — standart).
// Muhim o'zgaruvchilar ishga tushishda tekshiriladi: xato bo'lsa server tushunarli xabar bilan to'xtaydi.
require("dotenv").config({ quiet: true });

const num = (name, fallback) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

const WEAK_SECRETS = new Set(["", "o'zgartiring", "secret", "changeme", "jwt_secret"]);

// Ishga tushishdan oldin: kerakli o'zgaruvchilar bormi va JWT kaliti ishonchlimi
function validateEnv() {
  const problems = [];
  const secret = process.env.JWT_SECRET || "";
  if (WEAK_SECRETS.has(secret) || secret.length < 32) {
    problems.push(
      "JWT_SECRET kamida 32 belgili tasodifiy qiymat bo'lishi kerak. Yaratish: " +
        `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
  }
  for (const name of ["DB_HOST", "DB_USER", "DB_NAME"]) if (!process.env[name]) problems.push(`${name} ko'rsatilmagan`);
  if (!process.env.CLIENT_URL) problems.push("CLIENT_URL ko'rsatilmagan (masalan http://localhost:3000)");
  if (problems.length) {
    console.error("\n.env sozlamalarida xato (backend/.env):\n - " + problems.join("\n - ") + "\n");
    process.exit(1);
  }
}

const config = {
  port: num("PORT", 5000),
  // Vergul bilan bir nechta manzil: CLIENT_URL=https://imkon.uz,https://www.imkon.uz
  clientOrigins: (process.env.CLIENT_URL || "").split(",").map((s) => s.trim()).filter(Boolean),

  passwordMinLength: num("PASSWORD_MIN_LENGTH", 8),

  // Login: IP + login bo'yicha muvaffaqiyatsiz urinishlar
  loginMaxAttempts: num("LOGIN_MAX_ATTEMPTS", 10),
  loginWindowMin: num("LOGIN_WINDOW_MIN", 15),

  // Fayllar
  uploadMaxMb: num("UPLOAD_MAX_MB", 100),
  avatarMaxMb: num("AVATAR_MAX_MB", 5),
  fileUrlTtlHours: num("FILE_URL_TTL_HOURS", 12), // yuklangan fayl havolasi shuncha vaqt amal qiladi

  // AI va ovoz limitlari (bitta foydalanuvchi uchun, 10 daqiqada)
  limits: {
    aiRequests: num("LIMIT_AI_REQUESTS", 30), // dars tushuntirish, AI o'qituvchi, robot
    chatRequests: num("LIMIT_CHAT_REQUESTS", 40),
    sttRequests: num("LIMIT_STT_REQUESTS", 60),
    ttsChars: num("LIMIT_TTS_CHARS", 40000),
    windowMs: 10 * 60 * 1000,
  },

  openai: {
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    sttModel: process.env.OPENAI_STT_MODEL || "gpt-4o-transcribe",
    transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1", // subtitr (vaqt belgilari bilan)
  },
};

module.exports = { config, validateEnv };
