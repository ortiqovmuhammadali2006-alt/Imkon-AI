const { Router } = require("express");
const pool = require("../../config/db");
const { HttpError, parseId, parseMonth } = require("../../utils/validation");

const router = Router();

// Tanlangan oy bo'yicha har bir o'qituvchining oyligi, to'langan va qolgan summa
router.get("/", async (req, res) => {
  const month = parseMonth(req.query.month);
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.is_active, t.subject, t.monthly_salary,
            COALESCE(SUM(p.amount), 0) AS paid
     FROM users u
     JOIN teachers t ON t.user_id = u.id
     LEFT JOIN salary_payments p ON p.teacher_id = u.id AND p.month = $1
     GROUP BY u.id, t.user_id
     ORDER BY u.full_name`,
    [month]
  );
  res.json(rows);
});

router.get("/payments", async (req, res) => {
  const month = parseMonth(req.query.month);
  const { rows } = await pool.query(
    `SELECT p.id, p.teacher_id, u.full_name AS teacher_name, p.amount, p.month, p.note, p.paid_at
     FROM salary_payments p
     JOIN users u ON u.id = p.teacher_id
     WHERE p.month = $1
     ORDER BY p.paid_at DESC`,
    [month]
  );
  res.json(rows);
});

router.post("/payments", async (req, res) => {
  const teacherId = parseId(req.body.teacher_id);
  const month = parseMonth(req.body.month);
  const amount = Number(req.body.amount);
  const note = (req.body.note || "").trim() || null;

  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, "Summa 0 dan katta bo'lsin");

  const { rowCount } = await pool.query("SELECT 1 FROM teachers WHERE user_id = $1", [teacherId]);
  if (rowCount === 0) throw new HttpError(404, "O'qituvchi topilmadi");

  const { rows } = await pool.query(
    `INSERT INTO salary_payments (teacher_id, amount, month, note)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [teacherId, amount, month, note]
  );
  res.status(201).json(rows[0]);
});

router.delete("/payments/:id", async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM salary_payments WHERE id = $1", [
    parseId(req.params.id),
  ]);
  if (rowCount === 0) throw new HttpError(404, "To'lov topilmadi");
  res.status(204).end();
});

module.exports = router;
