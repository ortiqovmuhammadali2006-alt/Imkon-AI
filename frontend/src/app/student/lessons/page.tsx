"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Paperclip, Search, UserRound } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useStudentLessons } from "@/lib/student";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";

export default function StudentLessonsPage() {
  const { data, isLoading, error } = useStudentLessons();
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");

  const subjects = useMemo(() => [...new Set((data ?? []).map((l) => l.subject).filter(Boolean))] as string[], [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter(
      (l) => (!subject || l.subject === subject) && (!q || l.title.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q))
    );
  }, [data, search, subject]);

  return (
    <section>
      <PageHeader
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
                  className="card flex flex-col p-5 transition-shadow hover:shadow-md hover:ring-indigo-300"
                >
                  <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-indigo-700">{l.subject || "Dars"}</span>
                    <span className="text-slate-500">{formatDate(l.created_at)}</span>
                  </div>
                  <h2 className="text-lg font-semibold">{l.title}</h2>
                  {l.description && <p className="mt-1 line-clamp-2 text-slate-500">{l.description}</p>}
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <UserRound className="size-4" aria-hidden /> {l.teacher_name}
                    </span>
                    {l.assignments_count > 0 && (
                      <span className="flex items-center gap-1">
                        <ClipboardList className="size-4" aria-hidden /> {l.assignments_count} ta vazifa
                      </span>
                    )}
                    {l.file_name && <Paperclip className="size-4" aria-label="Material bor" />}
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
