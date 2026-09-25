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
    "Javoblaringni dars mavzusiga bog'la. Dars mavzusidan tashqari savollarga qisqa javob berib, darsga qaytar.",
    "Uy vazifasini o'quvchi o'rniga to'liq yechib berma — yo'l-yo'riq va maslahat ber.",
    "",
    `Dars mavzusi: ${lesson.title}`,
    lesson.subject ? `Fan: ${lesson.subject}` : "",
    lesson.description ? `Tavsif: ${lesson.description}` : "",
    lesson.content ? `Dars matni:\n${lesson.content.slice(0, 12000)}` : "Dars matni kiritilmagan — mavzu nomiga tayangan holda tushuntir.",
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
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [{ role: "system", content: systemPrompt(lesson, category) }, ...history],
    max_tokens: 1500,
  });
  return completion.choices[0]?.message?.content?.trim() || "Kechirasiz, javob tayyorlab bo'lmadi.";
}

// Matnni ovozga aylantirish (mp3 Buffer)
async function textToSpeech(text) {
  const response = await getClient().audio.speech.create({
    model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
    voice: process.env.OPENAI_TTS_VOICE || "alloy",
    input: text,
    instructions: "O'zbek tilida, sekin va aniq, iliq ohangda o'qi.",
    response_format: "mp3",
  });
  return Buffer.from(await response.arrayBuffer());
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

module.exports = { explainLesson, textToSpeech, toHttpError };
