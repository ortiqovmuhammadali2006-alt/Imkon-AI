"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";

// Brauzerning inglizcha sana/oy/vaqt oynalari o'rniga — o'zbekcha, sayt uslubidagi tanlagichlar.
// Qiymat formatlari <input type="date|month|time"> bilan bir xil: "2026-09-26", "2026-09", "08:30"

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const MONTHS_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];
const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const WEEKDAYS_FULL = ["dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba", "yakshanba"];

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
};
const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7; // dushanba = 0

// "2026-09-26" -> "26-sentabr, 2026"
export function formatUzDate(value: string) {
  const d = fromIso(value);
  return d ? `${d.getDate()}-${MONTHS[d.getMonth()].toLowerCase()}, ${d.getFullYear()}` : "";
}

const TRIGGER =
  "input flex items-center gap-2.5 text-left data-[open=true]:border-indigo-400 data-[open=true]:ring-4 data-[open=true]:ring-indigo-100";
const PANEL = "fixed z-[60] animate-pop rounded-2xl bg-surface p-3 shadow-2xl ring-1 ring-slate-200 outline-none";
const NAV_BTN = "flex size-9 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-30";

// ---------- Umumiy ochiladigan oyna: tugma ostida (joy bo'lmasa — ustida), tashqariga bosilsa yoki Esc — yopiladi ----------
// Portal orqali body'ga chiqadi — Modal ichidagi aylantirish (overflow) uni qirqib qo'ymasin

function Popover({
  anchorRef,
  rect,
  open,
  onClose,
  onReposition,
  label,
  height,
  children,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  rect: DOMRect | null; // tugmaning o'lchami (ochilganda va aylantirilganda yangilanadi)
  open: boolean;
  onClose: (focusTrigger: boolean) => void;
  onReposition: () => void;
  label: string;
  height: number;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const onRepositionRef = useRef(onReposition);
  useEffect(() => {
    onCloseRef.current = onClose;
    onRepositionRef.current = onReposition;
  });
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    if (!open) return;
    const place = () => onRepositionRef.current();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !anchorRef.current?.contains(t)) onCloseRef.current(false);
    };
    // Esc — faqat shu oynani yopadi. Capture bosqichida ushlanadi: fokus hali tugmada bo'lsa ham
    // ota Modal'ning Esc'i ishlamaydi (aks holda Modal ham yopilib ketadi)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onCloseRef.current(true);
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef]);

  if (!open || !mounted || !rect) return null;
  // Tugma ostida; pastda joy yetmasa — ustida
  const below = window.innerHeight - rect.bottom;
  const pos = {
    top: below < height + 12 && rect.top > below ? rect.top - height - 8 : rect.bottom + 8,
    left: Math.max(16, Math.min(rect.left, window.innerWidth - 16 - 316)),
  };
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      style={{ top: pos.top, left: pos.left }}
      className={PANEL}
    >
      {children}
    </div>,
    document.body
  );
}

