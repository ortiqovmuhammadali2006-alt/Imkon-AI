"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { FileUp, Loader2, Paperclip, X } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { api } from "@/lib/api";
import { useTeacherMutation, type Assignment } from "@/lib/teacher";

const MAX_MB = 100;
const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp,.gif,.mp3,.wav,.ogg,.m4a,.mp4,.webm,.zip";

// Vazifa: nomi, topshiriq matni, muddat va ixtiyoriy fayl (topshiriq varag'i, PDF, rasm, audio...)
export default function AssignmentForm({
  lessonId,
  assignment,
  onDone,
}: {
  lessonId: number;
  assignment?: Assignment;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    title: assignment?.title ?? "",
    description: assignment?.description ?? "",
    due_date: assignment?.due_date ?? "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useTeacherMutation(
    () => {
      const data = new FormData();
      data.append("title", form.title);
      data.append("description", form.description);
      data.append("due_date", form.due_date);
      if (file) data.append("file", file);
      else if (removeFile) data.append("remove_file", "true");
      const config = { onUploadProgress: (e: { loaded: number; total?: number }) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)) };
      return assignment
        ? api.put(`/teacher/assignments/${assignment.id}`, data, config)
        : api.post(`/teacher/lessons/${lessonId}/assignments`, data, config);
    },
    assignment ? "Vazifa yangilandi" : "Vazifa qo'shildi",
    onDone
  );

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`Fayl hajmi ${MAX_MB} MB dan oshmasligi kerak`);
      return;
    }
    setFile(f);
    setRemoveFile(false);
  };

  const currentFileName = file?.name ?? (!removeFile ? assignment?.file_name : null);

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
        <label htmlFor="a-title" className="label">Vazifa nomi *</label>
        <input id="a-title" required minLength={3} className="input" value={form.title} onChange={set("title")} placeholder="Masalan: 1-mashq" />
      </div>
      <div>
        <label htmlFor="a-desc" className="label">Topshiriq matni</label>
        <textarea
          id="a-desc"
          rows={5}
          className="input resize-y"
          value={form.description}
          onChange={set("description")}
          placeholder="O'quvchi nima qilishi kerak. Bu matn o'quvchiga ovoz bilan ham o'qib beriladi."
        />
      </div>

      <div>
        <span className="label">Vazifa fayli (ixtiyoriy)</span>
        {currentFileName ? (
          <div className="flex items-center gap-3 rounded-lg border border-slate-300 px-3.5 py-2.5">
            <Paperclip className="size-5 shrink-0 text-indigo-600" aria-hidden />
            <span className="flex-1 truncate">{currentFileName}</span>
            {file && <span className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</span>}
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
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files[0]);
            }}
            className={`flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
              dragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40"
            }`}
          >
            <FileUp className="mb-1.5 size-6 text-slate-400" aria-hidden />
            <span className="font-medium">Topshiriq faylini tanlang yoki shu yerga tashlang</span>
            <span className="mt-1 text-sm text-slate-500">Topshiriq varag&apos;i, PDF, Word, rasm, audio — {MAX_MB} MB gacha</span>
            <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>
        )}
      </div>

      <div>
        <label htmlFor="a-due" className="label">Topshirish muddati</label>
        <DatePicker id="a-due" value={form.due_date} onChange={(v) => setForm((f) => ({ ...f, due_date: v }))} />
      </div>

      {mutation.isPending && file && progress !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Fayl yuklanmoqda">
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onDone} className="btn-secondary">
          Bekor qilish
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {assignment ? "Saqlash" : "Qo'shish"}
        </button>
      </div>
    </form>
  );
}
