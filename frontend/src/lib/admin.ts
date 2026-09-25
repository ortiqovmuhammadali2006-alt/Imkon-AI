import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api, getErrorMessage } from "./api";
import type {
  AdminStats,
  SalaryPayment,
  SalaryRow,
  ScheduleSlot,
  Student,
  Teacher,
  TeacherActivity,
  TeacherActivityDetail,
} from "./types";

async function get<T>(url: string) {
  const { data } = await api.get<T>(url);
  return data;
}

export const useAdminStats = () =>
  useQuery({ queryKey: ["admin", "stats"], queryFn: () => get<AdminStats>("/admin/stats") });

export const useTeachers = () =>
  useQuery({ queryKey: ["admin", "teachers"], queryFn: () => get<Teacher[]>("/admin/teachers") });

export const useStudents = () =>
  useQuery({ queryKey: ["admin", "students"], queryFn: () => get<Student[]>("/admin/students") });

export const useSalaries = (month: string) =>
  useQuery({
    queryKey: ["admin", "salaries", month],
    queryFn: () => get<SalaryRow[]>(`/admin/salaries?month=${month}`),
  });

export const useSalaryPayments = (month: string) =>
  useQuery({
    queryKey: ["admin", "payments", month],
    queryFn: () => get<SalaryPayment[]>(`/admin/salaries/payments?month=${month}`),
  });

export const useMonitoring = () =>
  useQuery({
    queryKey: ["admin", "monitoring"],
    queryFn: () => get<TeacherActivity[]>("/admin/monitoring"),
  });

export const useTeacherActivity = (id: number | null) =>
  useQuery({
    queryKey: ["admin", "monitoring", id],
    queryFn: () => get<TeacherActivityDetail>(`/admin/monitoring/${id}`),
    enabled: id !== null,
  });

export const useSchedule = (teacherId: string) =>
  useQuery({
    queryKey: ["admin", "schedule", teacherId],
    queryFn: () => get<ScheduleSlot[]>(`/admin/schedule${teacherId ? `?teacher_id=${teacherId}` : ""}`),
  });

// Har qanday admin o'zgarishi: muvaffaqiyatda toast + barcha admin ma'lumotlarini yangilash
export function useAdminMutation<TVars>(
  request: (vars: TVars) => Promise<unknown>,
  successMessage: string,
  onSuccess?: () => void
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => {
      toast.success(successMessage);
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      onSuccess?.();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
