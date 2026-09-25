"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
const KEY = "imkon_theme"; // app/layout.tsx dagi boshlang'ich skript ham shu kalitni o'qiydi
const listeners = new Set<() => void>();

function current(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  // Cookie — server sahifani darhol to'g'ri rangda yuborsin (app/layout.tsx), oq "miltillash" bo'lmasin
  document.cookie = `${KEY}=${theme}; path=/; max-age=31536000; samesite=lax`;
  listeners.forEach((fn) => fn());
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    current,
    () => "light" as Theme
  );
  return { theme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}
