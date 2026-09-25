"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Loader2, Paperclip } from "lucide-react";
import { api, fileUrl, getErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useSubmissions, useTeacherMutation, type SubmissionRow } from "@/lib/teacher";
import CategoryBadge from "@/components/ui/CategoryBadge";
import { ErrorState, LoadingState } from "@/components/ui/States";
import ScorePicker, { ScoreBadge } from "./ScorePicker";

function GradeForm({ row }: { row: SubmissionRow }) {
  const [score, setScore] = useState<number | null>(row.score);
  const [feedback, setFeedback] = useState(row.feedback ?? "");
  const mutation = useTeacherMutation(
    () => api.patch(`/teacher/submissions/${row.submission_id}/grade`, { score, feedback }),
    "Baho qo'yildi"
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(undefined);
      }}
      className="mt-3 space-y-3 border-t border-slate-100 pt-3"
    >
      <ScorePicker value={score} onChange={setScore} />
      <input
        aria-label="Izoh"
        className="input"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="O'quvchiga izoh (ixtiyoriy)"
      />
      <button type="submit" disabled={!score || mutation.isPending} className="btn-primary">
        {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {row.score ? "Bahoni yangilash" : "Baholash"}
      </button>
    </form>
  );
}

// Vazifa bo'yicha barcha o'quvchilar: kim topshirgan, kim topshirmagan, baholash
export default function SubmissionsView({ assignmentId }: { assignmentId: number }) {
  const { data, isLoading, error } = useSubmissions(assignmentId);
  const [openId, setOpenId] = useState<number | null>(null);

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={getErrorMessage(error)} />;

  const rows = data.submissions;
  const submitted = rows.filter((r) => r.submission_id).length;

  if (rows.length === 0) {
    return <p className="py-8 text-center text-slate-500">Bu dars toifasiga mos o&apos;quvchi biriktirilmagan</p>;
  }

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Topshirgan: <b className="text-slate-800">{submitted}</b> / {rows.length}
      </p>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.student_id} className="rounded-xl p-4 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.full_name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <CategoryBadge category={r.category} />
                  {r.submitted_at ? (
                    <span className="flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="size-4" aria-hidden /> {formatDate(r.submitted_at)} da topshirgan
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-700">
                      <Clock className="size-4" aria-hidden /> Topshirmagan
                    </span>
                  )}
                </div>
              </div>
              <ScoreBadge score={r.score} />
              {r.submission_id && (
                <button
                  onClick={() => setOpenId(openId === r.student_id ? null : r.student_id)}
                  className="btn-secondary px-3 py-1.5 text-sm"
                  aria-expanded={openId === r.student_id}
                >
                  {openId === r.student_id ? "Yopish" : r.score ? "Ko'rish" : "Tekshirish"}
                </button>
              )}
            </div>

            {openId === r.student_id && (
              <div className="mt-3">
                {r.answer_text && (
                  <p className="rounded-lg bg-slate-50 p-3 whitespace-pre-wrap">{r.answer_text}</p>
                )}
                {r.file_url && (
                  <a
                    href={fileUrl(r.file_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 text-indigo-700 hover:underline"
                  >
                    <Paperclip className="size-4" aria-hidden /> {r.file_name ?? "Fayl"}
                  </a>
                )}
                <GradeForm key={r.submission_id} row={r} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
