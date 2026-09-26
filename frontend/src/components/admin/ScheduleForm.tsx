"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { TimePicker } from "@/components/ui/DatePicker";
import { api } from "@/lib/api";
import { useAdminMutation, useTeachers } from "@/lib/admin";
import type { ScheduleSlot } from "@/lib/types";
import { WEEKDAYS } from "@/components/ui/WeeklySchedule";

// slot berilsa — tahrirlash; defaults — yangi dars uchun oldindan tanlangan qiymatlar
export default function ScheduleForm({
  slot,
  defaults,
  onDone,
}: {
  slot?: ScheduleSlot;
  defaults?: { teacher_id?: string };
  onDone: () => void;
}) {
  const { data: teachers } = useTeachers();
  const [form, setForm] = useState({
    teacher_id: String(slot?.teacher_id ?? defaults?.teacher_id ?? ""),
    day_of_week: String(slot?.day_of_week ?? 1),
    start_time: slot?.start_time ?? "08:30",
    end_time: slot?.end_time ?? "09:15",
    subject: slot?.subject ?? "",
    room: slot?.room ?? "",
    group_name: slot?.group_name ?? "",
  });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const teacher = teachers?.find((t) => String(t.id) === form.teacher_id);

  const save = useAdminMutation(
    (): Promise<unknown> => {
      const body = { ...form, teacher_id: Number(form.teacher_id), day_of_week: Number(form.day_of_week) };
      return slot ? api.put(`/admin/schedule/${slot.id}`, body) : api.post("/admin/schedule", body);
    },
    slot ? "Jadval yangilandi" : "Jadvalga dars qo'shildi",
    onDone
  );
  const remove = useAdminMutation(() => api.delete(`/admin/schedule/${slot!.id}`), "Jadvaldan o'chirildi", onDone);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(undefined);
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <div>
        <label htmlFor="sc-teacher" className="label">O&apos;qituvchi *</label>
        <select id="sc-teacher" required className="input" value={form.teacher_id} onChange={set("teacher_id")}>
          <option value="">Tanlang</option>
          {teachers?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
              {t.subject ? ` — ${t.subject}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="sc-day" className="label">Hafta kuni *</label>
        <select id="sc-day" className="input" value={form.day_of_week} onChange={set("day_of_week")}>
          {WEEKDAYS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="sc-start" className="label">Boshlanishi *</label>
        <TimePicker id="sc-start" value={form.start_time} onChange={(v) => setForm((f) => ({ ...f, start_time: v }))} />
      </div>
      <div>
        <label htmlFor="sc-end" className="label">Tugashi *</label>
        <TimePicker id="sc-end" value={form.end_time} onChange={(v) => setForm((f) => ({ ...f, end_time: v }))} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="sc-subject" className="label">Fan</label>
        <input
          id="sc-subject"
          className="input"
          value={form.subject}
          onChange={set("subject")}
          placeholder={teacher?.subject ? `Bo'sh qolsa: ${teacher.subject}` : "Masalan: Matematika"}
        />
      </div>
      <div>
        <label htmlFor="sc-group" className="label">Sinf / guruh</label>
        <input id="sc-group" className="input" value={form.group_name} onChange={set("group_name")} placeholder="Masalan: 5-A" />
      </div>
      <div>
        <label htmlFor="sc-room" className="label">Xona</label>
        <input id="sc-room" className="input" value={form.room} onChange={set("room")} placeholder="Masalan: 12" />
      </div>

      <div className="flex items-center gap-3 sm:col-span-2">
        {slot && (
          <button
            type="button"
            onClick={() => confirm("Bu darsni jadvaldan o'chirilsinmi?") && remove.mutate(undefined)}
            disabled={remove.isPending}
            className="btn-secondary text-red-600 hover:bg-red-50"
          >
            <Trash2 className="size-4" aria-hidden /> O&apos;chirish
          </button>
        )}
        <div className="ml-auto flex gap-3">
          <button type="button" onClick={onDone} className="btn-secondary">
            Bekor qilish
          </button>
          <button type="submit" disabled={save.isPending} className="btn-primary">
            {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {slot ? "Saqlash" : "Qo'shish"}
          </button>
        </div>
      </div>
    </form>
  );
}
