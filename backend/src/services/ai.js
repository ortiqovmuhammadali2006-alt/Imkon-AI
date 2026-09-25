const OpenAI = require("openai");
const { HttpError } = require("../utils/validation");

let client = null;
function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new HttpError(503, "AI hali sozlanmagan. Administrator OPENAI_API_KEY ni kiritishi kerak");
  }
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

// Model va javob uzunligi. GPT-5 oilasi (va o-seriya) "fikrlovchi" modellar: max_tokens o'rniga
// max_completion_tokens talab qiladi, fikrlash qisqa bo'lsin (tezroq javob) — reasoning_effort: low
const DEFAULT_MODEL = "gpt-5.4-mini";
function chatParams(maxTokens) {
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const reasoning = /^(gpt-5|o\d)/.test(model);
  return {
    model,
    max_completion_tokens: reasoning ? maxTokens + 800 : maxTokens, // fikrlash tokenlari ham shu hisobga kiradi
    ...(reasoning && { reasoning_effort: "low" }),
  };
}
// O'quvchi toifasiga qarab tushuntirish uslubi
const STYLE = {
  general: "Oddiy, tushunarli tilda, misollar bilan tushuntir.",
  visual:
    "O'quvchining ko'rishi cheklangan: javob ovoz bilan o'qib beriladi. Rasm, jadval, 'qarang', 'rasmda' kabi ko'rishga tayanadigan iboralarni ishlatma. Hammasini so'z bilan tasvirla. Markdown belgilar (*, #, |) ishlatma, oddiy gaplar yoz.",
  hearing:
    "O'quvchining eshitishi cheklangan: qisqa gaplar, oddiy so'zlar, aniq tuzilma (1., 2., 3.) ishlat. Muhim atamalarni alohida ajratib izohla.",
  physical: "O'quvchining harakati cheklangan: mavzuni kichik, ketma-ket qadamlarga bo'lib tushuntir.",
};

