"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ClipboardList, Plus, Search } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CATEGORIES, formatDate, subjectTone } from "@/lib/format";
import { useLessons } from "@/lib/teacher";
import type { Category } from "@/lib/types";
import Modal from "@/components/ui/Modal";
import CategoryBadge from "@/components/ui/CategoryBadge";
import FileTypeBadge from "@/components/ui/FileTypeBadge";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";
import LessonForm from "@/components/teacher/LessonForm";

export default function LessonsPage() {
  const { data, isLoading, error } = useLessons();
  const { user } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "all" | "common">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter(
      (l) =>
        (category === "all" || (category === "common" ? l.category === null : l.category === category)) &&
        (!q || l.title.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q))
    );
  }, [data, search, category]);

  const addButton = (
    <button onClick={() => setCreating(true)} className="btn-primary">
      <Plus className="size-5" aria-hidden />
      Yangi dars
    </button>
  );

  return (
    <section>
      <PageHeader icon={BookOpen}
        title="Darslar va materiallar"
        description={`${user?.subject ? `${user.subject} fani bo'yicha dars` : "Dars"} materiallarini yuklang: PDF, taqdimot, audio, video. Darsni ochib, uy vazifasi qo'shing va topshiriqlarni tekshiring.`}
        action={addButton}
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error)} />
      ) : data!.length === 0 ? (
        <EmptyState message="Hali dars yuklanmagan" action={addButton} />
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
            <select
              aria-label="Toifa bo'yicha filtr"
              className="input sm:w-56"
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
            >
              <option value="all">Hammasi</option>
              <option value="common">Barcha toifalar uchun</option>
              {(Object.keys(CATEGORIES) as Category[]).map((key) => (
                <option key={key} value={key}>
                  {CATEGORIES[key].label}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <p className="card px-5 py-10 text-center text-slate-500">Hech narsa topilmadi</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((l) => (
                <Link
                  key={l.id}
                  href={`/teacher/lessons/${l.id}`}
                  className="card card-hover flex flex-col overflow-hidden"
                >
                  <div className={`h-1.5 bg-gradient-to-r ${subjectTone(user?.subject)}`} aria-hidden />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <CategoryBadge category={l.category} />
                      <span className="text-sm text-slate-500">{formatDate(l.created_at)}</span>
                    </div>
                    <h2 className="text-lg font-semibold tracking-tight text-slate-900">{l.title}</h2>
                    {l.description && <p className="mt-1 mb-5 line-clamp-2 text-slate-500">{l.description}</p>}
                    <div className="mt-auto flex items-center gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <ClipboardList className="size-4" aria-hidden /> {l.assignments_count} ta vazifa
                      </span>
                      {l.file_name && <FileTypeBadge name={l.file_name} />}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={creating} title="Yangi dars" onClose={() => setCreating(false)} size="lg">
        {creating && (
          <LessonForm
            onDone={(lesson) => {
              setCreating(false);
              if (lesson) router.push(`/teacher/lessons/${lesson.id}`);
            }}
          />
        )}
      </Modal>
    </section>
  );
}
