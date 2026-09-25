const pool = require("../../config/db");
const { HttpError } = require("../../utils/validation");

// O'quvchilar shu o'qituvchiga biriktirilganini tekshiradi
async function assertMyStudents(teacherId, studentIds) {
  const ids = [...new Set(studentIds)];
  if (ids.length === 0) return;
  const { rowCount } = await pool.query(
    "SELECT 1 FROM teacher_students WHERE teacher_id = $1 AND student_id = ANY($2)",
    [teacherId, ids]
  );
  if (rowCount !== ids.length) throw new HttpError(403, "Bu o'quvchi sizga biriktirilmagan");
}

// Dars shu o'qituvchiniki ekanini tekshirib, darsni qaytaradi
async function getMyLesson(teacherId, lessonId) {
  const { rows } = await pool.query("SELECT * FROM lessons WHERE id = $1 AND teacher_id = $2", [
    lessonId,
    teacherId,
  ]);
  if (!rows[0]) throw new HttpError(404, "Dars topilmadi");
  return rows[0];
}

// Vazifa shu o'qituvchining darsiga tegishli ekanini tekshiradi
async function getMyAssignment(teacherId, assignmentId) {
  const { rows } = await pool.query(
    `SELECT a.*, l.category AS lesson_category, l.title AS lesson_title
     FROM assignments a JOIN lessons l ON l.id = a.lesson_id
     WHERE a.id = $1 AND l.teacher_id = $2`,
    [assignmentId, teacherId]
  );
  if (!rows[0]) throw new HttpError(404, "Vazifa topilmadi");
  return rows[0];
}

module.exports = { assertMyStudents, getMyLesson, getMyAssignment };