function systemPrompt(lesson, category) {
  return [
    "Sen Imkon AI platformasidagi mehribon va sabrli o'qituvchi yordamchisan.",
    "Faqat o'zbek tilida (lotin yozuvida) javob ber.",
    STYLE[category] || STYLE.general,
    // Shoshilmasdan, batafsil: o'quvchi tinglab tushunishi uchun
    "Shoshilmasdan va batafsil tushuntir: avval asosiy fikrni bir-ikki gapda ayt, keyin mavzuni kichik qadamlarga bo'lib, " +
      "har bir qadamni hayotiy misol bilan tushuntir. Qiyin so'z ishlatsang, darhol oddiy so'z bilan izohla. " +
      "Oxirida 2-3 gaplik qisqa xulosa qil va o'quvchiga tushunganini tekshiruvchi bitta oddiy savol ber.",
    "Javoblaringni dars mavzusiga bog'la. Dars mavzusidan tashqari savollarga qisqa javob berib, darsga qaytar.",
    "Uy vazifasini o'quvchi o'rniga to'liq yechib berma — yo'l-yo'riq va maslahat ber.",
    "",
    `Dars mavzusi: ${lesson.title}`,
    lesson.subject ? `Fan: ${lesson.subject}` : "",
    lesson.description ? `Tavsif: ${lesson.description}` : "",
    lesson.content ? `Dars matni:\n${lesson.content.slice(0, 12000)}` : "",
    // Qulaylik to'plamidan: fayl ichidagi matn va video/audiodagi nutq
    lesson.a11y?.extracted_text ? `Dars materiali (fayldagi matn):\n${lesson.a11y.extracted_text.slice(0, 10000)}` : "",
    lesson.a11y?.transcript ? `Video/audio darsdagi nutq:\n${lesson.a11y.transcript.slice(0, 10000)}` : "",
    lesson.a11y?.image_description ? `Darsdagi rasm tavsifi:\n${lesson.a11y.image_description}` : "",
    !lesson.content && !lesson.a11y?.extracted_text && !lesson.a11y?.transcript
      ? "Dars matni kiritilmagan — mavzu nomiga tayangan holda tushuntir."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// messages: [{ role: "user" | "assistant", content }] — chat tarixi (bo'sh bo'lsa, darsni to'liq tushuntiradi)
async function explainLesson(lesson, category, messages) {
  const history = messages.length
    ? messages
    : [{ role: "user", content: "Shu darsni menga batafsil, bosqichma-bosqich tushuntirib ber." }];

  const completion = await getClient().chat.completions.create({
    ...chatParams(1500),
    messages: [{ role: "system", content: systemPrompt(lesson, category) }, ...history],
  });
  return completion.choices[0]?.message?.content?.trim() || "Kechirasiz, javob tayyorlab bo'lmadi.";
}

// Matnni ovozga aylantirish (mp3 Buffer). speed: 0.6 (sekin) ... 1.1 (tez)
async function textToSpeech(text, speed = 0.85) {
  const response = await getClient().audio.speech.create({
    model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
    voice: process.env.OPENAI_TTS_VOICE || "nova", // ayol ovozi — asosiy Madina ovozi bilan bir xil bo'lsin
    input: text,
    speed,
    instructions:
      speed < 0.9
        ? "O'zbek tilida, shoshilmasdan, sekin va aniq o'qi. Har bir gapdan keyin qisqa pauza qil. Iliq, o'qituvchidek ohangda."
        : "O'zbek tilida, aniq va iliq ohangda o'qi.",
    response_format: "mp3",
  });
  return Buffer.from(await response.arrayBuffer());
}

// Audio/videodan matn: vaqt belgilari bilan bo'laklar (subtitr uchun). Fayl 25 MB dan oshmasligi kerak.
// OpenAI "uz" til kodini qabul qilmaydi, whisper-1 esa o'zbekchani turkchaga o'xshatib yozadi ("kasırlarına").
// Shuning uchun: whisper-1 — vaqt belgilari, gpt-4o-transcribe — aniq o'zbekcha matn, AI — matnni bo'laklarga taqsimlaydi.
// Biror bosqich ishlamasa — whisper natijasi ishlatiladi.
const UZ_PROMPT = "Bugun biz o‘zbek tilida dars o‘tamiz. O‘quvchilar, diqqat bilan tinglang. Shunday qilib, g‘oya, qo‘shish.";

async function transcribe(filePath) {
  const fs = require("fs");
  const client = getClient();
  const [timed, accurate] = await Promise.all([
    client.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      response_format: "verbose_json",
      prompt: UZ_PROMPT,
    }),
    client.audio.transcriptions
      .create({
        file: fs.createReadStream(filePath),
        model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe",
        response_format: "json",
        prompt: UZ_PROMPT,
      })
      .then((r) => String(r.text || "").trim())
      .catch((err) => {
        console.error("Aniq transkripsiya ishlamadi, whisper matni ishlatiladi:", err.message);
        return "";
      }),
  ]);

  let segments = (timed.segments || [])
    .map((seg) => ({ start: seg.start, end: seg.end, text: String(seg.text || "").trim() }))
    .filter((seg) => seg.text);
  if (accurate && segments.length) segments = await alignText(accurate, segments);
  return { text: accurate || String(timed.text || "").trim(), segments };
}

