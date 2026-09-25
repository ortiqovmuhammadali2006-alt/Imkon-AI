import { Download } from "lucide-react";
import { fileUrl } from "@/lib/api";

// Fayl turiga qarab sahifaning o'zida ko'rsatish (audio, video, rasm, PDF) + yuklab olish tugmasi
export default function FilePreview({ url, name }: { url: string; name: string }) {
  const src = fileUrl(url);
  const ext = name.split(".").pop()?.toLowerCase() ?? "";

  let preview: React.ReactNode = null;
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) preview = <audio controls src={src} className="w-full" />;
  else if (["mp4", "webm"].includes(ext)) preview = <video controls src={src} className="max-h-96 w-full rounded-lg bg-black" />;
  else if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext))
    // eslint-disable-next-line @next/next/no-img-element
    preview = <img src={src} alt={name} className="max-h-96 rounded-lg" />;
  else if (ext === "pdf") preview = <iframe src={src} title={name} className="h-96 w-full rounded-lg ring-1 ring-slate-200" />;

  return (
    <div className="space-y-3">
      {preview}
      <a href={src} target="_blank" rel="noreferrer" className="btn-secondary">
        <Download className="size-4" aria-hidden />
        {name}
      </a>
    </div>
  );
}
