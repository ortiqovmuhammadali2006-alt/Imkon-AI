const { BASE, FILES, TEST_PASSWORD, adminToken, pool } = require("./helpers");
// AI Chat API testi: suhbat yaratish, SSE oqim, tarix (kontekst), ovozli rejim, to'xtatish, begona suhbat
const login = async (u, p) =>
  (await (await fetch(BASE + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, password: p }) })).json()).token;
const call = async (tok, method, path, body) => {
  const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: body && JSON.stringify(body) });
  return { status: r.status, data: r.status === 204 ? null : await r.json().catch(() => null) };
};
function check(label, cond, extra = "") {
  console.log(`${cond ? "OK  " : "FAIL"} ${label} ${cond ? "" : extra}`);
  if (!cond) process.exitCode = 1;
}

// SSE oqimini o'qish: deltas, done, error
async function stream(tok, convId, content, { voice = false, abortAfterMs } = {}) {
  const ctrl = new AbortController();
  // To'xtatish birinchi so'z kelgandan keyin hisoblanadi (internet qidiruvi vaqti har safar har xil)
  let abortTimer = null;
  const armAbort = () => {
    if (abortAfterMs && !abortTimer) abortTimer = setTimeout(() => ctrl.abort(), abortAfterMs);
  };
  const t0 = Date.now();
  const res = await fetch(`${BASE}/chat/conversations/${convId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ content, voice }),
    signal: ctrl.signal,
  });
  const out = { status: res.status, text: "", deltas: 0, done: false, error: null, firstMs: null };
  if (!res.ok) return { ...out, error: (await res.json()).message };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const line = buf.slice(0, i).replace(/^data: /, "");
        buf = buf.slice(i + 2);
        const ev = JSON.parse(line);
        if (ev.delta) { out.text += ev.delta; out.deltas++; if (out.firstMs === null) out.firstMs = Date.now() - t0; armAbort(); }
        if (ev.done) out.done = true;
        if (ev.error) out.error = ev.error;
      }
    }
  } catch (e) {
    if (e.name !== "AbortError") throw e;
    out.aborted = true;
  }
  return out;
}

(async () => {
  const admin = await adminToken();
  const s = (await call(admin, "POST", "/admin/students", { full_name: "Chat Test", username: "chat_s", password: TEST_PASSWORD, category: "hearing", grade: "6" })).data;
  const s2 = (await call(admin, "POST", "/admin/students", { full_name: "Chat Test 2", username: "chat_s2", password: TEST_PASSWORD })).data;
  try {
    const S = await login("chat_s", TEST_PASSWORD);
    const S2 = await login("chat_s2", TEST_PASSWORD);

    const conv = (await call(S, "POST", "/chat/conversations")).data;
    check("create conversation", conv.id && conv.title === "Yangi suhbat");

    const r1 = await stream(S, conv.id, "Mening ismim Anvar. Fotosintez nima? Qisqa tushuntir.");
    check("stream: many deltas + done", r1.done && r1.deltas >= 2 && r1.text.length > 50, JSON.stringify(r1).slice(0, 300));
    console.log(`     birinchi so'z: ${r1.firstMs} ms, bo'laklar: ${r1.deltas}`);
    console.log("     javob:", r1.text.slice(0, 200).replace(/\n/g, " "), "...");

    const r2 = await stream(S, conv.id, "Mening ismim nima edi?");
    check("context kept (remembers name)", /anvar/i.test(r2.text), r2.text);

    const r3 = await stream(S, conv.id, "Nafas olish haqida gapirib ber", { voice: true });
    check("voice mode: short, no markdown", r3.done && r3.text.length < 1600 && !/[*#`|]/.test(r3.text), `done=${r3.done} len=${r3.text.length} md=${/[*#`|]/.test(r3.text)} err=${r3.error} ${r3.text}`);
    console.log("     ovozli javob:", r3.text.replace(/\n/g, " "));

    const detail = (await call(S, "GET", `/chat/conversations/${conv.id}`)).data;
    check("messages saved (6)", detail.messages.length === 6, detail.messages.length);
    check("auto title from first message", detail.conversation.title.startsWith("Mening ismim Anvar"), detail.conversation.title);

    const r4 = await stream(S, conv.id, "O'zbekiston tarixi haqida juda batafsil, 20 bandli reja yozib ber", { abortAfterMs: 2000 });
    check("abort mid-stream", r4.aborted === true, JSON.stringify(r4).slice(0, 200));
    await new Promise((r) => setTimeout(r, 1500));
    const afterAbort = (await call(S, "GET", `/chat/conversations/${conv.id}`)).data;
    const last = afterAbort.messages[afterAbort.messages.length - 1];
    check("partial answer saved after abort", afterAbort.messages.length === 8 && last.role === "assistant" && last.content.length > 0, JSON.stringify(last).slice(0, 150));

    check("other user cannot read -> 404", (await call(S2, "GET", `/chat/conversations/${conv.id}`)).status === 404);
    check("other user cannot post -> 404", (await stream(S2, conv.id, "salom")).status === 404);
    check("empty message -> 400", (await stream(S, conv.id, "   ")).status === 400);

    const list = (await call(S, "GET", "/chat/conversations")).data;
    check("list conversations", list.length === 1 && list[0].id === conv.id);
    const ren = await call(S, "PATCH", `/chat/conversations/${conv.id}`, { title: "Biologiya" });
    check("rename", ren.data.title === "Biologiya");
    check("delete", (await call(S, "DELETE", `/chat/conversations/${conv.id}`)).status === 204);
    check("teacher/admin also allowed", (await call(admin, "GET", "/chat/conversations")).status === 200);
  } finally {
    await call(admin, "DELETE", `/admin/students/${s.id}`);
    await call(admin, "DELETE", `/admin/students/${s2.id}`);
    console.log("cleanup done");
  }
})()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
