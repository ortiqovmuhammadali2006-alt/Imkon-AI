const { Router } = require("express");
const pool = require("../../config/db");
const { authenticate, requireRole } = require("../../middleware/auth");
const { upload, fileInfo, removeFile } = require("../../middleware/upload");
const { HttpError, parseId } = require("../../utils/validation");
const { SELECT_SQL, ORDER_SQL } = require("../schedule");
const { explainLesson, getClient, chatParams, toHttpError } = require("../../services/ai");
const tutor = require("../../services/tutor");

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
            l.a11y, l.ai_plan, tu.full_name AS teacher_name, t.subject
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

// ---------- AI Tutor: dars bo'yicha interaktiv seans ----------

const tutorUsage = new Map();
function checkTutorLimit(userId) {
  const now = Date.now();
  const recent = (tutorUsage.get(userId) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 60) throw new HttpError(429, "Juda ko'p so'rov. Birozdan so'ng davom eting");
  recent.push(now);
  tutorUsage.set(userId, recent);
}

async function activeSession(studentId, lessonId) {
  const { rows } = await pool.query(
    "SELECT * FROM tutor_sessions WHERE student_id = $1 AND lesson_id = $2 ORDER BY updated_at DESC LIMIT 1",
    [studentId, lessonId]
  );
  return rows[0] || null;
}

async function sessionTurns(sessionId) {
  const { rows } = await pool.query(
    "SELECT id, role, content, kind, evaluation, part, created_at FROM tutor_turns WHERE session_id = $1 ORDER BY id",
    [sessionId]
  );
  return rows;
}

// Seans holati: reja, joriy qism va barcha navbatlar
router.get("/lessons/:id/tutor", async (req, res) => {
  const lesson = await getLesson(req.user.id, parseId(req.params.id));
  const session = await activeSession(req.user.id, lesson.id);
  res.json({
    lesson: { id: lesson.id, title: lesson.title, subject: lesson.subject, teacher_name: lesson.teacher_name },
    plan: lesson.ai_plan?.parts?.length ? lesson.ai_plan : null,
    session: session && { id: session.id, current_part: session.current_part, finished: session.finished },
    turns: session ? await sessionTurns(session.id) : [],
    modes: Object.entries(tutor.MODES).map(([key, m]) => ({ key, label: m.label })),
  });
});

// Navbat: body { message?, mode?, restart?, voice? }. Javob SSE: {plan}, {delta}, {error}, {done, evaluation, part, finished}
router.post("/lessons/:id/tutor", async (req, res) => {
  const lesson = await getLesson(req.user.id, parseId(req.params.id));
  const profile = await getProfile(req.user.id);
  const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 2000) : "";
  const mode = typeof req.body?.mode === "string" && tutor.MODES[req.body.mode] ? req.body.mode : null;
  const voice = Boolean(req.body?.voice);
  checkTutorLimit(req.user.id);

  let plan;
  try {
    plan = await tutor.getPlan(lesson);
  } catch (err) {
    throw toHttpError(err);
  }

  // Seans: yo'q bo'lsa, tugagan bo'lsa yoki "qaytadan" so'ralsa — yangisi
  let session = await activeSession(req.user.id, lesson.id);
  if (!session || session.finished || req.body?.restart) {
    const { rows } = await pool.query("INSERT INTO tutor_sessions (student_id, lesson_id) VALUES ($1, $2) RETURNING *", [req.user.id, lesson.id]);
    session = rows[0];
  }
  const history = await sessionTurns(session.id);
  const starting = history.length === 0;
  if (!starting && !message && !mode) throw new HttpError(400, "Javobingizni yozing yoki ayting");

  // O'quvchi navbati (seans boshida — AI o'zi boshlaydi)
  if (!starting) {
    const content = mode ? `Tushunmadim. ${tutor.MODES[mode].label} tushuntiring.` : message;
    const kind = mode ? "mode" : "message";
    await pool.query("INSERT INTO tutor_turns (session_id, role, content, kind) VALUES ($1, 'user', $2, $3)", [session.id, content, kind]);
    history.push({ role: "user", content, kind });
  }

  // Moslashuv uchun: shu seansdagi ketma-ket to'g'ri/noto'g'ri javoblar
  const evals = history.filter((t) => t.evaluation).map((t) => t.evaluation);
  const streak = (value) => {
    let n = 0;
    for (let i = evals.length - 1; i >= 0 && evals[i] === value; i--) n++;
    return n;
  };
  const stats = { wrongStreak: streak("wrong"), correctStreak: streak("correct") };

  const messages = [
    { role: "system", content: tutor.systemPrompt({ lesson, plan, profile, session, stats, voice }) },
    ...history.slice(-24).map((t) => ({ role: t.role, content: t.content })),
  ];
  if (starting) messages.push({ role: "user", content: "(Seans boshlandi. Salomlash va 1-qismni boshla.)" });
  // Usul tanlangan — bu umumiy "tushunmadim" emas: "qaysi qismi qiyin?" deb so'ramasin, tushuntirib, tekshiruvchi savol bersin
  if (mode) {
    messages.push({
      role: "system",
      content: `USUL: ${tutor.MODES[mode].instruction} O'quvchi usulni o'zi tanladi — "qaysi qismi qiyin" deb so'rama. Tushuntirgach, shu qism bo'yicha bitta oson tekshiruvchi savol ber. Baho: yoq.`,
    });
  }

  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send({ plan, session_id: session.id });

  const controller = new AbortController();
  res.on("close", () => controller.abort());

  let raw = "";
  let tag = null;
  let answer = "";
  try {
    const stream = await getClient().chat.completions.create(
      { ...chatParams(voice ? 500 : 700), messages, stream: true },
      { signal: controller.signal }
    );
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || chunk.choices[0]?.delta?.refusal;
      if (!delta) continue;
      if (tag) {
        answer += delta;
        send({ delta });
        continue;
      }
      // Birinchi qatordagi xizmat belgisi to'liq kelguncha matnni ushlab turamiz
      raw += delta;
      tag = tutor.parseTag(raw);
      if (tag && tag.rest) {
        answer = tag.rest;
        send({ delta: tag.rest });
      }
    }
    if (!tag && raw) {
      tag = tutor.parseTag(raw + "\n") || { evaluation: null, part: undefined, finished: false, rest: raw };
      answer = tag.rest;
      if (answer) send({ delta: answer });
    }
    if (!answer.trim() && !controller.signal.aborted) send({ error: "AI javob bermadi. Qayta urinib ko'ring." });
  } catch (err) {
    if (!controller.signal.aborted) {
      console.error(`[tutor] OpenAI xatosi (session ${session.id}):`, err.status ?? "", err.message);
      send({ error: toHttpError(err).message });
    }
  }

  const evaluation = tag?.evaluation || null;
  const finished = Boolean(tag?.finished);
  const nextPart = finished ? session.current_part : Math.min(Math.max(Number(tag?.part) || session.current_part, 1), plan.parts.length);
  if (answer.trim()) {
    // Baho — o'quvchi javob bergan paytdagi qism bo'yicha (bilim xaritasi uchun)
    await pool.query(
      "INSERT INTO tutor_turns (session_id, role, content, kind, evaluation, part) VALUES ($1, 'assistant', $2, $3, $4, $5)",
      [session.id, answer.trim(), starting ? "start" : "message", evaluation, session.current_part]
    );
    await pool.query("UPDATE tutor_sessions SET current_part = $1, finished = $2, updated_at = NOW() WHERE id = $3", [
      nextPart,
      finished,
      session.id,
    ]);
  }
  if (!res.writableEnded) {
    send({ done: true, evaluation, part: nextPart, finished, parts_total: plan.parts.length });
    res.end();
  }
});

