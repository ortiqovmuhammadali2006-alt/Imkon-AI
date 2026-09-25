"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { useSchedule, useTeachers } from "@/lib/admin";
import type { ScheduleSlot } from "@/lib/types";
import Modal from "@/components/ui/Modal";
import WeeklySchedule from "@/components/ui/WeeklySchedule";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";
import ScheduleForm from "@/components/admin/ScheduleForm";

export default function SchedulePage() {
  const [teacherId, setTeacherId] = useState("");
  const { data: teachers } = useTeachers();
  const { data, isLoading, error } = useSchedule(teacherId);
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
      <PageHeader
        title="Dars jadvali"
        description="Haftalik jadval. Tahrirlash uchun darsni bosing. O'qituvchilar o'z jadvalini panelida ko'radi."
        action={addButton}
      />

      <div className="mb-5">
        <label htmlFor="sch-teacher" className="label">O&apos;qituvchi bo&apos;yicha</label>
        <select id="sch-teacher" className="input sm:w-72" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          <option value="">Barcha o&apos;qituvchilar</option>
          {teachers?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error)} />
      ) : !teachers?.length ? (
        <EmptyState message="Jadval tuzish uchun avval o'qituvchi qo'shing" />
      ) : (
        <>
          {data!.length === 0 && (
            <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-amber-900 ring-1 ring-amber-200">
              Jadval hali bo&apos;sh. &quot;Dars qo&apos;shish&quot; tugmasini bosing.
            </p>
          )}
          <WeeklySchedule slots={data!} showTeacher={!teacherId} onSlotClick={setEditing} />
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
