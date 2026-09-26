"use client";

import Link from "next/link";
import { BookOpen, ClipboardList, PartyPopper } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CATEGORIES, formatGrade } from "@/lib/format";
import { useStudentAssignments, useStudentProfile, useStudentSchedule, useStudentStats } from "@/lib/student";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { SlotCard, WEEKDAYS, todayWeekday } from "@/components/ui/WeeklySchedule";
import StatCard from "@/components/ui/StatCard";
import WelcomeBanner from "@/components/ui/WelcomeBanner";
import AssignmentCard from "@/components/student/AssignmentCard";
import useVoiceRead from "@/components/student/useVoiceRead";

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
        ].join(" ")
      : null
  );

  if (stats.isLoading) return <LoadingState />;
  if (stats.error || !stats.data) return <ErrorState message={getErrorMessage(stats.error)} />;

  const s = stats.data;
  const today = todaySlots;
  const pending = (assignments.data ?? []).filter((a) => !a.submission_id).slice(0, 3);

  return (
    <section className="space-y-8">
      <WelcomeBanner
        name={user?.full_name ?? ""}
        subtitle={[formatGrade(profile.data?.grade), profile.data && profile.data.category !== "general" && CATEGORIES[profile.data.category].label].filter(Boolean).join(" · ") || undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard icon={ClipboardList} label="Topshirilmagan vazifalar" value={s.pending_assignments} href="/student/assignments" />
        <StatCard icon={BookOpen} label="O'qituvchilarim" value={profile.data?.teachers.length ?? 0} href="/student/lessons" />
      </div>

      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Bugungi darslar — {WEEKDAYS[todayWeekday() - 1]}</h2>
          <Link href="/student/schedule" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            Haftalik jadval →
          </Link>
        </div>
        {today.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-slate-500">Bugun dars yo&apos;q <PartyPopper className="mx-1 inline size-[1.1em] align-[-0.15em] text-indigo-600" aria-hidden /></p>
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
