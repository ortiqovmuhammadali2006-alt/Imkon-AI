"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, ChevronRight, ClipboardList, MessageSquare, PenLine, Star, UserRound, type LucideIcon } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useStudentGrades, useStudentStats } from "@/lib/student";
import { ErrorState, LoadingState, PageHeader } from "@/components/ui/States";
import Modal from "@/components/ui/Modal";
import AttachmentLink from "@/components/ui/AttachmentLink";
import { ScoreBadge } from "@/components/teacher/ScorePicker";
import SpeakButton from "@/components/student/SpeakButton";
import useVoiceRead from "@/components/student/useVoiceRead";

// Jurnal bahosi va baholangan vazifa — bitta ko'rinishda
type GradeItem = {
  key: string;
  kind: "lesson" | "assignment";
  score: number;
  date: string;
  title: string;
  subject: string | null;
  teacher: string;
  note: string | null; // o'qituvchi izohi
  lessonId: number | null;
  lessonTitle: string | null;
  task?: string | null; // vazifa matni
  answer?: string | null; // o'quvchining javobi
  file?: { url: string; name: string } | null;
  submittedAt?: string;
};

function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <div className="font-medium text-slate-900">{children}</div>
      </div>
    </div>
  );
}

function speechOf(g: GradeItem) {
  return [
    `${g.title}. Baho: ${g.score}.`,
    g.subject && `Fan: ${g.subject}.`,
    `O'qituvchi: ${g.teacher}.`,
    g.note ? `O'qituvchi izohi: ${g.note}` : "O'qituvchi izoh yozmagan.",
  ]
    .filter(Boolean)
    .join(" ");
}

// Bahoning ichi: baho, o'qituvchi izohi, vazifa bo'lsa — topshiriq va o'quvchining javobi, darsga o'tish
function GradeDetail({ g, onClose }: { g: GradeItem; onClose: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <span className="scale-125">
          <ScoreBadge score={g.score} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-indigo-700">{g.kind === "assignment" ? "Vazifa bahosi" : "Darsdagi baho"}</p>
          <p className="text-lg font-semibold text-slate-900">{g.title}</p>
        </div>
      </div>

      <SpeakButton text={speechOf(g)} label="Tinglash" />

      <div className="grid gap-4 sm:grid-cols-2">
        {g.subject && (
          <Row icon={BookOpen} label="Fan">
            {g.subject}
          </Row>
        )}
        <Row icon={UserRound} label="O'qituvchi">
          {g.teacher}
        </Row>
        <Row icon={CalendarDays} label="Baholangan sana">
          {formatDate(g.date)}
        </Row>
        {g.submittedAt && (
          <Row icon={ClipboardList} label="Topshirilgan sana">
            {formatDate(g.submittedAt)}
          </Row>
        )}
      </div>

      <div className="flex gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <MessageSquare className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <b>O&apos;qituvchi izohi:</b> {g.note || "Izoh yozilmagan"}
        </p>
      </div>

      {g.kind === "assignment" && (
        <div className="space-y-3">
          {g.task && (
            <div>
              <p className="mb-1 text-sm font-semibold text-slate-700">Topshiriq</p>
              <p className="whitespace-pre-wrap text-slate-700">{g.task}</p>
            </div>
          )}
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <PenLine className="size-4" aria-hidden /> Sizning javobingiz
            </p>
            {g.answer ? (
              <p className="rounded-lg border border-line bg-slate-50 p-3 whitespace-pre-wrap text-slate-800">{g.answer}</p>
            ) : (
              !g.file && <p className="text-slate-500">Matnli javob yo&apos;q</p>
            )}
            {g.file && (
              <div className="mt-2">
                <AttachmentLink url={g.file.url} name={g.file.name} label="Siz yuborgan fayl" />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4">
        <button onClick={onClose} className="btn-secondary">
          Yopish
        </button>
        {g.lessonId && (
          <Link href={`/student/lessons/${g.lessonId}`} className="btn-primary">
            <BookOpen className="size-4" aria-hidden /> Darsni ochish
          </Link>
        )}
      </div>
    </div>
  );
}

export default function StudentGradesPage() {
  const stats = useStudentStats();
  const grades = useStudentGrades();
  const [open, setOpen] = useState<GradeItem | null>(null);

  // Jurnal baholari va baholangan vazifalar bitta ro'yxatda, sanasi bo'yicha
  const all: GradeItem[] = grades.data
    ? [
        ...grades.data.grades.map((g) => ({
          key: `g${g.id}`,
          kind: "lesson" as const,
          score: g.score,
          date: g.created_at,
          title: g.lesson_title ?? "Darsdagi baho",
          subject: g.subject,
          teacher: g.teacher_name,
          note: g.comment,
          lessonId: g.lesson_id,
          lessonTitle: g.lesson_title,
        })),
        ...grades.data.submissions.map((s) => ({
          key: `s${s.id}`,
          kind: "assignment" as const,
          score: s.score,
          date: s.graded_at,
          title: `Vazifa: ${s.assignment_title}`,
          subject: s.subject,
          teacher: s.teacher_name,
          note: s.feedback,
          lessonId: s.lesson_id,
          lessonTitle: s.lesson_title,
          task: s.assignment_description,
          answer: s.answer_text,
          file: s.file_url && s.file_name ? { url: s.file_url, name: s.file_name } : null,
          submittedAt: s.submitted_at,
        })),
      ].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  useVoiceRead(
    stats.data && grades.data
      ? [
          stats.data.avg_score != null ? `O'rtacha bahoingiz ${stats.data.avg_score}.` : "Hali baho qo'yilmagan.",
          all.length ? "So'nggi baholar: " + all.slice(0, 5).map((g) => `${g.title}, ${g.score}`).join("; ") + "." : "",
          all.length ? "Batafsil ko'rish uchun bahoni bosing." : "",
        ].join(" ")
      : null
  );

  if (grades.isLoading) return <LoadingState />;
  if (grades.error || !grades.data) return <ErrorState message={getErrorMessage(grades.error)} />;

  return (
    <section className="space-y-6">
      {/* Davomat o'quvchiga ko'rsatilmaydi — uni faqat o'qituvchi ko'radi */}
      <PageHeader icon={Star} title="Baholarim" description="Darsdagi va vazifalar uchun olgan baholaringiz. Batafsil ko'rish uchun bahoni bosing" />

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
        <h2 className="mb-3 text-lg font-semibold">Barcha baholar</h2>
        {all.length === 0 ? (
          <p className="card px-5 py-10 text-center text-slate-500">Hali baho qo&apos;yilmagan</p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {all.map((g) => (
              <li key={g.key}>
                <button
                  onClick={() => setOpen(g)}
                  className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-indigo-50 focus-visible:bg-indigo-50"
                  aria-label={`${g.title}, baho ${g.score}. Batafsil ko'rish`}
                >
                  <ScoreBadge score={g.score} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{g.title}</p>
                    <p className="truncate text-sm text-slate-500">
                      {g.subject && `${g.subject} · `}
                      {formatDate(g.date)}
                      {g.note && ` · ${g.note}`}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={open !== null} title="Baho tafsilotlari" onClose={() => setOpen(null)}>
        {open && <GradeDetail g={open} onClose={() => setOpen(null)} />}
      </Modal>
    </section>
  );
}
