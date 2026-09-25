"use client";

import { useState } from "react";
import { CalendarCheck, CheckCheck, Clock, Loader2, Save, UserCheck, UserX, type LucideIcon } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { currentMonth, formatMonth, formatGrade } from "@/lib/format";
import {
  today,
  useAttendance,
  useAttendanceReport,
  useTeacherMutation,
  type AttendanceStatus,
} from "@/lib/teacher";
import CategoryBadge from "@/components/ui/CategoryBadge";
import Avatar from "@/components/ui/Avatar";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";

const STATUS: Record<AttendanceStatus, { label: string; icon: LucideIcon; active: string }> = {
  present: { label: "Keldi", icon: UserCheck, active: "border-emerald-600 bg-emerald-600 text-white" },
  late: { label: "Kechikdi", icon: Clock, active: "border-amber-500 bg-amber-500 text-white" },
  absent: { label: "Kelmadi", icon: UserX, active: "border-red-600 bg-red-600 text-white" },
};

function DailyAttendance() {
  const [date, setDate] = useState(today);
  // Saqlanmagan o'zgarishlar: student_id -> holat
  const [draft, setDraft] = useState<Record<number, AttendanceStatus | null>>({});
  const { data, isLoading, error } = useAttendance(date);

  const save = useTeacherMutation(
    () =>
      api.put("/teacher/attendance", {
        date,
        records: Object.entries(draft).map(([student_id, status]) => ({ student_id: Number(student_id), status })),
      }),
    "Davomat saqlandi",
    () => setDraft({})
  );

  const statusOf = (id: number, saved: AttendanceStatus | null) => (id in draft ? draft[id] : saved);
  const changed = Object.keys(draft).length;

  const toggle = (id: number, saved: AttendanceStatus | null, status: AttendanceStatus) => {
    const next = statusOf(id, saved) === status ? null : status;
    setDraft((d) => {
      const copy = { ...d };
      if (next === saved) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  };

  const markAllPresent = () => {
    if (!data) return;
    const next: Record<number, AttendanceStatus | null> = {};
    for (const r of data) if (r.status !== "present") next[r.student_id] = "present";
    setDraft(next);
  };

  const changeDate = (value: string) => {
    if (!value) return;
    if (changed && !confirm("Saqlanmagan o'zgarishlar bor. Boshqa kunga o'tilsinmi?")) return;
    setDate(value);
    setDraft({});
  };

  const counts = { present: 0, late: 0, absent: 0, none: 0 };
  data?.forEach((r) => {
    const s = statusOf(r.student_id, r.status);
    if (s) counts[s]++;
    else counts.none++;
  });

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label htmlFor="att-date" className="label">Sana</label>
          <input
            id="att-date"
            type="date"
            max={today()}
            className="input sm:w-52"
            value={date}
            onChange={(e) => changeDate(e.target.value)}
          />
        </div>
        <button onClick={markAllPresent} disabled={!data?.length} className="btn-secondary">
          <CheckCheck className="size-5" aria-hidden /> Hammasi keldi
        </button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error)} />
      ) : !data?.length ? (
        <EmptyState message="Sizga hali o'quvchi biriktirilmagan. Admin bilan bog'laning." />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2 text-sm">
            <span className="badge bg-emerald-100 text-emerald-700">Keldi: {counts.present}</span>
            <span className="badge bg-amber-100 text-amber-800">Kechikdi: {counts.late}</span>
            <span className="badge bg-red-100 text-red-700">Kelmadi: {counts.absent}</span>
            <span className="badge bg-slate-100 text-slate-600">Belgilanmagan: {counts.none}</span>
          </div>

          <ul className="card divide-y divide-slate-100">
            {data.map((r) => {
              const current = statusOf(r.student_id, r.status);
              return (
                <li
                  key={r.student_id}
                  className={`flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center ${r.student_id in draft ? "bg-indigo-50/50" : ""}`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={r.full_name} />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{r.full_name}</p>
                      <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                        <CategoryBadge category={r.category} />
                        {formatGrade(r.grade)}
                      </div>
                    </div>
                  </div>
                  <div role="radiogroup" aria-label={`${r.full_name} davomati`} className="flex gap-2">
                    {(Object.keys(STATUS) as AttendanceStatus[]).map((s) => {
                      const { label, icon: Icon, active } = STATUS[s];
                      return (
                        <button
                          key={s}
                          role="radio"
                          aria-checked={current === s}
                          onClick={() => toggle(r.student_id, r.status, s)}
                          className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                            current === s ? active : "border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <Icon className="size-4" aria-hidden />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="sticky bottom-4 mt-4 flex justify-end">
            <button onClick={() => save.mutate(undefined)} disabled={!changed || save.isPending} className="btn-primary shadow-lg">
              {save.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Save className="size-5" aria-hidden />}
              Saqlash{changed ? ` (${changed})` : ""}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MonthlyReport() {
  const [month, setMonth] = useState(currentMonth);
  const { data, isLoading, error } = useAttendanceReport(month);

  return (
    <div>
      <div className="mb-4">
        <label htmlFor="att-month" className="label">Oy</label>
        <input
          id="att-month"
          type="month"
          className="input sm:w-52"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
        />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error)} />
      ) : !data?.length ? (
        <EmptyState message="O'quvchilar yo'q" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <caption className="sr-only">{formatMonth(month)} davomat hisoboti</caption>
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">O&apos;quvchi</th>
                <th className="px-4 py-3 text-center">Keldi</th>
                <th className="px-4 py-3 text-center">Kechikdi</th>
                <th className="px-4 py-3 text-center">Kelmadi</th>
                <th className="px-4 py-3 text-center">Davomat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((r) => {
                const total = r.present + r.late + r.absent;
                const rate = total ? Math.round(((r.present + r.late) / total) * 100) : null;
                return (
                  <tr key={r.student_id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.full_name} size="sm" />
                        <div>
                          <p className="font-medium text-slate-900">{r.full_name}</p>
                          <CategoryBadge category={r.category} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-emerald-700">{r.present}</td>
                    <td className="px-4 py-3 text-center text-amber-700">{r.late}</td>
                    <td className="px-4 py-3 text-center text-red-700">{r.absent}</td>
                    <td className="px-4 py-3 text-center font-semibold">
                      {rate === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className={rate >= 80 ? "text-emerald-700" : rate >= 60 ? "text-amber-700" : "text-red-700"}>
                          {rate}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  const [tab, setTab] = useState<"daily" | "report">("daily");

  return (
    <section>
      <PageHeader icon={CalendarCheck} title="Davomat" description="O'quvchilar davomatini belgilang va oylik hisobotni ko'ring" />
      <div role="tablist" className="mb-6 inline-flex rounded-lg bg-slate-100 p-1">
        {[
          { key: "daily", label: "Kunlik belgilash" },
          { key: "report", label: "Oylik hisobot" },
        ].map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`rounded-md px-4 py-2 font-medium ${tab === t.key ? "bg-surface shadow-sm" : "text-slate-600"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "daily" ? <DailyAttendance /> : <MonthlyReport />}
    </section>
  );
}
