const pool = require("../config/db");
const { HttpError, parseId } = require("../utils/validation");

// Jadval so'rovlari admin, o'qituvchi (va keyinchalik o'quvchi) uchun umumiy
const SELECT_SQL = `
  SELECT sc.id, sc.teacher_id, u.full_name AS teacher_name, sc.day_of_week,
         sc.start_time, sc.end_time,
         COALESCE(sc.subject, t.subject) AS subject,
         sc.room, sc.group_name
  FROM schedule sc
  JOIN teachers t ON t.user_id = sc.teacher_id
  JOIN users u ON u.id = sc.teacher_id
`;
const ORDER_SQL = "ORDER BY sc.day_of_week, sc.start_time";

function parseTime(value, label) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || "")) {
    throw new HttpError(400, `${label} HH:MM formatida bo'lishi kerak`);
  }
  return value;
}

function parseScheduleFields(body) {
  const day_of_week = Number(body.day_of_week);
  if (!Number.isInteger(day_of_week) || day_of_week < 1 || day_of_week > 7) {
    throw new HttpError(400, "Hafta kuni noto'g'ri");
  }
  const start_time = parseTime(body.start_time, "Boshlanish vaqti");
  const end_time = parseTime(body.end_time, "Tugash vaqti");
  if (end_time <= start_time) throw new HttpError(400, "Tugash vaqti boshlanishdan keyin bo'lishi kerak");

  const text = (v) => (v || "").trim() || null;
  return {
    teacher_id: parseId(body.teacher_id),
    day_of_week,
    start_time,
    end_time,
    subject: text(body.subject),
    room: text(body.room),
    group_name: text(body.group_name),
  };
}

// O'qituvchining shu kunda vaqti ustma-ust tushadigan boshqa darsi bormi
async function assertNoOverlap(fields, excludeId = null) {
  const { rows } = await pool.query(
    `SELECT start_time, end_time FROM schedule
     WHERE teacher_id = $1 AND day_of_week = $2
       AND start_time < $4 AND end_time > $3
       AND ($5::int IS NULL OR id <> $5)
     LIMIT 1`,
    [fields.teacher_id, fields.day_of_week, fields.start_time, fields.end_time, excludeId]
  );
  if (rows[0]) {
    throw new HttpError(
      409,
      `Bu o'qituvchining shu kuni ${rows[0].start_time}–${rows[0].end_time} da boshqa darsi bor`
    );
  }
}

async function findSlot(id) {
  const { rows } = await pool.query(`${SELECT_SQL} WHERE sc.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, "Jadvaldagi dars topilmadi");
  return rows[0];
}

module.exports = { SELECT_SQL, ORDER_SQL, parseScheduleFields, assertNoOverlap, findSlot };
