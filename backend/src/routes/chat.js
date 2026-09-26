// AI Chat (ChatGPT kabi): suhbatlar bazada saqlanadi, javob SSE orqali so'zma-so'z oqib keladi.
// voice: true — ovozli suhbat rejimi: javob markdown belgilarsiz (ovoz bilan o'qiladi);
// o'quvchiga — o'qituvchidek bosqichma-bosqich tushuntirish, boshqalarga — ixcham javob
const { Router } = require("express");
const pool = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { HttpError, parseId } = require("../utils/validation");
const { getClient, chatParams, toHttpError } = require("../services/ai");

const router = Router();
router.use(authenticate);

const DEFAULT_TITLE = "Yangi suhbat";
// Ovozli rejimda eng oxirgi ko'rsatma (tarixdagi markdownli javoblarga taqlid qilmasin)
const VOICE_REMINDER = {
  student:
    "Eslatma: bu javob ovoz bilan o'qiladi va o'quvchi uni tinglab o'rganadi. Oddiy savol yoki salomlashish bo'lsa — 1-3 gap. " +
    "Mavzu yoki tushuncha so'ralsa — o'qituvchidek to'liq tushuntir (6-12 gap) va oxirida aynan shu mavzu bo'yicha tekshiruv savoli ber. " +
    "Mavzudan chetga chiqma va yangi mavzu taklif qilma. " +
    "Raqamlangan ro'yxat, yulduzcha, qalin matn va boshqa markdown belgilarini umuman ishlatma.",
  other:
    "Eslatma: bu javob ovoz bilan o'qiladi. Faqat oddiy gaplar bilan, 3-6 gapda javob ber. " +
    "Raqamlangan ro'yxat, yulduzcha, qalin matn va boshqa markdown belgilarini umuman ishlatma.",
};
const HISTORY_LIMIT = 30; // modelga yuboriladigan oxirgi xabarlar soni

const CATEGORY_HINT = {
  visual: "O'quvchining ko'rishi cheklangan: rasm, jadval, 'qarang' kabi ko'rishga tayanadigan iboralarni ishlatma, hammasini so'z bilan tasvirla.",
  hearing: "O'quvchining eshitishi cheklangan: qisqa gaplar, oddiy so'zlar, aniq tuzilma (1., 2., 3.) ishlat.",
  physical: "O'quvchining harakati cheklangan: mavzuni kichik, ketma-ket qadamlarga bo'l.",
};

// Ovozli tushuntirishda o'quvchi toifasiga moslash (matnli rejimdagi "1., 2., 3." tuzilma ovozda kerak emas)
const VOICE_CATEGORY_HINT = {
  visual: "O'quvchining ko'rishi cheklangan: 'qarang', 'rasmda' kabi iboralarni ishlatma, hammasini so'z bilan tasvirla.",
  hearing: "O'quvchining eshitishi cheklangan, javobni ekranda ham o'qiydi: juda qisqa gaplar va oddiy so'zlar ishlat.",
  physical: "O'quvchining harakati cheklangan: mavzuni kichik, ketma-ket qadamlarga bo'l.",
};

function rowsHint(info) {
  return VOICE_CATEGORY_HINT[info?.category] || "";
}

// Ovozli rejim: qidiruv vositasi javob ichiga qo'yadigan "([sayt](url))" havolalarini oqim davomida olib tashlash
// (havola bir necha bo'lakka bo'linib kelishi mumkin — to'liq yopilguncha ushlab turiladi)
function citationStripper() {
  let buf = "";
  const CITATION = /\(\s*\[[^\]]*\]\([^)]*\)\s*\)/g;
  return {
    feed(delta) {
      buf += delta;
      buf = buf.replace(CITATION, "");
      // Yopilmagan "([" — havola boshlanishi, yopilguncha kutamiz; oxiridagi yakka "(" ham shunday bo'lishi mumkin
      let hold = buf.lastIndexOf("([");
      if (hold === -1 && buf.endsWith("(")) hold = buf.length - 1;
      if (hold !== -1 && buf.length - hold < 600) {
        const out = buf.slice(0, hold);
        buf = buf.slice(hold);
        return out;
      }
      const out = buf;
      buf = "";
      return out;
    },
    flush() {
      const out = buf.replace(CITATION, "");
      buf = "";
      return out;
    },
  };
}

