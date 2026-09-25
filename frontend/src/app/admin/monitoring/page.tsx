"use client";

import { useState } from "react";
import { BookOpen, CalendarCheck, ChevronRight, Star } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { useMonitoring, useTeacherActivity } from "@/lib/admin";
import { CATEGORIES, daysAgo, formatDate } from "@/lib/format";
import type { TeacherActivity } from "@/lib/types";
import Modal from "@/components/ui/Modal";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";

// So'nggi faollikka qarab holat: 7 kun ichida — faol, 30 kun ichida — sust
function ActivityBadge({ lastActivity }: { lastActivity: string | null }) {
  const days = daysAgo(lastActivity);
  if (days === null) return <span className="badge bg-slate-100 text-slate-600">Faoliyat yo&apos;q</span>;
  if (days <= 7) return <span className="badge bg-emerald-100 text-emerald-700">Faol</span>;
  if (days <= 30) return <span className="badge bg-amber-100 text-amber-800">Sust</span>;
  return <span className="badge bg-red-100 text-red-700">Nofaol</span>;
}

function lastActivityText(value: string | null) {
  const days = daysAgo(value);
  if (days === null) return "—";
  if (days === 0) return "Bugun";
  if (days === 1) return "Kecha";
  return `${days} kun oldin`;
}

function TeacherDetail({ id }: { id: number }) {
  const { data, isLoading, error } = useTeacherActivity(id);
  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={getErrorMessage(error)} />;

  const { attendance } = data;
  const totalAttendance = attendance.present + attendance.absent + attendance.late;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 font-semibold">Davomat (so&apos;nggi 30 kun)</h3>
        {totalAttendance === 0 ? (
          <p className="text-sm text-slate-500">Davomat belgilanmagan</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-2xl font-bold text-emerald-700">{attendance.present}</p>
              <p className="text-sm text-emerald-700">Kelgan</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-2xl font-bold text-amber-700">{attendance.late}</p>
              <p className="text-sm text-amber-700">Kechikkan</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-2xl font-bold text-red-700">{attendance.absent}</p>
              <p className="text-sm text-red-700">Kelmagan</p>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-semibold">So&apos;nggi darslar</h3>
        {data.lessons.length === 0 ? (
          <p className="text-sm text-slate-500">Dars yuklanmagan</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {data.lessons.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="font-medium">{l.title}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`badge ${l.category ? CATEGORIES[l.category].className : "bg-indigo-50 text-indigo-700"}`}>
                    {l.category ? CATEGORIES[l.category].label : "Barcha toifalar"}
                  </span>
                  <span className="text-slate-500">{formatDate(l.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-semibold">So&apos;nggi baholar</h3>
        {data.grades.length === 0 ? (
          <p className="text-sm text-slate-500">Baho qo&apos;yilmagan</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {data.grades.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span>
                  <span className="font-medium">{g.student_name}</span>
                  {g.comment && <span className="text-slate-500"> — {g.comment}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-bold text-indigo-700">{g.score}</span>
                  <span className="text-slate-500">{formatDate(g.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function MonitoringPage() {
  const { data, isLoading, error } = useMonitoring();
  const [selected, setSelected] = useState<TeacherActivity | null>(null);

  const activeCount = data?.filter((t) => (daysAgo(t.last_activity) ?? Infinity) <= 7).length ?? 0;

  return (
    <section>
      <PageHeader
        title="Nazorat"
        description="O'qituvchilarning so'nggi 30 kundagi faoliyati. Batafsil ko'rish uchun qatorni bosing."
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error)} />
      ) : data!.length === 0 ? (
        <EmptyState message="Nazorat qilish uchun avval o'qituvchi qo'shing" />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <p className="text-sm text-slate-500">Oxirgi 7 kunda faol</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {activeCount} / {data!.length}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-slate-500">30 kunda yuklangan darslar</p>
              <p className="mt-1 text-2xl font-bold">
                {data!.reduce((sum, t) => sum + t.lessons_month, 0)} ta
              </p>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3">O&apos;qituvchi</th>
                  <th className="px-4 py-3 text-center">O&apos;quvchilar</th>
                  <th className="px-4 py-3 text-center">
                    <BookOpen className="inline size-4" aria-hidden /> Darslar (30 kun)
                  </th>
                  <th className="px-4 py-3 text-center">
                    <CalendarCheck className="inline size-4" aria-hidden /> Davomat kunlari
                  </th>
                  <th className="px-4 py-3 text-center">
                    <Star className="inline size-4" aria-hidden /> Baholar
                  </th>
                  <th className="px-4 py-3 text-center">O&apos;rtacha baho</th>
                  <th className="px-4 py-3">So&apos;nggi faollik</th>
                  <th className="px-4 py-3">Holat</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data!.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <button
                        className="text-left font-medium hover:text-indigo-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(t);
                        }}
                      >
                        {t.full_name}
                      </button>
                      <p className="text-slate-500">
                        {t.subject || "—"}
                        {!t.is_active && <span className="ml-2 text-red-600">(bloklangan)</span>}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">{t.students_count}</td>
                    <td className="px-4 py-3 text-center">
                      {t.lessons_month}
                      <span className="text-slate-400"> / {t.lessons_total}</span>
                    </td>
                    <td className="px-4 py-3 text-center">{t.attendance_days_month}</td>
                    <td className="px-4 py-3 text-center">{t.grades_month}</td>
                    <td className="px-4 py-3 text-center">{t.avg_grade ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{lastActivityText(t.last_activity)}</td>
                    <td className="px-4 py-3">
                      <ActivityBadge lastActivity={t.last_activity} />
                    </td>
                    <td className="px-2 py-3 text-slate-400">
                      <ChevronRight className="size-4" aria-hidden />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal
        open={selected !== null}
        title={selected ? `${selected.full_name} — faoliyat` : ""}
        onClose={() => setSelected(null)}
        size="lg"
      >
        {selected && <TeacherDetail id={selected.id} />}
      </Modal>
    </section>
  );
}
