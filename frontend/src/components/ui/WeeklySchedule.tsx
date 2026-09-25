import { Clock, DoorOpen, UserRound, Users } from "lucide-react";
import type { ScheduleSlot } from "@/lib/types";

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
        <span className="flex items-center gap-1 text-sm font-semibold text-indigo-700">
          <Clock className="size-3.5" aria-hidden />
          {slot.start_time}–{slot.end_time}
        </span>
        {live && <span className="badge bg-emerald-600 text-white">Hozir</span>}
      </div>
      <p className="mt-1 font-medium">{slot.subject || "Dars"}</p>
      <div className="mt-1 space-y-0.5 text-sm text-slate-500">
        {showTeacher && (
          <p className="flex items-center gap-1.5">
            <UserRound className="size-3.5 shrink-0" aria-hidden /> {slot.teacher_name}
          </p>
        )}
        {slot.group_name && (
          <p className="flex items-center gap-1.5">
            <Users className="size-3.5 shrink-0" aria-hidden /> {slot.group_name}
          </p>
        )}
        {slot.room && (
          <p className="flex items-center gap-1.5">
            <DoorOpen className="size-3.5 shrink-0" aria-hidden /> {slot.room}-xona
          </p>
        )}
      </div>
    </>
  );

  const className = `block w-full rounded-xl p-3 text-left ring-1 ${
    live ? "bg-emerald-50 ring-emerald-300" : "bg-white ring-slate-200"
  }`;

  return onClick ? (
    <button onClick={onClick} className={`${className} hover:ring-indigo-400`}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}

// Haftalik jadval: kunlar ustun bo'lib (kichik ekranda — ketma-ket)
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
    <div className={`grid gap-3 md:grid-cols-3 ${days.length === 7 ? "xl:grid-cols-7" : "xl:grid-cols-6"}`}>
      {days.map((day) => {
        const daySlots = slots.filter((s) => s.day_of_week === day);
        return (
          <section
            key={day}
            aria-label={WEEKDAYS[day - 1]}
            className={`rounded-2xl p-3 ${day === today ? "bg-indigo-50 ring-2 ring-indigo-300" : "bg-slate-100/70"}`}
          >
            <h3 className="mb-2 flex items-center justify-between px-1 font-semibold">
              {WEEKDAYS[day - 1]}
              {day === today && <span className="badge bg-indigo-600 text-white">Bugun</span>}
            </h3>
            {daySlots.length === 0 ? (
              <p className="px-1 py-3 text-sm text-slate-400">Dars yo&apos;q</p>
            ) : (
              <div className="space-y-2">
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
