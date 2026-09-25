const { Router } = require("express");
const pool = require("../../config/db");
const { HttpError, parseId } = require("../../utils/validation");
const {
  SELECT_SQL,
  ORDER_SQL,
  parseScheduleFields,
  assertNoOverlap,
  findSlot,
} = require("../schedule");

const router = Router();

async function assertTeacher(id) {
  const { rowCount } = await pool.query("SELECT 1 FROM teachers WHERE user_id = $1", [id]);
  if (rowCount === 0) throw new HttpError(404, "O'qituvchi topilmadi");
}

// Butun jadval yoki ?teacher_id= bo'yicha
router.get("/", async (req, res) => {
  const params = [];
  let where = "";
  if (req.query.teacher_id) {
    params.push(parseId(req.query.teacher_id));
    where = "WHERE sc.teacher_id = $1";
  }
  const { rows } = await pool.query(`${SELECT_SQL} ${where} ${ORDER_SQL}`, params);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const fields = parseScheduleFields(req.body || {});
  await assertTeacher(fields.teacher_id);
  await assertNoOverlap(fields);
  const { rows } = await pool.query(
    `INSERT INTO schedule (teacher_id, day_of_week, start_time, end_time, subject, room, group_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [fields.teacher_id, fields.day_of_week, fields.start_time, fields.end_time, fields.subject, fields.room, fields.group_name]
  );
  res.status(201).json(await findSlot(rows[0].id));
});

router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  await findSlot(id);
  const fields = parseScheduleFields(req.body || {});
  await assertTeacher(fields.teacher_id);
  await assertNoOverlap(fields, id);
  await pool.query(
    `UPDATE schedule SET teacher_id = $1, day_of_week = $2, start_time = $3, end_time = $4,
            subject = $5, room = $6, group_name = $7
     WHERE id = $8`,
    [fields.teacher_id, fields.day_of_week, fields.start_time, fields.end_time, fields.subject, fields.room, fields.group_name, id]
  );
  res.json(await findSlot(id));
});

router.delete("/:id", async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM schedule WHERE id = $1", [parseId(req.params.id)]);
  if (rowCount === 0) throw new HttpError(404, "Jadvaldagi dars topilmadi");
  res.status(204).end();
});

module.exports = router;
