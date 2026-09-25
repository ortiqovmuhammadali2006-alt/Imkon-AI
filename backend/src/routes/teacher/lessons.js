const { Router } = require("express");
const pool = require("../../config/db");
const { upload, fileInfo, removeFile } = require("../../middleware/upload");
const {
  HttpError,
  parseId,
  parseDate,
  parseScore,
  parseOptionalCategory,
} = require("../../utils/validation");
const { getMyLesson, getMyAssignment } = require("./access");

const router = Router();

function parseLessonFields(body) {
  const title = (body.title || "").trim();
  if (title.length < 3) throw new HttpError(400, "Dars mavzusi kamida 3 ta belgidan iborat bo'lsin");
  return {
    title,
    description: (body.description || "").trim() || null,
    content: (body.content || "").trim() || null,
    category: parseOptionalCategory(body.category),
  };
}

function parseAssignmentFields(body) {
  const title = (body.title || "").trim();
  if (title.length < 3) throw new HttpError(400, "Vazifa nomi kamida 3 ta belgidan iborat bo'lsin");
  return {
    title,
    description: (body.description || "").trim() || null,
    due_date: body.due_date ? parseDate(body.due_date, "Topshirish muddati") : null,
  };
}

// Validatsiya xato bersa, yuklangan faylni o'chirib yuboradi
function validateWithUpload(req, parse) {
  try {
    return parse(req.body || {});
  } catch (err) {
    if (req.file) removeFile(fileInfo(req.file).file_url);
    throw err;
  }
}

// ---------- Darslar ----------

