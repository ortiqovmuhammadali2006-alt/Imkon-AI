import { FileArchive, FileImage, FileMusic, FileText, FileVideo, Presentation, type LucideIcon } from "lucide-react";

const TYPES: { exts: string[]; label: string; icon: LucideIcon; className: string }[] = [
  { exts: ["pdf"], label: "PDF", icon: FileText, className: "bg-red-50 text-red-600" },
  { exts: ["doc", "docx", "txt"], label: "Hujjat", icon: FileText, className: "bg-blue-50 text-blue-600" },
  { exts: ["ppt", "pptx"], label: "Taqdimot", icon: Presentation, className: "bg-orange-50 text-orange-600" },
  { exts: ["xls", "xlsx"], label: "Jadval", icon: FileText, className: "bg-emerald-50 text-emerald-700" },
  { exts: ["jpg", "jpeg", "png", "webp", "gif"], label: "Rasm", icon: FileImage, className: "bg-pink-50 text-pink-600" },
  { exts: ["mp3", "wav", "ogg", "m4a"], label: "Audio", icon: FileMusic, className: "bg-violet-50 text-violet-600" },
  { exts: ["mp4", "webm"], label: "Video", icon: FileVideo, className: "bg-sky-50 text-sky-600" },
  { exts: ["zip"], label: "Arxiv", icon: FileArchive, className: "bg-slate-100 text-slate-600" },
];

// Material fayli turi: belgi + nom (PDF, Audio, Video...)
export default function FileTypeBadge({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const type = TYPES.find((t) => t.exts.includes(ext)) ?? { label: "Fayl", icon: FileText, className: "bg-slate-100 text-slate-600" };
  const Icon = type.icon;
  return (
    <span className={`badge ${type.className}`} title={name}>
      <Icon className="size-3.5" aria-hidden />
      {type.label}
    </span>
  );
}
