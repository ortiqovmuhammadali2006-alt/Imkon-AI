import { CATEGORIES } from "@/lib/format";
import type { Category } from "@/lib/types";

// category null — dars barcha toifalar uchun
export default function CategoryBadge({ category }: { category: Category | null }) {
  if (!category) return <span className="badge bg-indigo-50 text-indigo-700">Barcha toifalar</span>;
  return <span className={`badge ${CATEGORIES[category].className}`}>{CATEGORIES[category].label}</span>;
}
