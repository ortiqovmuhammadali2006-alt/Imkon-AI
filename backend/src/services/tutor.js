// AI Tutor — platformaning markazi: darsni qismlarga bo'lib, interaktiv o'qitadi.
// Tsikl: kichik tushuntirish → PAUZA → bitta savol → o'quvchi javobi → baho → moslashtirilgan davom.
// Har bir AI javobining birinchi qatori xizmat belgisi: [[baho: togri|qisman|notogri|yoq; qism: N|tugadi]]
// — u o'quvchiga ko'rsatilmaydi, bazaga yoziladi (keyin bilim xaritasi shundan hisoblanadi).
const pool = require("../config/db");
const { getClient, chatParams } = require("./ai");

// ---------- Dars materiali (o'qituvchi yuklagan — asosiy manba) ----------

function lessonMaterial(lesson, limit = 14000) {
  const a = lesson.a11y || {};
  const parts = [
    lesson.content && `Dars matni:\n${lesson.content}`,
    a.extracted_text && `Fayldagi matn:\n${a.extracted_text}`,
    a.transcript && `Video/audio darsdagi nutq:\n${a.transcript}`,
    a.image_description && `Rasm tavsifi:\n${a.image_description}`,
  ].filter(Boolean);
  return parts.join("\n\n").slice(0, limit);
}

// ---------- Dars rejasi: maqsad + 3-6 qism (tushuncha) ----------

async function getPlan(lesson) {
  if (lesson.ai_plan?.parts?.length) return lesson.ai_plan;
  const material = lessonMaterial(lesson);
  const completion = await getClient().chat.completions.create({
    ...chatParams(900),
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Sen tajribali metodistsan. Berilgan dars materialini o'quvchiga bosqichma-bosqich o'rgatish uchun reja tuz. " +
          "Faqat o'zbek tilida (lotin). Faqat JSON qaytar: " +
          '{"goal": "bir gapli o\'quv maqsadi", "parts": [{"title": "tushuncha nomi (2-5 so\'z)", "summary": "bu qismda nima o\'rganiladi (1 gap)"}]}. ' +
          "parts — 3 tadan 6 tagacha, oddiydan murakkabga, har biri bitta asosiy tushuncha. Materialda yo'q narsani qo'shma.",
      },
      {
        role: "user",
        content: `Mavzu: ${lesson.title}\n${lesson.subject ? `Fan: ${lesson.subject}\n` : ""}${lesson.description ? `Tavsif: ${lesson.description}\n` : ""}\n${
          material || "(Material matni yo'q — mavzu nomiga tayangan holda umumiy reja tuz.)"
        }`,
      },
    ],
  });
  const raw = JSON.parse(completion.choices[0]?.message?.content || "{}");
  const parts = (Array.isArray(raw.parts) ? raw.parts : [])
    .map((p) => ({ title: String(p?.title || "").trim().slice(0, 80), summary: String(p?.summary || "").trim().slice(0, 240) }))
    .filter((p) => p.title)
    .slice(0, 6);
  if (!parts.length) parts.push({ title: lesson.title.slice(0, 80), summary: "" });
  const plan = { goal: String(raw.goal || "").trim().slice(0, 240), parts, created_at: new Date().toISOString() };
  await pool.query("UPDATE lessons SET ai_plan = $1 WHERE id = $2", [JSON.stringify(plan), lesson.id]);
  return plan;
}

// ---------- "Tushunmadim" usullari ----------

const MODES = {
  simple: { label: "Juda sodda qilib", instruction: "Hozirgi qismni juda sodda so'zlar bilan, xuddi 7 yoshli bolaga tushuntirgandek qayta tushuntir." },
  example: { label: "Hayotiy misol bilan", instruction: "Hozirgi qismni o'quvchining kundalik hayotidan (uy, maktab, tabiat) aniq misol bilan qayta tushuntir." },
  imagine: {
    label: "Ko'z oldiga keltirib",
    instruction: "Hozirgi qismni ko'z oldiga keltiriladigan tasvir orqali tushuntir: 'Tasavvur qiling...' deb boshlab, manzarani so'z bilan chiz.",
  },
  steps: { label: "Bosqichma-bosqich", instruction: "Hozirgi qismni 3-4 ta mayda bosqichga bo'lib, 'Birinchi... Ikkinchi...' tarzida qayta tushuntir." },
  voice: { label: "Ovozli", instruction: "Hozirgi qismni tinglab tushunish oson bo'lgan jonli og'zaki nutq bilan qayta tushuntir." },
  short: { label: "Qisqa qilib", instruction: "Hozirgi qismning eng asosiy fikrini 2 gapda ayt." },
};

const CATEGORY_HINT = {
  visual: "O'quvchining ko'rishi cheklangan: 'qarang', 'rasmda' kabi iboralarni ishlatma, hammasini so'z bilan tasvirla.",
  hearing: "O'quvchining eshitishi cheklangan, matnni o'qiydi: qisqa gaplar, oddiy so'zlar.",
  physical: "O'quvchining harakati cheklangan: yozma javobni qisqa kutish mumkinligini hisobga ol.",
};

// ---------- Tutor ko'rsatmasi ----------

