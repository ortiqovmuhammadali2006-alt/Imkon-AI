const { Router } = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../../config/db");
const { withTransaction } = require("../../config/db");
const { HttpError, validateUserFields, parseId } = require("../../utils/validation");
const { removeFile } = require("../../middleware/upload");

const router = Router();

const LIST_SQL = `
  SELECT u.id, u.full_name, u.username, u.phone, u.is_active, u.created_at,
         t.subject, t.monthly_salary,
         (SELECT COUNT(*) FROM teacher_students ts WHERE ts.teacher_id = u.id)::int AS students_count
  FROM users u
  JOIN teachers t ON t.user_id = u.id
`;

function parseTeacherFields(body) {
  const subject = (body.subject || "").trim() || null;
  const monthly_salary = Number(body.monthly_salary ?? 0);
  if (!Number.isFinite(monthly_salary) || monthly_salary < 0) {
    throw new HttpError(400, "Oylik summasi noto'g'ri");
  }
  return { subject, monthly_salary };
}

async function findTeacher(id) {
  const { rows } = await pool.query(`${LIST_SQL} WHERE u.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, "O'qituvchi topilmadi");
  return rows[0];
}

router.get("/", async (req, res) => {
  const { rows } = await pool.query(`${LIST_SQL} ORDER BY u.created_at DESC`);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const user = validateUserFields(req.body, { requirePassword: true });
  const teacher = parseTeacherFields(req.body);
  const hash = await bcrypt.hash(user.password, 10);

  const id = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO users (full_name, username, password_hash, role, phone)
       VALUES ($1, $2, $3, 'teacher', $4) RETURNING id`,
      [user.full_name, user.username, hash, user.phone]
    );
    await client.query(
      "INSERT INTO teachers (user_id, subject, monthly_salary) VALUES ($1, $2, $3)",
      [rows[0].id, teacher.subject, teacher.monthly_salary]
    );
    return rows[0].id;
  });

  res.status(201).json(await findTeacher(id));
});

router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  await findTeacher(id);
  const user = validateUserFields(req.body, { requirePassword: false });
  const teacher = parseTeacherFields(req.body);

  await withTransaction(async (client) => {
    await client.query(
      "UPDATE users SET full_name = $1, username = $2, phone = $3 WHERE id = $4",
      [user.full_name, user.username, user.phone, id]
    );
    if (user.password) {
      const hash = await bcrypt.hash(user.password, 10);
      await client.query("UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2", [hash, id]);
    }
    await client.query(
      "UPDATE teachers SET subject = $1, monthly_salary = $2 WHERE user_id = $3",
      [teacher.subject, teacher.monthly_salary, id]
    );
  });

  res.json(await findTeacher(id));
});

router.patch("/:id/status", async (req, res) => {
  const id = parseId(req.params.id);
  await findTeacher(id);
  await pool.query("UPDATE users SET is_active = $1 WHERE id = $2", [Boolean(req.body.is_active), id]);
  res.json(await findTeacher(id));
});

router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  await findTeacher(id);
  // Dars materiallari va ularga topshirilgan ishlar fayllari ham o'chadi
  const { rows: files } = await pool.query(
    `SELECT file_url FROM lessons WHERE teacher_id = $1 AND file_url IS NOT NULL
     UNION ALL
     SELECT subtitle_url FROM lessons WHERE teacher_id = $1 AND subtitle_url IS NOT NULL
     UNION ALL
     SELECT a11y->>'auto_subtitle_url' FROM lessons WHERE teacher_id = $1 AND a11y ? 'auto_subtitle_url'
     UNION ALL
     SELECT s.file_url FROM submissions s JOIN assignments a ON a.id = s.assignment_id
       JOIN lessons l ON l.id = a.lesson_id
     WHERE l.teacher_id = $1 AND s.file_url IS NOT NULL
     UNION ALL
     SELECT a.file_url FROM assignments a JOIN lessons l ON l.id = a.lesson_id WHERE l.teacher_id = $1 AND a.file_url IS NOT NULL
     UNION ALL
     SELECT avatar_url FROM users WHERE id = $1 AND avatar_url IS NOT NULL`,
    [id]
  );
  await pool.query("DELETE FROM users WHERE id = $1", [id]);
  files.forEach((f) => removeFile(f.file_url));
  res.status(204).end();
});

module.exports = router;
