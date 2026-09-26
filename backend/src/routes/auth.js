const { Router } = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { authenticate } = require("../middleware/auth");
const { UPLOAD_DIR, removeFile } = require("../middleware/upload");
const { HttpError } = require("../utils/validation");

const router = Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: "Login va parolni kiriting" });
  }

  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.password_hash, u.role, u.is_active, u.avatar_url, t.subject
     FROM users u LEFT JOIN teachers t ON t.user_id = u.id
     WHERE u.username = $1`,
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
    user: {
      id: user.id,
      full_name: user.full_name,
      username: user.username,
      role: user.role,
      subject: user.subject,
      avatar_url: user.avatar_url,
    },
  });
});

router.get("/me", authenticate, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.role, u.is_active, u.avatar_url, t.subject
     FROM users u LEFT JOIN teachers t ON t.user_id = u.id
     WHERE u.id = $1`,
    [req.user.id]
  );
  const user = rows[0];
  if (!user || !user.is_active) {
    return res.status(401).json({ message: "Foydalanuvchi topilmadi" });
  }
  res.json({ user });
});

// Profil oynasi (yon menyudagi foydalanuvchi kartasi bosilganda): umumiy ma'lumot + rolga xos qism
router.get("/profile", authenticate, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, full_name, username, role, phone, avatar_url, created_at FROM users WHERE id = $1",
    [req.user.id]
  );
  const profile = rows[0];
  if (!profile) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });

  if (profile.role === "student") {
    const { rows: st } = await pool.query(
      `SELECT st.category, st.grade, st.birth_date,
              COALESCE(json_agg(json_build_object('full_name', tu.full_name, 'subject', t.subject) ORDER BY tu.full_name)
                FILTER (WHERE tu.id IS NOT NULL), '[]') AS teachers
       FROM students st
       LEFT JOIN teacher_students ts ON ts.student_id = st.user_id
       LEFT JOIN users tu ON tu.id = ts.teacher_id
       LEFT JOIN teachers t ON t.user_id = ts.teacher_id
       WHERE st.user_id = $1
       GROUP BY st.user_id`,
      [profile.id]
    );
    Object.assign(profile, st[0] || { teachers: [] });
  } else if (profile.role === "teacher") {
    const { rows: tr } = await pool.query(
      `SELECT t.subject,
              (SELECT COUNT(*)::int FROM teacher_students WHERE teacher_id = t.user_id) AS students_count,
              (SELECT COUNT(*)::int FROM lessons WHERE teacher_id = t.user_id) AS lessons_count
       FROM teachers t WHERE t.user_id = $1`,
      [profile.id]
    );
    Object.assign(profile, tr[0] || {});
  }
  res.json(profile);
});

// Ismni o'zgartirish — faqat administrator o'zi uchun (o'qituvchi va o'quvchi ismini administrator kiritadi)
router.patch("/profile", authenticate, async (req, res) => {
  if (req.user.role !== "admin") throw new HttpError(403, "Ismni administrator o'zgartiradi");
  const full_name = String(req.body?.full_name ?? "").trim().replace(/\s+/g, " ");
  if (full_name.length < 3) throw new HttpError(400, "Ism kamida 3 ta belgidan iborat bo'lsin");
  if (full_name.length > 150) throw new HttpError(400, "Ism juda uzun (150 belgigacha)");
  const { rows } = await pool.query("UPDATE users SET full_name = $1 WHERE id = $2 RETURNING full_name", [full_name, req.user.id]);
  res.json(rows[0]);
});

// Profil rasmi: faqat rasm, 5 MB gacha
const IMAGE_TYPES = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `avatar-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${IMAGE_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    IMAGE_TYPES[file.mimetype] ? cb(null, true) : cb(new HttpError(400, "Faqat rasm yuklang (JPG, PNG, WEBP yoki GIF)")),
});

router.post("/avatar", authenticate, (req, res, next) => {
  avatarUpload.single("avatar")(req, res, async (err) => {
    try {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") throw new HttpError(400, "Rasm hajmi 5 MB dan oshmasligi kerak");
      if (err) throw err;
      if (!req.file) throw new HttpError(400, "Rasm tanlanmadi");
      const avatar_url = `/uploads/${path.basename(req.file.filename)}`;
      const { rows } = await pool.query(
        "UPDATE users u SET avatar_url = $1 FROM users old WHERE u.id = old.id AND u.id = $2 RETURNING old.avatar_url AS previous",
        [avatar_url, req.user.id]
      );
      if (rows[0]?.previous) removeFile(rows[0].previous);
      res.json({ avatar_url });
    } catch (e) {
      if (req.file) removeFile(`/uploads/${req.file.filename}`);
      next(e);
    }
  });
});

router.delete("/avatar", authenticate, async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE users u SET avatar_url = NULL FROM users old WHERE u.id = old.id AND u.id = $1 RETURNING old.avatar_url AS previous",
    [req.user.id]
  );
  if (rows[0]?.previous) removeFile(rows[0].previous);
  res.json({ avatar_url: null });
});

module.exports = router;