function systemPrompt({ lesson, plan, profile, session, stats, voice }) {
  const partsList = plan.parts.map((p, i) => `${i + 1}. ${p.title}${p.summary ? ` — ${p.summary}` : ""}`).join("\n");
  const material = lessonMaterial(lesson);
  return [
    "Sen Imkon AI platformasining AI Tutorisan — sabrli, mehribon, jonli o'qituvchi. Faqat o'zbek tilida (lotin) gapir.",
    "Sen oddiy chatbot emassan: darsni o'quvchi bilan birgalikda, savol-javob orqali o'tasan.",
    "",
    "JAVOB FORMATI (qat'iy):",
    "1-qator — xizmat belgisi, aynan shunday: [[baho: X; qism: N]]",
    "  X — o'quvchining OXIRGI javobiga bahong: togri, qisman, notogri; agar baholanadigan javob bo'lmasa (seans boshi, savol, 'tushunmadim') — yoq.",
    `  N — endi qaysi qismni o'rgatayapsan (1..${plan.parts.length}); butun dars tugagan bo'lsa — tugadi.`,
    "Keyin: 3-5 ta qisqa gap bilan BITTA kichik fikrni tushuntir, so'ng BITTA savol ber va TO'XTA. Savoldan keyin hech narsa yozma.",
    "Uzoq monolog qilma. Bir javobda bir nechta savol berma.",
    "",
    "O'QITISH QOIDALARI:",
    "- Seans boshida: salomlash, bugungi maqsadni bir gapda ayt, 1-qismni boshla.",
    "- Javob to'g'ri: 'Ajoyib!' kabi qisqa maqtov, keyin keyingi qismga o't (yoki shu qismni bir qadam chuqurlashtir).",
    "- Qisman to'g'ri: to'g'ri tomonini ayt, yetishmayotgan qismini birgalikda ko'rib chiq, shu qism bo'yicha yangi savol.",
    "- Noto'g'ri: 'Muammo emas' deb qo'llab-quvvatla, shu qismni BOSHQA usulda (oddiyroq, misol bilan) tushuntir va yo'naltiruvchi ishora ber.",
    "  QAT'IY: birinchi xatodan keyingi javobingda to'g'ri javobning o'zi (son, so'z) ham, uni ochib qo'yadigan iqtibos ham BO'LMASIN —",
    "  faqat ishora ber (masalan: 'barmoqlaringda sanab ko'r', 'qaysi biri kattaroq?') va o'quvchi o'zi topsin.",
    "  Shu savolga ikkinchi marta ham xato qilsa — endi javobni tushuntirib ayt va yangi, osonroq savol ber.",
    "- O'quvchi 'tushunmadim' desa: 'Qaysi qismi qiyin bo'ldi?' deb so'ra. U aniq joyni aytsa — faqat o'sha joyni boshqacha tushuntir.",
    "- Oxirgi qism to'g'ri o'zlashtirilsa: 3-4 gapli xulosa, tabrik, qism: tugadi. Tugagandan keyin savol berma.",
    "- O'quvchi darsdan tashqari savol bersa — qisqa javob ber va darsga qaytar.",
    "",
    "MANBA: asosan quyidagi dars materialiga tayan. Materialdan aniq fikr olganingda uni qisqa iqtibos bilan ko'rsat: (Materialda: \"...\").",
    "Materialda bo'lmagan narsani so'rashsa, buni ochiq ayt: 'Bu dars materialida yo'q, lekin qisqacha...'",
    "",
    profile.grade ? `O'quvchi sinfi: ${profile.grade}. Tilni shu yoshga moslashtir.` : "",
    CATEGORY_HINT[profile.category] || "",
    stats.wrongStreak >= 2
      ? `DIQQAT: o'quvchi ketma-ket ${stats.wrongStreak} marta xato qildi. Juda sodda tushuntir, oldingi (asosiy) bilimni tekshiruvchi oson savol ber.`
      : "",
    stats.correctStreak >= 3 ? "O'quvchi ketma-ket to'g'ri javob bermoqda — biroz qiyinroq savol berishing mumkin." : "",
    voice
      ? "Bu OVOZLI dars: javob ovoz bilan o'qiladi. Markdown, ro'yxat, jadval, formula belgilarini ishlatma — hammasini so'z bilan ayt."
      : "Qalin matn (**...**) faqat muhim atama uchun; sarlavha va jadval ishlatma.",
    "",
    `DARS: ${lesson.title}${lesson.subject ? ` (${lesson.subject})` : ""}`,
    plan.goal ? `Maqsad: ${plan.goal}` : "",
    `Reja:\n${partsList}`,
    `Hozirgi qism: ${session.current_part}`,
    "",
    material ? `DARS MATERIALI:\n${material}` : "Dars materiali matni yo'q — mavzu va reja asosida umumiy bilimga tayangan holda o'qit.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

// ---------- Xizmat belgisini o'qish ----------

const TAG = /^\s*\[\[\s*baho\s*:\s*([a-z']+)\s*;\s*qism\s*:\s*([0-9]+|tugadi)\s*\]\]\s*/i;
const EVAL = { togri: "correct", qisman: "partial", notogri: "wrong", "noto'g'ri": "wrong", "to'g'ri": "correct" };

// null — hali to'liq kelmagan (kutamiz); { evaluation, part, finished, rest } — tayyor
function parseTag(text) {
  const m = text.match(TAG);
  if (m) {
    const part = m[2].toLowerCase() === "tugadi" ? null : Number(m[2]);
    return { evaluation: EVAL[m[1].toLowerCase()] || null, part, finished: part === null, rest: text.slice(m[0].length) };
  }
  // Belgi kelmay qolsa (model unutsa) — matnni yo'qotmaymiz
  if (text.includes("\n") || text.length > 80) {
    const cleaned = text.replace(/^\s*\[\[[^\]]*\]\]\s*/, "");
    return { evaluation: null, part: undefined, finished: false, rest: cleaned };
  }
  return null;
}

module.exports = { getPlan, systemPrompt, parseTag, MODES, lessonMaterial };
