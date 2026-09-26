"use client";

import Link from "next/link";
import { AlertTriangle, Brain, CheckCircle2, GraduationCap, Play, RotateCcw, Sparkles, type LucideIcon } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { useStudentKnowledge, type KnowledgeLesson, type KnowledgeLevel, type KnowledgeStatus } from "@/lib/student";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";
import useVoiceRead from "@/components/student/useVoiceRead";

// Ranglar palitra bo'yicha: emerald — o'zlashtirildi, indigo — o'rganilmoqda, amber — takrorlash kerak, slate — boshlanmagan
const STATUS: Record<KnowledgeStatus, { label: string; badge: string; action: string; icon: LucideIcon }> = {
  mastered: { label: "O'zlashtirildi", badge: "bg-emerald-100 text-emerald-700", action: "Qayta o'rganish", icon: CheckCircle2 },
  learning: { label: "O'rganilmoqda", badge: "bg-indigo-100 text-indigo-700", action: "Davom etish", icon: Play },
  review: { label: "Takrorlash kerak", badge: "bg-amber-100 text-amber-800", action: "Takrorlash", icon: RotateCcw },
  not_started: { label: "Boshlanmagan", badge: "bg-slate-100 text-slate-600", action: "Boshlash", icon: Play },
};

const LEVEL: Record<KnowledgeLevel, { label: string; className: string }> = {
  strong: { label: "yaxshi", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  medium: { label: "o'rtacha", className: "border-amber-200 bg-amber-50 text-amber-800" },
  weak: { label: "qiyin", className: "border-red-200 bg-red-50 text-red-700" },
  new: { label: "hali o'tilmagan", className: "border-line bg-slate-50 text-slate-500" },
};

function masteryColor(value: number | null) {
  if (value == null) return "text-slate-400";
  return value >= 75 ? "text-emerald-700" : value >= 40 ? "text-amber-700" : "text-red-700";
}

function SummaryCard({ icon: Icon, label, value, className }: { icon: LucideIcon; label: string; value: string | number; className: string }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${className}`}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function LessonRow({ l }: { l: KnowledgeLesson }) {
  const s = STATUS[l.status];
  return (
    <li className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{l.title}</h3>
            <span className={`badge ${s.badge}`}>{s.label}</span>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">{l.teacher_name}</p>

          {/* O'tilgan qismlar */}
          <div className="mt-3 flex items-center gap-3">
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={l.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Dars bo'yicha o'tilgan qism"
            >
              <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${l.progress}%` }} />
            </div>
            <span className="w-24 text-right text-xs font-medium text-slate-500">{l.progress}% o&apos;tildi</span>
          </div>

          {l.parts.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Mavzu qismlari">
              {l.parts.map((p) => (
                <li key={p.title} className={`rounded-md border px-2.5 py-1 text-xs font-medium ${LEVEL[p.level].className}`}>
                  {p.title}
                  <span className="sr-only"> — {LEVEL[p.level].label}</span>
                  {p.mastery != null && <span className="ml-1.5 opacity-75">{p.mastery}%</span>}
                </li>
              ))}
            </ul>
          )}

          {l.weak_parts.length > 0 && (
            <p className="mt-3 flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Qayta ko&apos;rib chiqing: {l.weak_parts.join(", ")}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end">
          <div className="sm:text-right">
            <p className={`text-3xl font-bold ${masteryColor(l.mastery)}`}>{l.mastery != null ? `${l.mastery}%` : "—"}</p>
            <p className="text-xs text-slate-500">
              {l.answered ? `${l.answered} ta javob · ${l.correct} to'g'ri` : "hali javob yo'q"}
            </p>
          </div>
          <Link href={`/student/lessons/${l.lesson_id}/tutor`} className="btn-primary px-3.5 py-2 text-sm">
            <s.icon className="size-4" aria-hidden /> {s.action}
          </Link>
        </div>
      </div>
    </li>
  );
}

// "Mening bilimim": sun'iy intellekt o'qituvchisi bilan o'rganilgan mavzular va o'zlashtirish darajasi (fan bo'yicha)
export default function StudentKnowledgePage() {
  const { data, isLoading, error } = useStudentKnowledge();

  useVoiceRead(
    data
      ? [
          data.summary.mastery != null ? `Umumiy o'zlashtirishingiz ${data.summary.mastery} foiz.` : "Hali sun'iy intellekt o'qituvchisi bilan dars o'tmagansiz.",
          `O'zlashtirilgan mavzular: ${data.summary.mastered}. O'rganilmoqda: ${data.summary.learning}. Takrorlash kerak: ${data.summary.review}.`,
          ...data.lessons
            .filter((l) => l.status === "review")
            .slice(0, 3)
            .map((l) => `${l.title} mavzusini takrorlang${l.weak_parts.length ? `, ayniqsa: ${l.weak_parts.join(", ")}` : ""}.`),
          "Darsni boshlash uchun Imkon, darslarni och deng.",
        ].join(" ")
      : null
  );

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={getErrorMessage(error)} />;

  const bySubject = new Map<string, KnowledgeLesson[]>();
  for (const l of data.lessons) {
    const key = l.subject || "Boshqa fanlar";
    bySubject.set(key, [...(bySubject.get(key) ?? []), l]);
  }
  const { summary } = data;

  return (
    <section className="space-y-6">
      <PageHeader
        icon={Brain}
        title="Mening bilimim"
        description="Sun'iy intellekt o'qituvchisi bilan o'rgangan mavzularingiz va ularni qanchalik o'zlashtirganingiz"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Sparkles} label="Umumiy o'zlashtirish" value={summary.mastery != null ? `${summary.mastery}%` : "—"} className="bg-indigo-100 text-indigo-700" />
        <SummaryCard icon={CheckCircle2} label="O'zlashtirilgan" value={summary.mastered} className="bg-emerald-100 text-emerald-700" />
        <SummaryCard icon={GraduationCap} label="O'rganilmoqda" value={summary.learning} className="bg-indigo-100 text-indigo-700" />
        <SummaryCard icon={RotateCcw} label="Takrorlash kerak" value={summary.review} className="bg-amber-100 text-amber-800" />
      </div>

      {data.lessons.length === 0 ? (
        <div className="card">
          <EmptyState icon={Brain} message="Hali darslar yo'q. O'qituvchingiz dars yuklagach, bilimingiz shu yerda ko'rinadi." />
        </div>
      ) : (
        [...bySubject].map(([subject, lessons]) => (
          <div key={subject} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-slate-50 px-5 py-3">
              <h2 className="font-semibold text-slate-900">{subject}</h2>
              <span className="text-sm text-slate-500">{lessons.length} ta mavzu</span>
            </div>
            <ul className="divide-y divide-line">
              {lessons.map((l) => (
                <LessonRow key={l.lesson_id} l={l} />
              ))}
            </ul>
          </div>
        ))
      )}

      <p className="flex items-center gap-2 text-sm text-slate-500">
        <span className="inline-flex gap-1.5">
          {(["strong", "medium", "weak", "new"] as const).map((k) => (
            <span key={k} className={`rounded-md border px-2 py-0.5 text-xs ${LEVEL[k].className}`}>
              {LEVEL[k].label}
            </span>
          ))}
        </span>
        — mavzu qismlarini qanchalik bilishingiz
      </p>
    </section>
  );
}
