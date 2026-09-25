"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { api } from "@/lib/api";
import { useTeacherMutation, type Assignment } from "@/lib/teacher";

export default function AssignmentForm({
  lessonId,
  assignment,
  onDone,
}: {
  lessonId: number;
  assignment?: Assignment;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    title: assignment?.title ?? "",
    description: assignment?.description ?? "",
    due_date: assignment?.due_date ?? "",
  });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useTeacherMutation(
    () =>
      assignment
        ? api.put(`/teacher/assignments/${assignment.id}`, form)
        : api.post(`/teacher/lessons/${lessonId}/assignments`, form),
    assignment ? "Vazifa yangilandi" : "Vazifa qo'shildi",
    onDone
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(undefined);
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="a-title" className="label">Vazifa nomi *</label>
        <input id="a-title" required minLength={3} className="input" value={form.title} onChange={set("title")} />
      </div>
      <div>
        <label htmlFor="a-desc" className="label">Topshiriq matni</label>
        <textarea
          id="a-desc"
          rows={5}
          className="input resize-y"
          value={form.description}
          onChange={set("description")}
          placeholder="O'quvchi nima qilishi kerak"
        />
      </div>
      <div>
        <label htmlFor="a-due" className="label">Topshirish muddati</label>
        <DatePicker id="a-due" value={form.due_date} onChange={(v) => setForm((f) => ({ ...f, due_date: v }))} />
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onDone} className="btn-secondary">
          Bekor qilish
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {assignment ? "Saqlash" : "Qo'shish"}
        </button>
      </div>
    </form>
  );
}
