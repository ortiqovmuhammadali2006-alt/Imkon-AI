"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useLessons, useMyStudents, useTeacherMutation, type Grade } from "@/lib/teacher";
import ScorePicker from "./ScorePicker";
import { formatGrade } from "@/lib/format";

// grade berilsa — tahrirlash; studentId berilsa — o'sha o'quvchi oldindan tanlanadi
export default function GradeForm({
  grade,
  studentId,
  onDone,
}: {
  grade?: Grade;
  studentId?: number;
  onDone: () => void;
}) {
  const { data: students } = useMyStudents();
  const { data: lessons } = useLessons();
  const [student, setStudent] = useState(String(grade?.student_id ?? studentId ?? ""));
  const [score, setScore] = useState<number | null>(grade?.score ?? null);
  const [lesson, setLesson] = useState(String(grade?.lesson_id ?? ""));
  const [comment, setComment] = useState(grade?.comment ?? "");

  const mutation = useTeacherMutation(
    (): Promise<unknown> => {
      const body = { score, comment, lesson_id: lesson ? Number(lesson) : null };
      return grade
        ? api.put(`/teacher/grades/${grade.id}`, body)
        : api.post("/teacher/grades", { ...body, student_id: Number(student) });
    },
    grade ? "Baho yangilandi" : "Baho qo'yildi",
    onDone
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(undefined);
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="g-student" className="label">O&apos;quvchi *</label>
        <select
          id="g-student"
          required
          disabled={!!grade}
          className="input disabled:bg-slate-50"
          value={student}
          onChange={(e) => setStudent(e.target.value)}
        >
          <option value="">Tanlang</option>
          {students?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
              {s.grade ? ` (${formatGrade(s.grade)})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="label">Baho *</span>
        <ScorePicker value={score} onChange={setScore} />
      </div>

      <div>
        <label htmlFor="g-lesson" className="label">Dars (ixtiyoriy)</label>
        <select id="g-lesson" className="input" value={lesson} onChange={(e) => setLesson(e.target.value)}>
          <option value="">Darsga bog&apos;lanmagan</option>
          {lessons?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="g-comment" className="label">Izoh</label>
        <input
          id="g-comment"
          className="input"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Masalan: og'zaki javob, faollik"
        />
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onDone} className="btn-secondary">
          Bekor qilish
        </button>
        <button type="submit" disabled={!score || !student || mutation.isPending} className="btn-primary">
          {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {grade ? "Saqlash" : "Baho qo'yish"}
        </button>
      </div>
    </form>
  );
}
