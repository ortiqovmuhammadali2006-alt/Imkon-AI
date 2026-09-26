"use client";

import { ClipboardList } from "lucide-react";
import { useState } from "react";
import { getErrorMessage } from "@/lib/api";
import { useStudentAssignments, type StudentAssignment } from "@/lib/student";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";
import AssignmentCard from "@/components/student/AssignmentCard";
import useVoiceRead from "@/components/student/useVoiceRead";
import { formatDate } from "@/lib/format";

const TABS: { key: string; label: string; filter: (a: StudentAssignment) => boolean }[] = [
  { key: "todo", label: "Topshirilmagan", filter: (a) => !a.submission_id },
  { key: "submitted", label: "Tekshirilmoqda", filter: (a) => !!a.submission_id && a.score === null },
  { key: "graded", label: "Baholangan", filter: (a) => a.score !== null },
];

export default function AssignmentsPage() {
  const { data, isLoading, error } = useStudentAssignments();
  const [tab, setTab] = useState("todo");
  const current = TABS.find((t) => t.key === tab)!;
  const items = (data ?? []).filter(current.filter);

  useVoiceRead(
    data
      ? items.length
        ? `${current.label}: ${items.length} ta. ` +
            items
              .map((a, i) => `${i + 1}. ${a.title}${a.due_date ? `, muddati ${formatDate(a.due_date)}` : ""}${a.score !== null ? `, baho ${a.score}` : ""}.`)
              .join(" ")
        : `${current.label} vazifalar yo'q`
      : null
  );

  return (
    <section>
      <PageHeader icon={ClipboardList} title="Uy vazifalari" description="Javobni yozib, ovoz bilan aytib yoki fayl biriktirib topshiring" />

      <div role="tablist" className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const count = (data ?? []).filter(t.filter).length;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-4 py-2 font-medium ${
                tab === t.key ? "bg-indigo-600 text-white" : "bg-surface text-slate-600 ring-1 ring-line hover:bg-slate-50"
              }`}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error)} />
      ) : items.length === 0 ? (
        <EmptyState message={tab === "todo" ? "Barakalla! Topshirilmagan vazifa yo'q" : "Bu yerda hozircha hech narsa yo'q"} />
      ) : (
        <div className="space-y-4">
          {items.map((a) => (
            <AssignmentCard key={a.id} a={a} showLesson />
          ))}
        </div>
      )}
    </section>
  );
}
