// So'rovlar limiti — ma'lumotlar bazasida (usage_log): server qayta ishga tushsa ham, bir nechta nusxada ishlasa ham
// hisob to'g'ri qoladi. Shu jadval AI va ovoz sarfini hisoblash uchun ham xizmat qiladi (kim, qachon, qancha).
const pool = require("../config/db");
const { HttpError } = require("./validation");
const { config } = require("../config");

// kind: "ai" | "tutor" | "chat" | "stt" | "tts" | "login"
function createLimiter(kind, { max, windowMs = config.limits.windowMs, message = "Juda ko'p so'rov. Birozdan so'ng urinib ko'ring" }) {
  return {
    // amount — so'rov "og'irligi" (TTS uchun belgilar soni), key — foydalanuvchi ID yoki "ip|login"
    async hit(key, amount = 1) {
      const since = new Date(Date.now() - windowMs);
      const { rows } = await pool.query(
        "SELECT COALESCE(SUM(amount), 0)::int AS used FROM usage_log WHERE key = $1 AND kind = $2 AND created_at > $3",
        [String(key), kind, since]
      );
      if (rows[0].used + amount > max) throw new HttpError(429, message);
      await pool.query("INSERT INTO usage_log (key, kind, amount) VALUES ($1, $2, $3)", [String(key), kind, amount]);
    },
    async used(key) {
      const since = new Date(Date.now() - windowMs);
      const { rows } = await pool.query(
        "SELECT COALESCE(SUM(amount), 0)::int AS used FROM usage_log WHERE key = $1 AND kind = $2 AND created_at > $3",
        [String(key), kind, since]
      );
      return rows[0].used;
    },
    async reset(key) {
      await pool.query("DELETE FROM usage_log WHERE key = $1 AND kind = $2", [String(key), kind]);
    },
  };
}

// Eski yozuvlar (90 kundan ortiq) — kuniga bir marta tozalanadi
let lastCleanup = 0;
async function cleanupUsage() {
  if (Date.now() - lastCleanup < 24 * 3600 * 1000) return;
  lastCleanup = Date.now();
  await pool.query("DELETE FROM usage_log WHERE created_at < NOW() - INTERVAL '90 days'").catch(() => {});
}

module.exports = { createLimiter, cleanupUsage };
