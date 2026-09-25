const { Router } = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { authenticate } = require("../middleware/auth");

const router = Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: "Login va parolni kiriting" });
  }

  const { rows } = await pool.query(
    "SELECT id, full_name, username, password_hash, role, is_active FROM users WHERE username = $1",
    [username.trim()]
  );
  const user = rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ message: "Login yoki parol noto'g'ri" });
  }
  if (!user.is_active) {
    return res.status(403).json({ message: "Hisobingiz bloklangan. Admin bilan bog'laning" });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

  res.json({
    token,
    user: { id: user.id, full_name: user.full_name, username: user.username, role: user.role },
  });
});

router.get("/me", authenticate, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, full_name, username, role, is_active FROM users WHERE id = $1",
    [req.user.id]
  );
  const user = rows[0];
  if (!user || !user.is_active) {
    return res.status(401).json({ message: "Foydalanuvchi topilmadi" });
  }
  res.json({ user });
});

module.exports = router;
