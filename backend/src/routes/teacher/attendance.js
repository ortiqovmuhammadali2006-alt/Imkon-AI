const { Router } = require("express");
const pool = require("../../config/db");
const { withTransaction } = require("../../config/db");
const { HttpError, parseId, parseDate, parseMonth } = require("../../utils/validation");
const { assertMyStudents } = require("./access");

const router = Router();

const STATUSES = ["present", "absent", "late"];

// Tanlangan kun uchun barcha faol o'quvchilar va ularning davomati (belgilanmagan bo'lsa — null)
router.get("/", async (req, res) => {
  const date = parseDate(req.query.date);
  const { rows } = await pool.query(
    `SELECT u.id AS student_id, u.full_name, st.category, st.grade, a.status
     FROM teacher_students ts
     JOIN students st ON st.user_id = ts.student_id
     JOIN users u ON u.id = st.user_id
     LEFT JOIN attendance a ON a.student_id = u.id AND a.teacher_id = ts.teacher_id AND a.date = $2
     WHERE ts.teacher_id = $1 AND u.is_active
     ORDER BY u.full_name`,
    [req.user.id, date]
  );
  res.json(rows);
});

// Bir kunlik davomatni saqlash: { date, records: [{ student_id, status }] }
// status null bo'lsa — belgi olib tashlanadi
router.put("/", async (req, res) => {
  const date = parseDate(req.body?.date);
  const { rows: future } = await pool.query("SELECT $1::date > CURRENT_DATE AS is_future", [date]);
  if (future[0].is_future) throw new HttpError(400, "Kelajakdagi kun uchun davomat belgilab bo'lmaydi");
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  if (records.length === 0) throw new HttpError(400, "Davomat ro'yxati bo'sh");

  const parsed = records.map((r) => {
    const status = r.status ?? null;
    if (status !== null && !STATUSES.includes(status)) throw new HttpError(400, "Davomat holati noto'g'ri");
    return { student_id: parseId(r.student_id), status };
  });
  await assertMyStudents(req.user.id, parsed.map((r) => r.student_id));

  await withTransaction(async (client) => {
    for (const r of parsed) {
      if (r.status === null) {
        await client.query(
          "DELETE FROM attendance WHERE teacher_id = $1 AND student_id = $2 AND date = $3",
          [req.user.id, r.student_id, date]
        );
      } else {
        await client.query(
          `INSERT INTO attendance (teacher_id, student_id, date, status) VALUES ($1, $2, $3, $4)
           ON CONFLICT (teacher_id, student_id, date) DO UPDATE SET status = EXCLUDED.status`,
          [req.user.id, r.student_id, date, r.status]
        );
      }
    }
  });

  res.json({ saved: parsed.length });
});

// Oylik hisobot: har bir o'quvchi bo'yicha kelgan / kechikkan / kelmagan kunlar
router.get("/report", async (req, res) => {
  const month = parseMonth(req.query.month);
  const { rows } = await pool.query(
    `SELECT u.id AS student_id, u.full_name, st.category,
            COUNT(a.id) FILTER (WHERE a.status = 'present')::int AS present,
            COUNT(a.id) FILTER (WHERE a.status = 'late')::int AS late,
            COUNT(a.id) FILTER (WHERE a.status = 'absent')::int AS absent
     FROM teacher_students ts
     JOIN students st ON st.user_id = ts.student_id
     JOIN users u ON u.id = st.user_id
     LEFT JOIN attendance a ON a.student_id = u.id AND a.teacher_id = ts.teacher_id
          AND a.date >= $2::date AND a.date < ($2::date + INTERVAL '1 month')
     WHERE ts.teacher_id = $1
     GROUP BY u.id, st.user_id
     ORDER BY u.full_name`,
    [req.user.id, month]
  );
  res.json(rows);
});

module.exports = router;
