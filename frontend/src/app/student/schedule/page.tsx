"use client";

import { getErrorMessage } from "@/lib/api";
import { useStudentSchedule } from "@/lib/student";
import WeeklySchedule from "@/components/ui/WeeklySchedule";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";

export default function StudentSchedulePage() {
  const { data, isLoading, error } = useStudentSchedule();

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
