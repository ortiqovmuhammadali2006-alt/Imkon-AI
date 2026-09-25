"use client";

import Link from "next/link";
import { AlertTriangle, BookOpen, CalendarCheck, ClipboardCheck, ClipboardList, Users, type LucideIcon } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CATEGORIES, formatDate } from "@/lib/format";
import { useMySchedule, useMyStudents, useTeacherStats } from "@/lib/teacher";
import { SlotCard, WEEKDAYS, todayWeekday } from "@/components/ui/WeeklySchedule";
import type { Category } from "@/lib/types";
import CategoryBadge from "@/components/ui/CategoryBadge";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { ScoreBadge } from "@/components/teacher/ScorePicker";

function StatCard({ icon: Icon, label, value, href, tone }: { icon: LucideIcon; label: string; value: number; href: string; tone: string }) {
  return (
    <Link href={href} className="card flex items-center gap-4 p-5 hover:ring-indigo-300">
      <div className={`rounded-xl p-3 ${tone}`}>
        <Icon className="size-6" aria-hidden />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </Link>
  );
}

function TodaySchedule() {
  const { data } = useMySchedule();
  if (!data) return null;
  const today = data.filter((s) => s.day_of_week === todayWeekday());

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Bugungi darslar — {WEEKDAYS[todayWeekday() - 1]}</h2>
        <Link href="/teacher/schedule" className="text-sm text-indigo-700 hover:underline">
          Haftalik jadval
        </Link>
      </div>
      {today.length === 0 ? (
        <p className="text-slate-500">Bugun darsingiz yo&apos;q</p>
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
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Xush kelibsiz, {user?.full_name}!</h1>
        <p className="mt-1 text-slate-500">Bugungi holat va o&apos;quvchilaringiz</p>
      </div>

      {(s.students.total > 0 && s.attendance_marked_today === 0) || s.ungraded_submissions > 0 ? (
        <div className="space-y-2">
          {s.students.total > 0 && s.attendance_marked_today === 0 && (
            <Link href="/teacher/attendance" className="flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">
              <AlertTriangle className="size-5 shrink-0" aria-hidden />
              Bugungi davomat hali belgilanmagan
            </Link>
          )}
          {s.ungraded_submissions > 0 && (
            <Link href="/teacher/lessons" className="flex items-center gap-3 rounded-xl bg-indigo-50 px-4 py-3 text-indigo-900 ring-1 ring-indigo-200 hover:bg-indigo-100">
              <ClipboardCheck className="size-5 shrink-0" aria-hidden />
              {s.ungraded_submissions} ta topshirilgan ish tekshirilishini kutmoqda
            </Link>
          )}
        </div>
      ) : null}

      <TodaySchedule />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="O'quvchilarim" value={s.students.total} href="/teacher/grades" tone="bg-sky-100 text-sky-700" />
        <StatCard icon={BookOpen} label="Darslar" value={s.lessons} href="/teacher/lessons" tone="bg-indigo-100 text-indigo-700" />
        <StatCard icon={ClipboardList} label="Faol vazifalar" value={s.open_assignments} href="/teacher/lessons" tone="bg-violet-100 text-violet-700" />
        <StatCard icon={CalendarCheck} label="Bugun belgilangan" value={s.attendance_marked_today} href="/teacher/attendance" tone="bg-emerald-100 text-emerald-700" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-2">
          <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">O&apos;quvchilarim</h2>
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
                    <tr key={st.id} className={st.is_active ? "" : "opacity-50"}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{st.full_name}</p>
                        <p className="text-slate-500">{st.grade || "—"}</p>
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
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Toifalar</h2>
            <ul className="space-y-2 text-sm">
              {(Object.keys(CATEGORIES) as Category[]).map((key) => (
                <li key={key} className="flex justify-between">
                  <span>{CATEGORIES[key].label}</span>
                  <span className="font-medium">{s.students.by_category[key]}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-semibold">So&apos;nggi topshiriqlar</h2>
            {s.recent_submissions.length === 0 ? (
              <p className="text-sm text-slate-500">Hali topshiriq kelmagan</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {s.recent_submissions.map((r) => (
                  <li key={r.id} className="flex items-center gap-3">
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
