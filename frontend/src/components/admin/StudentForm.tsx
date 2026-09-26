"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { api } from "@/lib/api";
import { useAdminMutation, useTeachers } from "@/lib/admin";
import { CATEGORIES } from "@/lib/format";
import type { Category, Student } from "@/lib/types";

// student berilsa — tahrirlash, aks holda — yangi o'quvchi
export default function StudentForm({ student, onDone }: { student?: Student; onDone: () => void }) {
  const { data: teachers } = useTeachers();
  const [form, setForm] = useState({
    full_name: student?.full_name ?? "",
    username: student?.username ?? "",
    password: "",
    phone: student?.phone ?? "",
    category: student?.category ?? ("general" as Category),
    grade: student?.grade ?? "",
    birth_date: student?.birth_date ?? "",
  });
  const [teacherIds, setTeacherIds] = useState<number[]>(student?.teachers.map((t) => t.id) ?? []);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleTeacher = (id: number) =>
    setTeacherIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const mutation = useAdminMutation(
    () => {
      const body = { ...form, teacher_ids: teacherIds };
      return student ? api.put(`/admin/students/${student.id}`, body) : api.post("/admin/students", body);
    },
    student ? "O'quvchi ma'lumotlari yangilandi" : "Yangi o'quvchi qo'shildi",
    onDone
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(undefined);
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <label htmlFor="s-name" className="label">F.I.Sh *</label>
        <input id="s-name" required className="input" value={form.full_name} onChange={set("full_name")} />
      </div>
      <div>
        <label htmlFor="s-username" className="label">Login *</label>
        <input
          id="s-username"
          required
          autoComplete="off"
          className="input"
          value={form.username}
          onChange={set("username")}
        />
      </div>
      <div>
        <label htmlFor="s-password" className="label">
          Parol {student ? "(o'zgartirish uchun)" : "*"}
        </label>
        <input
          id="s-password"
          type="password"
          autoComplete="new-password"
          required={!student}
          minLength={8}
          className="input"
          value={form.password}
          onChange={set("password")}
          placeholder={student ? "O'zgarmaydi" : "Kamida 8 ta belgi"}
        />
      </div>

      <fieldset className="sm:col-span-2">
        <legend className="label">Toifa *</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(CATEGORIES) as Category[]).map((key) => (
            <label
              key={key}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 ${
                form.category === key ? "border-indigo-500 bg-indigo-50" : "border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="category"
                value={key}
                checked={form.category === key}
                onChange={set("category")}
                className="accent-indigo-600"
              />
              {CATEGORIES[key].label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="s-grade" className="label">Sinf / guruh</label>
        <input id="s-grade" className="input" value={form.grade} onChange={set("grade")} placeholder="Masalan: 5-A" />
      </div>
      <div>
        <label htmlFor="s-birth" className="label">Tug&apos;ilgan sana</label>
        <DatePicker id="s-birth" value={form.birth_date} max={new Date().toISOString().slice(0, 10)} onChange={(v) => setForm((f) => ({ ...f, birth_date: v }))} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="s-phone" className="label">Telefon (ota-ona)</label>
        <input
          id="s-phone"
          type="tel"
          className="input"
          value={form.phone}
          onChange={set("phone")}
          placeholder="+998 90 123 45 67"
        />
      </div>

      <fieldset className="sm:col-span-2">
        <legend className="label">O&apos;qituvchilari</legend>
        {!teachers?.length ? (
          <p className="text-sm text-slate-500">Avval o&apos;qituvchi qo&apos;shing</p>
        ) : (
          <div className="grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-slate-300 p-2 sm:grid-cols-2">
            {teachers.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={teacherIds.includes(t.id)}
                  onChange={() => toggleTeacher(t.id)}
                  className="accent-indigo-600"
                />
                <span className="truncate">
                  {t.full_name}
                  {t.subject && <span className="text-slate-500"> · {t.subject}</span>}
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex justify-end gap-3 sm:col-span-2">
        <button type="button" onClick={onDone} className="btn-secondary">
          Bekor qilish
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {student ? "Saqlash" : "Qo'shish"}
        </button>
      </div>
    </form>
  );
}
