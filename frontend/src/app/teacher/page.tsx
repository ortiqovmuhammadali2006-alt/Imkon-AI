"use client";

import Link from "next/link";
import { AlertTriangle, BookOpen, Coffee, CalendarCheck, ClipboardCheck, ClipboardList, Users } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import WelcomeBanner from "@/components/ui/WelcomeBanner";
import Avatar from "@/components/ui/Avatar";
import { getErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CATEGORIES, formatDate, formatGrade } from "@/lib/format";
import { useMySchedule, useMyStudents, useTeacherStats } from "@/lib/teacher";
import { SlotCard, WEEKDAYS, todayWeekday } from "@/components/ui/WeeklySchedule";
import type { Category } from "@/lib/types";
import CategoryBadge from "@/components/ui/CategoryBadge";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { ScoreBadge } from "@/components/teacher/ScorePicker";

function TodaySchedule() {
  const { data } = useMySchedule();
  if (!data) return null;
  const today = data.filter((s) => s.day_of_week === todayWeekday());

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Bugungi darslar — {WEEKDAYS[todayWeekday() - 1]}</h2>
        <Link href="/teacher/schedule" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
          Haftalik jadval →
        </Link>
      </div>
      {today.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-slate-500">Bugun darsingiz yo&apos;q — dam oling <Coffee className="mx-1 inline size-[1.1em] align-[-0.15em] text-indigo-600" aria-hidden /></p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {today.map((s) => (
            <SlotCard key={s.id} slot={s} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeacherHome() {
  const { user } = useAuth();
  const stats = useTeacherStats();
  const students = useMyStudents();

  if (stats.isLoading) return <LoadingState />;
  if (stats.error || !stats.data) return <ErrorState message={getErrorMessage(stats.error)} />;
  const s = stats.data;

  return (
    <section className="space-y-8">
      <WelcomeBanner
        name={user?.full_name ?? ""}
        subtitle={user?.subject ? `${user.subject} fani o'qituvchisi · bugungi holat va o'quvchilaringiz` : "Bugungi holat va o'quvchilaringiz"}
      >
        <div className="flex flex-col gap-2">
          {s.students.total > 0 && s.attendance_marked_today === 0 && (
            <Link href="/teacher/attendance" className="flex items-center gap-2.5 rounded-xl bg-amber-400/90 px-4 py-2.5 text-sm font-semibold text-[#451a03] shadow-lg shadow-black/20 hover:bg-[#fcd34d]">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              Bugungi davomat belgilanmagan
            </Link>
          )}
          {s.ungraded_submissions > 0 && (
            <Link href="/teacher/lessons" className="flex items-center gap-2.5 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-medium ring-1 ring-white/25 backdrop-blur-sm hover:bg-white/25">
              <ClipboardCheck className="size-4 shrink-0" aria-hidden />
              {s.ungraded_submissions} ta ish tekshirilishini kutmoqda
            </Link>
          )}
        </div>
      </WelcomeBanner>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="O'quvchilarim" value={s.students.total} href="/teacher/grades" />
        <StatCard icon={BookOpen} label="Darslar" value={s.lessons} href="/teacher/lessons" />
        <StatCard icon={ClipboardList} label="Faol vazifalar" value={s.open_assignments} href="/teacher/lessons" />
        <StatCard icon={CalendarCheck} label="Bugun belgilangan" value={s.attendance_marked_today} href="/teacher/attendance" />
      </div>

      <TodaySchedule />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-2">
          <h2 className="border-b border-slate-100 px-6 py-4 text-lg font-semibold tracking-tight">O&apos;quvchilarim</h2>
          {students.isLoading ? (
            <LoadingState />
          ) : !students.data?.length ? (
            <p className="px-5 py-10 text-center text-slate-500">Sizga hali o&apos;quvchi biriktirilmagan. Admin bilan bog&apos;laning.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-5 py-3">O&apos;quvchi</th>
                    <th className="px-5 py-3">Toifa</th>
                    <th className="px-5 py-3 text-center">O&apos;rtacha baho</th>
                    <th className="px-5 py-3 text-center">Davomat (30 kun)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.data.map((st) => (
                    <tr key={st.id} className={`transition-colors hover:bg-slate-50/70 ${st.is_active ? "" : "opacity-50"}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={st.full_name} size="sm" />
                          <div>
                            <p className="font-medium">{st.full_name}</p>
                            <p className="text-slate-500">{formatGrade(st.grade) || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <CategoryBadge category={st.category} />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <ScoreBadge score={st.avg_score} />
                      </td>
                      <td className="px-5 py-3 text-center">
                        {st.attendance_rate === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className={st.attendance_rate >= 80 ? "text-emerald-700" : "text-red-700"}>{st.attendance_rate}%</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="mb-4 text-lg font-semibold tracking-tight">Toifalar</h2>
            <ul className="space-y-2.5 text-sm">
              {(Object.keys(CATEGORIES) as Category[]).map((key) => (
                <li key={key} className="flex items-center justify-between">
                  <span className={`badge ${CATEGORIES[key].className}`}>{CATEGORIES[key].label}</span>
                  <span className="font-semibold text-slate-900">{s.students.by_category[key]}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-6">
            <h2 className="mb-4 text-lg font-semibold tracking-tight">So&apos;nggi topshiriqlar</h2>
            {s.recent_submissions.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Hali topshiriq kelmagan</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {s.recent_submissions.map((r) => (
                  <li key={r.id} className="flex items-center gap-3">
                    <Avatar name={r.student_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.student_name}</p>
                      <p className="truncate text-slate-500">
                        {r.assignment_title} · {formatDate(r.submitted_at)}
                      </p>
                    </div>
                    {r.score ? <ScoreBadge score={r.score} /> : <span className="badge bg-amber-100 text-amber-800">Yangi</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
