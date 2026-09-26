const { BASE, FILES, TEST_PASSWORD, adminToken, pool } = require("./helpers");
async function call(token, method, path, body, isForm) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(!isForm && body && { "Content-Type": "application/json" }), Authorization: `Bearer ${token}` },
    body: isForm ? body : body && JSON.stringify(body),
  });
  return { status: res.status, data: res.status === 204 ? null : await res.json().catch(() => null) };
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
    created.push(`${path}/${r.data.id}`);
    return r.data;
  };
  try {
    const t = await mk("/admin/teachers", { full_name: "St Teacher", username: "st_t", password: TEST_PASSWORD, subject: "Tarix" });
    const t2 = await mk("/admin/teachers", { full_name: "Other Teacher", username: "st_t2", password: TEST_PASSWORD });
    const s = await mk("/admin/students", { full_name: "St Vis", username: "st_s", password: TEST_PASSWORD, category: "visual", grade: "5-A", teacher_ids: [t.id] });
    await call(admin, "POST", "/admin/schedule", { teacher_id: t.id, day_of_week: 1, start_time: "08:00", end_time: "08:45", group_name: "5-a" });
    await call(admin, "POST", "/admin/schedule", { teacher_id: t.id, day_of_week: 2, start_time: "08:00", end_time: "08:45", group_name: "6-B" });
    await call(admin, "POST", "/admin/schedule", { teacher_id: t.id, day_of_week: 3, start_time: "08:00", end_time: "08:45" });
    await call(admin, "POST", "/admin/schedule", { teacher_id: t2.id, day_of_week: 1, start_time: "10:00", end_time: "10:45" });

    const T = await login("st_t", TEST_PASSWORD);
    const T2 = await login("st_t2", TEST_PASSWORD);
    const mkLesson = async (tok, title, category) => {
      const f = new FormData(); f.append("title", title); f.append("category", category); f.append("content", "Amir Temur 1336-yilda tug'ilgan.");
      return (await call(tok, "POST", "/teacher/lessons", f, true)).data;
    };
    const lAll = await mkLesson(T, "Umumiy dars", "");
    const lVis = await mkLesson(T, "Ko'rish uchun dars", "visual");
    const lHear = await mkLesson(T, "Eshitish uchun dars", "hearing");
    const lOther = await mkLesson(T2, "Boshqa o'qituvchi", "");
    const a1 = (await call(T, "POST", `/teacher/lessons/${lVis.id}/assignments`, { title: "Insho yozing", due_date: "2099-01-01" })).data;
    const aHear = (await call(T, "POST", `/teacher/lessons/${lHear.id}/assignments`, { title: "Yashirin vazifa" })).data;

    const S = await login("st_s", TEST_PASSWORD);
    check("teacher token -> student API 403", (await call(T, "GET", "/student/lessons")).status === 403);

    const profile = await call(S, "GET", "/student/profile");
    check("profile", profile.data.category === "visual" && profile.data.teachers.length === 1, JSON.stringify(profile.data));

    const sched = await call(S, "GET", "/student/schedule");
    check("schedule: own group (case-insensitive) + no-group, not other group/teacher", sched.data.length === 2 && sched.data.every((x) => x.teacher_id === t.id && x.day_of_week !== 2), JSON.stringify(sched.data));

    const lessons = await call(S, "GET", "/student/lessons");
    const ids = lessons.data.map((l) => l.id);
    check("lessons: all + visual only", ids.length === 2 && ids.includes(lAll.id) && ids.includes(lVis.id), JSON.stringify(ids));
    check("hearing lesson hidden -> 404", (await call(S, "GET", `/student/lessons/${lHear.id}`)).status === 404);
    check("other teacher lesson hidden -> 404", (await call(S, "GET", `/student/lessons/${lOther.id}`)).status === 404);
    const detail = await call(S, "GET", `/student/lessons/${lVis.id}`);
    check("lesson detail with assignments", detail.data.content && detail.data.assignments.length === 1 && detail.data.subject === "Tarix", JSON.stringify(detail.data));

    const hasKey = !!process.env.OPENAI_API_KEY;
    const ai = await call(S, "POST", `/student/lessons/${lVis.id}/explain`, { messages: [] });
    check("AI unavailable -> clear 503 (no key / no credits) or 200", ai.status === 200 || (ai.status === 503 && /OPENAI|mablag/.test(ai.data.message)), JSON.stringify(ai.data));
    check("AI bad messages -> 400", (await call(S, "POST", `/student/lessons/${lVis.id}/explain`, { messages: [{ role: "system", content: "x" }] })).status === 400);
    check("AI on hidden lesson -> 404", (await call(S, "POST", `/student/lessons/${lHear.id}/explain`, { messages: [] })).status === 404);
    check("tts empty -> 400", (await call(S, "POST", "/tts", { text: " " })).status === 400);

    const stats1 = await call(S, "GET", "/student/stats");
    check("stats pending = 1", stats1.data.pending_assignments === 1, JSON.stringify(stats1.data));

    const empty = new FormData();
    check("empty submit -> 400", (await call(S, "POST", `/student/assignments/${a1.id}/submit`, empty, true)).status === 400);
    check("hidden assignment submit -> 404", (await call(S, "POST", `/student/assignments/${aHear.id}/submit`, (() => { const f = new FormData(); f.append("answer_text", "x"); return f; })(), true)).status === 404);

    const f1 = new FormData(); f1.append("answer_text", "Mening inshom"); f1.append("file", new Blob(["essay"]), "insho.txt");
    const sub1 = await call(S, "POST", `/student/assignments/${a1.id}/submit`, f1, true);
    check("submit with file -> 201", sub1.status === 201 && sub1.data.file_name === "insho.txt", JSON.stringify(sub1.data));
    const f2 = new FormData(); f2.append("answer_text", "Tuzatilgan insho");
    const sub2 = await call(S, "POST", `/student/assignments/${a1.id}/submit`, f2, true);
    check("resubmit keeps file -> 200", sub2.status === 200 && sub2.data.file_url === sub1.data.file_url && sub2.data.answer_text === "Tuzatilgan insho");

    const list = await call(S, "GET", "/student/assignments");
    check("assignments list only accessible", list.data.length === 1 && list.data[0].submission_id, JSON.stringify(list.data));

    // O'qituvchi baholaydi va baho qo'yadi, davomat belgilaydi
    await call(T, "PATCH", `/teacher/submissions/${sub1.data.id}/grade`, { score: 5, feedback: "A'lo" });
    await call(T, "POST", "/teacher/grades", { student_id: s.id, score: 4, lesson_id: lAll.id });
    await call(T, "PUT", "/teacher/attendance", { date: new Date().toLocaleDateString("sv-SE"), records: [{ student_id: s.id, status: "present" }] });

    const f3 = new FormData(); f3.append("answer_text", "Yana");
    check("resubmit after grading -> 400", (await call(S, "POST", `/student/assignments/${a1.id}/submit`, f3, true)).status === 400);

    const grades = await call(S, "GET", "/student/grades");
    check("grades page removed for student (404)", grades.status === 404);
    const att = await call(S, "GET", "/student/attendance");
    check("attendance hidden from student (404)", att.status === 404);
    const stats2 = await call(S, "GET", "/student/stats");
    check("stats: only pending (no avg/attendance), pending 0", !("avg_score" in stats2.data) && !("attendance_rate" in stats2.data) && stats2.data.pending_assignments === 0, JSON.stringify(stats2.data));
  } finally {
    for (const p of created.reverse()) await call(admin, "DELETE", p);
    console.log("cleanup done");
  }
})()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
