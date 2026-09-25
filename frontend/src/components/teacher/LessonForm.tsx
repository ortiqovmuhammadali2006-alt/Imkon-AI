"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, Paperclip, X } from "lucide-react";
import { api } from "@/lib/api";
import { CATEGORIES } from "@/lib/format";
import { useTeacherMutation, type Lesson } from "@/lib/teacher";
import type { Category } from "@/lib/types";

const MAX_MB = 100;
const ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp,.gif,.mp3,.wav,.ogg,.m4a,.mp4,.webm,.vtt,.srt,.zip";

// Toifaga qarab qaysi format qulayligi haqida maslahat
const HINTS: Record<Category | "all", string> = {
  all: "Barcha o'quvchilar ko'radi. Matn + audio yoki video qo'shsangiz, hamma uchun qulay bo'ladi.",
  general: "Oddiy o'quvchilar uchun: PDF, taqdimot yoki video.",
  visual: "Ko'rishi cheklanganlar uchun: audio (MP3) yoki batafsil matn — ekran o'qigich va AI ovozi o'qib beradi.",
  hearing: "Eshitishi cheklanganlar uchun: subtitrli video, rasm va batafsil matn.",
  physical: "Harakati cheklanganlar uchun: qisqa bo'limlarga bo'lingan matn va video.",
};

export default function LessonForm({
  lesson,
  onDone,
}: {
  lesson?: Lesson & { content?: string | null };
  onDone: (lesson?: Lesson) => void;
}) {
  const [form, setForm] = useState({
    title: lesson?.title ?? "",
    description: lesson?.description ?? "",
    content: lesson?.content ?? "",
    category: (lesson?.category ?? "all") as Category | "all",
  });
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useTeacherMutation(
    async () => {
      const data = new FormData();
      data.append("title", form.title);
      data.append("description", form.description);
      data.append("content", form.content);
      data.append("category", form.category === "all" ? "" : form.category);
      if (file) data.append("file", file);
      else if (removeFile) data.append("remove_file", "true");

      const config = { onUploadProgress: (e: { loaded: number; total?: number }) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)) };
      const res = lesson
        ? await api.put<Lesson>(`/teacher/lessons/${lesson.id}`, data, config)
        : await api.post<Lesson>("/teacher/lessons", data, config);
      return res.data;
    },
    lesson ? "Dars yangilandi" : "Dars yuklandi",
    (saved) => onDone(saved)
  );

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) {
      alert(`Fayl hajmi ${MAX_MB} MB dan oshmasligi kerak`);
      return;
    }
    setFile(f);
    setRemoveFile(false);
  };

  const currentFileName = file?.name ?? (!removeFile ? lesson?.file_name : null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setProgress(null);
        mutation.mutate(undefined);
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="l-title" className="label">Dars mavzusi *</label>
        <input id="l-title" required minLength={3} className="input" value={form.title} onChange={set("title")} />
      </div>

      <div>
        <label htmlFor="l-category" className="label">Kimlar uchun</label>
        <select id="l-category" className="input" value={form.category} onChange={set("category")}>
          <option value="all">Barcha toifalar</option>
          {(Object.keys(CATEGORIES) as Category[]).map((key) => (
            <option key={key} value={key}>
              {CATEGORIES[key].label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-sm text-slate-500">{HINTS[form.category]}</p>
      </div>

      <div>
        <label htmlFor="l-desc" className="label">Qisqa tavsif</label>
        <input id="l-desc" className="input" value={form.description} onChange={set("description")} placeholder="Dars nima haqida" />
      </div>

      <div>
        <label htmlFor="l-content" className="label">Dars matni</label>
        <textarea
          id="l-content"
          rows={7}
          className="input resize-y"
          value={form.content}
          onChange={set("content")}
          placeholder="Darsning asosiy mazmuni. O'quvchi panelida AI shu matn asosida batafsil tushuntiradi va ovoz bilan o'qib beradi."
        />
      </div>

      <div>
        <span className="label">Material fayli</span>
        {currentFileName ? (
          <div className="flex items-center gap-3 rounded-lg border border-slate-300 px-3.5 py-2.5">
            <Paperclip className="size-5 shrink-0 text-indigo-600" aria-hidden />
            <span className="flex-1 truncate">{currentFileName}</span>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setRemoveFile(true);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="icon-btn"
              aria-label="Faylni olib tashlash"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pickFile(e.dataTransfer.files[0]);
            }}
            className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-center hover:border-indigo-400 hover:bg-indigo-50/40"
          >
            <FileUp className="mb-2 size-7 text-slate-400" aria-hidden />
            <span className="font-medium">Faylni tanlang yoki shu yerga tashlang</span>
            <span className="mt-1 text-sm text-slate-500">PDF, Word, taqdimot, rasm, audio, video — {MAX_MB} MB gacha</span>
            <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>
        )}
      </div>

      {mutation.isPending && file && progress !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => onDone()} className="btn-secondary">
          Bekor qilish
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {lesson ? "Saqlash" : "Yuklash"}
        </button>
      </div>
    </form>
  );
}
