"use client";

import { Star } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useStudentGrades, useStudentStats } from "@/lib/student";
import { ErrorState, LoadingState, PageHeader } from "@/components/ui/States";
import { ScoreBadge } from "@/components/teacher/ScorePicker";
import useVoiceRead from "@/components/student/useVoiceRead";

export default function StudentGradesPage() {
  const stats = useStudentStats();
  const grades = useStudentGrades();

  useVoiceRead(
    stats.data && grades.data
      ? [
          stats.data.avg_score != null ? `O'rtacha bahoingiz ${stats.data.avg_score}.` : "Hali baho qo'yilmagan.",
          grades.data.grades.slice(0, 5).length
            ? "So'nggi baholar: " + grades.data.grades.slice(0, 5).map((g) => `${g.subject ?? "dars"} ${g.score}`).join(", ") + "."
            : "",
        ].join(" ")
      : null
  );

  if (grades.isLoading) return <LoadingState />;
  if (grades.error || !grades.data) return <ErrorState message={getErrorMessage(grades.error)} />;

  // Jurnal baholari va baholangan vazifalar bitta ro'yxatda, sanasi bo'yicha
  const all = [
    ...grades.data.grades.map((g) => ({
      key: `g${g.id}`,
      score: g.score,
      date: g.created_at,
      title: g.lesson_title ?? "Darsdagi baho",
      subject: g.subject,
      note: g.comment,
    })),
    ...grades.data.submissions.map((s) => ({
      key: `s${s.id}`,
      score: s.score,
      date: s.graded_at,
      title: `Vazifa: ${s.assignment_title}`,
      subject: s.subject,
      note: s.feedback,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section className="space-y-6">
      {/* Davomat o'quvchiga ko'rsatilmaydi — uni faqat o'qituvchi ko'radi */}
      <PageHeader icon={Star} title="Baholarim" description="Darsdagi va vazifalar uchun olgan baholaringiz" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-sm text-slate-500">O&apos;rtacha baho</p>
          <p className="mt-1 text-3xl font-bold text-indigo-700">{stats.data?.avg_score ?? "—"}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">Baholar soni</p>
          <p className="mt-1 text-3xl font-bold">{all.length}</p>
        </div>
      </div>

      <div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Barcha baholar</h2>
          {all.length === 0 ? (
            <p className="card px-5 py-10 text-center text-slate-500">Hali baho qo&apos;yilmagan</p>
          ) : (
            <ul className="card divide-y divide-line">
              {all.map((g) => (
                <li key={g.key} className="flex items-center gap-4 px-5 py-3">
                  <ScoreBadge score={g.score} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{g.title}</p>
                    <p className="text-sm text-slate-500">
                      {g.subject && `${g.subject} · `}
                      {formatDate(g.date)}
                      {g.note && ` · ${g.note}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
