"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { formatDate, subjectTone } from "@/lib/format";
import { onVoiceAction, speak, stopSpeaking } from "@/lib/speech";
import { useStudentLesson, useStudentProfile } from "@/lib/student";
import FilePreview from "@/components/ui/FilePreview";
import FileTypeBadge from "@/components/ui/FileTypeBadge";
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
      <Link href="/student/lessons" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 font-medium text-slate-500 hover:bg-surface hover:text-indigo-700">
        <ArrowLeft className="size-4" aria-hidden /> Darslarim
      </Link>

      <article className="card overflow-hidden">
        <div className={`bg-gradient-to-br ${subjectTone(lesson.subject)} px-6 py-8 text-white sm:px-10`}>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-white/20 px-3 py-1 font-semibold backdrop-blur-sm">{lesson.subject || "Dars"}</span>
            <span className="flex items-center gap-1.5 text-white/90">
              <UserRound className="size-4" aria-hidden /> {lesson.teacher_name}
            </span>
            <span className="text-white/75">· {formatDate(lesson.created_at)}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{lesson.title}</h1>
          {lesson.description && <p className="mt-2 max-w-2xl text-lg text-white/90">{lesson.description}</p>}
          <div className="mt-6">
            <SpeakButton text={lessonText} label="Darsni ovoz bilan tinglash" variant="hero" />
          </div>
        </div>

        <div className="px-6 py-8 sm:px-10">
          {lesson.content ? (
            <p className="max-w-[70ch] text-lg leading-8 whitespace-pre-wrap text-slate-800">{lesson.content}</p>
          ) : (
            <p className="text-slate-500">Dars matni kiritilmagan. Materialni ko&apos;ring yoki AI yordamchidan tushuntirishni so&apos;rang.</p>
          )}

          {lesson.file_url && lesson.file_name && (
            <div className="mt-8 border-t border-slate-100 pt-8">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight">
                Dars materiali <FileTypeBadge name={lesson.file_name} />
              </h2>
              <FilePreview url={lesson.file_url} name={lesson.file_name} />
            </div>
          )}
        </div>
      </article>
      <AiTutor lessonId={lessonId} autoSpeak={profile?.category === "visual"} />

      {lesson.assignments.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Uy vazifalari</h2>
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
