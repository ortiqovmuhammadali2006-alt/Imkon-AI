import { Clock, DoorOpen, UserRound, Users } from "lucide-react";
import type { ScheduleSlot } from "@/lib/types";
import { formatGrade } from "@/lib/format";

export const WEEKDAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];

// JS: 0 — yakshanba; bizda 1 — dushanba ... 7 — yakshanba
export function todayWeekday() {
  return ((new Date().getDay() + 6) % 7) + 1;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function SlotCard({
  slot,
  showTeacher,
  onClick,
}: {
  slot: ScheduleSlot;
  showTeacher?: boolean;
  onClick?: () => void;
}) {
  const isToday = slot.day_of_week === todayWeekday();
  const now = nowTime();
  const live = isToday && slot.start_time <= now && now < slot.end_time;

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-semibold text-indigo-700">
          <Clock className="size-4" aria-hidden />
          {slot.start_time}–{slot.end_time}
        </span>
        {live && <span className="badge bg-emerald-600 text-white">Hozir</span>}
      </div>
      <p className="mt-1.5 text-lg font-semibold text-slate-900">{slot.subject || "Dars"}</p>
      <div className="mt-2 space-y-1 text-slate-600">
        {showTeacher && (
          <p className="flex items-center gap-1.5">
            <UserRound className="size-4 shrink-0" aria-hidden /> {slot.teacher_name}
          </p>
        )}
        {slot.group_name && (
          <p className="flex items-center gap-1.5">
            <Users className="size-4 shrink-0" aria-hidden /> {formatGrade(slot.group_name)}
          </p>
        )}
        {slot.room && (
          <p className="flex items-center gap-1.5">
            <DoorOpen className="size-4 shrink-0" aria-hidden /> {slot.room}-xona
          </p>
        )}
      </div>
    </>
  );

  const className = `block w-full rounded-xl p-4 text-left ring-1 ${
    live ? "bg-emerald-50 ring-emerald-300" : "bg-surface ring-line"
  }`;

  return onClick ? (
    <button onClick={onClick} className={`${className} hover:ring-indigo-400`}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}

// Haftalik jadval: bir qatorda 3 ta kun (planshetda 2 ta, telefonda 1 ta) — kartalar katta, o'qish oson
export default function WeeklySchedule({
  slots,
  showTeacher,
  onSlotClick,
}: {
  slots: ScheduleSlot[];
  showTeacher?: boolean;
  onSlotClick?: (slot: ScheduleSlot) => void;
}) {
  const today = todayWeekday();
  // Yakshanba faqat unga dars qo'yilgan bo'lsa ko'rinadi
  const days = slots.some((s) => s.day_of_week === 7) ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6];

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {days.map((day) => {
        const daySlots = slots.filter((s) => s.day_of_week === day);
        return (
          <section
            key={day}
            aria-label={WEEKDAYS[day - 1]}
            className={`rounded-2xl p-5 ${day === today ? "bg-indigo-50 ring-2 ring-indigo-300" : "border border-line bg-surface"}`}
          >
            <h3 className="mb-3 flex items-center justify-between px-1 text-lg font-bold text-slate-900">
              {WEEKDAYS[day - 1]}
              {day === today && <span className="badge bg-indigo-600 text-white">Bugun</span>}
            </h3>
            {daySlots.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-slate-400">Dars yo&apos;q</p>
            ) : (
              <div className="space-y-3">
                {daySlots.map((s) => (
                  <SlotCard
                    key={s.id}
                    slot={s}
                    showTeacher={showTeacher}
                    onClick={onSlotClick ? () => onSlotClick(s) : undefined}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
