// AI Chat (ChatGPT kabi): suhbatlar bazada saqlanadi, javob SSE orqali so'zma-so'z oqib keladi.
// voice: true — ovozli suhbat rejimi: javob qisqa va markdown belgilarsiz (ovoz bilan o'qiladi)
const { Router } = require("express");
const pool = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { HttpError, parseId } = require("../utils/validation");
const { getClient, chatParams, toHttpError } = require("../services/ai");

const router = Router();
router.use(authenticate);

const DEFAULT_TITLE = "Yangi suhbat";
const VOICE_REMINDER =
  "Eslatma: bu javob ovoz bilan o'qiladi. Faqat oddiy gaplar bilan, 2-5 gapda javob ber. " +
  "Raqamlangan ro'yxat, yulduzcha, qalin matn va boshqa markdown belgilarini umuman ishlatma.";
const HISTORY_LIMIT = 30; // modelga yuboriladigan oxirgi xabarlar soni

const CATEGORY_HINT = {
  visual: "O'quvchining ko'rishi cheklangan: rasm, jadval, 'qarang' kabi ko'rishga tayanadigan iboralarni ishlatma, hammasini so'z bilan tasvirla.",
  hearing: "O'quvchining eshitishi cheklangan: qisqa gaplar, oddiy so'zlar, aniq tuzilma (1., 2., 3.) ishlat.",
  physical: "O'quvchining harakati cheklangan: mavzuni kichik, ketma-ket qadamlarga bo'l.",
};

async function systemPrompt(user, voice) {
  const base = [
    "Sen Imkon AI — imkoniyati cheklangan o'quvchilar uchun ta'lim platformasining mehribon AI yordamchisisan.",
    "Faqat o'zbek tilida (lotin yozuvida) javob ber. Sodda, tushunarli, shoshilmasdan tushuntir, qiyin so'zlarni izohla.",
  ];
  if (user.role === "student") {
    const { rows } = await pool.query("SELECT category, grade FROM students WHERE user_id = $1", [user.id]);
    base.push(
      "Suhbatdoshing — o'quvchi. Uni rag'batlantir, misollar keltir. Uy vazifasini uning o'rniga to'liq yechib berma — yo'l ko'rsat.",
      // Ovozli rejimda "1., 2., 3." tuzilma kerak emas — javob tinglanadi
      voice ? "" : CATEGORY_HINT[rows[0]?.category] || "",
      rows[0]?.grade ? `O'quvchi sinfi: ${rows[0].grade}. Tushuntirishni shu yoshga moslashtir.` : ""
    );
  } else if (user.role === "teacher") {
    base.push(
      "Suhbatdoshing — o'qituvchi. Dars rejasi, inklyuziv ta'lim metodikasi, topshiriq va test tuzish, " +
        "imkoniyati cheklangan o'quvchilar bilan ishlash bo'yicha amaliy maslahat ber."
    );
  } else {
    base.push("Suhbatdoshing — maktab administratori. Ta'lim jarayonini tashkil etish bo'yicha amaliy maslahat ber.");
  }
  if (voice) {
    base.push(
      "Bu OVOZLI suhbat: javobing ovoz bilan o'qiladi. 2-5 ta qisqa gap bilan, jonli suhbat ohangida javob ber. " +
        "Markdown belgilari (*, #, -, |, `), ro'yxat va kod ishlatma. Kerak bo'lsa, oxirida qisqa savol ber."
    );
  } else {
    base.push("Kerak bo'lganda sarlavha, ro'yxat va qalin matn (markdown) bilan tartibli yoz.");
  }
  return base.filter(Boolean).join("\n");
}

async function getMyConversation(userId, id) {
  const { rows } = await pool.query("SELECT * FROM chat_conversations WHERE id = $1 AND user_id = $2", [id, userId]);
  if (!rows[0]) throw new HttpError(404, "Suhbat topilmadi");
  return rows[0];
}

// Har bir foydalanuvchiga 10 daqiqada 40 ta xabar
const usage = new Map();
function checkLimit(userId) {
  const now = Date.now();
  const recent = (usage.get(userId) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 40) throw new HttpError(429, "Juda ko'p xabar. Birozdan so'ng davom eting");
  recent.push(now);
  usage.set(userId, recent);
}

