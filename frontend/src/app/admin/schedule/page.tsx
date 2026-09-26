"use client";

import { useState, useMemo } from "react";
import { BookOpen, CalendarDays, FilterX, Plus, UserRound, Users } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { useSchedule, useTeachers } from "@/lib/admin";
import type { ScheduleSlot } from "@/lib/types";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import WeeklySchedule from "@/components/ui/WeeklySchedule";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";
import ScheduleForm from "@/components/admin/ScheduleForm";

export default function SchedulePage() {
  const [teacherId, setTeacherId] = useState("");
  const [group, setGroup] = useState("");
  const [subject, setSubject] = useState("");

  const { data: teachers } = useTeachers();
  const { data, isLoading, error } = useSchedule(teacherId);

  const groups = useMemo(() => [...new Set((data ?? []).map((s) => s.group_name).filter(Boolean))] as string[], [data]);
  const subjects = useMemo(() => [...new Set((data ?? []).map((s) => s.subject).filter(Boolean))] as string[], [data]);

  const filteredData = useMemo(() => {
    return (data ?? []).filter((s) => {
      const matchGroup = !group || s.group_name === group;
      const matchSubject = !subject || s.subject === subject;
      return matchGroup && matchSubject;
    });
  }, [data, group, subject]);

  // undefined — yopiq, null — yangi, ScheduleSlot — tahrirlash
  const [editing, setEditing] = useState<ScheduleSlot | null | undefined>(undefined);

  const addButton = (
    <button onClick={() => setEditing(null)} disabled={!teachers?.length} className="btn-primary">
      <Plus className="size-5" aria-hidden />
      Dars qo&apos;shish
    </button>
  );

  return (
    <section>
      <PageHeader icon={CalendarDays}
        title="Dars jadvali"
        description="Haftalik jadval. Tahrirlash uchun darsni bosing. O'qituvchilar o'z jadvalini panelida ko'radi."
        action={addButton}
      />

      {/* Filtrlar: bitta kartada, sayt uslubidagi ochiluvchi ro'yxatlar */}
      <div className="card mb-5 flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="sm:w-64">
          <label htmlFor="sch-teacher" className="label">O&apos;qituvchi bo&apos;yicha</label>
          <Select
            id="sch-teacher"
            icon={UserRound}
            value={teacherId}
            onChange={setTeacherId}
            options={[{ value: "", label: "Barcha o'qituvchilar" }, ...(teachers ?? []).map((t) => ({ value: String(t.id), label: t.full_name }))]}
          />
        </div>
        {groups.length > 0 && (
          <div className="sm:w-52">
            <label htmlFor="sch-group" className="label">Sinf / guruh bo&apos;yicha</label>
            <Select
              id="sch-group"
              icon={Users}
              value={group}
              onChange={setGroup}
              options={[{ value: "", label: "Barcha guruhlar" }, ...groups.map((g) => ({ value: g, label: g }))]}
            />
          </div>
        )}
        {subjects.length > 0 && (
          <div className="sm:w-52">
            <label htmlFor="sch-subject" className="label">Fan bo&apos;yicha</label>
            <Select
              id="sch-subject"
              icon={BookOpen}
              value={subject}
              onChange={setSubject}
              options={[{ value: "", label: "Barcha fanlar" }, ...subjects.map((x) => ({ value: x, label: x }))]}
            />
          </div>
        )}
        {(teacherId || group || subject) && (
          <button
            type="button"
            onClick={() => {
              setTeacherId("");
              setGroup("");
              setSubject("");
            }}
            className="btn-secondary sm:ml-auto"
          >
            <FilterX className="size-4" aria-hidden /> Filtrlarni tozalash
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error)} />
      ) : !teachers?.length ? (
        <EmptyState message="Jadval tuzish uchun avval o'qituvchi qo'shing" />
      ) : (
        <>
          {filteredData.length === 0 && data!.length > 0 && (
            <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-amber-900 ring-1 ring-amber-200">
              Qidiruv bo&apos;yicha dars topilmadi.
            </p>
          )}
          {data!.length === 0 && (
            <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-amber-900 ring-1 ring-amber-200">
              Jadval hali bo&apos;sh. &quot;Dars qo&apos;shish&quot; tugmasini bosing.
            </p>
          )}
          <WeeklySchedule slots={filteredData} showTeacher={!teacherId} onSlotClick={setEditing} />
        </>
      )}

      <Modal
        open={editing !== undefined}
        title={editing ? "Jadvaldagi darsni tahrirlash" : "Jadvalga dars qo'shish"}
        onClose={() => setEditing(undefined)}
      >
        {editing !== undefined && (
          <ScheduleForm
            key={editing?.id ?? "new"}
            slot={editing ?? undefined}
            defaults={{ teacher_id: teacherId }}
            onDone={() => setEditing(undefined)}
          />
        )}
      </Modal>
    </section>
  );
}
