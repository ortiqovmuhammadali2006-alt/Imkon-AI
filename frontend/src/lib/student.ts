import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api, getErrorMessage } from "./api";
import type { Category, ScheduleSlot } from "./types";

export type StudentProfile = {
  full_name: string;
  category: Category;
  grade: string | null;
  teachers: { id: number; full_name: string; subject: string | null }[];
};

export type StudentStats = {
  pending_assignments: number;
  avg_score: number | null;
  grades_count: number;
  attendance_rate: number | null;
};

export type StudentLesson = {
  id: number;
  title: string;
  description: string | null;
  category: Category | null;
  file_name: string | null;
  created_at: string;
  teacher_name: string;
  subject: string | null;
  assignments_count: number;
  has_subtitles: boolean;
  has_simple_text: boolean;
};

export type LessonAssignment = {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  submission_id: number | null;
  submitted_at: string | null;
  score: number | null;
  feedback: string | null;
};

export type TranscriptSegment = { start: number; end: number; text: string };

// Qulaylik to'plami: o'qituvchi materialidan avtomatik yaratilgan formatlar
export type StudentA11y = {
  subtitle_vtt_url: string | null;
  segments: TranscriptSegment[];
  transcript: string | null;
  extracted_text: string | null;
  image_description: string | null;
  simple_text: string | null;
  key_terms: { term: string; meaning: string }[];
  processing: boolean;
};

export type StudentLessonDetail = Omit<StudentLesson, "assignments_count" | "has_subtitles" | "has_simple_text"> & {
  content: string | null;
  file_url: string | null;
  a11y: StudentA11y;
  assignments: LessonAssignment[];
};

export type StudentAssignment = {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
  lesson_id: number;
  lesson_title: string;
  teacher_name: string;
  subject: string | null;
  submission_id: number | null;
  answer_text: string | null;
  file_url: string | null;
  file_name: string | null;
  submitted_at: string | null;
  score: number | null;
  feedback: string | null;
  graded_at: string | null;
};

export type StudentGrades = {
  grades: {
    id: number;
    score: number;
    comment: string | null;
    created_at: string;
    teacher_name: string;
    subject: string | null;
    lesson_title: string | null;
  }[];
  submissions: {
    id: number;
    score: number;
    feedback: string | null;
    graded_at: string;
    assignment_title: string;
    lesson_title: string;
    subject: string | null;
  }[];
};

export type StudentAttendance = {
  id: number;
  date: string;
  status: "present" | "late" | "absent";
  teacher_name: string;
  subject: string | null;
}[];

export type ChatMessage = { role: "user" | "assistant"; content: string };

async function get<T>(url: string) {
  const { data } = await api.get<T>(url);
  return data;
}

export const useStudentProfile = () =>
  useQuery({ queryKey: ["student", "profile"], queryFn: () => get<StudentProfile>("/student/profile") });

export const useStudentStats = () =>
  useQuery({ queryKey: ["student", "stats"], queryFn: () => get<StudentStats>("/student/stats") });

export const useStudentSchedule = () =>
  useQuery({ queryKey: ["student", "schedule"], queryFn: () => get<ScheduleSlot[]>("/student/schedule") });

export const useStudentLessons = () =>
  useQuery({ queryKey: ["student", "lessons"], queryFn: () => get<StudentLesson[]>("/student/lessons") });

export const useStudentLesson = (id: number) =>
  useQuery({
    queryKey: ["student", "lessons", id],
    queryFn: () => get<StudentLessonDetail>(`/student/lessons/${id}`),
    // Material hali qayta ishlanayotgan bo'lsa, tayyor bo'lguncha yangilab turadi
    refetchInterval: (q) => (q.state.data?.a11y.processing ? 5000 : false),
  });

export const useStudentAssignments = () =>
  useQuery({
    queryKey: ["student", "assignments"],
    queryFn: () => get<StudentAssignment[]>("/student/assignments"),
  });

export const useStudentGrades = () =>
  useQuery({ queryKey: ["student", "grades"], queryFn: () => get<StudentGrades>("/student/grades") });

export const useStudentAttendance = () =>
  useQuery({ queryKey: ["student", "attendance"], queryFn: () => get<StudentAttendance>("/student/attendance") });

export function useSubmitAssignment(assignmentId: number, onDone?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { answerText: string; file: File | null; removeFile: boolean }) => {
      const data = new FormData();
      data.append("answer_text", vars.answerText);
      if (vars.file) data.append("file", vars.file);
      else if (vars.removeFile) data.append("remove_file", "true");
      await api.post(`/student/assignments/${assignmentId}/submit`, data);
    },
    onSuccess: () => {
      toast.success("Vazifa topshirildi");
      queryClient.invalidateQueries({ queryKey: ["student"] });
      onDone?.();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// focus — darsning bitta qismi: AI aynan shuni batafsil tushuntiradi (bosqichma-bosqich rejim)
export async function explainLesson(lessonId: number, messages: ChatMessage[], focus?: string) {
  const { data } = await api.post<{ answer: string }>(`/student/lessons/${lessonId}/explain`, { messages, focus });
  return data.answer;
}

export function isOverdue(due: string | null) {
  return due !== null && due < new Date().toLocaleDateString("sv-SE");
}
