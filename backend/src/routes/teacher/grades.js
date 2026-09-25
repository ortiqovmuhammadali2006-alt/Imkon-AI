const { Router } = require("express");
const pool = require("../../config/db");
const { HttpError, parseId, parseMonth, parseScore } = require("../../utils/validation");
const { assertMyStudents, getMyLesson } = require("./access");

const router = Router();

// Baholar ro'yxati. Filtrlar: ?month=YYYY-MM, ?student_id=
router.get("/", async (req, res) => {
  const params = [req.user.id];
  const where = ["g.teacher_id = $1"];
  if (req.query.month) {
    params.push(parseMonth(req.query.month));
    where.push(`g.created_at >= $${params.length}::date AND g.created_at < ($${params.length}::date + INTERVAL '1 month')`);
  }
  if (req.query.student_id) {
    params.push(parseId(req.query.student_id));
    where.push(`g.student_id = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT g.id, g.student_id, u.full_name AS student_name, g.lesson_id, l.title AS lesson_title,
            g.score, g.comment, g.created_at
     FROM grades g
     JOIN users u ON u.id = g.student_id
     LEFT JOIN lessons l ON l.id = g.lesson_id
     WHERE ${where.join(" AND ")}
     ORDER BY g.created_at DESC`,
    params
  );
  res.json(rows);
});

// Har bir o'quvchi bo'yicha o'rtacha baho va baholar soni
router.get("/summary", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id AS student_id, u.full_name, st.category, st.grade,
            COUNT(g.id)::int AS grades_count,
            ROUND(AVG(g.score), 2) AS avg_score,
            (SELECT score FROM grades WHERE teacher_id = $1 AND student_id = u.id
              ORDER BY created_at DESC LIMIT 1) AS last_score
     FROM teacher_students ts
     JOIN students st ON st.user_id = ts.student_id
     JOIN users u ON u.id = st.user_id
     LEFT JOIN grades g ON g.student_id = u.id AND g.teacher_id = ts.teacher_id
     WHERE ts.teacher_id = $1
     GROUP BY u.id, st.user_id
     ORDER BY u.full_name`,
    [req.user.id]
  );
  res.json(rows);
});

async function parseGradeBody(teacherId, body) {
  const score = parseScore(body.score);
  const comment = (body.comment || "").trim() || null;
  const lesson_id = body.lesson_id ? parseId(body.lesson_id) : null;
  if (lesson_id) await getMyLesson(teacherId, lesson_id);
  return { score, comment, lesson_id };
}

router.post("/", async (req, res) => {
  const studentId = parseId(req.body?.student_id);
  await assertMyStudents(req.user.id, [studentId]);
  const grade = await parseGradeBody(req.user.id, req.body);

  const { rows } = await pool.query(
    `INSERT INTO grades (teacher_id, student_id, lesson_id, score, comment)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.user.id, studentId, grade.lesson_id, grade.score, grade.comment]
  );
  res.status(201).json(rows[0]);
});

// lesson_id faqat so'rovda yuborilgan bo'lsa o'zgaradi (null — bog'lanishni olib tashlaydi)
router.put("/:id", async (req, res) => {
  const body = req.body || {};
  const grade = await parseGradeBody(req.user.id, body);
  const { rows } = await pool.query(
    `UPDATE grades SET score = $1, comment = $2,
            lesson_id = CASE WHEN $6 THEN $3 ELSE lesson_id END
     WHERE id = $4 AND teacher_id = $5 RETURNING *`,
    [grade.score, grade.comment, grade.lesson_id, parseId(req.params.id), req.user.id, "lesson_id" in body]
  );
  if (!rows[0]) throw new HttpError(404, "Baho topilmadi");
  res.json(rows[0]);
});

router.delete("/:id", async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM grades WHERE id = $1 AND teacher_id = $2", [
    parseId(req.params.id),
    req.user.id,
  ]);
  if (rowCount === 0) throw new HttpError(404, "Baho topilmadi");
  res.status(204).end();
});

module.exports = router;
