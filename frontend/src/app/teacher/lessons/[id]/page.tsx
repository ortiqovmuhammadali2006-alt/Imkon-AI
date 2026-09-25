"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Download, Pencil, Plus, Trash2, Users } from "lucide-react";
import { api, fileUrl, getErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useLesson, useTeacherMutation, type Assignment } from "@/lib/teacher";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import CategoryBadge from "@/components/ui/CategoryBadge";
import { ErrorState, LoadingState } from "@/components/ui/States";
import LessonForm from "@/components/teacher/LessonForm";
import AssignmentForm from "@/components/teacher/AssignmentForm";
import SubmissionsView from "@/components/teacher/SubmissionsView";

// Fayl turiga qarab sahifaning o'zida ko'rsatish
function FilePreview({ url, name }: { url: string; name: string }) {
  const src = fileUrl(url);
  const ext = name.split(".").pop()?.toLowerCase() ?? "";

  let preview: React.ReactNode = null;
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) preview = <audio controls src={src} className="w-full" />;
  else if (["mp4", "webm"].includes(ext)) preview = <video controls src={src} className="max-h-96 w-full rounded-lg bg-black" />;
  else if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext))
    // eslint-disable-next-line @next/next/no-img-element
    preview = <img src={src} alt={name} className="max-h-96 rounded-lg" />;
  else if (ext === "pdf") preview = <iframe src={src} title={name} className="h-96 w-full rounded-lg ring-1 ring-slate-200" />;

  return (
    <div className="space-y-3">
      {preview}
      <a href={src} target="_blank" rel="noreferrer" className="btn-secondary">
        <Download className="size-4" aria-hidden />
        {name}
      </a>
    </div>
  );
}

function isOverdue(due: string | null) {
  return due !== null && due < new Date().toLocaleDateString("sv-SE");
}