// Har bir tanlagich uchun: ochiq/yopiq holat, tugma o'lchami (bosilganda o'lchanadi), yopilganda fokus tugmaga qaytadi
function usePicker() {
  const [open, setOpenState] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const measure = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setRect(r);
  }, []);
  const setOpen = useCallback(
    (next: boolean) => {
      if (next) measure();
      setOpenState(next);
    },
    [measure]
  );
  const close = useCallback((focusTrigger = true) => {
    setOpenState(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);
  return { open, setOpen, close, triggerRef, rect, measure };
}

// ---------- Sana ----------

export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  placeholder = "Sanani tanlang",
  clearable = true,
  className = "",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  clearable?: boolean;
  className?: string;
}) {
  const { open, setOpen, close, triggerRef, rect, measure } = usePicker();
  const selected = value ? fromIso(value) : null;
  const minD = min ? fromIso(min) : null;
  const maxD = max ? fromIso(max) : null;
  const [cursor, setCursor] = useState<Date>(() => selected ?? new Date()); // klaviatura fokusidagi kun
  const [view, setView] = useState<"days" | "months">("days");
  const gridRef = useRef<HTMLDivElement>(null);
  const today = new Date();

  const disabled = (d: Date) => (minD && d < minD) || (maxD && d > maxD) || false;

  const openPicker = () => {
    const start = selected ?? (maxD && today > maxD ? maxD : today);
    setCursor(start);
    setView("days");
    setOpen(true);
  };

  // Ochilganda va kursor o'zgarganda fokus tanlangan kunga o'tadi
  useEffect(() => {
    if (!open || view !== "days") return;
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${toIso(cursor)}"]`);
    btn?.focus({ preventScroll: true });
  }, [open, cursor, view]);

  const pick = (d: Date) => {
    if (disabled(d)) return;
    onChange(toIso(d));
    close();
  };

  const onGridKey = (e: React.KeyboardEvent) => {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      Home: () => addDays(cursor, -weekdayIndex(cursor)),
      End: () => addDays(cursor, 6 - weekdayIndex(cursor)),
      PageUp: () => addMonths(cursor, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(cursor, e.shiftKey ? 12 : 1),
    };
    if (moves[e.key]) {
      e.preventDefault();
      setCursor(moves[e.key]());
    }
  };

  // 6 hafta: oyning birinchi kuni joylashgan haftaning dushanbasidan
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = addDays(first, -weekdayIndex(first));
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => (open ? close() : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-open={open}
        className={`${TRIGGER} ${className}`}
      >
        <CalendarDays className="size-5 shrink-0 text-indigo-600" aria-hidden />
        <span className={`flex-1 truncate ${value ? "text-slate-900" : "text-slate-400"}`}>{value ? formatUzDate(value) : placeholder}</span>
      </button>

      <Popover anchorRef={triggerRef} rect={rect} open={open} onClose={close} onReposition={measure} label="Sana tanlash" height={372}>
        <div className="w-[300px]">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className={NAV_BTN}
              onClick={() => setCursor(view === "days" ? addMonths(cursor, -1) : addMonths(cursor, -12))}
              aria-label={view === "days" ? "Oldingi oy" : "Oldingi yil"}
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => setView(view === "days" ? "months" : "days")}
              className="rounded-xl px-3 py-1.5 font-semibold text-slate-900 transition-colors hover:bg-slate-100"
              aria-label={view === "days" ? "Oy va yilni tanlash" : "Kunlarga qaytish"}
            >
              {view === "days" ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}` : cursor.getFullYear()}
            </button>
            <button
              type="button"
              className={NAV_BTN}
              onClick={() => setCursor(view === "days" ? addMonths(cursor, 1) : addMonths(cursor, 12))}
              aria-label={view === "days" ? "Keyingi oy" : "Keyingi yil"}
            >
              <ChevronRight className="size-5" />
            </button>
          </div>

          {view === "days" ? (
            <div ref={gridRef} role="grid" aria-label={`${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`} onKeyDown={onGridKey}>
              <div role="row" className="mb-1 grid grid-cols-7">
                {WEEKDAYS.map((w, i) => (
                  <span
                    key={w}
                    role="columnheader"
                    aria-label={WEEKDAYS_FULL[i]}
                    className={`py-1.5 text-center text-xs font-semibold ${i >= 5 ? "text-red-600" : "text-slate-400"}`}
                  >
                    {w}
                  </span>
                ))}
              </div>
              {Array.from({ length: 6 }, (_, w) => (
                <div role="row" key={w} className="grid grid-cols-7 gap-0.5">
                  {days.slice(w * 7, w * 7 + 7).map((d) => {
                    const inMonth = d.getMonth() === cursor.getMonth();
                    const isSel = selected && sameDay(d, selected);
                    const isToday = sameDay(d, today);
                    const off = disabled(d);
                    return (
                      <span role="gridcell" key={toIso(d)} aria-selected={!!isSel}>
                        <button
                          type="button"
                          data-day={toIso(d)}
                          tabIndex={sameDay(d, cursor) ? 0 : -1}
                          disabled={off}
                          onClick={() => pick(d)}
                          aria-label={`${d.getDate()}-${MONTHS[d.getMonth()].toLowerCase()}, ${d.getFullYear()}, ${WEEKDAYS_FULL[weekdayIndex(d)]}${isToday ? ", bugun" : ""}`}
                          aria-current={isToday ? "date" : undefined}
                          className={`flex size-10 w-full items-center justify-center rounded-xl text-sm transition-colors focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-25 ${
                            isSel
                              ? "bg-indigo-600 font-semibold text-white shadow-md shadow-indigo-600/30"
                              : isToday
                                ? "font-semibold text-indigo-700 ring-2 ring-indigo-300 ring-inset hover:bg-indigo-50"
                                : inMonth
                                  ? "text-slate-800 hover:bg-indigo-50"
                                  : "text-slate-400 hover:bg-slate-100"
                          }`}
                        >
                          {d.getDate()}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 py-2">
              {MONTHS.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setCursor(new Date(cursor.getFullYear(), i, Math.min(cursor.getDate(), 28)));
                    setView("days");
                  }}
                  className={`rounded-xl py-3 text-sm font-medium transition-colors ${
                    i === cursor.getMonth() ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-indigo-50"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            {clearable && value ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  close();
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
              >
                Tozalash
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              disabled={disabled(today)}
              onClick={() => pick(today)}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
            >
              Bugun
            </button>
          </div>
        </div>
      </Popover>
    </>
  );
}

// ---------- Oy ----------

export function MonthPicker({
  id,
  value,
  onChange,
  max,
  className = "",
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string; // "2026-09"
  onChange: (value: string) => void;
  max?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const { open, setOpen, close, triggerRef, rect, measure } = usePicker();
  const [y, m] = value.split("-").map(Number);
  const [year, setYear] = useState(y || new Date().getFullYear());
  const [maxY, maxM] = (max ?? "").split("-").map(Number);
  const over = (yy: number, mm: number) => !!max && (yy > maxY || (yy === maxY && mm > maxM));

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-label={ariaLabel}
        onClick={() => {
          setYear(y || new Date().getFullYear());
          setOpen(!open);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-open={open}
        className={`${TRIGGER} ${className}`}
      >
        <CalendarDays className="size-5 shrink-0 text-indigo-600" aria-hidden />
        <span className="flex-1 truncate text-slate-900">{y && m ? `${MONTHS[m - 1]} ${y}` : "Oyni tanlang"}</span>
      </button>

      <Popover anchorRef={triggerRef} rect={rect} open={open} onClose={close} onReposition={measure} label="Oy tanlash" height={250}>
        <div className="w-[280px]">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className={NAV_BTN} onClick={() => setYear(year - 1)} aria-label="Oldingi yil">
              <ChevronLeft className="size-5" />
            </button>
            <span className="font-semibold text-slate-900">{year}</span>
            <button type="button" className={NAV_BTN} onClick={() => setYear(year + 1)} disabled={!!max && year >= maxY} aria-label="Keyingi yil">
              <ChevronRight className="size-5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MONTHS_SHORT.map((short, i) => {
              const sel = year === y && i + 1 === m;
              const now = new Date();
              const isCurrent = year === now.getFullYear() && i === now.getMonth();
              return (
                <button
                  key={short}
                  type="button"
                  autoFocus={sel}
                  disabled={over(year, i + 1)}
                  aria-label={`${MONTHS[i]} ${year}`}
                  aria-pressed={sel}
                  onClick={() => {
                    onChange(`${year}-${pad(i + 1)}`);
                    close();
                  }}
                  className={`rounded-xl py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${
                    sel
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : isCurrent
                        ? "text-indigo-700 ring-2 ring-indigo-300 ring-inset hover:bg-indigo-50"
                        : "text-slate-700 hover:bg-indigo-50"
                  }`}
                >
                  {short}
                </button>
              );
            })}
          </div>
        </div>
      </Popover>
    </>
  );
}

