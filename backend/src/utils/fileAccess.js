// Yuklangan fayllarni himoyalash: /uploads endi ochiq emas.
// Server API javobida fayl havolasini ("/uploads/abc.pdf") imzolangan ko'rinishga o'tkazadi:
// "/uploads/abc.pdf?exp=1790000000&sig=...". Havolani faqat shu faylga ruxsati bor foydalanuvchi oladi
// (masalan, o'z darsi yoki o'z topshirig'i), u belgilangan vaqtdan keyin ishlamaydi va boshqa faylga yaramaydi.
// <img>, <video>, <iframe> sarlavha (Authorization) yubora olmaydi — shuning uchun token emas, imzo ishlatiladi.
const crypto = require("crypto");
const path = require("path");
const { config } = require("../config");

const HOUR = 3600;

function key() {
  // JWT kalitidan alohida maqsad uchun kalit — imzo tokenga aylanib qolmasin
  return crypto.createHmac("sha256", process.env.JWT_SECRET).update("imkon-uploads-v1").digest();
}

function signature(name, exp) {
  return crypto.createHmac("sha256", key()).update(`${name}:${exp}`).digest("base64url");
}

// Muddat soat boshiga yaxlitlanadi — bir soat ichida havola o'zgarmaydi (brauzer keshi ishlaydi)
function signUrl(url) {
  const name = path.basename(url.split("?")[0]);
  const now = Math.floor(Date.now() / 1000);
  const exp = (Math.floor(now / HOUR) + 1) * HOUR + config.fileUrlTtlHours * HOUR;
  return `/uploads/${name}?exp=${exp}&sig=${signature(name, exp)}`;
}

function isUploadPath(value) {
  return typeof value === "string" && value.startsWith("/uploads/") && !value.includes("?");
}

// JSON ichidagi barcha "/uploads/..." qiymatlarni imzolaydi (chuqur, massiv va obyektlar ichida ham)
function signDeep(value, depth = 0) {
  if (depth > 12 || value == null) return value;
  if (isUploadPath(value)) return signUrl(value);
  if (Array.isArray(value)) return value.map((v) => signDeep(v, depth + 1));
  if (typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = signDeep(v, depth + 1);
    return out;
  }
  return value;
}

// API javoblaridagi fayl havolalarini avtomatik imzolaydi (res.json ustidan)
function signUploadsInJson(req, res, next) {
  const original = res.json.bind(res);
  res.json = (body) => original(signDeep(body));
  next();
}

// /uploads/* — faqat to'g'ri va muddati o'tmagan imzo bilan
function requireSignedUpload(req, res, next) {
  const name = path.basename(decodeURIComponent(req.path));
  const exp = Number(req.query.exp);
  const sig = String(req.query.sig || "");
  const expected = signature(name, exp);
  const valid =
    Number.isInteger(exp) &&
    exp > Date.now() / 1000 &&
    sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!valid) return res.status(403).json({ message: "Fayl havolasi eskirgan yoki noto'g'ri. Sahifani yangilang" });
  next();
}

module.exports = { signUrl, signDeep, signUploadsInJson, requireSignedUpload };
