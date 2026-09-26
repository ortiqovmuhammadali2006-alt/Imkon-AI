"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";

export type SelectOption = { value: string; label: string };

// Brauzerning oddiy <select> ro'yxati o'rniga — sayt uslubidagi ochiluvchi ro'yxat.
// Klaviatura: ↑/↓, Home/End, Enter/Probel — tanlash, Esc — yopish, harf — shu harf bilan boshlanuvchi variant.
// Ekran o'qigich uchun combobox + listbox roli. Ro'yxat portal orqali body'da — Modal/aylantirish uni qirqmaydi
export default function Select({
  id,
  value,
  onChange,
  options,
  icon: Icon,
  className = "",
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  icon?: LucideIcon;
  className?: string;
  ariaLabel?: string;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [active, setActive] = useState(0);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const selected = options[selectedIndex];

  const measure = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setRect(r);
  }, []);

  const openList = () => {
    measure();
    setActive(selectedIndex);
    setOpen(true);
  };
  const close = useCallback((focus = true) => {
    setOpen(false);
    if (focus) triggerRef.current?.focus();
  }, []);
  const pick = (i: number) => {
    const o = options[i];
    if (o) onChange(o.value);
    close();
  };

  // Tashqariga bosish, Esc (capture — ota Modal yopilmasin), aylantirish/o'lcham o'zgarishi
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!listRef.current?.contains(t) && !triggerRef.current?.contains(t)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, close, measure]);

  // Faol variant ko'rinib tursin
  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, last));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Enter" || e.key === " ") pick(active);
    else if (e.key === "Tab") return close(false);
    else if (e.key.length === 1) {
      const ch = e.key.toLowerCase();
      const from = options.findIndex((o, i) => i > active && o.label.toLowerCase().startsWith(ch));
      const found = from >= 0 ? from : options.findIndex((o) => o.label.toLowerCase().startsWith(ch));
      if (found >= 0) setActive(found);
    } else return;
    e.preventDefault();
  };

  const maxHeight = 288;
  const below = rect ? window.innerHeight - rect.bottom : 0;
  const upward = rect ? below < Math.min(maxHeight, options.length * 44 + 12) + 12 && rect.top > below : false;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        data-open={open}
        className={`input flex items-center gap-2.5 text-left data-[open=true]:border-indigo-400 data-[open=true]:ring-4 data-[open=true]:ring-indigo-200 ${className}`}
      >
        {Icon && <Icon className={`size-4 shrink-0 ${value ? "text-indigo-600" : "text-slate-400"}`} aria-hidden />}
        <span className={`flex-1 truncate ${value ? "font-medium text-slate-900" : "text-slate-700"}`}>{selected?.label}</span>
        <ChevronDown className={`size-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open &&
        mounted &&
        rect &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={id}
            style={{
              top: upward ? undefined : rect.bottom + 6,
              bottom: upward ? window.innerHeight - rect.top + 6 : undefined,
              left: rect.left,
              width: Math.max(rect.width, 180),
              maxHeight,
            }}
            className="fixed z-[60] animate-pop overflow-y-auto rounded-lg border border-line bg-surface p-1.5 shadow-xl shadow-slate-900/10"
          >
            {options.map((o, i) => {
              const isSelected = o.value === value;
              return (
                <li
                  key={o.value}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => pick(i)}
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 transition-colors ${
                    i === active ? "bg-indigo-50 text-indigo-800" : "text-slate-700"
                  } ${isSelected ? "font-semibold" : ""}`}
                >
                  <span className="flex-1 truncate">{o.label}</span>
                  {isSelected && <Check className="size-4 shrink-0 text-indigo-600" aria-hidden />}
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </>
  );
}
