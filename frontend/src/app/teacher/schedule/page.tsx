"use client";

import { getErrorMessage } from "@/lib/api";
import { useMySchedule } from "@/lib/teacher";
import WeeklySchedule from "@/components/ui/WeeklySchedule";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";

export default function TeacherSchedulePage() {
  const { data, isLoading, error } = useMySchedule();

  return (
    <section>
      <PageHeader title="Dars jadvali" description="Haftalik jadvalingiz. Jadvalni administrator tuzadi." />
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error)} />
      ) : !data?.length ? (
        <EmptyState message="Sizga hali dars jadvali qo'yilmagan. Administrator bilan bog'laning." />
      ) : (
        <WeeklySchedule slots={data} />
      )}
    </section>
  );
}
