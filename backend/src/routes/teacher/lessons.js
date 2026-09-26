const { Router } = require("express");
const path = require("path");
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
const { enqueueLesson, removeGeneratedFiles } = require("../../services/accessibility");
const { normalizeVideoUrl } = require("../../services/youtube");

const router = Router();

// Dars: asosiy material (file) + ixtiyoriy subtitr fayli (subtitle: .srt / .vtt)
const lessonUpload = upload.fields([
  { name: "file", maxCount: 1 },
  { name: "subtitle", maxCount: 1 },
]);

function uploadedFiles(req) {
  const file = req.files?.file?.[0];
  const subtitle = req.files?.subtitle?.[0];
  return { file, subtitle };
}

function cleanupUploads(req) {
  const { file, subtitle } = uploadedFiles(req);
  if (file) removeFile(fileInfo(file).file_url);
  if (subtitle) removeFile(fileInfo(subtitle).file_url);
}

function parseLessonFields(body) {
  const title = (body.title || "").trim();
  if (title.length < 3) throw new HttpError(400, "Dars mavzusi kamida 3 ta belgidan iborat bo'lsin");
  return {
    title,
    description: (body.description || "").trim() || null,
    content: (body.content || "").trim() || null,
    category: parseOptionalCategory(body.category),
    youtube_url: normalizeVideoUrl(body.youtube_url) || null,
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

// Validatsiya xato bersa, yuklangan fayllarni o'chirib yuboradi
function validateWithUpload(req, parse) {
  try {
    const { subtitle } = uploadedFiles(req);
    if (subtitle && ![".srt", ".vtt"].includes(path.extname(subtitle.originalname).toLowerCase())) {
      throw new HttpError(400, "Subtitr fayli .srt yoki .vtt formatida bo'lishi kerak");
    }
    return parse(req.body || {});
  } catch (err) {
    cleanupUploads(req);
    throw err;
  }
}

// ---------- Darslar ----------

router.get("/lessons", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT l.id, l.title, l.description, l.category, l.file_url, l.file_name, l.youtube_url, l.created_at,
            l.a11y->>'status' AS a11y_status,
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

router.post("/lessons", lessonUpload, async (req, res) => {
  const fields = validateWithUpload(req, parseLessonFields);
  const { file: f, subtitle: sub } = uploadedFiles(req);
  const file = fileInfo(f) || { file_url: null, file_name: null };
  const subtitle = fileInfo(sub) || { file_url: null, file_name: null };

  const { rows } = await pool.query(
    `INSERT INTO lessons (teacher_id, title, description, content, category, file_url, file_name,
                          subtitle_url, subtitle_name, youtube_url, a11y)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '{"status":"pending"}') RETURNING *`,
    [req.user.id, fields.title, fields.description, fields.content, fields.category,
     file.file_url, file.file_name, subtitle.file_url, subtitle.file_name, fields.youtube_url]
  );
  enqueueLesson(rows[0].id); // qulaylik to'plami fonda tayyorlanadi
  res.status(201).json(rows[0]);
});

// Yangi fayl/subtitr yuborilsa — almashtiriladi; remove_file / remove_subtitle = "true" bo'lsa — o'chiriladi
router.put("/lessons/:id", lessonUpload, async (req, res) => {
  let lesson;
  try {
    lesson = await getMyLesson(req.user.id, parseId(req.params.id));
  } catch (err) {
    cleanupUploads(req);
    throw err;
  }
  const fields = validateWithUpload(req, parseLessonFields);
  const { file: f, subtitle: sub } = uploadedFiles(req);

  let file = { file_url: lesson.file_url, file_name: lesson.file_name };
  if (f) file = fileInfo(f);
  else if (req.body.remove_file === "true") file = { file_url: null, file_name: null };

  let subtitle = { file_url: lesson.subtitle_url, file_name: lesson.subtitle_name };
  if (sub) subtitle = fileInfo(sub);
  else if (req.body.remove_subtitle === "true") subtitle = { file_url: null, file_name: null };

  const { rows } = await pool.query(
    `UPDATE lessons SET title = $1, description = $2, content = $3, category = $4, file_url = $5, file_name = $6,
                        subtitle_url = $7, subtitle_name = $8, youtube_url = $9, a11y = jsonb_set(a11y, '{status}', '"pending"')
     WHERE id = $10 RETURNING *`,
    [fields.title, fields.description, fields.content, fields.category, file.file_url, file.file_name,
     subtitle.file_url, subtitle.file_name, fields.youtube_url, lesson.id]
  );
  if (lesson.file_url !== file.file_url) removeFile(lesson.file_url);
  if (lesson.subtitle_url !== subtitle.file_url) removeFile(lesson.subtitle_url);
  enqueueLesson(lesson.id);
  res.json(rows[0]);
});

// Qulaylik to'plamini qayta yaratish (masalan, OpenAI hisobi to'ldirilgandan keyin)
router.post("/lessons/:id/accessibility", async (req, res) => {
  const lesson = await getMyLesson(req.user.id, parseId(req.params.id));
  await pool.query(`UPDATE lessons SET a11y = jsonb_set(a11y, '{status}', '"pending"') WHERE id = $1`, [lesson.id]);
  enqueueLesson(lesson.id);
  res.status(202).json({ status: "pending" });
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
  removeFile(lesson.subtitle_url);
  removeGeneratedFiles(lesson.a11y);
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
