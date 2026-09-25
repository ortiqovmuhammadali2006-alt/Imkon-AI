"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { currentMonth, formatDate, formatMonth } from "@/lib/format";
import { useGradeSummary, useGrades, useTeacherMutation, type Grade } from "@/lib/teacher";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import CategoryBadge from "@/components/ui/CategoryBadge";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";
import GradeForm from "@/components/teacher/GradeForm";
import { ScoreBadge } from "@/components/teacher/ScorePicker";

// Forma holati: yopiq | yangi (ixtiyoriy o'quvchi bilan) | tahrirlash
type FormState = { mode: "closed" } | { mode: "new"; studentId?: number } | { mode: "edit"; grade: Grade };

export default function GradesPage() {
  const summary = useGradeSummary();
  const [month, setMonth] = useState(currentMonth);
  const grades = useGrades(month);
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [deleting, setDeleting] = useState<Grade | null>(null);

  const remove = useTeacherMutation(
    (g: Grade) => api.delete(`/teacher/grades/${g.id}`),
    "Baho o'chirildi",
    () => setDeleting(null)
  );
  const close = () => setForm({ mode: "closed" });

  return (
    <section className="space-y-8">
      <PageHeader
        title="Baholar"
        description="O'quvchilarga baho qo'ying va o'zlashtirishni kuzating"
        action={
          <button onClick={() => setForm({ mode: "new" })} className="btn-primary">
            <Plus className="size-5" aria-hidden /> Baho qo&apos;yish
          </button>
        }
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold">O&apos;quvchilar bo&apos;yicha</h2>
        {summary.isLoading ? (
          <LoadingState />
        ) : summary.error ? (
          <ErrorState message={getErrorMessage(summary.error)} />
        ) : !summary.data?.length ? (
          <EmptyState message="Sizga hali o'quvchi biriktirilmagan. Admin bilan bog'laning." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3">O&apos;quvchi</th>
                  <th className="px-4 py-3 text-center">Baholar soni</th>
                  <th className="px-4 py-3 text-center">O&apos;rtacha</th>
                  <th className="px-4 py-3 text-center">Oxirgi</th>
                  <th className="px-4 py-3 text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.data.map((s) => (
                  <tr key={s.student_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{s.full_name}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-slate-500">
                        <CategoryBadge category={s.category} />
                        {s.grade}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">{s.grades_count}</td>
                    <td className="px-4 py-3 text-center font-semibold">{s.avg_score ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge score={s.last_score} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setForm({ mode: "new", studentId: s.student_id })}
                        className="btn-secondary px-3 py-1.5 text-sm"
                      >
                        <Plus className="size-4" aria-hidden /> Baho
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold">{formatMonth(month)} — qo&apos;yilgan baholar</h2>
          <input
            type="month"
            aria-label="Oy"
            className="input sm:w-52"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </div>
        {grades.isLoading ? (
          <LoadingState />
        ) : !grades.data?.length ? (
          <p className="card px-5 py-8 text-center text-slate-500">Bu oyda baho qo&apos;yilmagan</p>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {grades.data.map((g) => (
              <li key={g.id} className="flex items-center gap-4 px-5 py-3">
                <ScoreBadge score={g.score} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{g.student_name}</p>
                  <p className="truncate text-sm text-slate-500">
                    {formatDate(g.created_at)}
                    {g.lesson_title && ` · ${g.lesson_title}`}
                    {g.comment && ` · ${g.comment}`}
                  </p>
                </div>
                <button onClick={() => setForm({ mode: "edit", grade: g })} className="icon-btn" aria-label="Tahrirlash" title="Tahrirlash">
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={() => setDeleting(g)}
                  className="icon-btn hover:bg-red-50 hover:text-red-600"
                  aria-label="O'chirish"
                  title="O'chirish"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={form.mode !== "closed"} title={form.mode === "edit" ? "Bahoni tahrirlash" : "Baho qo'yish"} onClose={close}>
        {form.mode === "new" && <GradeForm key={`new-${form.studentId ?? ""}`} studentId={form.studentId} onDone={close} />}
        {form.mode === "edit" && <GradeForm key={form.grade.id} grade={form.grade} onDone={close} />}
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        title="Bahoni o'chirish"
        message={
          <>
            <b>{deleting?.student_name}</b> ning {deleting?.score} bahosi o&apos;chiriladi.
          </>
        }
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}
