"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { onVoiceAction, speak, stopSpeaking } from "@/lib/speech";
import { useStudentLesson, useStudentProfile } from "@/lib/student";
import FilePreview from "@/components/ui/FilePreview";
import { ErrorState, LoadingState } from "@/components/ui/States";
import AiTutor from "@/components/student/AiTutor";
import AssignmentCard from "@/components/student/AssignmentCard";
import SpeakButton from "@/components/student/SpeakButton";

export default function StudentLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const lessonId = Number(id);
  const { data: lesson, isLoading, error } = useStudentLesson(lessonId);
  const { data: profile } = useStudentProfile();

  const lessonText = lesson
    ? [lesson.title, lesson.description, lesson.content].filter(Boolean).join(". ")
    : "";

  // Ovozli buyruq: "O'qib ber" / "To'xta"
  const textRef = useRef(lessonText);
  useEffect(() => {
    textRef.current = lessonText;
  });
  useEffect(() => {
    const off = onVoiceAction((action) => {
      if (action === "read" && textRef.current) speak(textRef.current);
    });
    return () => {
      off();
      stopSpeaking();
    };
  }, []);

  if (isLoading) return <LoadingState />;
  if (error || !lesson) return <ErrorState message={getErrorMessage(error)} />;

  return (
    <section className="space-y-6">
      <Link href="/student/lessons" className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-700">
        <ArrowLeft className="size-4" aria-hidden /> Darslarim
      </Link>

      <article className="card p-6">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-medium text-indigo-700">{lesson.subject || "Dars"}</span>
          <span className="flex items-center gap-1 text-slate-500">
            <UserRound className="size-4" aria-hidden /> {lesson.teacher_name}
          </span>
          <span className="text-slate-500">{formatDate(lesson.created_at)}</span>
        </div>
        <h1 className="text-2xl font-bold">{lesson.title}</h1>
        {lesson.description && <p className="mt-1 text-lg text-slate-600">{lesson.description}</p>}

        <div className="mt-4">
          <SpeakButton text={lessonText} label="Darsni ovoz bilan o'qish" />
        </div>

        {lesson.content && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <p className="text-lg leading-relaxed whitespace-pre-wrap text-slate-800">{lesson.content}</p>
          </div>
        )}

        {lesson.file_url && lesson.file_name && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <h2 className="mb-3 font-semibold">Dars materiali</h2>
            <FilePreview url={lesson.file_url} name={lesson.file_name} />
          </div>
        )}
      </article>

      <AiTutor lessonId={lessonId} autoSpeak={profile?.category === "visual"} />

      {lesson.assignments.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Uy vazifalari</h2>
          <div className="space-y-3">
            {lesson.assignments.map((a) => (
              <AssignmentCard key={a.id} a={a} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
