"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarClock, MessageSquare } from "lucide-react";
import { formatDate } from "@/lib/format";
import { isOverdue } from "@/lib/student";
import { ScoreBadge } from "@/components/teacher/ScorePicker";
import SpeakButton from "./SpeakButton";
import SubmitForm from "./SubmitForm";

type AssignmentLike = {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  submission_id: number | null;
  submitted_at: string | null;
  score: number | null;
  feedback: string | null;
  answer_text?: string | null;
  file_name?: string | null;
  lesson_id?: number;
  lesson_title?: string;
  subject?: string | null;
};

export function AssignmentStatus({ a }: { a: AssignmentLike }) {
  if (a.score !== null) return <span className="badge bg-emerald-100 text-emerald-700">Baholangan</span>;
  if (a.submission_id) return <span className="badge bg-sky-100 text-sky-800">Topshirilgan</span>;
  if (isOverdue(a.due_date)) return <span className="badge bg-red-100 text-red-700">Muddati o&apos;tgan</span>;
  return <span className="badge bg-amber-100 text-amber-800">Topshirilmagan</span>;
}

// Holatga qarab chap chegara rangi
function accentOf(a: AssignmentLike) {
  if (a.score !== null) return "border-l-emerald-500";
  if (a.submission_id) return "border-l-sky-500";
  if (isOverdue(a.due_date)) return "border-l-red-500";
  return "border-l-amber-400";
}

export default function AssignmentCard({ a, showLesson }: { a: AssignmentLike; showLesson?: boolean }) {
  const [open, setOpen] = useState(false);
  const canSubmit = a.score === null;
  const speechText = [a.title, a.description, a.due_date && `Muddat: ${formatDate(a.due_date)}`, a.feedback && `O'qituvchi izohi: ${a.feedback}`]
    .filter(Boolean)
    .join(". ");

  return (
    <article className={`card border-l-4 p-5 sm:p-6 ${accentOf(a)}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <AssignmentStatus a={a} />
            {a.subject && <span className="text-sm text-slate-500">{a.subject}</span>}
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">{a.title}</h3>
          {showLesson && a.lesson_id && (
            <Link href={`/student/lessons/${a.lesson_id}`} className="mt-0.5 inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline">
              <BookOpen className="size-3.5" aria-hidden /> {a.lesson_title}
            </Link>
          )}
        </div>
        <ScoreBadge score={a.score} />
      </div>

      {a.description && <p className="mt-2 whitespace-pre-wrap text-slate-700">{a.description}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
        {a.due_date && (
          <span className={`flex items-center gap-1 ${isOverdue(a.due_date) && !a.submission_id ? "text-red-600" : ""}`}>
            <CalendarClock className="size-4" aria-hidden /> Muddat: {formatDate(a.due_date)}
          </span>
        )}
        {a.submitted_at && <span>Topshirilgan: {formatDate(a.submitted_at)}</span>}
        <SpeakButton text={speechText} label="Tinglash" />
      </div>

      {a.feedback && (
        <p className="mt-4 flex gap-2.5 rounded-2xl bg-emerald-50 p-4 text-emerald-900 ring-1 ring-emerald-100">
          <MessageSquare className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <b>O&apos;qituvchi izohi:</b> {a.feedback}
          </span>
        </p>
      )}

      {canSubmit && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          {open ? (
            <SubmitForm
              assignmentId={a.id}
              initialText={a.answer_text}
              initialFileName={a.file_name}
              onDone={() => setOpen(false)}
            />
          ) : (
            <button onClick={() => setOpen(true)} className={a.submission_id ? "btn-secondary" : "btn-primary"}>
              {a.submission_id ? "Javobni o'zgartirish" : "Javob topshirish"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
