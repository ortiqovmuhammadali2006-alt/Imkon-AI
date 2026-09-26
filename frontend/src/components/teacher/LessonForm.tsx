"use client";

import { useRef, useState } from "react";
import { Captions, Check, CirclePlay, FileUp, Loader2, Paperclip, Sparkles, X } from "lucide-react";
import { parseYoutubeId, youtubeThumb } from "@/lib/youtube";
import { api } from "@/lib/api";
import { CATEGORIES } from "@/lib/format";
import { useTeacherMutation, type Lesson } from "@/lib/teacher";
import type { Category } from "@/lib/types";

const MAX_MB = 100;
const ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp,.gif,.mp3,.wav,.ogg,.m4a,.mp4,.webm,.zip";
const MEDIA_EXT = ["mp3", "wav", "ogg", "m4a", "mp4", "webm"];

// Material turiga qarab o'quvchi uchun avtomatik nimalar yaratilishi (backend: services/accessibility.js)
function autoFeatures(fileName: string | null | undefined, hasSubtitle: boolean) {
  const ext = fileName?.split(".").pop()?.toLowerCase() ?? "";
  const list: string[] = [];
  if (MEDIA_EXT.includes(ext)) list.push(hasSubtitle ? "Sizning subtitringiz + sinxron matn" : "Avtomatik subtitr va to'liq matn (AI)");
  if (["pdf", "docx", "txt"].includes(ext)) list.push("Fayldagi matn ajratib olinadi — ovoz bilan o'qiladi");
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) list.push("Rasm tavsifi — ko'rishi cheklanganlar uchun (AI)");
  list.push("Oddiy tildagi qisqa variant va atamalar lug'ati (AI)");
  return list;
}

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
    youtube_url: lesson?.youtube_url ?? "",
    category: (lesson?.category ?? "all") as Category | "all",
  });
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [subtitle, setSubtitle] = useState<File | null>(null);
  const [removeSubtitle, setRemoveSubtitle] = useState(false);
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
      data.append("youtube_url", form.youtube_url.trim()); // bo'sh — video olib tashlanadi
      data.append("category", form.category === "all" ? "" : form.category);
      if (file) data.append("file", file);
      else if (removeFile) data.append("remove_file", "true");
      if (subtitle) data.append("subtitle", subtitle);
      else if (removeSubtitle) data.append("remove_subtitle", "true");

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

  const youtubeId = parseYoutubeId(form.youtube_url);
  const currentFileName = file?.name ?? (!removeFile ? lesson?.file_name : null);
  const currentSubtitleName = subtitle?.name ?? (!removeSubtitle ? lesson?.subtitle_name : null);
  const isMedia = MEDIA_EXT.includes(currentFileName?.split(".").pop()?.toLowerCase() ?? "");

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
        <label htmlFor="l-youtube" className="label flex items-center gap-2">
          <CirclePlay className="size-4 text-red-600" aria-hidden /> YouTube video darslik (ixtiyoriy)
        </label>
        <input
          id="l-youtube"
          inputMode="url"
          className="input"
          value={form.youtube_url}
          onChange={set("youtube_url")}
          placeholder="https://www.youtube.com/watch?v=...  yoki  https://youtu.be/..."
          aria-invalid={Boolean(form.youtube_url.trim() && !youtubeId)}
          aria-describedby="l-youtube-hint"
        />
        {form.youtube_url.trim() && !youtubeId ? (
          <p id="l-youtube-hint" className="mt-1.5 text-sm text-red-700">Bu YouTube havolasiga o&apos;xshamaydi. Videoni YouTube&apos;da ochib, manzilini nusxalang.</p>
        ) : youtubeId ? (
          <div id="l-youtube-hint" className="mt-2 flex items-center gap-3 rounded-lg border border-line p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- YouTube rasmi */}
            <img src={youtubeThumb(youtubeId)} alt="" className="h-14 w-24 rounded object-cover" />
            <p className="text-sm text-slate-600">Video darslikka qo&apos;shiladi. Subtitrlari bo&apos;lsa, o&apos;quvchi uchun video matni va sodda to&apos;plam tayyorlanadi.</p>
          </div>
        ) : (
          <p id="l-youtube-hint" className="mt-1.5 text-sm text-slate-500">
            YouTube&apos;dagi video manzilini shu yerga qo&apos;ying — o&apos;quvchi videoni dars sahifasida ko&apos;radi.
          </p>
        )}
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

      {/* Subtitr: video/audio uchun (bo'lmasa AI avtomatik yaratadi) */}
      {(isMedia || currentSubtitleName) && (
        <div>
          <span className="label">Subtitr fayli (ixtiyoriy, .srt yoki .vtt)</span>
          {currentSubtitleName ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-300 px-3.5 py-2.5">
              <Captions className="size-5 shrink-0 text-indigo-600" aria-hidden />
              <span className="flex-1 truncate">{currentSubtitleName}</span>
              <button
                type="button"
                onClick={() => {
                  setSubtitle(null);
                  setRemoveSubtitle(true);
                }}
                className="icon-btn"
                aria-label="Subtitrni olib tashlash"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <label className="btn-secondary cursor-pointer">
              <Captions className="size-4" aria-hidden /> Subtitr biriktirish
              <input
                type="file"
                accept=".srt,.vtt"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setSubtitle(f);
                    setRemoveSubtitle(false);
                  }
                }}
              />
            </label>
          )}
          <p className="mt-1.5 text-sm text-slate-500">Subtitr bo&apos;lmasa, AI nutqdan uni avtomatik yaratadi.</p>
        </div>
      )}

      {/* O'quvchi uchun avtomatik tayyorlanadigan formatlar */}
      <div className="rounded-xl bg-indigo-50 p-4 ring-1 ring-indigo-200">
        <p className="mb-2 flex items-center gap-2 font-semibold text-indigo-900">
          <Sparkles className="size-4" aria-hidden /> O&apos;quvchilar uchun avtomatik tayyorlanadi
        </p>
        <ul className="space-y-1 text-sm text-indigo-900/80">
          {[...(youtubeId ? ["YouTube video: subtitr matni (bo'lsa) va sodda to'plam (AI)"] : []), ...autoFeatures(currentFileName, !!currentSubtitleName)].map((f) => (
            <li key={f} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-indigo-600" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
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
