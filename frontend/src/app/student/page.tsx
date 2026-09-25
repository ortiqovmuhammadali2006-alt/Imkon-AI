"use client";

import Link from "next/link";
import { BookOpen, CalendarCheck, ClipboardList, Mic, Star, type LucideIcon } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CATEGORIES } from "@/lib/format";
import { useStudentAssignments, useStudentProfile, useStudentSchedule, useStudentStats } from "@/lib/student";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { SlotCard, WEEKDAYS, todayWeekday } from "@/components/ui/WeeklySchedule";
import AssignmentCard from "@/components/student/AssignmentCard";
import useVoiceRead from "@/components/student/useVoiceRead";

function StatCard({ icon: Icon, label, value, href, tone }: { icon: LucideIcon; label: string; value: string; href: string; tone: string }) {
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

export default function StudentHome() {
  const { user } = useAuth();
  const stats = useStudentStats();
  const profile = useStudentProfile();
  const schedule = useStudentSchedule();
  const assignments = useStudentAssignments();

  const todaySlots = (schedule.data ?? []).filter((x) => x.day_of_week === todayWeekday());
  useVoiceRead(
    stats.data
      ? [
          `Topshirilmagan vazifalar: ${stats.data.pending_assignments} ta.`,
          todaySlots.length
            ? `Bugun ${todaySlots.length} ta dars: ` +
              todaySlots.map((x) => `soat ${x.start_time} da ${x.subject ?? "dars"}`).join(", ") + "."
            : "Bugun dars yo'q.",
          stats.data.avg_score != null ? `O'rtacha bahoingiz ${stats.data.avg_score}.` : "",
        ].join(" ")
      : null
  );

  if (stats.isLoading) return <LoadingState />;
  if (stats.error || !stats.data) return <ErrorState message={getErrorMessage(stats.error)} />;

  const s = stats.data;
  const today = todaySlots;
  const pending = (assignments.data ?? []).filter((a) => !a.submission_id).slice(0, 3);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Salom, {user?.full_name}!</h1>
        <p className="mt-1 text-slate-500">
          {profile.data?.grade && `${profile.data.grade} · `}
          {profile.data && CATEGORIES[profile.data.category].label}
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl bg-indigo-50 px-4 py-3 text-indigo-900 ring-1 ring-indigo-200">
        <Mic className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p>
          Pastdagi <b>Ovoz rejimi</b> tugmasini bosing (<b>Alt + O</b>) va <b>“Darslar”</b>, <b>“Vazifalar”</b>,{" "}
          <b>“Jadval”</b>, <b>“O&apos;qib ber”</b>, <b>“Birinchi darsni och”</b> yoki <b>“Yordam”</b> deb ayting.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ClipboardList} label="Topshirilmagan vazifalar" value={String(s.pending_assignments)} href="/student/assignments" tone="bg-amber-100 text-amber-700" />
        <StatCard icon={Star} label="O'rtacha baho" value={s.avg_score != null ? String(s.avg_score) : "—"} href="/student/grades" tone="bg-indigo-100 text-indigo-700" />
        <StatCard icon={CalendarCheck} label="Davomat (30 kun)" value={s.attendance_rate != null ? `${s.attendance_rate}%` : "—"} href="/student/grades" tone="bg-emerald-100 text-emerald-700" />
        <StatCard icon={BookOpen} label="O'qituvchilarim" value={String(profile.data?.teachers.length ?? 0)} href="/student/lessons" tone="bg-sky-100 text-sky-700" />
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Bugungi darslar — {WEEKDAYS[todayWeekday() - 1]}</h2>
          <Link href="/student/schedule" className="text-sm text-indigo-700 hover:underline">
            Haftalik jadval
          </Link>
        </div>
        {today.length === 0 ? (
          <p className="text-slate-500">Bugun dars yo&apos;q</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {today.map((slot) => (
              <SlotCard key={slot.id} slot={slot} showTeacher />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Bajarilishi kerak</h2>
          <Link href="/student/assignments" className="text-sm text-indigo-700 hover:underline">
            Barcha vazifalar
          </Link>
        </div>
        {pending.length === 0 ? (
          <p className="card px-5 py-8 text-center text-slate-500">Barakalla! Topshirilmagan vazifa yo&apos;q</p>
        ) : (
          <div className="space-y-3">
            {pending.map((a) => (
              <AssignmentCard key={a.id} a={a} showLesson />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
