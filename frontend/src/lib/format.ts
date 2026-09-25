import type { Category } from "./types";

export const CATEGORIES: Record<Category, { label: string; className: string }> = {
  general: { label: "Umumiy", className: "bg-slate-100 text-slate-700" },
  visual: { label: "Ko'rish cheklangan", className: "bg-amber-100 text-amber-800" },
  hearing: { label: "Eshitish cheklangan", className: "bg-sky-100 text-sky-800" },
  physical: { label: "Harakat cheklangan", className: "bg-emerald-100 text-emerald-800" },
};

const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

export function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString("ru-RU").replace(/,/g, " ")} so'm`;
}

// "2026-09-25T..." yoki "2026-09-25" -> "25.09.2026"
export function formatDate(value: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

// "2026-09" yoki "2026-09-01" -> "Sentabr 2026"
export function formatMonth(value: string) {
  const [y, m] = value.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Sinf/guruhni tushunarli ko'rsatish: "9" -> "9-sinf", "5-A" / "5a" -> "5-A sinf", boshqasi o'zgarmaydi
export function formatGrade(grade: string | null | undefined) {
  const g = grade?.trim();
  if (!g) return "";
  if (/^\d{1,2}$/.test(g)) return `${g}-sinf`;
  const m = g.match(/^(\d{1,2})\s*-?\s*([a-zA-Zа-яА-Я])$/);
  if (m) return `${m[1]}-${m[2].toUpperCase()} sinf`;
  return g;
}

const SUBJECT_TONES = [
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-amber-400 to-orange-500",
  "from-rose-500 to-pink-400",
  "from-violet-500 to-fuchsia-400",
];

// Fanga qarab doim bir xil rang (dars kartochkalaridagi chiziq uchun)
export function subjectTone(subject: string | null | undefined) {
  if (!subject) return SUBJECT_TONES[0];
  let hash = 0;
  for (const ch of subject) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SUBJECT_TONES[hash % SUBJECT_TONES.length];
}

// Nechchi kun oldin (nazorat sahifasi uchun)
export function daysAgo(value: string | null) {
  if (!value) return null;
  return Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
}
