// Yuklangan fayllar himoyasi: faqat API bergan imzolangan havola ishlaydi; imzosiz, buzilgan yoki boshqa faylga
// ko'chirilgan imzo — 403. Frontend domeni uchun CORS sarlavhasi bor (subtitr <track> va video uchun kerak)
const { BASE, FILES, TEST_PASSWORD, adminToken, pool } = require("./helpers");

async function call(tok, method, path, body, isForm) {
  const r = await fetch(BASE + path, {
    method,
    headers: { ...(!isForm && body && { "Content-Type": "application/json" }), Authorization: `Bearer ${tok}` },
    body: isForm ? body : body && JSON.stringify(body),
  });
  return { status: r.status, data: r.status === 204 ? null : await r.json().catch(() => null) };
}
function check(label, cond, extra = "") {
  console.log(`${cond ? "OK  " : "FAIL"} ${label} ${cond ? "" : extra}`);
  if (!cond) process.exitCode = 1;
}
const login = async (u, p) =>
  (await (await fetch(BASE + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, password: p }) })).json()).token;

(async () => {
  const admin = await adminToken();
  const t = (await call(admin, "POST", "/admin/teachers", { full_name: "Fayl Test", username: "t_files", password: TEST_PASSWORD })).data;
  try {
    const T = await login("t_files", TEST_PASSWORD);
    const f = new FormData();
    f.append("title", "Fayl himoyasi testi");
    f.append("file", new Blob(["x"]), "v.mp4");
    f.append("subtitle", new Blob(["WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nSalom\n"]), "s.vtt");
    const l = (await call(T, "POST", "/teacher/lessons", f, true)).data;

    check("API returns signed file URL", /^\/uploads\/[^?]+\?exp=\d+&sig=/.test(l.file_url || ""), l.file_url);
    for (const url of [l.subtitle_url, l.file_url]) {
      const r = await fetch(FILES + url, { headers: { Origin: "http://localhost:3000" } });
      check(`signed ${url.split("?")[0].slice(-4)} -> 200 + CORS`, r.status === 200 && r.headers.get("access-control-allow-origin") === "http://localhost:3000", String(r.status));
    }

    const bare = l.file_url.split("?")[0];
    check("unsigned URL -> 403", (await fetch(FILES + bare)).status === 403);
    const tampered = l.file_url.replace(/sig=.{4}/, "sig=AAAA");
    check("tampered signature -> 403", (await fetch(FILES + tampered)).status === 403);
    const expired = l.file_url.replace(/exp=\d+/, "exp=1000");
    check("expired / changed exp -> 403", (await fetch(FILES + expired)).status === 403);
    const otherFile = l.subtitle_url.split("?")[0] + "?" + l.file_url.split("?")[1];
    check("signature of another file -> 403", (await fetch(FILES + otherFile)).status === 403);
    check("path traversal blocked", [400, 403, 404].includes((await fetch(FILES + "/uploads/..%2F.env")).status));

    await call(T, "DELETE", `/teacher/lessons/${l.id}`);
  } finally {
    await call(admin, "DELETE", `/admin/teachers/${t.id}`);
  }
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
