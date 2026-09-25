const { Router } = require("express");
const pool = require("../../config/db");
const { authenticate, requireRole } = require("../../middleware/auth");
const { upload, fileInfo, removeFile } = require("../../middleware/upload");
const { HttpError, parseId } = require("../../utils/validation");
const { SELECT_SQL, ORDER_SQL } = require("../schedule");
const { explainLesson, toHttpError } = require("../../services/ai");

const router = Router();
router.use(authenticate, requireRole("student"));

// O'quvchiga ko'rinadigan darslar: o'z o'qituvchilariniki, toifasi mos yoki "barcha toifalar"
const ACCESSIBLE_LESSONS = `
  FROM lessons l
  JOIN teacher_students ts ON ts.teacher_id = l.teacher_id AND ts.student_id = $1
  JOIN students st ON st.user_id = ts.student_id
  JOIN users tu ON tu.id = l.teacher_id
  JOIN teachers t ON t.user_id = l.teacher_id
  WHERE (l.category IS NULL OR l.category = st.category)
`;

async function getProfile(studentId) {
  const { rows } = await pool.query("SELECT category, grade FROM students WHERE user_id = $1", [studentId]);
  if (!rows[0]) throw new HttpError(404, "O'quvchi ma'lumotlari topilmadi");
  return rows[0];
}

async function getLesson(studentId, lessonId) {
  const { rows } = await pool.query(
    `SELECT l.id, l.title, l.description, l.content, l.category, l.file_url, l.file_name, l.created_at,
            l.a11y, tu.full_name AS teacher_name, t.subject
     ${ACCESSIBLE_LESSONS} AND l.id = $2`,
    [studentId, lessonId]
  );
  if (!rows[0]) throw new HttpError(404, "Dars topilmadi");
  return rows[0];
}

// AI so'rovlari uchun oddiy limit: har bir o'quvchiga 10 daqiqada 30 ta
const aiUsage = new Map();
function checkAiLimit(userId) {
  const now = Date.now();
  const recent = (aiUsage.get(userId) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 30) throw new HttpError(429, "Juda ko'p so'rov. Birozdan so'ng urinib ko'ring");
  recent.push(now);
  aiUsage.set(userId, recent);
}

// ---------- Profil va bosh sahifa ----------

router.get("/profile", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.full_name, st.category, st.grade,
            COALESCE(json_agg(json_build_object('id', tu.id, 'full_name', tu.full_name, 'subject', t.subject))
              FILTER (WHERE tu.id IS NOT NULL), '[]') AS teachers
     FROM users u JOIN students st ON st.user_id = u.id
     LEFT JOIN teacher_students ts ON ts.student_id = u.id
     LEFT JOIN users tu ON tu.id = ts.teacher_id
     LEFT JOIN teachers t ON t.user_id = ts.teacher_id
     WHERE u.id = $1
     GROUP BY u.id, st.user_id`,
    [req.user.id]
  );
  res.json(rows[0]);
});

router.get("/stats", async (req, res) => {
  const id = req.user.id;
  const [pending, grades, attendance] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS count
       FROM assignments a JOIN lessons l ON l.id = a.lesson_id
       JOIN teacher_students ts ON ts.teacher_id = l.teacher_id AND ts.student_id = $1
       JOIN students st ON st.user_id = ts.student_id
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = $1
       WHERE (l.category IS NULL OR l.category = st.category)
         AND s.id IS NULL AND (a.due_date IS NULL OR a.due_date >= CURRENT_DATE)`,
      [id]
    ),
    pool.query(
      `SELECT ROUND(AVG(score), 2) AS avg_score, COUNT(*)::int AS count FROM (
         SELECT score FROM grades WHERE student_id = $1
         UNION ALL
         SELECT score FROM submissions WHERE student_id = $1 AND score IS NOT NULL
       ) x`,
      [id]
    ),
    pool.query(
      `SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status <> 'absent') / NULLIF(COUNT(*), 0))::int AS rate
       FROM attendance WHERE student_id = $1 AND date > CURRENT_DATE - 30`,
      [id]
    ),
  ]);
  res.json({
    pending_assignments: pending.rows[0].count,
    avg_score: grades.rows[0].avg_score,
    grades_count: grades.rows[0].count,
    attendance_rate: attendance.rows[0].rate,
  });
});

