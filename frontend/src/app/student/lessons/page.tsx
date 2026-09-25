"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OPEN_LESSON_EVENT, speak } from "@/lib/speech";
import useVoiceRead from "@/components/student/useVoiceRead";
import { BookOpen, ClipboardList, Search, UserRound } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { formatDate, subjectTone } from "@/lib/format";
import { useStudentLessons } from "@/lib/student";
import FileTypeBadge from "@/components/ui/FileTypeBadge";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";

export default function StudentLessonsPage() {
  const { data, isLoading, error } = useStudentLessons();
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");

  const router = useRouter();

  // Ovozli buyruq "2-darsni och" (tartib raqami — to'liq ro'yxat bo'yicha):
  // boshqa sahifadan — ?open=2 orqali, shu sahifada turganda — OPEN_LESSON_EVENT orqali
  useEffect(() => {
    if (!data) return;
    const openByNumber = (n: number) => {
      const lesson = data[n - 1];
      if (lesson) router.push(`/student/lessons/${lesson.id}`);
      else speak(`${n}-dars topilmadi. Jami ${data.length} ta dars bor`, { quick: true });
    };

    const fromUrl = Number(new URLSearchParams(window.location.search).get("open"));
    if (fromUrl) {
      window.history.replaceState(null, "", "/student/lessons");
      openByNumber(fromUrl);
    }

    const onOpen = (e: Event) => openByNumber(Number((e as CustomEvent<number>).detail));
    window.addEventListener(OPEN_LESSON_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_LESSON_EVENT, onOpen);
  }, [data, router]);

  useVoiceRead(
    data
      ? data.length
        ? `${data.length} ta dars bor. ` +
            data.map((l, i) => `${i + 1}. ${l.title}${l.subject ? `, ${l.subject}` : ""}.`).join(" ") +
            " Darsni ochish uchun, masalan, birinchi darsni och deb ayting."
        : "Hozircha darslar yo'q"
      : null
  );

  const subjects = useMemo(() => [...new Set((data ?? []).map((l) => l.subject).filter(Boolean))] as string[], [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter(
      (l) => (!subject || l.subject === subject) && (!q || l.title.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q))
    );
  }, [data, search, subject]);

  return (
    <section>
      <PageHeader icon={BookOpen}
        title="Darslarim"
        description="O'qituvchilaringiz yuklagan darslar. Darsni oching — AI batafsil tushuntirib beradi."
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error)} />
      ) : !data?.length ? (
        <EmptyState message="Hozircha darslar yo'q. O'qituvchingiz dars yuklaganda shu yerda ko'rinadi." />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                aria-label="Qidirish"
                placeholder="Mavzu bo'yicha qidirish"
                className="input pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {subjects.length > 1 && (
              <select aria-label="Fan bo'yicha" className="input sm:w-56" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">Barcha fanlar</option>
                {subjects.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            )}
          </div>

          {filtered.length === 0 ? (
            <p className="card px-5 py-10 text-center text-slate-500">Hech narsa topilmadi</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((l) => (
                <Link
                  key={l.id}
                  href={`/student/lessons/${l.id}`}
                  className="card card-hover flex flex-col overflow-hidden"
                >
                  <div className={`h-1.5 bg-gradient-to-r ${subjectTone(l.subject)}`} aria-hidden />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-3 flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 font-semibold text-slate-700">
                        <span
                          className={`inline-flex size-7 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white ${subjectTone(l.subject)}`}
                          title="Ovozli buyruq uchun tartib raqami"
                        >
                          {data!.indexOf(l) + 1}
                        </span>
                        {l.subject || "Dars"}
                      </span>
                      <span className="text-slate-500">{formatDate(l.created_at)}</span>
                    </div>
                    <h2 className="text-lg font-semibold tracking-tight text-slate-900">{l.title}</h2>
                    {l.description && <p className="mt-1 mb-5 line-clamp-2 text-slate-500">{l.description}</p>}
                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 pt-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <UserRound className="size-4" aria-hidden /> {l.teacher_name}
                      </span>
                      {l.assignments_count > 0 && (
                        <span className="flex items-center gap-1.5">
                          <ClipboardList className="size-4" aria-hidden /> {l.assignments_count}
                        </span>
                      )}
                      {l.file_name && <FileTypeBadge name={l.file_name} />}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