// ---------- Imkon robot-yordamchi: erkin gapni tushunib, platformadagi amalni bajaradi ----------

const ASSISTANT_ACTIONS = [
  "open_home", // bosh sahifa
  "open_lessons", // darslar ro'yxati
  "open_lesson", // aniq dars sahifasi (lesson_id)
  "tutor", // AI Tutor bilan darsni o'rganish (lesson_id)
  "open_assignments",
  "open_schedule",
  "open_grades",
  "open_chat", // AI suhbat (savol berish, shunchaki suhbat)
  "voice_chat", // ovozli suhbat
  "answer", // faqat javob (bugungi reja, oddiy savol) — sahifa o'zgarmaydi
  "unknown", // command_only rejimida: gap platforma buyrug'i emas — hech narsa bajarilmaydi
];
const WEEKDAY_NAMES = ["", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba", "yakshanba"];

router.post("/assistant", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, 500) : "";
  const pathname = typeof req.body?.pathname === "string" ? req.body.pathname.slice(0, 200) : "";
  // Ovoz rejimidan kelgan buyruq ("Imkon, ..."): savol yoki suhbat bo'lsa javob berilmaydi, faqat platforma amali
  const commandOnly = Boolean(req.body?.command_only);
  if (!text) throw new HttpError(400, "Nima yordam kerakligini yozing yoki ayting");
  checkAiLimit(req.user.id);

  const [{ rows: lessons }, { rows: slots }, { rows: tasks }, { rows: lastTutor }, { rows: me }] = await Promise.all([
    pool.query(`SELECT l.id, l.title, t.subject, l.created_at ${ACCESSIBLE_LESSONS} ORDER BY l.created_at DESC LIMIT 40`, [req.user.id]),
    pool.query(
      `${SELECT_SQL}
       JOIN teacher_students ts ON ts.teacher_id = sc.teacher_id AND ts.student_id = $1
       JOIN students st ON st.user_id = ts.student_id
       WHERE sc.group_name IS NULL OR st.grade IS NULL OR LOWER(sc.group_name) = LOWER(st.grade)
       ${ORDER_SQL}`,
      [req.user.id]
    ),
    pool.query(
      `SELECT a.title, a.due_date, l.title AS lesson_title
       FROM assignments a
       JOIN lessons l ON l.id = a.lesson_id
       JOIN teacher_students ts ON ts.teacher_id = l.teacher_id AND ts.student_id = $1
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = $1
       WHERE s.id IS NULL
       ORDER BY a.due_date NULLS LAST LIMIT 8`,
      [req.user.id]
    ),
    pool.query(
      `SELECT ts.lesson_id, l.title FROM tutor_sessions ts JOIN lessons l ON l.id = ts.lesson_id
       WHERE ts.student_id = $1 ORDER BY ts.updated_at DESC LIMIT 1`,
      [req.user.id]
    ),
    pool.query("SELECT u.full_name FROM users u WHERE u.id = $1", [req.user.id]),
  ]);

  const now = new Date();
  const today = ((now.getDay() + 6) % 7) + 1; // 1 = dushanba
  const tomorrow = (today % 7) + 1;
  const daySlots = (d) =>
    slots
      .filter((s) => s.day_of_week === d)
      .map((s) => `${String(s.start_time).slice(0, 5)} ${s.subject || "dars"} (${s.teacher_name})`)
      .join("; ") || "dars yo'q";
  const openLessonId = Number((pathname.match(/^\/student\/lessons\/(\d+)/) || [])[1]) || null;

  const context = [
    `O'quvchi: ${me[0]?.full_name}. Bugun: ${WEEKDAY_NAMES[today]}, ${now.toISOString().slice(0, 10)}.`,
    `Hozirgi sahifa: ${pathname || "noma'lum"}${openLessonId ? ` (ochiq dars id=${openLessonId})` : ""}.`,
    `Bugungi jadval: ${daySlots(today)}.`,
    `Ertangi jadval (${WEEKDAY_NAMES[tomorrow]}): ${daySlots(tomorrow)}.`,
    `Topshirilmagan vazifalar: ${tasks.map((t) => `"${t.title}" (${t.lesson_title}${t.due_date ? `, muddat ${String(t.due_date).slice(0, 10)}` : ""})`).join("; ") || "yo'q"}.`,
    lastTutor[0] ? `Oxirgi AI Tutor darsi: id=${lastTutor[0].lesson_id} "${lastTutor[0].title}".` : "AI Tutor bilan hali dars o'tilmagan.",
    `Darslar (yangidan eskiga): ${lessons.map((l) => `id=${l.id} "${l.title}" [${l.subject || "fan"}]`).join("; ") || "yo'q"}.`,
  ].join("\n");

  let result;
  try {
    const completion = await getClient().chat.completions.create({
      ...chatParams(400),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Sen 'Imkon' — imkoniyati cheklangan o'quvchilar platformasidagi mehribon robot-yordamchisan. O'quvchining gapini tushunib, " +
            "javobingda 'AI' so'zini ishlatma — 'sun'iy intellekt' de. " +
            "platformadagi bitta amalni tanla va qisqa (1-2 gap) iliq javob yoz. Faqat o'zbek tilida (lotin). Faqat JSON qaytar: " +
            `{"action": "${ASSISTANT_ACTIONS.join("|")}", "lesson_id": son yoki null, "reply": "..."}.\n` +
            "Qoidalar: darsni tushuntirish/o'rganish/qayta tushuntirish/'tushunmayapman' — action=tutor (ochiq dars yoki mos dars, " +
            "bo'lmasa oxirgi Tutor darsi). Aniq darsni ochish — open_lesson (fan va sana bo'yicha eng mos darsni tanla; ertangi fan so'ralsa — shu fanning eng yangi darsi). " +
            "Bugungi reja so'ralsa — answer: jadval va topshirilmagan vazifalarni qisqa ayt. Mos dars topilmasa — open_lessons va buni ayt. " +
            "Savol bermoqchi yoki suhbatlashmoqchi bo'lsa — open_chat; ovozli suhbat yoki 'mikrofonni yoq' — voice_chat. lesson_id faqat ro'yxatdagi id bo'lsin." +
            (commandOnly
              ? "\nMUHIM: bu OVOZLI BUYRUQ rejimi. Faqat platformada biror amal bajarish (sahifa/dars ochish, bugungi reja) so'ralsa amal tanla. " +
                "Agar gap savol, ma'lumot so'rash, suhbat yoki noaniq gap bo'lsa — action=unknown va reply: " +
                "\"Bu buyruq emas. Sun'iy intellekt bilan suhbatlashish uchun Imkon, mikrofonni yoq deng.\" Savolga o'zing javob berma."
              : ""),
        },
        { role: "user", content: `${context}\n\nO'quvchi: "${text}"` },
      ],
    });
    result = JSON.parse(completion.choices[0]?.message?.content || "{}");
  } catch (err) {
    throw toHttpError(err);
  }

  let action = ASSISTANT_ACTIONS.includes(result.action) ? result.action : commandOnly ? "unknown" : "answer";
  let lessonId = lessons.some((l) => l.id === Number(result.lesson_id)) ? Number(result.lesson_id) : null;
  if (["open_lesson", "tutor"].includes(action) && !lessonId) {
    lessonId = action === "tutor" ? openLessonId || lastTutor[0]?.lesson_id || null : null;
    if (!lessonId) action = "open_lessons";
  }
  res.json({
    action,
    lesson_id: lessonId,
    reply: String(result.reply || "").trim().slice(0, 400) || "Bajarildi!",
  });
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
