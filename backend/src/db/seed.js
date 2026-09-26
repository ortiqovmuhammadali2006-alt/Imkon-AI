// Namoyish (demo) ma'lumotlari: 2 o'qituvchi, har bir toifadan o'quvchi, darslar, vazifalar, jadval, baho va davomat.
// Qayta ishga tushirsa takrorlamaydi (demo_ bilan boshlanuvchi loginlar mavjud bo'lsa — o'tkazib yuboradi).
//   npm run seed                 — parol tasodifiy yaratiladi va ekranga chiqariladi
//   SEED_PASSWORD=... npm run seed — o'z parolingiz bilan (kamida 8 belgi)
//   npm run seed -- --reset      — oldingi demo ma'lumotlarni o'chirib, qaytadan yaratadi
require("dotenv").config({ quiet: true });
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");

const RESET = process.argv.includes("--reset");
const PASSWORD = process.env.SEED_PASSWORD || `Demo-${crypto.randomBytes(4).toString("hex")}`;

const TEACHERS = [
  { username: "demo_matematika", full_name: "Dilnoza Karimova", subject: "Matematika", salary: 6000000 },
  { username: "demo_ona_tili", full_name: "Jasur Rahimov", subject: "Ona tili", salary: 5500000 },
];

const STUDENTS = [
  { username: "demo_umumiy", full_name: "Aziz Tursunov", category: "general", birth: "2015-04-12" },
  { username: "demo_korish", full_name: "Madina Yusupova", category: "visual", birth: "2015-09-03" },
  { username: "demo_eshitish", full_name: "Sardor Aliyev", category: "hearing", birth: "2014-12-21" },
  { username: "demo_harakat", full_name: "Nigora Qodirova", category: "physical", birth: "2015-06-30" },
];

// [o'qituvchi indeksi, mavzu, tavsif, dars matni]
const LESSONS = [
  [0, "Ikki xonali sonlarni qo'shish", "Xonalab qo'shish usuli",
    "Ikki xonali sonlarni qo'shishda avval birliklarni, keyin o'nliklarni qo'shamiz.\n25 + 34: birliklar 5 + 4 = 9, o'nliklar 2 + 3 = 5. Javob: 59.\nAgar birliklar yig'indisi 10 dan oshsa, bitta o'nlik keyingi xonaga o'tadi: 38 + 27 = 65."],
  [0, "Arifmetik amallar tartibi", "Qavs, ko'paytirish va qo'shish tartibi",
    "Misolda bir nechta amal bo'lsa, avval qavs ichidagi amal bajariladi.\nKeyin ko'paytirish va bo'lish, eng oxirida qo'shish va ayirish.\nMasalan: 5 + 2 × 3 = 5 + 6 = 11. (5 + 2) × 3 = 7 × 3 = 21."],
  [1, "Ot so'z turkumi", "Ot nima va u qanday so'roqlarga javob beradi",
    "Ot — shaxs, narsa, joy yoki hodisaning nomini bildiradigan so'z.\nOt kim? nima? qayer? so'roqlariga javob beradi.\nMasalan: o'quvchi (kim?), kitob (nima?), maktab (qayer?).\nAtoqli otlar bosh harf bilan yoziladi: Toshkent, Madina."],
  [1, "Gap va uning turlari", "Darak, so'roq va undov gaplar",
    "Gap tugallangan fikrni bildiradi.\nDarak gap biror narsa haqida xabar beradi va nuqta bilan tugaydi: Bugun havo iliq.\nSo'roq gap savolni bildiradi va so'roq belgisi bilan tugaydi: Darsga tayyormisan?\nUndov gap kuchli his-tuyg'uni bildiradi va undov belgisi bilan tugaydi: Qanday go'zal!"],
];

// [dars indeksi, nomi, topshiriq matni]
const ASSIGNMENTS = [
  [0, "Qo'shishga misollar", "Quyidagilarni xonalab qo'shing va yechimni yozing: 23 + 45, 37 + 26, 48 + 19."],
  [1, "Amallar tartibi", "Yechimni bosqichma-bosqich yozing: 4 + 3 × 2, (8 − 3) × 2, 20 : (2 + 3)."],
  [2, "Otlarni toping", "Gapdagi otlarni ajrating: Madina kutubxonadan kitob oldi."],
];

// [o'qituvchi indeksi, hafta kuni, boshlanish, tugash, xona]
const SCHEDULE = [
  [0, 1, "08:30", "09:15", "12"], [0, 3, "08:30", "09:15", "12"], [0, 5, "09:30", "10:15", "12"],
  [1, 2, "08:30", "09:15", "7"], [1, 4, "09:30", "10:15", "7"],
];

