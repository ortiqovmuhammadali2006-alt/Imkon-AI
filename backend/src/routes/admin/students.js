const { Router } = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../../config/db");
const { withTransaction } = require("../../config/db");
const { CATEGORIES, HttpError, validateUserFields, parseId } = require("../../utils/validation");
const { removeFile } = require("../../middleware/upload");

const router = Router();

const LIST_SQL = `
  SELECT u.id, u.full_name, u.username, u.phone, u.is_active, u.created_at,
         s.category, s.grade, s.birth_date,
         COALESCE(
           json_agg(json_build_object('id', tu.id, 'full_name', tu.full_name) ORDER BY tu.full_name)
             FILTER (WHERE tu.id IS NOT NULL),
           '[]'
         ) AS teachers
  FROM users u
  JOIN students s ON s.user_id = u.id
  LEFT JOIN teacher_students ts ON ts.student_id = u.id
  LEFT JOIN users tu ON tu.id = ts.teacher_id
`;
const GROUP_SQL = "GROUP BY u.id, s.user_id";

function parseStudentFields(body) {
  const category = body.category || "general";
  if (!CATEGORIES.includes(category)) throw new HttpError(400, "Toifa noto'g'ri");

  const grade = (body.grade || "").trim() || null;
  const birth_date = body.birth_date || null;
  if (birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
    throw new HttpError(400, "Tug'ilgan sana noto'g'ri");
  }

  const teacher_ids = Array.isArray(body.teacher_ids) ? body.teacher_ids.map(parseId) : [];
  return { category, grade, birth_date, teacher_ids: [...new Set(teacher_ids)] };
}

async function findStudent(id) {
  const { rows } = await pool.query(`${LIST_SQL} WHERE u.id = $1 ${GROUP_SQL}`, [id]);
  if (!rows[0]) throw new HttpError(404, "O'quvchi topilmadi");
  return rows[0];
}

async function setTeachers(client, studentId, teacherIds) {
  await client.query("DELETE FROM teacher_students WHERE student_id = $1", [studentId]);
  if (teacherIds.length === 0) return;

  const { rowCount } = await client.query("SELECT 1 FROM teachers WHERE user_id = ANY($1)", [
    teacherIds,
  ]);
  if (rowCount !== teacherIds.length) throw new HttpError(400, "Tanlangan o'qituvchi topilmadi");

  await client.query(
    `INSERT INTO teacher_students (teacher_id, student_id)
     SELECT UNNEST($1::int[]), $2`,
    [teacherIds, studentId]
  );
}

router.get("/", async (req, res) => {
  const { rows } = await pool.query(`${LIST_SQL} ${GROUP_SQL} ORDER BY u.created_at DESC`);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const user = validateUserFields(req.body, { requirePassword: true });
  const student = parseStudentFields(req.body);
  const hash = await bcrypt.hash(user.password, 10);

  const id = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO users (full_name, username, password_hash, role, phone)
       VALUES ($1, $2, $3, 'student', $4) RETURNING id`,
      [user.full_name, user.username, hash, user.phone]
    );
    const id = rows[0].id;
    await client.query(
      "INSERT INTO students (user_id, category, grade, birth_date) VALUES ($1, $2, $3, $4)",
      [id, student.category, student.grade, student.birth_date]
    );
    await setTeachers(client, id, student.teacher_ids);
    return id;
  });

  res.status(201).json(await findStudent(id));
});

router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  await findStudent(id);
  const user = validateUserFields(req.body, { requirePassword: false });
  const student = parseStudentFields(req.body);

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
      "UPDATE students SET category = $1, grade = $2, birth_date = $3 WHERE user_id = $4",
      [student.category, student.grade, student.birth_date, id]
    );
    await setTeachers(client, id, student.teacher_ids);
  });

  res.json(await findStudent(id));
});

router.patch("/:id/status", async (req, res) => {
  const id = parseId(req.params.id);
  await findStudent(id);
  await pool.query("UPDATE users SET is_active = $1 WHERE id = $2", [Boolean(req.body.is_active), id]);
  res.json(await findStudent(id));
});

router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  await findStudent(id);
  const { rows: files } = await pool.query(
    `SELECT file_url FROM submissions WHERE student_id = $1 AND file_url IS NOT NULL
     UNION ALL
     SELECT avatar_url FROM users WHERE id = $1 AND avatar_url IS NOT NULL`,
    [id]
  );
  await pool.query("DELETE FROM users WHERE id = $1", [id]);
  files.forEach((f) => removeFile(f.file_url));
  res.status(204).end();
});

module.exports = router;
