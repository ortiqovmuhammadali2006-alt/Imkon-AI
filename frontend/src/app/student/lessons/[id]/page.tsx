"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, UserRound } from "lucide-react";
import LessonTextTabs from "@/components/student/LessonTextTabs";
import StepByStep from "@/components/student/StepByStep";
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

  // Ochiq yorliqdagi matn (asl, oddiy til, materialdagi matn...) — "O'qib ber" shuni o'qiydi
  const [activeText, setActiveText] = useState("");
  const lessonText = lesson ? [lesson.title, lesson.description, activeText].filter(Boolean).join(". ") : "";

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
          {lesson.a11y.processing && (
            <p role="status" className="mb-6 flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-3 text-indigo-900 ring-1 ring-indigo-100">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Material tayyorlanmoqda: subtitr va qo&apos;shimcha formatlar tez orada shu yerda paydo bo&apos;ladi.
            </p>
          )}

          <LessonTextTabs content={lesson.content} a11y={lesson.a11y} category={profile?.category} onActiveText={setActiveText} />

          {lesson.file_url && lesson.file_name && (
            <div className="mt-8 border-t border-slate-100 pt-8">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight">
                Dars materiali <FileTypeBadge name={lesson.file_name} />
              </h2>
              <FilePreview
                url={lesson.file_url}
                name={lesson.file_name}
                subtitleUrl={lesson.a11y.subtitle_vtt_url}
                segments={lesson.a11y.segments}
                imageDescription={lesson.a11y.image_description}
              />
            </div>
          )}
        </div>
      </article>
      <StepByStep lessonId={lessonId} text={activeText} />

      <AiTutor lessonId={lessonId} autoSpeak={profile?.category === "visual"} fallbackText={lessonText} />

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
