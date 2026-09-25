const { Router } = require("express");
const pool = require("../../config/db");
const { authenticate, requireRole } = require("../../middleware/auth");

const router = Router();

router.use(authenticate, requireRole("admin"));

router.use("/teachers", require("./teachers"));
router.use("/students", require("./students"));
router.use("/salaries", require("./salaries"));
router.use("/monitoring", require("./monitoring"));
router.use("/schedule", require("./schedule"));

// Bosh sahifa statistikasi
router.get("/stats", async (req, res) => {
  const [teachers, students, categories, salary, payments] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active
                FROM users WHERE role = 'teacher'`),
    pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active
                FROM users WHERE role = 'student'`),
    pool.query("SELECT category, COUNT(*)::int AS count FROM students GROUP BY category"),
    pool.query(`
      SELECT
        (SELECT COALESCE(SUM(t.monthly_salary), 0) FROM teachers t
          JOIN users u ON u.id = t.user_id WHERE u.is_active) AS expected,
        (SELECT COALESCE(SUM(amount), 0) FROM salary_payments
          WHERE month = DATE_TRUNC('month', CURRENT_DATE)::date) AS paid
    `),
    pool.query(`
      SELECT p.id, p.amount, p.month, p.paid_at, u.full_name AS teacher_name
      FROM salary_payments p JOIN users u ON u.id = p.teacher_id
      ORDER BY p.paid_at DESC LIMIT 5
    `),
  ]);

  const byCategory = { general: 0, visual: 0, hearing: 0, physical: 0 };
  for (const row of categories.rows) byCategory[row.category] = row.count;

  res.json({
    teachers: teachers.rows[0],
    students: { ...students.rows[0], by_category: byCategory },
    salary: salary.rows[0],
    recent_payments: payments.rows,
  });
});

module.exports = router;