// ---------- Suhbatlar ----------

router.get("/conversations", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, title, updated_at FROM chat_conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 100`,
    [req.user.id]
  );
  res.json(rows);
});

router.post("/conversations", async (req, res) => {
  const { rows } = await pool.query(
    "INSERT INTO chat_conversations (user_id) VALUES ($1) RETURNING id, title, updated_at",
    [req.user.id]
  );
  res.status(201).json(rows[0]);
});

router.get("/conversations/:id", async (req, res) => {
  const conversation = await getMyConversation(req.user.id, parseId(req.params.id));
  const { rows: messages } = await pool.query(
    "SELECT id, role, content, created_at FROM chat_messages WHERE conversation_id = $1 ORDER BY id",
    [conversation.id]
  );
  res.json({ conversation, messages });
});

router.patch("/conversations/:id", async (req, res) => {
  const conversation = await getMyConversation(req.user.id, parseId(req.params.id));
  const title = String(req.body?.title || "").trim().slice(0, 120);
  if (!title) throw new HttpError(400, "Sarlavha bo'sh bo'lmasin");
  const { rows } = await pool.query(
    "UPDATE chat_conversations SET title = $1 WHERE id = $2 RETURNING id, title, updated_at",
    [title, conversation.id]
  );
  res.json(rows[0]);
});

router.delete("/conversations/:id", async (req, res) => {
  const conversation = await getMyConversation(req.user.id, parseId(req.params.id));
  await pool.query("DELETE FROM chat_conversations WHERE id = $1", [conversation.id]);
  res.status(204).end();
});

// ---------- Xabar yuborish (SSE oqim) ----------

router.post("/conversations/:id/messages", async (req, res) => {
  const conversation = await getMyConversation(req.user.id, parseId(req.params.id));
  const content = String(req.body?.content || "").trim();
  if (!content) throw new HttpError(400, "Xabar bo'sh");
  if (content.length > 6000) throw new HttpError(400, "Xabar juda uzun (6000 belgidan oshmasin)");
  const voice = Boolean(req.body?.voice);
  checkLimit(req.user.id);

  await pool.query("INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, 'user', $2)", [conversation.id, content]);
  // Birinchi xabar — suhbat sarlavhasi
  if (conversation.title === DEFAULT_TITLE) {
    const title = content.replace(/\s+/g, " ").slice(0, 60) + (content.length > 60 ? "…" : "");
    await pool.query("UPDATE chat_conversations SET title = $1 WHERE id = $2", [title, conversation.id]);
  }

  const { rows: history } = await pool.query(
    `SELECT role, content FROM (
       SELECT id, role, content FROM chat_messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT $2
     ) h ORDER BY id`,
    [conversation.id, HISTORY_LIMIT]
  );

  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Foydalanuvchi "To'xtatish" bossa yoki sahifani yopsa — OpenAI so'rovini ham to'xtatamiz
  const controller = new AbortController();
  res.on("close", () => controller.abort());

  let answer = "";
  try {
    const stream = await getClient().chat.completions.create(
      {
        ...chatParams(voice ? 400 : 1800),
        messages: [
          { role: "system", content: await systemPrompt(req.user, voice) },
          ...history,
          // Tarixdagi oldingi (markdownli) javoblarga taqlid qilmasin — ovozli qoida eng oxirgi ko'rsatma bo'lsin
          ...(voice ? [{ role: "system", content: VOICE_REMINDER }] : []),
        ],
        stream: true,
      },
      { signal: controller.signal }
    );
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        answer += delta;
        send({ delta });
      }
    }
  } catch (err) {
    if (!controller.signal.aborted) {
      send({ error: toHttpError(err).message });
    }
  }

  // Javobning chiqqan qismi (to'xtatilgan bo'lsa ham) saqlanadi
  let messageId = null;
  if (answer.trim()) {
    const { rows } = await pool.query(
      "INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, 'assistant', $2) RETURNING id",
      [conversation.id, answer]
    );
    messageId = rows[0].id;
  }
  await pool.query("UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1", [conversation.id]);
  if (!res.writableEnded) {
    send({ done: true, message_id: messageId });
    res.end();
  }
});

module.exports = router;
