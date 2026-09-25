"use client";

import { getErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useStudentAttendance, useStudentGrades, useStudentStats } from "@/lib/student";
import { ErrorState, LoadingState, PageHeader } from "@/components/ui/States";
import { ScoreBadge } from "@/components/teacher/ScorePicker";

const ATTENDANCE_LABEL = {
  present: { label: "Keldi", className: "bg-emerald-100 text-emerald-700" },
  late: { label: "Kechikdi", className: "bg-amber-100 text-amber-800" },
  absent: { label: "Kelmadi", className: "bg-red-100 text-red-700" },
};

export default function StudentGradesPage() {
  const stats = useStudentStats();
  const grades = useStudentGrades();
  const attendance = useStudentAttendance();

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

  const present = attendance.data?.filter((a) => a.status !== "absent").length ?? 0;

  return (
    <section className="space-y-6">
      <PageHeader title="Baholarim" description="Baholaringiz va so'nggi 30 kunlik davomatingiz" />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-slate-500">O&apos;rtacha baho</p>
          <p className="mt-1 text-3xl font-bold text-indigo-700">{stats.data?.avg_score ?? "—"}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">Baholar soni</p>
          <p className="mt-1 text-3xl font-bold">{all.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">Davomat (30 kun)</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">
            {stats.data?.attendance_rate != null ? `${stats.data.attendance_rate}%` : "—"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Barcha baholar</h2>
          {all.length === 0 ? (
            <p className="card px-5 py-10 text-center text-slate-500">Hali baho qo&apos;yilmagan</p>
          ) : (
            <ul className="card divide-y divide-slate-100">
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

        <div>
          <h2 className="mb-3 text-lg font-semibold">Davomat</h2>
          {!attendance.data?.length ? (
            <p className="card px-5 py-10 text-center text-slate-500">Davomat belgilanmagan</p>
          ) : (
            <div className="card">
              <p className="border-b border-slate-100 px-5 py-3 text-sm text-slate-600">
                {attendance.data.length} kundan {present} kun qatnashgan
              </p>
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                {attendance.data.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span>
                      {formatDate(a.date)}
                      {a.subject && <span className="text-slate-500"> · {a.subject}</span>}
                    </span>
                    <span className={`badge ${ATTENDANCE_LABEL[a.status].className}`}>{ATTENDANCE_LABEL[a.status].label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
