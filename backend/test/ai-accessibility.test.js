const { BASE, FILES, TEST_PASSWORD, adminToken, pool } = require("./helpers");
// Qulaylik to'plami testi: subtitr (.srt -> .vtt), PDF/TXT dan matn, AI qadamlari mablag'siz holatda ham buzilmasligi
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitDone(tok, id) {
  for (let i = 0; i < 40; i++) {
    const r = await call(tok, "GET", `/teacher/lessons/${id}`);
    if (!["pending", "processing"].includes(r.data.a11y?.status)) return r.data;
    await sleep(500);
  }
  throw new Error("Ishlov tugamadi");
}

// Minimal, to'g'ri PDF (bitta sahifa, matn bilan)
function makePdf(text) {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 18 Tf 72 700 Td (${text}) Tj ET`;
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

(async () => {
  const admin = await adminToken();
  const t = (await call(admin, "POST", "/admin/teachers", { full_name: "A11y Teacher", username: "a11y_t", password: TEST_PASSWORD, subject: "Biologiya" })).data;
  const s = (await call(admin, "POST", "/admin/students", { full_name: "A11y Student", username: "a11y_s", password: TEST_PASSWORD, category: "hearing", teacher_ids: [t.id] })).data;
  try {
    const T = await login("a11y_t", TEST_PASSWORD);
    const S = await login("a11y_s", TEST_PASSWORD);

    // 1) Video + o'qituvchining .srt subtitri
    const srt = "1\n00:00:01,000 --> 00:00:04,500\nFotosintez — o'simliklarda boradigan jarayon.\n\n2\n00:00:05,000 --> 00:00:08,000\nU quyosh nuri yordamida sodir bo'ladi.\n";
    const f1 = new FormData();
    f1.append("title", "Fotosintez video");
    f1.append("file", new Blob(["fake-video"]), "dars.mp4");
    f1.append("subtitle", new Blob([srt]), "dars.srt");
    const l1 = (await call(T, "POST", "/teacher/lessons", f1, true)).data;
    check("lesson with subtitle created", l1.subtitle_name === "dars.srt", JSON.stringify(l1));
    const d1 = await waitDone(T, l1.id);
    check("subtitle step done (teacher)", d1.a11y.steps.subtitle?.status === "done" && d1.a11y.steps.subtitle.source === "teacher", JSON.stringify(d1.a11y));
    check("segments parsed (2)", d1.a11y.segments?.length === 2 && d1.a11y.segments[1].start === 5, JSON.stringify(d1.a11y.segments));
    const vtt = await (await fetch(FILES + d1.a11y.subtitle_vtt_url)).text();
    check("srt converted to vtt", vtt.startsWith("WEBVTT") && vtt.includes("00:00:01.000 --> 00:00:04.500"), vtt.slice(0, 120));
    check("transcript built", d1.a11y.transcript.includes("quyosh nuri"));

    // 2) Noto'g'ri subtitr formati
    const bad = new FormData();
    bad.append("title", "Yomon subtitr");
    bad.append("subtitle", new Blob(["x"]), "subs.txt");
    check("bad subtitle ext -> 400", (await call(T, "POST", "/teacher/lessons", bad, true)).status === 400);

    // 3) PDF dan matn
    const f2 = new FormData();
    f2.append("title", "PDF dars");
    f2.append("content", "Bu dars hujayra tuzilishi haqida. Hujayra — tirik organizmning eng kichik tuzilma birligi.");
    f2.append("file", new Blob([makePdf("Hujayra membranasi va yadro")]), "hujayra.pdf");
    const l2 = (await call(T, "POST", "/teacher/lessons", f2, true)).data;
    const d2 = await waitDone(T, l2.id);
    check("pdf text extracted", d2.a11y.steps.text?.status === "done" && /Hujayra membranasi/.test(d2.a11y.extracted_text), JSON.stringify(d2.a11y));
    const hasKey = !!process.env.OPENAI_API_KEY;
    check("AI step reports clear error when no credits", d2.a11y.steps.simple && (d2.a11y.steps.simple.status === "done" || /mablag'|sozlanmagan|AI/.test(d2.a11y.steps.simple.error)), JSON.stringify(d2.a11y.steps.simple));
    check("overall status partial/done", ["partial", "done"].includes(d2.a11y.status), d2.a11y.status);

    // 4) Video subtitrsiz -> AI transkripsiya (mablag'siz — tushunarli xato, jarayon buzilmaydi)
    const f3 = new FormData();
    f3.append("title", "Subtitrsiz audio");
    f3.append("file", new Blob(["not-really-audio"]), "ovoz.mp3");
    const l3 = (await call(T, "POST", "/teacher/lessons", f3, true)).data;
    const d3 = await waitDone(T, l3.id);
    check("transcription step finished (done or clear error)", d3.a11y.steps.subtitle && (d3.a11y.steps.subtitle.status === "done" || d3.a11y.steps.subtitle.error), JSON.stringify(d3.a11y.steps));

    // 5) O'quvchi ko'radigan ma'lumot (xato matnlarisiz)
    const sl = await call(S, "GET", `/student/lessons/${l1.id}`);
    check("student gets subtitles + segments", sl.data.a11y.subtitle_vtt_url && sl.data.a11y.segments.length === 2, JSON.stringify(sl.data.a11y));
    check("student does not get internal steps", !("steps" in sl.data.a11y) && !("status" in sl.data.a11y));
    const list = await call(S, "GET", "/student/lessons");
    check("student list has_subtitles flag", list.data.find((x) => x.id === l1.id)?.has_subtitles === true, JSON.stringify(list.data));

    // 6) Subtitrni olib tashlash -> fayl o'chadi, qayta ishlov
    const up = new FormData();
    up.append("title", "Fotosintez video");
    up.append("remove_subtitle", "true");
    const u1 = (await call(T, "PUT", `/teacher/lessons/${l1.id}`, up, true)).data;
    check("subtitle removed", u1.subtitle_url === null);
    check("old srt file deleted", (await fetch(FILES + l1.subtitle_url)).status === 404);
    await waitDone(T, l1.id);
    check("old generated vtt deleted", (await fetch(FILES + d1.a11y.subtitle_vtt_url)).status === 404);

    // 7) Qayta yaratish endpointi
    const re = await call(T, "POST", `/teacher/lessons/${l2.id}/accessibility`);
    check("reprocess -> 202", re.status === 202);
    await waitDone(T, l2.id);
  } finally {
    await call(admin, "DELETE", `/admin/students/${s.id}`);
    await call(admin, "DELETE", `/admin/teachers/${t.id}`);
    console.log("cleanup done");
  }
})()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
