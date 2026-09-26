// Integratsion testlar uchun umumiy yordamchilar. Testlar ishlab turgan backend serveriga (npm run dev) so'rov yuboradi
// va bazadan foydalanadi (backend/.env). Admin tokeni parolsiz — JWT_SECRET bilan yaratiladi (repoda parol yo'q).
// Har bir test o'zi yaratgan ma'lumotni o'zi o'chiradi.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });
const jwt = require("jsonwebtoken");
const pool = require("../src/config/db");

const FILES = process.env.TEST_SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
const BASE = `${FILES}/api`;
// Test foydalanuvchilari paroli (faqat testda yaratilib, oxirida o'chiriladi)
const TEST_PASSWORD = "Test-parol-2026";

async function adminToken() {
  const { rows } = await pool.query("SELECT id FROM users WHERE role = 'admin' AND is_active ORDER BY id LIMIT 1");
  if (!rows[0]) throw new Error("Bazada admin yo'q — avval: npm run migrate");
  return jwt.sign({ id: rows[0].id, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

module.exports = { BASE, FILES, TEST_PASSWORD, adminToken, pool };
