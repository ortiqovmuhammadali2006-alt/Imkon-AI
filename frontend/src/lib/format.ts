import type { Category } from "./types";

export const CATEGORIES: Record<Category, { label: string; className: string }> = {
  general: { label: "Umumiy", className: "bg-indigo-50 text-indigo-700" },
  visual: { label: "Ko'rish cheklangan", className: "bg-indigo-50 text-indigo-700" },
  hearing: { label: "Eshitish cheklangan", className: "bg-indigo-50 text-indigo-700" },
  physical: { label: "Harakat cheklangan", className: "bg-indigo-50 text-indigo-700" },
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


// Dars kartochkalaridagi chiziq va sarlavha — barcha fanlar uchun bitta brend rangi, boshidan oxirigacha bir tekis
export function subjectTone(_subject?: string | null) {
  return "from-indigo-600 to-indigo-600";
}

// Nechchi kun oldin (nazorat sahifasi uchun)
export function daysAgo(value: string | null) {
  if (!value) return null;
  return Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
}
