const { BASE, FILES, TEST_PASSWORD, adminToken, pool } = require("./helpers");
// Teacher API smoke test. Backend papkasidan ishga tushiriladi (pg va .env uchun)

async function call(token, method, path, body, isForm) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(!isForm && body && { "Content-Type": "application/json" }), Authorization: `Bearer ${token}` },
    body: isForm ? body : body && JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, data };
}
const login = async (u, p) =>
  (await (await fetch(BASE + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, password: p }) })).json()).token;

function check(label, cond, extra = "") {
  console.log(`${cond ? "OK  " : "FAIL"} ${label} ${cond ? "" : extra}`);
  if (!cond) process.exitCode = 1;
}

(async () => {
  const admin = await adminToken();
  const created = [];
  const mk = async (path, body) => {
    const r = await call(admin, "POST", path, body);
    if (r.status !== 201) throw new Error(JSON.stringify(r.data));
    created.push(path.replace(/s$/, "s/") + r.data.id);
    return r.data;
  };

  try {
    const t1 = await mk("/admin/teachers", { full_name: "Test Teacher A", username: "tt_a", password: TEST_PASSWORD, subject: "Fizika" });
    const t2 = await mk("/admin/teachers", { full_name: "Test Teacher B", username: "tt_b", password: TEST_PASSWORD });
    const sVis = await mk("/admin/students", { full_name: "Test Ko'rish", username: "ts_vis", password: TEST_PASSWORD, category: "visual", teacher_ids: [t1.id] });
    const sGen = await mk("/admin/students", { full_name: "Test Umumiy", username: "ts_gen", password: TEST_PASSWORD, category: "general", teacher_ids: [t1.id] });
    const sOther = await mk("/admin/students", { full_name: "Test Boshqa", username: "ts_oth", password: TEST_PASSWORD, teacher_ids: [t2.id] });

    const A = await login("tt_a", TEST_PASSWORD);
    const B = await login("tt_b", TEST_PASSWORD);

    // Ruxsatlar
    check("admin token -> teacher API 403", (await call(admin, "GET", "/teacher/stats")).status === 403);

    // O'quvchilar
    const students = await call(A, "GET", "/teacher/students");
    check("my students = 2", students.data.length === 2, JSON.stringify(students.data));

    // Dars + fayl yuklash
    const form = new FormData();
    form.append("title", "Nyuton qonunlari");
    form.append("description", "Birinchi dars");
    form.append("content", "Jism tinch holatda...");
    form.append("category", "visual");
    form.append("file", new Blob(["audio-mock"], { type: "audio/mpeg" }), "dars-1 o'zbek.mp3");
    const lesson = await call(A, "POST", "/teacher/lessons", form, true);
    check("lesson create with file", lesson.status === 201 && lesson.data.file_url, JSON.stringify(lesson.data));
    check("utf8 file name kept", lesson.data.file_name === "dars-1 o'zbek.mp3", lesson.data.file_name);
    const fileRes = await fetch(FILES + lesson.data.file_url);
    check("uploaded file served", fileRes.status === 200 && (await fileRes.text()) === "audio-mock");

    const badForm = new FormData();
    badForm.append("title", "Yomon fayl");
    badForm.append("file", new Blob(["x"]), "virus.exe");
    const bad = await call(A, "POST", "/teacher/lessons", badForm, true);
    check("bad extension -> 400", bad.status === 400, JSON.stringify(bad.data));

    const shortTitle = new FormData();
    shortTitle.append("title", "ab");
    check("short title -> 400", (await call(A, "POST", "/teacher/lessons", shortTitle, true)).status === 400);

    // Boshqa o'qituvchi darsni ko'ra olmaydi
    check("other teacher lesson -> 404", (await call(B, "GET", `/teacher/lessons/${lesson.data.id}`)).status === 404);

    // Darsni tahrirlash: faylni olib tashlash
    const upd = new FormData();
    upd.append("title", "Nyuton qonunlari (yangilangan)");
    upd.append("category", "");
    upd.append("remove_file", "true");
    const updated = await call(A, "PUT", `/teacher/lessons/${lesson.data.id}`, upd, true);
    check("lesson update + remove file", updated.data.file_url === null && updated.data.category === null, JSON.stringify(updated.data));
    check("old file deleted", (await fetch(FILES + lesson.data.file_url)).status === 404);

    // Vazifa
    const asg = await call(A, "POST", `/teacher/lessons/${lesson.data.id}/assignments`, { title: "1-mashq", due_date: "2099-01-01" });
    check("assignment create", asg.status === 201);
    check("bad due_date -> 400", (await call(A, "POST", `/teacher/lessons/${lesson.data.id}/assignments`, { title: "abc", due_date: "tomorrow" })).status === 400);

    // O'quvchi topshirig'ini bazaga to'g'ridan-to'g'ri qo'shamiz (o'quvchi paneli hali yo'q)
    const { rows: sub } = await pool.query(
      "INSERT INTO submissions (assignment_id, student_id, answer_text) VALUES ($1, $2, 'Javobim') RETURNING id",
      [asg.data.id, sVis.id]
    );
    const subs = await call(A, "GET", `/teacher/assignments/${asg.data.id}/submissions`);
    check("submissions list: 2 students, 1 submitted", subs.data.submissions.length === 2 && subs.data.submissions.filter((s) => s.submission_id).length === 1, JSON.stringify(subs.data));

    const graded = await call(A, "PATCH", `/teacher/submissions/${sub[0].id}/grade`, { score: 5, feedback: "Zo'r" });
    check("grade submission", graded.data.score === 5 && graded.data.graded_at);
    check("grade 6 -> 400", (await call(A, "PATCH", `/teacher/submissions/${sub[0].id}/grade`, { score: 6 })).status === 400);
    check("other teacher grade -> 404", (await call(B, "PATCH", `/teacher/submissions/${sub[0].id}/grade`, { score: 3 })).status === 404);

    const detail = await call(A, "GET", `/teacher/lessons/${lesson.data.id}`);
    check("lesson detail counts", detail.data.assignments[0].submissions_count === 1 && detail.data.assignments[0].graded_count === 1);

    // Davomat
    const today = new Date().toLocaleDateString("sv-SE");
    const att = await call(A, "PUT", "/teacher/attendance", { date: today, records: [{ student_id: sVis.id, status: "present" }, { student_id: sGen.id, status: "late" }] });
    check("attendance save", att.status === 200, JSON.stringify(att.data));
    await call(A, "PUT", "/teacher/attendance", { date: today, records: [{ student_id: sGen.id, status: "absent" }] });
    const attList = await call(A, "GET", `/teacher/attendance?date=${today}`);
    check("attendance upsert", attList.data.find((r) => r.student_id === sGen.id).status === "absent");
    check("foreign student -> 403", (await call(A, "PUT", "/teacher/attendance", { date: today, records: [{ student_id: sOther.id, status: "present" }] })).status === 403);
    check("future date -> 400", (await call(A, "PUT", "/teacher/attendance", { date: "2099-01-01", records: [{ student_id: sVis.id, status: "present" }] })).status === 400);
    const report = await call(A, "GET", `/teacher/attendance/report?month=${today.slice(0, 7)}`);
    check("attendance report", report.data.find((r) => r.student_id === sGen.id).absent === 1, JSON.stringify(report.data));

    // Baholar
    const g = await call(A, "POST", "/teacher/grades", { student_id: sGen.id, score: 4, comment: "Yaxshi", lesson_id: lesson.data.id });
    check("grade create", g.status === 201);
    check("foreign student grade -> 403", (await call(A, "POST", "/teacher/grades", { student_id: sOther.id, score: 4 })).status === 403);
    const gu = await call(A, "PUT", `/teacher/grades/${g.data.id}`, { score: 3, comment: "O'rtacha" });
    check("grade update", gu.data.score === 3);
    const glist = await call(A, "GET", `/teacher/grades?month=${today.slice(0, 7)}`);
    check("grades list with lesson title", glist.data.length === 1 && glist.data[0].lesson_title, JSON.stringify(glist.data));
    const gsum = await call(A, "GET", "/teacher/grades/summary");
    check("grades summary", gsum.data.find((r) => r.student_id === sGen.id).avg_score === 3, JSON.stringify(gsum.data));

    const stats = await call(A, "GET", "/teacher/stats");
    check("stats", stats.data.students.total === 2 && stats.data.lessons === 1 && stats.data.attendance_marked_today === 2, JSON.stringify(stats.data));

    const studentsAfter = await call(A, "GET", "/teacher/students");
    check("students avg + attendance rate", studentsAfter.data.find((s) => s.id === sVis.id).attendance_rate === 100, JSON.stringify(studentsAfter.data));

    // Admin nazorat sahifasida faollik ko'rinadi
    const mon = await call(admin, "GET", "/admin/monitoring");
    const m = mon.data.find((r) => r.id === t1.id);
    check("admin monitoring sees activity", m.lessons_month === 1 && m.grades_month === 1 && m.last_activity, JSON.stringify(m));

    check("grade delete", (await call(A, "DELETE", `/teacher/grades/${g.data.id}`)).status === 204);
    check("lesson delete", (await call(A, "DELETE", `/teacher/lessons/${lesson.data.id}`)).status === 204);
  } finally {
    for (const path of created.reverse()) await call(admin, "DELETE", path);
    console.log("cleanup done");
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
