const CATEGORIES = ["general", "visual", "hearing", "physical"];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Yangi foydalanuvchi uchun umumiy maydonlarni tekshiradi.
// requirePassword=false bo'lsa (tahrirlashda) parol ixtiyoriy
function validateUserFields(body, { requirePassword }) {
  const full_name = (body.full_name || "").trim();
  const username = (body.username || "").trim();
  const password = body.password || "";
  const phone = (body.phone || "").trim() || null;

  if (full_name.length < 3) throw new HttpError(400, "F.I.Sh kamida 3 ta belgidan iborat bo'lsin");
  if (!/^[a-zA-Z0-9_.]{3,60}$/.test(username)) {
    throw new HttpError(400, "Login kamida 3 ta belgi: faqat lotin harflari, raqam, _ yoki .");
  }
  if (requirePassword || password) {
    const min = require("../config").config.passwordMinLength;
    if (password.length < min) throw new HttpError(400, `Parol kamida ${min} ta belgidan iborat bo'lsin`);
  }

  return { full_name, username, password, phone };
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Noto'g'ri ID");
  return id;
}

// "2026-09" -> "2026-09-01"
function parseMonth(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value || "")) {
    throw new HttpError(400, "Oy YYYY-MM formatida bo'lishi kerak");
  }
  return `${value}-01`;
}

// "2026-09-25" formatini tekshiradi
function parseDate(value, label = "Sana") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "") || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, `${label} YYYY-MM-DD formatida bo'lishi kerak`);
  }
  return value;
}

// Baho 1–5 oralig'ida butun son
function parseScore(value) {
  const score = Number(value);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new HttpError(400, "Baho 1 dan 5 gacha bo'lishi kerak");
  }
  return score;
}

// Bo'sh qiymat — barcha toifalar uchun (null)
function parseOptionalCategory(value) {
  if (!value || value === "all") return null;
  if (!CATEGORIES.includes(value)) throw new HttpError(400, "Toifa noto'g'ri");
  return value;
}

module.exports = {
  CATEGORIES,
  HttpError,
  validateUserFields,
  parseId,
  parseMonth,
  parseDate,
  parseScore,
  parseOptionalCategory,
};