// Dars jadvali: o'z o'qituvchilarining darslari; guruh ko'rsatilgan bo'lsa — faqat o'z sinfiniki
router.get("/schedule", async (req, res) => {
  const { rows } = await pool.query(
    `${SELECT_SQL}
     JOIN teacher_students ts ON ts.teacher_id = sc.teacher_id AND ts.student_id = $1
     JOIN students st ON st.user_id = ts.student_id
     WHERE sc.group_name IS NULL OR st.grade IS NULL OR LOWER(sc.group_name) = LOWER(st.grade)
     ${ORDER_SQL}`,
    [req.user.id]
  );
  res.json(rows);
});

// ---------- Darslar ----------

router.get("/lessons", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT l.id, l.title, l.description, l.category, l.file_name, l.created_at,
            tu.full_name AS teacher_name, t.subject,
            (l.a11y ? 'subtitle_vtt_url') AS has_subtitles,
            (l.a11y ? 'simple_text') AS has_simple_text,
            (SELECT COUNT(*) FROM assignments a WHERE a.lesson_id = l.id)::int AS assignments_count
     ${ACCESSIBLE_LESSONS}
     ORDER BY l.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

router.get("/lessons/:id", async (req, res) => {
  const lesson = await getLesson(req.user.id, parseId(req.params.id));
  const { rows: assignments } = await pool.query(
    `SELECT a.id, a.title, a.description, a.due_date,
            s.id AS submission_id, s.submitted_at, s.score, s.feedback
     FROM assignments a
     LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = $2
     WHERE a.lesson_id = $1
     ORDER BY a.created_at`,
    [lesson.id, req.user.id]
  );
  // O'quvchiga faqat tayyor formatlar — ishlov bosqichlari va xato matnlari emas
  const a = lesson.a11y || {};
  const a11y = {
    subtitle_vtt_url: a.subtitle_vtt_url || null,
    segments: a.segments || [],
    transcript: a.transcript || null,
    extracted_text: a.extracted_text || null,
    image_description: a.image_description || null,
    simple_text: a.simple_text || null,
    key_terms: a.key_terms || [],
    processing: ["pending", "processing"].includes(a.status),
  };
  res.json({ ...lesson, a11y, assignments });
});

// AI tushuntirish. body.messages — oldingi suhbat (bo'sh bo'lsa, darsni to'liq tushuntiradi)
router.post("/lessons/:id/explain", async (req, res) => {
  const lesson = await getLesson(req.user.id, parseId(req.params.id));
  const { category } = await getProfile(req.user.id);

  const raw = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const messages = raw.slice(-20).map((m) => {
    if (!["user", "assistant"].includes(m?.role) || typeof m.content !== "string" || !m.content.trim()) {
      throw new HttpError(400, "Xabar formati noto'g'ri");
    }
    return { role: m.role, content: m.content.slice(0, 4000) };
  });

  // focus — bosqichma-bosqich rejimda darsning bitta qismi: AI aynan shuni batafsil tushuntiradi
  const focus = typeof req.body?.focus === "string" ? req.body.focus.trim().slice(0, 2000) : "";
  if (focus) {
    messages.push({
      role: "user",
      content: `Darsning quyidagi qismini shoshilmasdan, batafsil va oddiy misollar bilan tushuntirib ber:\n«${focus}»`,
    });
  }

  checkAiLimit(req.user.id);
  try {
    res.json({ answer: await explainLesson(lesson, category, messages) });
  } catch (err) {
    throw toHttpError(err);
  }
});

// ---------- Uy vazifalari ----------

router.get("/assignments", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.title, a.description, a.due_date, a.created_at,
            l.id AS lesson_id, l.title AS lesson_title, tu.full_name AS teacher_name, t.subject,
            s.id AS submission_id, s.answer_text, s.file_url, s.file_name, s.submitted_at,
            s.score, s.feedback, s.graded_at
     FROM assignments a
     JOIN lessons l ON l.id = a.lesson_id
     JOIN teacher_students ts ON ts.teacher_id = l.teacher_id AND ts.student_id = $1
     JOIN students st ON st.user_id = ts.student_id
     JOIN users tu ON tu.id = l.teacher_id
     JOIN teachers t ON t.user_id = l.teacher_id
     LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = $1
     WHERE l.category IS NULL OR l.category = st.category
     ORDER BY (s.id IS NOT NULL), a.due_date NULLS LAST, a.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

// Vazifani topshirish yoki qayta topshirish (baholangunga qadar). Matn yoki fayl kerak
router.post("/assignments/:id/submit", upload.single("file"), async (req, res) => {
  const cleanup = () => req.file && removeFile(fileInfo(req.file).file_url);
  try {
    const assignmentId = parseId(req.params.id);
    const { rows } = await pool.query(
      `SELECT a.id, s.id AS submission_id, s.score, s.file_url, s.file_name
       FROM assignments a
       JOIN lessons l ON l.id = a.lesson_id
       JOIN teacher_students ts ON ts.teacher_id = l.teacher_id AND ts.student_id = $2
       JOIN students st ON st.user_id = ts.student_id
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = $2
       WHERE a.id = $1 AND (l.category IS NULL OR l.category = st.category)`,
      [assignmentId, req.user.id]
    );
    const current = rows[0];
    if (!current) throw new HttpError(404, "Vazifa topilmadi");
    if (current.score !== null) throw new HttpError(400, "Vazifa baholangan, endi o'zgartirib bo'lmaydi");

    const answerText = (req.body?.answer_text || "").trim() || null;
    const keepOldFile = !req.file && req.body?.remove_file !== "true";
    const file = req.file
      ? fileInfo(req.file)
      : keepOldFile
        ? { file_url: current.file_url, file_name: current.file_name }
        : { file_url: null, file_name: null };
    if (!answerText && !file.file_url) throw new HttpError(400, "Javob matnini yozing yoki fayl biriktiring");

    const { rows: saved } = await pool.query(
      `INSERT INTO submissions (assignment_id, student_id, answer_text, file_url, file_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (assignment_id, student_id) DO UPDATE
         SET answer_text = EXCLUDED.answer_text, file_url = EXCLUDED.file_url,
             file_name = EXCLUDED.file_name, submitted_at = NOW()
       RETURNING *`,
      [assignmentId, req.user.id, answerText, file.file_url, file.file_name]
    );
    if (current.file_url && current.file_url !== file.file_url) removeFile(current.file_url);
    res.status(current.submission_id ? 200 : 201).json(saved[0]);
  } catch (err) {
    cleanup();
    throw err;
  }
});

// ---------- Baholar va davomat ----------

router.get("/grades", async (req, res) => {
  const [grades, submissions] = await Promise.all([
    pool.query(
      `SELECT g.id, g.score, g.comment, g.created_at, tu.full_name AS teacher_name, t.subject,
              l.title AS lesson_title
       FROM grades g
       JOIN users tu ON tu.id = g.teacher_id
       JOIN teachers t ON t.user_id = g.teacher_id
       LEFT JOIN lessons l ON l.id = g.lesson_id
       WHERE g.student_id = $1
       ORDER BY g.created_at DESC`,
      [req.user.id]
    ),
    pool.query(
      `SELECT s.id, s.score, s.feedback, s.graded_at, a.title AS assignment_title,
              l.title AS lesson_title, t.subject
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN lessons l ON l.id = a.lesson_id
       JOIN teachers t ON t.user_id = l.teacher_id
       WHERE s.student_id = $1 AND s.score IS NOT NULL
       ORDER BY s.graded_at DESC`,
      [req.user.id]
    ),
  ]);
  res.json({ grades: grades.rows, submissions: submissions.rows });
});

router.get("/attendance", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.date, a.status, tu.full_name AS teacher_name, t.subject
     FROM attendance a
     JOIN users tu ON tu.id = a.teacher_id
     JOIN teachers t ON t.user_id = a.teacher_id
     WHERE a.student_id = $1 AND a.date > CURRENT_DATE - 30
     ORDER BY a.date DESC`,
    [req.user.id]
  );
  res.json(rows);
});

module.exports = router;
