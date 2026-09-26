const { BASE, FILES, TEST_PASSWORD, adminToken, pool } = require("./helpers");
async function call(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body && JSON.stringify(body),
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
  const t = (await call(admin, "POST", "/admin/teachers", { full_name: "Jadval Test", username: "sch_t", password: TEST_PASSWORD, subject: "Kimyo" })).data;
  try {
    const s1 = await call(admin, "POST", "/admin/schedule", { teacher_id: t.id, day_of_week: 1, start_time: "08:30", end_time: "09:15", room: "12", group_name: "5-A" });
    check("create slot", s1.status === 201 && s1.data.start_time === "08:30" && s1.data.subject === "Kimyo", JSON.stringify(s1.data));
    const overlap = await call(admin, "POST", "/admin/schedule", { teacher_id: t.id, day_of_week: 1, start_time: "09:00", end_time: "09:45" });
    check("overlap -> 409", overlap.status === 409, JSON.stringify(overlap.data));
    const adjacent = await call(admin, "POST", "/admin/schedule", { teacher_id: t.id, day_of_week: 1, start_time: "09:15", end_time: "10:00", subject: "Biologiya" });
    check("adjacent slot ok", adjacent.status === 201 && adjacent.data.subject === "Biologiya", JSON.stringify(adjacent.data));
    check("end before start -> 400", (await call(admin, "POST", "/admin/schedule", { teacher_id: t.id, day_of_week: 2, start_time: "10:00", end_time: "09:00" })).status === 400);
    check("bad day -> 400", (await call(admin, "POST", "/admin/schedule", { teacher_id: t.id, day_of_week: 8, start_time: "10:00", end_time: "11:00" })).status === 400);
    const upd = await call(admin, "PUT", `/admin/schedule/${s1.data.id}`, { teacher_id: t.id, day_of_week: 1, start_time: "08:00", end_time: "08:45", room: "14" });
    check("update (self not overlap)", upd.status === 200 && upd.data.room === "14", JSON.stringify(upd.data));
    const list = await call(admin, "GET", `/admin/schedule?teacher_id=${t.id}`);
    check("admin list sorted", list.data.length === 2 && list.data[0].start_time === "08:00");

    const T = await login("sch_t", TEST_PASSWORD);
    const mine = await call(T, "GET", "/teacher/schedule");
    check("teacher sees own schedule", mine.status === 200 && mine.data.length === 2);
    check("teacher cannot edit", (await call(T, "POST", "/admin/schedule", {})).status === 403);
    check("delete", (await call(admin, "DELETE", `/admin/schedule/${adjacent.data.id}`)).status === 204);
  } finally {
    await call(admin, "DELETE", `/admin/teachers/${t.id}`);
    console.log("cleanup done");
  }
})()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