router.get("/lessons", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT l.id, l.title, l.description, l.category, l.file_url, l.file_name, l.created_at,
            (SELECT COUNT(*) FROM assignments a WHERE a.lesson_id = l.id)::int AS assignments_count
     FROM lessons l
     WHERE l.teacher_id = $1
     ORDER BY l.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

router.get("/lessons/:id", async (req, res) => {
  const lesson = await getMyLesson(req.user.id, parseId(req.params.id));
  const { rows: assignments } = await pool.query(
    `SELECT a.id, a.title, a.description, a.due_date, a.created_at,
            COUNT(s.id)::int AS submissions_count,
            COUNT(s.id) FILTER (WHERE s.score IS NOT NULL)::int AS graded_count
     FROM assignments a
     LEFT JOIN submissions s ON s.assignment_id = a.id
     WHERE a.lesson_id = $1
     GROUP BY a.id
     ORDER BY a.created_at`,
    [lesson.id]
  );
  res.json({ ...lesson, assignments });
});

router.post("/lessons", upload.single("file"), async (req, res) => {
  const fields = validateWithUpload(req, parseLessonFields);
  const file = fileInfo(req.file) || { file_url: null, file_name: null };

  const { rows } = await pool.query(
    `INSERT INTO lessons (teacher_id, title, description, content, category, file_url, file_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.user.id, fields.title, fields.description, fields.content, fields.category, file.file_url, file.file_name]
  );
  res.status(201).json(rows[0]);
});

// Yangi fayl yuborilsa — almashtiriladi; remove_file=true bo'lsa — o'chiriladi
router.put("/lessons/:id", upload.single("file"), async (req, res) => {
  let lesson;
  try {
    lesson = await getMyLesson(req.user.id, parseId(req.params.id));
  } catch (err) {
    if (req.file) removeFile(fileInfo(req.file).file_url);
    throw err;
  }
  const fields = validateWithUpload(req, parseLessonFields);

  let file = { file_url: lesson.file_url, file_name: lesson.file_name };
  if (req.file) file = fileInfo(req.file);
  else if (req.body.remove_file === "true") file = { file_url: null, file_name: null };

  const { rows } = await pool.query(
    `UPDATE lessons SET title = $1, description = $2, content = $3, category = $4, file_url = $5, file_name = $6
     WHERE id = $7 RETURNING *`,
    [fields.title, fields.description, fields.content, fields.category, file.file_url, file.file_name, lesson.id]
  );
  if (lesson.file_url !== file.file_url) removeFile(lesson.file_url);
  res.json(rows[0]);
});

router.delete("/lessons/:id", async (req, res) => {
  const lesson = await getMyLesson(req.user.id, parseId(req.params.id));
  // Dars bilan birga o'chadigan topshiriq fayllari
  const { rows: files } = await pool.query(
    `SELECT s.file_url FROM submissions s JOIN assignments a ON a.id = s.assignment_id
     WHERE a.lesson_id = $1 AND s.file_url IS NOT NULL`,
    [lesson.id]
  );
  await pool.query("DELETE FROM lessons WHERE id = $1", [lesson.id]);
  removeFile(lesson.file_url);
  files.forEach((f) => removeFile(f.file_url));
  res.status(204).end();
});

// ---------- Uy vazifalari ----------

router.post("/lessons/:id/assignments", async (req, res) => {
  const lesson = await getMyLesson(req.user.id, parseId(req.params.id));
  const fields = parseAssignmentFields(req.body || {});
  const { rows } = await pool.query(
    `INSERT INTO assignments (lesson_id, title, description, due_date)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [lesson.id, fields.title, fields.description, fields.due_date]
  );
  res.status(201).json(rows[0]);
});

router.put("/assignments/:id", async (req, res) => {
  const assignment = await getMyAssignment(req.user.id, parseId(req.params.id));
  const fields = parseAssignmentFields(req.body || {});
  const { rows } = await pool.query(
    `UPDATE assignments SET title = $1, description = $2, due_date = $3 WHERE id = $4 RETURNING *`,
    [fields.title, fields.description, fields.due_date, assignment.id]
  );
  res.json(rows[0]);
});

router.delete("/assignments/:id", async (req, res) => {
  const assignment = await getMyAssignment(req.user.id, parseId(req.params.id));
  const { rows: files } = await pool.query(
    "SELECT file_url FROM submissions WHERE assignment_id = $1 AND file_url IS NOT NULL",
    [assignment.id]
  );
  await pool.query("DELETE FROM assignments WHERE id = $1", [assignment.id]);
  files.forEach((f) => removeFile(f.file_url));
  res.status(204).end();
});

// Vazifa bo'yicha: darsning toifasiga mos barcha o'quvchilar va ularning topshirgan ishi (bo'lsa)
router.get("/assignments/:id/submissions", async (req, res) => {
  const assignment = await getMyAssignment(req.user.id, parseId(req.params.id));
  const { rows } = await pool.query(
    `SELECT u.id AS student_id, u.full_name, st.category,
            sub.id AS submission_id, sub.answer_text, sub.file_url, sub.file_name,
            sub.submitted_at, sub.score, sub.feedback, sub.graded_at
     FROM teacher_students ts
     JOIN students st ON st.user_id = ts.student_id
     JOIN users u ON u.id = st.user_id
     LEFT JOIN submissions sub ON sub.student_id = u.id AND sub.assignment_id = $1
     WHERE ts.teacher_id = $2 AND ($3::varchar IS NULL OR st.category = $3)
     ORDER BY sub.submitted_at IS NULL, sub.submitted_at DESC, u.full_name`,
    [assignment.id, req.user.id, assignment.lesson_category]
  );
  res.json({ assignment, submissions: rows });
});

// Topshirilgan ishni baholash
router.patch("/submissions/:id/grade", async (req, res) => {
  const id = parseId(req.params.id);
  const score = parseScore(req.body?.score);
  const feedback = (req.body?.feedback || "").trim() || null;

  const { rows } = await pool.query(
    `UPDATE submissions s SET score = $1, feedback = $2, graded_at = NOW()
     FROM assignments a JOIN lessons l ON l.id = a.lesson_id
     WHERE s.id = $3 AND s.assignment_id = a.id AND l.teacher_id = $4
     RETURNING s.*`,
    [score, feedback, id, req.user.id]
  );
  if (!rows[0]) throw new HttpError(404, "Topshirilgan ish topilmadi");
  res.json(rows[0]);
});

module.exports = router;