// Internet manbasi: takrorlanmasin, kuzatuv parametrlari (utm_*) olib tashlansin, 6 tadan oshmasin
function addSource(list, annotation) {
  let url;
  try {
    const u = new URL(annotation.url);
    [...u.searchParams.keys()].filter((k) => k.startsWith("utm_")).forEach((k) => u.searchParams.delete(k));
    url = u.toString();
  } catch {
    return;
  }
  if (list.length >= 6 || list.some((s) => s.url === url)) return;
  const title = String(annotation.title || "").split("\n").map((l) => l.trim()).filter(Boolean)[0] || new URL(url).hostname;
  list.push({ title: title.slice(0, 120), url });
}

async function systemPrompt(user, voice) {
  const base = [
    "Sen Imkon AI — imkoniyati cheklangan o'quvchilar uchun ta'lim platformasining mehribon AI yordamchisisan.",
    "Faqat o'zbek tilida (lotin yozuvida) javob ber. Sodda, tushunarli, shoshilmasdan tushuntir, qiyin so'zlarni izohla.",
    // Internet qidiruvi: har bir savol bo'yicha eng yangi va ishonchli ma'lumot
    "INTERNET: har qanday savolga javob berishdan oldin web_search bilan internetdan qidir va topilgan eng yangi, ishonchli " +
      "ma'lumotga tayan (rasmiy saytlar, ta'lim manbalari, ensiklopediyalar). Faqat salomlashish yoki oddiy suhbatda qidirish shart emas. " +
      "Manbalar turlicha bo'lsa — buni ayt. Ma'lumotni o'quvchi tushunadigan qilib o'zbek tilida qayta bayon qil, ko'chirib qo'yma.",
    "XAVFSIZLIK: suhbatdoshing bola. Faqat yoshiga mos ma'lumot ber; zo'ravonlik, kattalar mavzusi, xavfli harakatlar, " +
      "shaxsiy ma'lumotlarni so'rash kabi mavzularda mehribonlik bilan rad et va ota-ona yoki o'qituvchiga murojaat qilishni maslahat ber.",
  ];
  let studentInfo = null;
  if (user.role === "student") {
    const { rows } = await pool.query("SELECT category, grade FROM students WHERE user_id = $1", [user.id]);
    studentInfo = rows[0] || null;
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
  if (voice && user.role === "student") {
    base.push(
      "Bu OVOZLI dars-suhbat: javobing ovoz bilan o'qiladi, o'quvchi uni TINGLAB o'rganadi. Sen — mehribon o'qituvchisan.",
      "Mavzu, tushuncha yoki 'nima uchun/qanday' savoli bo'lsa, shunday tushuntir:\n" +
        "birinchi — bir gapda oddiy javob;\n" +
        "keyin — 'Birinchidan', 'Keyin', 'Shundan so'ng' kabi so'zlar bilan qadam-baqadam, har gapda bitta fikr;\n" +
        "so'ng — o'quvchi hayotidan oddiy misol (uy, maktab, tabiat);\n" +
        "oxirida — 'Demak,' bilan bir gapli xulosa va AYNAN SHU tushuntirilgan narsa bo'yicha bitta oson savol.",
      "MAVZUDAN CHETGA CHIQMA: faqat o'quvchi so'ragan narsani tushuntir. Boshqa mavzuga o'tma, " +
        "'yana ... haqida ham aytib beraymi' kabi yangi mavzu taklif qilma. " +
        "Tekshiruv savoli har doim suhbat boshidagi ASOSIY savolga oid bo'lsin — izoh uchun boshqa hodisani eslatgan bo'lsang ham, " +
        "savolni o'sha boshqa hodisadan berma. " +
        "Mavzuni faqat o'quvchi o'zi boshqa narsa so'rasa o'zgartir.",
      "Jami 6-12 ta qisqa, sodda gap. Yangi atamani aytsang — darhol oddiy so'z bilan izohla.",
      "O'quvchi sening savolingga javob bersa: to'g'ri bo'lsa — maqta va SHU mavzuni bir oz chuqurroq tushuntir; " +
        "xato bo'lsa — 'Yo'q' deb boshlama: avval urinishini maqta ('Yaxshi o'yladingiz'), keyin to'g'risini boshqa misol bilan qayta tushuntir.",
      "Salomlashish yoki oddiy savolga 1-3 gap bilan javob ber.",
      "O'quvchi gapi chala yoki tushunarsiz bo'lsa (ovozni tanish xatosi bo'lishi mumkin), taxmin qilib boshqa mavzuga ketma — " +
        "qisqa qilib nimani nazarda tutganini so'ra.",
      rowsHint(studentInfo),
      "Markdown belgilari (*, #, -, |, `), ro'yxat, jadval, formula belgilari va kod ishlatma — hammasini so'z bilan ayt " +
        "(masalan, '2+3' emas, 'ikki qo'shuv uch')."
    );
  } else if (voice) {
    base.push(
      "Bu OVOZLI suhbat: javobing ovoz bilan o'qiladi (manba havolalarini gap ichida yozma). 3-6 ta aniq gap bilan, jonli suhbat ohangida javob ber. " +
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
    "SELECT id, role, content, sources, created_at FROM chat_messages WHERE conversation_id = $1 ORDER BY id",
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

  // "Qayta yuborish": oxirgi xabar shu savolning o'zi bo'lsa (javob olinmay qolgan), uni takror saqlamaymiz
  const { rows: last } = await pool.query(
    "SELECT role, content FROM chat_messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 1",
    [conversation.id]
  );
  const isRetry = req.body?.retry && last[0]?.role === "user" && last[0].content === content;
  if (!isRetry) {
    await pool.query("INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, 'user', $2)", [conversation.id, content]);
  }
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
  const sources = [];
  try {
    // Internet qidiruvi bilan (OpenAI web_search): har bir savol bo'yicha eng yangi ma'lumot va manbalar
    const params = chatParams(voice ? (req.user.role === "student" ? 900 : 450) : 1800);
    const stream = await getClient().responses.create(
      {
        model: params.model,
        max_output_tokens: params.max_completion_tokens,
        ...(params.reasoning_effort && { reasoning: { effort: params.reasoning_effort } }),
        tools: [{ type: "web_search", user_location: { type: "approximate", country: "UZ" } }],
        input: [
          { role: "system", content: await systemPrompt(req.user, voice) },
          ...history,
          // Tarixdagi oldingi (markdownli) javoblarga taqlid qilmasin — ovozli qoida eng oxirgi ko'rsatma bo'lsin
          ...(voice ? [{ role: "system", content: VOICE_REMINDER[req.user.role === "student" ? "student" : "other"] }] : []),
        ],
        stream: true,
      },
      { signal: controller.signal }
    );
    let searching = false;
    let status = null;
    const stripper = voice ? citationStripper() : null;
    const emit = (text) => {
      if (!text) return;
      answer += text;
      send({ delta: text });
    };
    for await (const event of stream) {
      if (event.type === "response.web_search_call.searching" && !searching) {
        searching = true;
        send({ status: "searching" });
      } else if (event.type === "response.output_text.delta" || event.type === "response.refusal.delta") {
        emit(stripper ? stripper.feed(event.delta) : event.delta);
      } else if (event.type === "response.output_text.annotation.added" && event.annotation?.type === "url_citation") {
        addSource(sources, event.annotation);
      } else if (event.type === "response.completed" || event.type === "response.incomplete" || event.type === "response.failed") {
        status = event.response?.status;
      } else if (event.type === "error") {
        throw new Error(event.message || "AI xatosi");
      }
    }
    if (stripper) emit(stripper.flush());
    if (!answer.trim() && !controller.signal.aborted) {
      console.error(`[chat] bo'sh javob (conversation ${conversation.id}, status: ${status})`);
      send({ error: "AI javob bermadi. Qayta yuborib ko'ring." });
    }
  } catch (err) {
    if (!controller.signal.aborted) {
      console.error(`[chat] OpenAI xatosi (conversation ${conversation.id}):`, err.status ?? "", err.message);
      send({ error: toHttpError(err).message });
    }
  }

  // Javobning chiqqan qismi (to'xtatilgan bo'lsa ham) saqlanadi
  let messageId = null;
  if (answer.trim()) {
    const { rows } = await pool.query(
      "INSERT INTO chat_messages (conversation_id, role, content, sources) VALUES ($1, 'assistant', $2, $3) RETURNING id",
      [conversation.id, answer, sources.length ? JSON.stringify(sources) : null]
    );
    messageId = rows[0].id;
  }
  await pool.query("UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1", [conversation.id]);
  if (!res.writableEnded) {
    send({ done: true, message_id: messageId, sources });
    res.end();
  }
});

module.exports = router;
