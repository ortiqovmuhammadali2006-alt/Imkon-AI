import { Download } from "lucide-react";
import { fileUrl } from "@/lib/api";
import MediaPlayer, { type Segment } from "./MediaPlayer";

// Fayl turiga qarab sahifaning o'zida ko'rsatish (audio/video — subtitrli pleyer, rasm, PDF) + yuklab olish
export default function FilePreview({
  url,
  name,
  subtitleUrl,
  segments,
  imageDescription,
}: {
  url: string;
  name: string;
  subtitleUrl?: string | null;
  segments?: Segment[];
  imageDescription?: string | null;
}) {
  const src = fileUrl(url);
  const ext = name.split(".").pop()?.toLowerCase() ?? "";

  if (["mp3", "wav", "ogg", "m4a", "mp4", "webm"].includes(ext)) {
    return <MediaPlayer url={url} name={name} subtitleUrl={subtitleUrl} segments={segments} />;
  }

  let preview: React.ReactNode = null;
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext))
    // eslint-disable-next-line @next/next/no-img-element
    preview = <img src={src} alt={imageDescription || name} className="max-h-96 rounded-lg" />;
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