export default function LessonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const lessonId = Number(id);
  const router = useRouter();
  const { data: lesson, isLoading, error } = useLesson(lessonId);

  const [editing, setEditing] = useState(false);
  const [deletingLesson, setDeletingLesson] = useState(false);
  // undefined — yopiq, null — yangi, Assignment — tahrirlash
  const [assignmentForm, setAssignmentForm] = useState<Assignment | null | undefined>(undefined);
  const [deletingAssignment, setDeletingAssignment] = useState<Assignment | null>(null);
  const [viewing, setViewing] = useState<Assignment | null>(null);

  const removeLesson = useTeacherMutation(
    () => api.delete(`/teacher/lessons/${lessonId}`),
    "Dars o'chirildi",
    () => router.replace("/teacher/lessons")
  );
  const removeAssignment = useTeacherMutation(
    (a: Assignment) => api.delete(`/teacher/assignments/${a.id}`),
    "Vazifa o'chirildi",
    () => setDeletingAssignment(null)
  );

  if (isLoading) return <LoadingState />;
  if (error || !lesson) return <ErrorState message={getErrorMessage(error)} />;

  return (
    <section className="space-y-6">
      <Link href="/teacher/lessons" className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-700">
        <ArrowLeft className="size-4" aria-hidden /> Darslar
      </Link>

      <div className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <CategoryBadge category={lesson.category} />
              <span className="text-sm text-slate-500">{formatDate(lesson.created_at)}</span>
            </div>
            <h1 className="text-2xl font-bold">{lesson.title}</h1>
            {lesson.description && <p className="mt-1 text-slate-600">{lesson.description}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={() => setEditing(true)} className="btn-secondary">
              <Pencil className="size-4" aria-hidden /> Tahrirlash
            </button>
            <button
              onClick={() => setDeletingLesson(true)}
              className="icon-btn hover:bg-red-50 hover:text-red-600"
              aria-label="Darsni o'chirish"
              title="Darsni o'chirish"
            >
              <Trash2 className="size-5" />
            </button>
          </div>
        </div>

        {lesson.content && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <h2 className="mb-2 font-semibold">Dars matni</h2>
            <p className="leading-relaxed whitespace-pre-wrap text-slate-700">{lesson.content}</p>
          </div>
        )}

        {lesson.file_url && lesson.file_name && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <h2 className="mb-3 font-semibold">Material</h2>
            <FilePreview url={lesson.file_url} name={lesson.file_name} />
          </div>
        )}
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Uy vazifalari</h2>
          <button onClick={() => setAssignmentForm(null)} className="btn-primary">
            <Plus className="size-5" aria-hidden /> Vazifa qo&apos;shish
          </button>
        </div>

        {lesson.assignments.length === 0 ? (
          <p className="card px-5 py-10 text-center text-slate-500">Bu darsga hali vazifa berilmagan</p>
        ) : (
          <ul className="space-y-3">
            {lesson.assignments.map((a) => (
              <li key={a.id} className="card p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{a.title}</h3>
                    {a.description && <p className="mt-1 whitespace-pre-wrap text-slate-600">{a.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                      {a.due_date && (
                        <span className={`flex items-center gap-1 ${isOverdue(a.due_date) ? "text-red-600" : ""}`}>
                          <CalendarClock className="size-4" aria-hidden /> Muddat: {formatDate(a.due_date)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="size-4" aria-hidden /> {a.submissions_count} ta topshirilgan,{" "}
                        {a.graded_count} tasi baholangan
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => setViewing(a)} className="btn-secondary px-3 py-1.5 text-sm">
                      Topshiriqlar
                      {a.submissions_count > a.graded_count && (
                        <span className="badge bg-amber-100 text-amber-800">{a.submissions_count - a.graded_count}</span>
                      )}
                    </button>
                    <button onClick={() => setAssignmentForm(a)} className="icon-btn" aria-label="Tahrirlash" title="Tahrirlash">
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => setDeletingAssignment(a)}
                      className="icon-btn hover:bg-red-50 hover:text-red-600"
                      aria-label="O'chirish"
                      title="O'chirish"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={editing} title="Darsni tahrirlash" onClose={() => setEditing(false)} size="lg">
        {editing && <LessonForm lesson={lesson} onDone={() => setEditing(false)} />}
      </Modal>

      <Modal
        open={assignmentForm !== undefined}
        title={assignmentForm ? "Vazifani tahrirlash" : "Yangi vazifa"}
        onClose={() => setAssignmentForm(undefined)}
      >
        {assignmentForm !== undefined && (
          <AssignmentForm
            key={assignmentForm?.id ?? "new"}
            lessonId={lessonId}
            assignment={assignmentForm ?? undefined}
            onDone={() => setAssignmentForm(undefined)}
          />
        )}
      </Modal>

      <Modal open={viewing !== null} title={viewing ? `${viewing.title} — topshiriqlar` : ""} onClose={() => setViewing(null)} size="lg">
        {viewing && <SubmissionsView assignmentId={viewing.id} />}
      </Modal>

      <ConfirmModal
        open={deletingLesson}
        title="Darsni o'chirish"
        message={
          <>
            <b>{lesson.title}</b> o&apos;chirilsa, uning fayli, barcha vazifalari va o&apos;quvchilar topshirgan
            ishlar ham o&apos;chib ketadi.
          </>
        }
        loading={removeLesson.isPending}
        onConfirm={() => removeLesson.mutate(undefined)}
        onClose={() => setDeletingLesson(false)}
      />

      <ConfirmModal
        open={deletingAssignment !== null}
        title="Vazifani o'chirish"
        message={
          <>
            <b>{deletingAssignment?.title}</b> va unga topshirilgan barcha ishlar o&apos;chiriladi.
          </>
        }
        loading={removeAssignment.isPending}
        onConfirm={() => deletingAssignment && removeAssignment.mutate(deletingAssignment)}
        onClose={() => setDeletingAssignment(null)}
      />
    </section>
  );
}