async function reset(client) {
  const { rows } = await client.query("SELECT id FROM users WHERE username LIKE 'demo\\_%'");
  if (!rows.length) return;
  await client.query("DELETE FROM users WHERE username LIKE 'demo\\_%'"); // bog'liq ma'lumotlar CASCADE bilan o'chadi
  console.log(`Oldingi demo ma'lumotlar o'chirildi (${rows.length} ta foydalanuvchi)`);
}

async function run() {
  if (PASSWORD.length < 8) throw new Error("SEED_PASSWORD kamida 8 belgi bo'lsin");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (RESET) await reset(client);
    const exists = await client.query("SELECT 1 FROM users WHERE username LIKE 'demo\\_%' LIMIT 1");
    if (exists.rowCount) {
      console.log("Demo ma'lumotlar allaqachon bor. Qayta yaratish: npm run seed -- --reset");
      await client.query("ROLLBACK");
      return;
    }
    const hash = await bcrypt.hash(PASSWORD, 10);

    const teacherIds = [];
    for (const t of TEACHERS) {
      const { rows } = await client.query(
        "INSERT INTO users (full_name, username, password_hash, role) VALUES ($1, $2, $3, 'teacher') RETURNING id",
        [t.full_name, t.username, hash]
      );
      await client.query("INSERT INTO teachers (user_id, subject, monthly_salary) VALUES ($1, $2, $3)", [rows[0].id, t.subject, t.salary]);
      teacherIds.push(rows[0].id);
    }

    const studentIds = [];
    for (const s of STUDENTS) {
      const { rows } = await client.query(
        "INSERT INTO users (full_name, username, password_hash, role) VALUES ($1, $2, $3, 'student') RETURNING id",
        [s.full_name, s.username, hash]
      );
      await client.query("INSERT INTO students (user_id, category, grade, birth_date) VALUES ($1, $2, '3-A', $3)", [rows[0].id, s.category, s.birth]);
      for (const tid of teacherIds) await client.query("INSERT INTO teacher_students (teacher_id, student_id) VALUES ($1, $2)", [tid, rows[0].id]);
      studentIds.push(rows[0].id);
    }

    const lessonIds = [];
    for (const [ti, title, description, content] of LESSONS) {
      // Qulaylik to'plami (sodda bayon, misollar, test) server ishga tushganda avtomatik tayyorlanadi (OpenAI kerak)
      const { rows } = await client.query(
        `INSERT INTO lessons (teacher_id, title, description, content, a11y) VALUES ($1, $2, $3, $4, '{"status":"pending"}') RETURNING id`,
        [teacherIds[ti], title, description, content]
      );
      lessonIds.push(rows[0].id);
    }

    const assignmentIds = [];
    for (const [li, title, description] of ASSIGNMENTS) {
      const { rows } = await client.query(
        "INSERT INTO assignments (lesson_id, title, description, due_date) VALUES ($1, $2, $3, CURRENT_DATE + 7) RETURNING id",
        [lessonIds[li], title, description]
      );
      assignmentIds.push(rows[0].id);
    }

    // Bitta topshirilgan va baholangan ish — o'qituvchi paneli bo'sh ko'rinmasin
    await client.query(
      "INSERT INTO submissions (assignment_id, student_id, answer_text, score, feedback, graded_at) VALUES ($1, $2, $3, 5, $4, NOW())",
      [assignmentIds[0], studentIds[0], "23 + 45 = 68, 37 + 26 = 63, 48 + 19 = 67", "Barakalla, hammasi to'g'ri!"]
    );

    for (const [ti, day, start, end, room] of SCHEDULE) {
      await client.query(
        "INSERT INTO schedule (teacher_id, day_of_week, start_time, end_time, subject, room, group_name) VALUES ($1, $2, $3, $4, $5, $6, '3-A')",
        [teacherIds[ti], day, start, end, TEACHERS[ti].subject, room]
      );
    }

    for (const [i, sid] of studentIds.entries()) {
      await client.query("INSERT INTO grades (teacher_id, student_id, lesson_id, score, comment) VALUES ($1, $2, $3, $4, $5)", [
        teacherIds[0], sid, lessonIds[0], [5, 4, 5, 4][i], "Darsda faol qatnashdi",
      ]);
      await client.query("INSERT INTO attendance (teacher_id, student_id, date, status) VALUES ($1, $2, CURRENT_DATE, $3)", [
        teacherIds[0], sid, i === 3 ? "late" : "present",
      ]);
    }

    await client.query("COMMIT");
    console.log("\nDemo ma'lumotlar yaratildi:");
    console.log(`  O'qituvchilar: ${TEACHERS.map((t) => t.username).join(", ")}`);
    console.log(`  O'quvchilar:   ${STUDENTS.map((s) => `${s.username} (${s.category})`).join(", ")}`);
    console.log(`  Parol (hammasi uchun): ${PASSWORD}`);
    console.log("  Darslarning sodda to'plami backend ishga tushganda avtomatik tayyorlanadi (OPENAI_API_KEY kerak).\n");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Seed xatosi:", err.message);
  process.exit(1);
});
