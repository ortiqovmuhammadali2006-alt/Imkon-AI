export type Category = "general" | "visual" | "hearing" | "physical";

export type Teacher = {
  id: number;
  full_name: string;
  username: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  subject: string | null;
  monthly_salary: number;
  students_count: number;
};

export type Student = {
  id: number;
  full_name: string;
  username: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  category: Category;
  grade: string | null;
  birth_date: string | null;
  teachers: { id: number; full_name: string }[];
};

export type SalaryRow = {
  id: number;
  full_name: string;
  is_active: boolean;
  subject: string | null;
  monthly_salary: number;
  paid: number;
};

export type SalaryPayment = {
  id: number;
  teacher_id: number;
  teacher_name: string;
  amount: number;
  month: string;
  note: string | null;
  paid_at: string;
};

export type AdminStats = {
  teachers: { total: number; active: number };
  students: { total: number; active: number; by_category: Record<Category, number> };
  salary: { expected: number; paid: number };
  recent_payments: Pick<SalaryPayment, "id" | "amount" | "month" | "paid_at" | "teacher_name">[];
};

export type TeacherActivity = {
  id: number;
  full_name: string;
  is_active: boolean;
  subject: string | null;
  students_count: number;
  lessons_total: number;
  lessons_month: number;
  attendance_days_month: number;
  grades_month: number;
  avg_grade: number | null;
  last_activity: string | null;
};

export type TeacherActivityDetail = {
  teacher: { id: number; full_name: string; subject: string | null };
  lessons: { id: number; title: string; category: Category | null; created_at: string }[];
  attendance: { present: number; absent: number; late: number };
  grades: { id: number; score: number; comment: string | null; created_at: string; student_name: string }[];
};
