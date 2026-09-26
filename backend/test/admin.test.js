const { BASE, FILES, TEST_PASSWORD, adminToken, pool } = require("./helpers");
// Admin API smoke test: yaratadi, tekshiradi va o'chirib tozalaydi
let token;

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json();
  return { status: res.status, data };
}

function check(label, cond, extra = "") {
  console.log(`${cond ? "OK  " : "FAIL"} ${label} ${extra}`);
  if (!cond) process.exitCode = 1;
}

(async () => {
  token = await adminToken();
  check("admin token", Boolean(token));

  const month = new Date().toISOString().slice(0, 7);
  const t = await call("POST", "/admin/teachers", {
    full_name: "Test O'qituvchi", username: "test_teacher_x", password: TEST_PASSWORD,
    subject: "Matematika", monthly_salary: 5000000,
  });
  check("teacher create", t.status === 201, JSON.stringify(t.data));
  const dup = await call("POST", "/admin/teachers", {
    full_name: "Dup", username: "test_teacher_x", password: TEST_PASSWORD,
  });
  check("duplicate username -> 409", dup.status === 409, dup.data?.message);
  const bad = await call("POST", "/admin/teachers", { full_name: "A", username: "x", password: "1" });
  check("validation -> 400", bad.status === 400, bad.data?.message);

  const s = await call("POST", "/admin/students", {
    full_name: "Test O'quvchi", username: "test_student_x", password: TEST_PASSWORD,
    category: "visual", grade: "5-A", birth_date: "2014-03-15", teacher_ids: [t.data.id],
  });
  check("student create + teacher link", s.status === 201 && s.data.teachers.length === 1, JSON.stringify(s.data));
  check("birth_date string", s.data.birth_date === "2014-03-15", s.data.birth_date);

  const upd = await call("PUT", `/admin/students/${s.data.id}`, {
    full_name: "Test O'quvchi 2", username: "test_student_x", category: "hearing", teacher_ids: [],
  });
  check("student update", upd.status === 200 && upd.data.category === "hearing" && upd.data.teachers.length === 0);

  const st = await call("PATCH", `/admin/teachers/${t.data.id}/status`, { is_active: false });
  check("teacher block", st.data.is_active === false);
  const blockedLogin = await call("POST", "/auth/login", { username: "test_teacher_x", password: TEST_PASSWORD });
  check("blocked teacher cannot login", blockedLogin.status === 403, blockedLogin.data?.message);
  await call("PATCH", `/admin/teachers/${t.data.id}/status`, { is_active: true });

  const pay = await call("POST", "/admin/salaries/payments", { teacher_id: t.data.id, amount: 2000000, month });
  check("salary payment", pay.status === 201);
  const sal = await call("GET", `/admin/salaries?month=${month}`);
  const row = sal.data.find((r) => r.id === t.data.id);
  check("salary summary", row && row.paid === 2000000 && row.monthly_salary === 5000000, JSON.stringify(row));

  const stats = await call("GET", "/admin/stats");
  check("stats", stats.status === 200 && stats.data.students.by_category, JSON.stringify(stats.data));
  const mon = await call("GET", "/admin/monitoring");
  check("monitoring list", mon.status === 200 && Array.isArray(mon.data));
  const monD = await call("GET", `/admin/monitoring/${t.data.id}`);
  check("monitoring detail", monD.status === 200 && monD.data.attendance, JSON.stringify(monD.data));

  // Teacher token bilan admin API ga kirish mumkin emas
  const tl = await call("POST", "/auth/login", { username: "test_teacher_x", password: TEST_PASSWORD });
  const adminTok = token; token = tl.data.token;
  const forbidden = await call("GET", "/admin/stats");
  check("teacher -> admin API 403", forbidden.status === 403);
  token = adminTok;

  // Tozalash
  await call("DELETE", `/admin/salaries/payments/${pay.data.id}`);
  const d1 = await call("DELETE", `/admin/students/${s.data.id}`);
  const d2 = await call("DELETE", `/admin/teachers/${t.data.id}`);
  check("cleanup", d1.status === 204 && d2.status === 204);
})()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