// ---------- Vaqt ----------

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));

export function TimePicker({
  id,
  value,
  onChange,
  className = "",
}: {
  id?: string;
  value: string; // "08:30" (bazadan "08:30:00" kelsa ham bo'ladi)
  onChange: (value: string) => void;
  className?: string;
}) {
  const { open, setOpen, close, triggerRef, rect, measure } = usePicker();
  const [h, m] = (value || "08:00").slice(0, 5).split(":");
  const listRef = useRef<HTMLDivElement>(null);

  // Ochilganda tanlangan soat va daqiqa ko'rinadigan joyga suriladi
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      listRef.current?.querySelectorAll<HTMLElement>("[data-selected=true]").forEach((el) => el.scrollIntoView({ block: "center" }));
      listRef.current?.querySelector<HTMLElement>("[data-selected=true]")?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  const column = (items: string[], current: string, label: string, set: (v: string) => void) => (
    <div role="listbox" aria-label={label} className="flex h-64 flex-col gap-1 overflow-y-auto px-1">
      {items.map((v) => (
        <button
          key={v}
          type="button"
          role="option"
          aria-selected={v === current}
          data-selected={v === current}
          onClick={() => set(v)}
          className={`shrink-0 rounded-lg px-4 py-2 text-center font-medium tabular-nums transition-colors ${
            v === current ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-700 hover:bg-indigo-50"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-open={open}
        className={`${TRIGGER} ${className}`}
      >
        <Clock className="size-5 shrink-0 text-indigo-600" aria-hidden />
        <span className="flex-1 text-slate-900 tabular-nums">{value ? value.slice(0, 5) : "Vaqtni tanlang"}</span>
      </button>

      <Popover anchorRef={triggerRef} rect={rect} open={open} onClose={close} onReposition={measure} label="Vaqt tanlash" height={290}>
        <div ref={listRef} className="flex items-start gap-1">
          {column(HOURS, h, "Soat", (hh) => onChange(`${hh}:${m}`))}
          <span className="self-center text-lg font-bold text-slate-400">:</span>
          {column(MINUTES, MINUTES.includes(m) ? m : "", "Daqiqa", (mm) => {
            onChange(`${h}:${mm}`);
            close();
          })}
        </div>
      </Popover>
    </>
  );
}