// Aniq matnni whisper vaqt bo'laklariga taqsimlash (subtitr to'g'ri paytda chiqsin)
async function alignText(text, segments) {
  if (segments.length === 1) return [{ ...segments[0], text }];
  try {
    const completion = await getClient().chat.completions.create({
      ...chatParams(Math.min(16000, Math.ceil(text.length / 2) + 500)),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Senga to'g'ri matn va xuddi shu nutqning taxminiy (xato yozilgan) bo'laklari beriladi. " +
            "To'g'ri matnni tartibi bilan, hech narsa qo'shmasdan va tashlab ketmasdan, bo'laklar soniga teng qismlarga bo'l: " +
            "har bir qism mos taxminiy bo'lakka to'g'ri kelsin. Faqat JSON qaytar: {\"parts\": [\"...\", ...]}",
        },
        {
          role: "user",
          content: JSON.stringify({ correct_text: text, rough_segments: segments.map((seg) => seg.text) }),
        },
      ],
    });
    const parts = JSON.parse(completion.choices[0].message.content || "{}").parts;
    if (!Array.isArray(parts) || parts.length !== segments.length) throw new Error(`bo'laklar soni mos emas`);
    return segments.map((seg, i) => ({ ...seg, text: String(parts[i] || "").trim() || seg.text }));
  } catch (err) {
    console.error("Subtitrni moslashtirib bo'lmadi, whisper matni ishlatiladi:", err.message);
    return segments;
  }
}

// Rasmni ko'rishi cheklangan o'quvchi uchun so'z bilan tasvirlash
async function describeImage(buffer, mime) {
  const completion = await getClient().chat.completions.create({
    ...chatParams(700),
    messages: [
      {
        role: "system",
        content:
          "Sen ko'rishi cheklangan o'quvchilar uchun o'quv rasmlarini tasvirlaysan. O'zbek tilida (lotin), oddiy gaplar bilan yoz. " +
          "Avval rasm nima haqida ekanini bir gapda ayt, keyin muhim qismlarini tartib bilan tasvirla. Rasmda yozuv bo'lsa, uni to'liq o'qib ber. " +
          "Markdown belgilar ishlatma.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Shu o'quv rasmini tasvirlab ber." },
          { type: "image_url", image_url: { url: `data:${mime};base64,${buffer.toString("base64")}` } },
        ],
      },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() || "";
}

// Dars matnidan: oddiy tildagi qisqa variant + atamalar lug'ati (JSON)
async function simplifyLesson(title, sourceText) {
  const completion = await getClient().chat.completions.create({
    ...chatParams(1800),
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Sen maktab o'qituvchisining yordamchisisan. O'zbek tilida (lotin) javob ber. Faqat JSON qaytar: " +
          '{"simple_text": "...", "key_terms": [{"term": "...", "meaning": "..."}]}. ' +
          "simple_text — darsning oddiy tildagi qisqa bayoni: qisqa gaplar, har bir fikr alohida qatorda, 8-12 qator, qiyin so'zlarsiz. " +
          "key_terms — darsdagi 3-10 ta muhim atama va ularning bir gaplik sodda izohi. Markdown belgilar ishlatma.",
      },
      { role: "user", content: `Dars mavzusi: ${title}\n\nDars materiali:\n${sourceText.slice(0, 14000)}` },
    ],
  });
  const data = JSON.parse(completion.choices[0]?.message?.content || "{}");
  const keyTerms = Array.isArray(data.key_terms)
    ? data.key_terms
        .filter((t) => t && t.term && t.meaning)
        .slice(0, 12)
        .map((t) => ({ term: String(t.term), meaning: String(t.meaning) }))
    : [];
  return { simple_text: String(data.simple_text || "").trim(), key_terms: keyTerms };
}

// OpenAI xatolarini foydalanuvchiga tushunarli xabarga aylantirish
function toHttpError(err) {
  if (err instanceof HttpError) return err;
  const status = err?.status;
  if (status === 401) return new HttpError(503, "OpenAI kaliti noto'g'ri. Administratorga murojaat qiling");
  if (err?.code === "insufficient_quota" || err?.type === "insufficient_quota" || err?.code === "credit_balance_exhausted") {
    return new HttpError(503, "AI hisobida mablag' tugagan. Administrator OpenAI hisobini to'ldirishi kerak");
  }
  if (status === 429) return new HttpError(429, "AI hozir band. Birozdan so'ng urinib ko'ring");
  console.error("OpenAI xatosi:", err?.message);
  return new HttpError(502, "AI xizmatiga ulanib bo'lmadi");
}

module.exports = { getClient, chatParams, explainLesson, textToSpeech, transcribe, describeImage, simplifyLesson, toHttpError };
