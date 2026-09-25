const { Router } = require("express");
const pool = require("../../config/db");
const { authenticate, requireRole } = require("../../middleware/auth");

const router = Router();

router.use(authenticate, requireRole("teacher"));

router.use("/", require("./lessons"));
router.use("/attendance", require("./attendance"));
router.use("/grades", require("./grades"));

// O'qituvchiga biriktirilgan o'quvchilar: o'rtacha baho va 30 kunlik davomat foizi bilan
router.get("/students", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.phone, u.is_active, st.category, st.grade, st.birth_date,
            (SELECT ROUND(AVG(score), 2) FROM grades
              WHERE teacher_id = $1 AND student_id = u.id) AS avg_score,
            (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status <> 'absent') / NULLIF(COUNT(*), 0))
              FROM attendance
              WHERE teacher_id = $1 AND student_id = u.id AND date > CURRENT_DATE - 30)::int AS attendance_rate
     FROM teacher_students ts
     JOIN students st ON st.user_id = ts.student_id
     JOIN users u ON u.id = st.user_id
     WHERE ts.teacher_id = $1
     ORDER BY u.full_name`,
    [req.user.id]
  );
  res.json(rows);
});

// Bosh sahifa statistikasi
router.get("/stats", async (req, res) => {
  const id = req.user.id;
  const [students, lessons, ungraded, today, recent] = await Promise.all([
    pool.query(
      `SELECT st.category, COUNT(*)::int AS count
       FROM teacher_students ts JOIN students st ON st.user_id = ts.student_id
       WHERE ts.teacher_id = $1 GROUP BY st.category`,
      [id]
    ),
    pool.query(
      `SELECT COUNT(DISTINCT l.id)::int AS lessons,
              COUNT(a.id) FILTER (WHERE a.due_date >= CURRENT_DATE)::int AS open_assignments
       FROM lessons l LEFT JOIN assignments a ON a.lesson_id = l.id
       WHERE l.teacher_id = $1`,
      [id]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count
       FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN lessons l ON l.id = a.lesson_id
       WHERE l.teacher_id = $1 AND s.score IS NULL`,
      [id]
    ),
    pool.query(
      "SELECT COUNT(*)::int AS count FROM attendance WHERE teacher_id = $1 AND date = CURRENT_DATE",
      [id]
    ),
    pool.query(
      `SELECT s.id, s.submitted_at, s.score, u.full_name AS student_name,
              a.id AS assignment_id, a.title AS assignment_title
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN lessons l ON l.id = a.lesson_id
       JOIN users u ON u.id = s.student_id
       WHERE l.teacher_id = $1
       ORDER BY s.submitted_at DESC LIMIT 5`,
      [id]
    ),
  ]);

  const byCategory = { general: 0, visual: 0, hearing: 0, physical: 0 };
  for (const row of students.rows) byCategory[row.category] = row.count;
  const studentsTotal = Object.values(byCategory).reduce((a, b) => a + b, 0);

  res.json({
    students: { total: studentsTotal, by_category: byCategory },
    lessons: lessons.rows[0].lessons,
    open_assignments: lessons.rows[0].open_assignments,
    ungraded_submissions: ungraded.rows[0].count,
    attendance_marked_today: today.rows[0].count,
    recent_submissions: recent.rows,
  });
});

module.exports = router;
