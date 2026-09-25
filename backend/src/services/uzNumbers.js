// Ovozli o'qishdan oldin raqamlarni o'zbekcha so'zga aylantirish.
// Ovoz sintezatorlari raqamni ba'zan inglizcha o'qiydi ("0" -> "oh"); so'z bilan yozilsa, doim to'g'ri o'qiladi:
//   "0" -> "nol", "125" -> "bir yuz yigirma besh", "5-sinf" -> "beshinchi sinf", "2.5" -> "ikki butun besh",
//   "50%" -> "ellik foiz", "08:30" -> "sakkiz o'ttiz", "2+3=5" -> "ikki qo'shuv uch teng besh"

const ONES = ["nol", "bir", "ikki", "uch", "to'rt", "besh", "olti", "yetti", "sakkiz", "to'qqiz"];
const TENS = ["", "o'n", "yigirma", "o'ttiz", "qirq", "ellik", "oltmish", "yetmish", "sakson", "to'qson"];
const SCALES = [
  [1e9, "milliard"],
  [1e6, "million"],
  [1e3, "ming"],
];

function below1000(n) {
  const parts = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} yuz`);
  if (rest >= 10) parts.push(TENS[Math.floor(rest / 10)]);
  if (rest % 10) parts.push(ONES[rest % 10]);
  return parts.join(" ");
}

// Butun son -> so'z (0 ... 999 999 999 999)
function numberToWords(n) {
  if (n === 0) return "nol";
  const parts = [];
  let rest = n;
  for (const [value, name] of SCALES) {
    const count = Math.floor(rest / value);
    if (count) {
      parts.push(`${below1000(count)} ${name}`);
      rest %= value;
    }
  }
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
}

// Tartib son: "bir" -> "birinchi", "ikki" -> "ikkinchi", "o'n" -> "o'ninchi", "yigirma" -> "yigirmanchi"
function ordinal(words) {
  return /[aeiou]$/.test(words) ? `${words}nchi` : `${words}inchi`;
}

function digitsToWords(digits) {
  // Uzun raqamlar (telefon, ID) — bittalab o'qiladi
  if (digits.length > 9) return digits.split("").map((d) => ONES[Number(d)]).join(" ");
  // Gapda tabiiyroq: "bir yuz yigirma" -> "yuz yigirma", "bir ming" -> "ming"
  return numberToWords(Number(digits)).replace(/^bir (yuz|ming)\b/, "$1");
}

function uzNumbersToWords(text) {
  return (
    text
      // Minglik bo'shliqlar: "1 500 000" -> "1500000"
      .replace(/\b\d{1,3}(?: \d{3})+\b/g, (m) => m.replace(/ /g, ""))
      // Vaqt: 08:30 -> "sakkiz o'ttiz", 09:00 -> "to'qqiz"
      .replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h, m) => (Number(m) ? `${numberToWords(Number(h))} ${numberToWords(Number(m))}` : numberToWords(Number(h))))
      // Tartib son: "5-sinf", "2-dars", "1-qism" -> "beshinchi sinf"
      .replace(/\b(\d+)-(?=\p{L})/gu, (_, d) => `${ordinal(digitsToWords(d))} `)
      // O'nli kasr: 2.5 / 2,5 -> "ikki butun besh"
      .replace(/\b(\d+)[.,](\d+)\b/g, (_, a, b) => `${digitsToWords(a)} butun ${digitsToWords(b)}`)
      // Foiz: 50% -> "ellik foiz"
      .replace(/(\d+)\s?%/g, (_, d) => `${digitsToWords(d)} foiz`)
      // Manfiy son (bo'shliqdan keyin): "-5" -> "minus besh"
      .replace(/(^|\s)-(\d+)/g, (_, pre, d) => `${pre}minus ${digitsToWords(d)}`)
      // Qolgan barcha raqamlar
      .replace(/\d+/g, (d) => digitsToWords(d))
      // Arifmetik belgilar (raqamlar so'zga aylangandan keyin)
      .replace(/\s*\+\s*/g, " qo'shuv ")
      .replace(/\s*=\s*/g, " teng ")
      .replace(/\s*[×]\s*/g, " ko'paytiruv ")
      .replace(/\s*[÷]\s*/g, " bo'luv ")
      .replace(/\s{2,}/g, " ")
  );
}

module.exports = { uzNumbersToWords, numberToWords };
