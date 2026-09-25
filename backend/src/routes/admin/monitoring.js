const { Router } = require("express");
const pool = require("../../config/db");
const { HttpError, parseId } = require("../../utils/validation");

const router = Router();

// Har bir o'qituvchining so'nggi 30 kunlik faolligi
router.get("/", async (req, res) => {
  const { rows } = await pool.query(`
    SELECT u.id, u.full_name, u.is_active, t.subject,
      (SELECT COUNT(*) FROM teacher_students WHERE teacher_id = u.id)::int AS students_count,
      (SELECT COUNT(*) FROM lessons WHERE teacher_id = u.id)::int AS lessons_total,
      (SELECT COUNT(*) FROM lessons
        WHERE teacher_id = u.id AND created_at > NOW() - INTERVAL '30 days')::int AS lessons_month,
      (SELECT COUNT(DISTINCT date) FROM attendance
        WHERE teacher_id = u.id AND date > CURRENT_DATE - 30)::int AS attendance_days_month,
      (SELECT COUNT(*) FROM grades
        WHERE teacher_id = u.id AND created_at > NOW() - INTERVAL '30 days')::int AS grades_month,
      (SELECT ROUND(AVG(score), 2) FROM grades WHERE teacher_id = u.id) AS avg_grade,
      GREATEST(
        (SELECT MAX(created_at) FROM lessons WHERE teacher_id = u.id),
        (SELECT MAX(date)::timestamptz FROM attendance WHERE teacher_id = u.id),
        (SELECT MAX(created_at) FROM grades WHERE teacher_id = u.id)
      ) AS last_activity
    FROM users u
    JOIN teachers t ON t.user_id = u.id
    ORDER BY last_activity DESC NULLS LAST, u.full_name
  `);
  res.json(rows);
});

// Bitta o'qituvchi bo'yicha batafsil: so'nggi darslar, davomat va baholar
router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const { rows: teacher } = await pool.query(
    `SELECT u.id, u.full_name, t.subject FROM users u JOIN teachers t ON t.user_id = u.id
     WHERE u.id = $1`,
    [id]
  );
  if (!teacher[0]) throw new HttpError(404, "O'qituvchi topilmadi");

  const [lessons, attendance, grades] = await Promise.all([
    pool.query(
      `SELECT id, title, category, created_at FROM lessons
       WHERE teacher_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [id]
    ),
    pool.query(
      `SELECT status, COUNT(*)::int AS count FROM attendance
       WHERE teacher_id = $1 AND date > CURRENT_DATE - 30 GROUP BY status`,
      [id]
    ),
    pool.query(
      `SELECT g.id, g.score, g.comment, g.created_at, u.full_name AS student_name
       FROM grades g JOIN users u ON u.id = g.student_id
       WHERE g.teacher_id = $1 ORDER BY g.created_at DESC LIMIT 10`,
      [id]
    ),
  ]);

  const attendanceSummary = { present: 0, absent: 0, late: 0 };
  for (const row of attendance.rows) attendanceSummary[row.status] = row.count;

  res.json({
    teacher: teacher[0],
    lessons: lessons.rows,
    attendance: attendanceSummary,
    grades: grades.rows,
  });
});

module.exports = router;
