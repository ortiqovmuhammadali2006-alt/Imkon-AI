import { fileUrl } from "@/lib/api";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}


export default function Avatar({ name, src, size = "md" }: { name: string; src?: string | null; size?: "sm" | "md" | "lg" | "xl" }) {
  const cls = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg", xl: "size-20 text-2xl" }[size];
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- backend serveridagi yuklangan rasm
      <img src={fileUrl(src)} alt="" aria-hidden className={`shrink-0 rounded-full object-cover ring-2 ring-surface ${cls}`} />
    );
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 font-semibold text-white ${cls}`}
    >
      {initials(name)}
    </span>
  );
}
