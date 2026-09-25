"use client";

import { getErrorMessage } from "@/lib/api";
import { useStudentSchedule } from "@/lib/student";
import WeeklySchedule, { WEEKDAYS } from "@/components/ui/WeeklySchedule";
import useVoiceRead from "@/components/student/useVoiceRead";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";

export default function StudentSchedulePage() {
  const { data, isLoading, error } = useStudentSchedule();

  useVoiceRead(
    data
      ? data.length
        ? WEEKDAYS.map((day, i) => {
            const slots = data.filter((s) => s.day_of_week === i + 1);
            return slots.length
              ? `${day}: ` + slots.map((s) => `soat ${s.start_time} da ${s.subject ?? "dars"}`).join(", ") + "."
              : "";
          })
            .filter(Boolean)
            .join(" ")
        : "Dars jadvali hali tuzilmagan"
      : null
  );

  return (
    <section>
      <PageHeader title="Dars jadvali" description="Haftalik darslaringiz" />
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error)} />
      ) : !data?.length ? (
        <EmptyState message="Dars jadvali hali tuzilmagan" />
      ) : (
        <WeeklySchedule slots={data} showTeacher />
      )}
    </section>
  );
}
