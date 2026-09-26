"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

// Tungi / kunduzgi rejim tugmasi
export default function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Kunduzgi rejim" : "Tungi rejim";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center gap-2 rounded-full border border-line bg-surface text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-indigo-600 ${
        withLabel ? "px-4 py-2.5 font-medium" : "size-11"
      }`}
    >
      {dark ? <Sun className="size-5 text-amber-400" aria-hidden /> : <Moon className="size-5" aria-hidden />}
      {withLabel && label}
    </button>
  );
}
