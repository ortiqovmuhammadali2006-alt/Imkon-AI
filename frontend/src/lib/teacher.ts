import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api, getErrorMessage } from "./api";
import type { Category, ScheduleSlot } from "./types";

export type AttendanceStatus = "present" | "late" | "absent";

export type TeacherStats = {
  students: { total: number; by_category: Record<Category, number> };
  lessons: number;
  open_assignments: number;
  ungraded_submissions: number;
  attendance_marked_today: number;
  recent_submissions: {
    id: number;
    submitted_at: string;
    score: number | null;
    student_name: string;
    assignment_id: number;
    assignment_title: string;
  }[];
};

export type MyStudent = {
  id: number;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  category: Category;
  grade: string | null;
  birth_date: string | null;
  avg_score: number | null;
  attendance_rate: number | null;
};

export type A11yStepStatus = { status: "done" | "failed"; error?: string; source?: "teacher" | "ai" };

// Qulaylik to'plami (backend: services/accessibility.js)
export type LessonA11y = {
  status?: "pending" | "processing" | "done" | "partial" | "failed";
  steps?: Partial<Record<"subtitle" | "text" | "image" | "simple", A11yStepStatus>>;
  subtitle_vtt_url?: string;
  transcript?: string;
  segments?: { start: number; end: number; text: string }[];
  extracted_text?: string;
  image_description?: string;
  summary?: string;
  simple_text?: string;
  examples?: string[];
  key_terms?: { term: string; meaning: string }[];
  quiz?: { question: string; options: string[]; answer: number; explanation: string }[];
};

export type Lesson = {
  id: number;
  title: string;
  description: string | null;
  content?: string | null;
  category: Category | null;
  file_url: string | null;
  file_name: string | null;
  subtitle_url?: string | null;
  subtitle_name?: string | null;
  a11y?: LessonA11y;
  a11y_status?: LessonA11y["status"] | null;
  created_at: string;
  assignments_count?: number;
};

export type Assignment = {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
  submissions_count: number;
  graded_count: number;
};

export type LessonDetail = Lesson & { content: string | null; assignments: Assignment[] };

export type SubmissionRow = {
  student_id: number;
  full_name: string;
  category: Category;
  submission_id: number | null;
  answer_text: string | null;
  file_url: string | null;
  file_name: string | null;
  submitted_at: string | null;
  score: number | null;
  feedback: string | null;
  graded_at: string | null;
};

export type AttendanceRow = {
  student_id: number;
  full_name: string;
  category: Category;
  grade: string | null;
  status: AttendanceStatus | null;
};

export type AttendanceReportRow = {
  student_id: number;
  full_name: string;
  category: Category;
  present: number;
  late: number;
  absent: number;
};

export type Grade = {
  id: number;
  student_id: number;
  student_name: string;
  lesson_id: number | null;
  lesson_title: string | null;
  score: number;
  comment: string | null;
  created_at: string;
};

export type GradeSummary = {
  student_id: number;
  full_name: string;
  category: Category;
  grade: string | null;
  grades_count: number;
  avg_score: number | null;
  last_score: number | null;
};

async function get<T>(url: string) {
  const { data } = await api.get<T>(url);
  return data;
}

export const useTeacherStats = () =>
  useQuery({ queryKey: ["teacher", "stats"], queryFn: () => get<TeacherStats>("/teacher/stats") });

export const useMyStudents = () =>
  useQuery({ queryKey: ["teacher", "students"], queryFn: () => get<MyStudent[]>("/teacher/students") });

export const useMySchedule = () =>
  useQuery({ queryKey: ["teacher", "schedule"], queryFn: () => get<ScheduleSlot[]>("/teacher/schedule") });

export const useLessons = () =>
  useQuery({ queryKey: ["teacher", "lessons"], queryFn: () => get<Lesson[]>("/teacher/lessons") });

// Qulaylik to'plami tayyorlanayotgan bo'lsa, har 3 soniyada yangilab turadi
export const useLesson = (id: number) =>
  useQuery({
    queryKey: ["teacher", "lessons", id],
    queryFn: () => get<LessonDetail>(`/teacher/lessons/${id}`),
    refetchInterval: (q) => (["pending", "processing"].includes(q.state.data?.a11y?.status ?? "") ? 3000 : false),
  });

export const useSubmissions = (assignmentId: number | null) =>
  useQuery({
    queryKey: ["teacher", "submissions", assignmentId],
    queryFn: () =>
      get<{ assignment: { id: number; title: string; lesson_title: string }; submissions: SubmissionRow[] }>(
        `/teacher/assignments/${assignmentId}/submissions`
      ),
    enabled: assignmentId !== null,
  });

export const useAttendance = (date: string) =>
  useQuery({
    queryKey: ["teacher", "attendance", date],
    queryFn: () => get<AttendanceRow[]>(`/teacher/attendance?date=${date}`),
  });

export const useAttendanceReport = (month: string) =>
  useQuery({
    queryKey: ["teacher", "attendance-report", month],
    queryFn: () => get<AttendanceReportRow[]>(`/teacher/attendance/report?month=${month}`),
  });

export const useGrades = (month: string) =>
  useQuery({
    queryKey: ["teacher", "grades", month],
    queryFn: () => get<Grade[]>(`/teacher/grades?month=${month}`),
  });

export const useGradeSummary = () =>
  useQuery({
    queryKey: ["teacher", "grade-summary"],
    queryFn: () => get<GradeSummary[]>("/teacher/grades/summary"),
  });

// O'qituvchi o'zgarishi: muvaffaqiyatda toast + o'qituvchi ma'lumotlarini yangilash
export function useTeacherMutation<TVars, TResult = unknown>(
  request: (vars: TVars) => Promise<TResult>,
  successMessage: string,
  onSuccess?: (result: TResult) => void
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (result) => {
      toast.success(successMessage);
      queryClient.invalidateQueries({ queryKey: ["teacher"] });
      onSuccess?.(result);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function today() {
  return new Date().toLocaleDateString("sv-SE");
}
