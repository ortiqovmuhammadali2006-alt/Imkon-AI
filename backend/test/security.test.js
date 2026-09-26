// Xavfsizlik: login urinishlari limiti, zaif parol belgisi, parolni o'zgartirish (eski tokenlar bekor bo'ladi),
// bloklangan foydalanuvchining tokeni, parol uzunligi, xavfsizlik sarlavhalari
const { BASE, TEST_PASSWORD, adminToken, pool } = require("./helpers");

async function call(tok, method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(tok && { Authorization: `Bearer ${tok}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: r.status, data: r.status === 204 ? null : await r.json().catch(() => null) };
}
function check(label, cond, extra = "") {
  console.log(`${cond ? "OK  " : "FAIL"} ${label} ${cond ? "" : extra}`);
  if (!cond) process.exitCode = 1;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const admin = await adminToken();
  const USER = "t_security";
  const created = (await call(admin, "POST", "/admin/teachers", { full_name: "Xavfsizlik Test", username: USER, password: TEST_PASSWORD })).data;
  try {
    // Parol uzunligi
    const short = await call(admin, "POST", "/admin/teachers", { full_name: "Qisqa Parol", username: "t_short", password: "1234567" });
    check("password < 8 -> 400", short.status === 400, JSON.stringify(short.data));

    // Kirish va zaif parol belgisi
    const ok = await call(null, "POST", "/auth/login", { username: USER, password: TEST_PASSWORD });
    check("login ok, strong password not flagged", ok.status === 200 && ok.data.weak_password === false, JSON.stringify(ok.data));
    const oldToken = ok.data.token;

    // Parolni o'zgartirish
    const wrong = await call(oldToken, "POST", "/auth/password", { current_password: "noto'g'ri", new_password: "Yangi-parol-2026" });
    check("change password: wrong current -> 400", wrong.status === 400);
    const weak = await call(oldToken, "POST", "/auth/password", { current_password: TEST_PASSWORD, new_password: "12345678" });
    check("change password: common password rejected", weak.status === 400);
    await sleep(1100); // token "iat" soniyalarda — parol o'zgarishi undan keyin bo'lsin
    const changed = await call(oldToken, "POST", "/auth/password", { current_password: TEST_PASSWORD, new_password: "Yangi-parol-2026" });
    check("change password -> new token", changed.status === 200 && Boolean(changed.data.token), JSON.stringify(changed.data));
    check("old token rejected after password change", (await call(oldToken, "GET", "/auth/me")).status === 401);
    check("new token works", (await call(changed.data.token, "GET", "/auth/me")).status === 200);
    check("old password no longer works", (await call(null, "POST", "/auth/login", { username: USER, password: TEST_PASSWORD })).status === 401);

    // Bloklangan foydalanuvchining amaldagi tokeni ham ishlamaydi
    await call(admin, "PATCH", `/admin/teachers/${created.id}/status`, { is_active: false });
    check("blocked user's token rejected", (await call(changed.data.token, "GET", "/auth/me")).status === 401);
    await call(admin, "PATCH", `/admin/teachers/${created.id}/status`, { is_active: true });

    // Parolni taxmin qilish: 10 ta noto'g'ri urinishdan keyin — 429 (to'g'ri parol bilan ham)
    await pool.query("DELETE FROM usage_log WHERE kind = 'login' AND key LIKE $1", [`%|${USER}`]); // oldingi xato urinishlar
    const statuses = [];
    for (let i = 0; i < 11; i++) statuses.push((await call(null, "POST", "/auth/login", { username: USER, password: `xato-${i}` })).status);
    check("10 wrong attempts -> 401, then 429", statuses.slice(0, 10).every((s) => s === 401) && statuses[10] === 429, statuses.join(","));
    const locked = await call(null, "POST", "/auth/login", { username: USER, password: "Yangi-parol-2026" });
    check("locked even with correct password", locked.status === 429);

    // Xavfsizlik sarlavhalari (helmet)
    const h = (await fetch(`${BASE}/health`)).headers;
    check("helmet headers", h.get("x-content-type-options") === "nosniff" && h.get("x-powered-by") === null && Boolean(h.get("content-security-policy")));
  } finally {
    await pool.query("DELETE FROM usage_log WHERE kind = 'login' AND key LIKE $1", [`%|${USER}`]);
    await call(admin, "DELETE", `/admin/teachers/${created.id}`);
  }
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
