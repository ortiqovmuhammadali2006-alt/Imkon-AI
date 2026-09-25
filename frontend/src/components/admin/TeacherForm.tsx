"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAdminMutation } from "@/lib/admin";
import type { Teacher } from "@/lib/types";

// teacher berilsa — tahrirlash, aks holda — yangi o'qituvchi
export default function TeacherForm({ teacher, onDone }: { teacher?: Teacher; onDone: () => void }) {
  const [form, setForm] = useState({
    full_name: teacher?.full_name ?? "",
    username: teacher?.username ?? "",
    password: "",
    phone: teacher?.phone ?? "",
    subject: teacher?.subject ?? "",
    monthly_salary: teacher ? String(teacher.monthly_salary) : "",
  });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useAdminMutation(
    () => {
      const body = { ...form, monthly_salary: Number(form.monthly_salary) || 0 };
      return teacher ? api.put(`/admin/teachers/${teacher.id}`, body) : api.post("/admin/teachers", body);
    },
    teacher ? "O'qituvchi ma'lumotlari yangilandi" : "Yangi o'qituvchi qo'shildi",
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
        <label htmlFor="t-name" className="label">F.I.Sh *</label>
        <input id="t-name" required className="input" value={form.full_name} onChange={set("full_name")} />
      </div>
      <div>
        <label htmlFor="t-username" className="label">Login *</label>
        <input
          id="t-username"
          required
          autoComplete="off"
          className="input"
          value={form.username}
          onChange={set("username")}
        />
      </div>
      <div>
        <label htmlFor="t-password" className="label">
          Parol {teacher ? "(o'zgartirish uchun)" : "*"}
        </label>
        <input
          id="t-password"
          type="password"
          autoComplete="new-password"
          required={!teacher}
          minLength={6}
          className="input"
          value={form.password}
          onChange={set("password")}
          placeholder={teacher ? "O'zgarmaydi" : "Kamida 6 ta belgi"}
        />
      </div>
      <div>
        <label htmlFor="t-subject" className="label">Fan</label>
        <input
          id="t-subject"
          className="input"
          value={form.subject}
          onChange={set("subject")}
          placeholder="Masalan: Matematika"
        />
      </div>
      <div>
        <label htmlFor="t-phone" className="label">Telefon</label>
        <input
          id="t-phone"
          type="tel"
          className="input"
          value={form.phone}
          onChange={set("phone")}
          placeholder="+998 90 123 45 67"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="t-salary" className="label">Oylik maosh (so&apos;m)</label>
        <input
          id="t-salary"
          type="number"
          min={0}
          step={1000}
          className="input"
          value={form.monthly_salary}
          onChange={set("monthly_salary")}
          placeholder="0"
        />
      </div>

      <div className="flex justify-end gap-3 sm:col-span-2">
        <button type="button" onClick={onDone} className="btn-secondary">
          Bekor qilish
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {teacher ? "Saqlash" : "Qo'shish"}
        </button>
      </div>
    </form>
  );
}
