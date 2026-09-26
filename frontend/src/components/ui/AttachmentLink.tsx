import { Download, Paperclip } from "lucide-react";
import { fileUrl } from "@/lib/api";
import FileTypeBadge from "./FileTypeBadge";

const IMAGE = /\.(jpe?g|png|webp|gif)$/i;

// Biriktirilgan fayl (masalan, vazifa varag'i): rasm bo'lsa — kichik ko'rinish, aks holda nom + turi; bosilsa yangi oynada ochiladi
export default function AttachmentLink({ url, name, label = "Vazifa fayli" }: { url: string; name: string; label?: string }) {
  const href = fileUrl(url);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-lg border border-line bg-surface p-2.5 pr-4 transition-colors hover:border-indigo-300 hover:bg-indigo-50"
    >
      {IMAGE.test(name) ? (
        // eslint-disable-next-line @next/next/no-img-element -- backend serveridagi yuklangan rasm
        <img src={href} alt="" className="size-12 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
          <Paperclip className="size-5" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-slate-500">{label}</span>
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-slate-900">{name}</span>
          <FileTypeBadge name={name} />
        </span>
      </span>
      <Download className="size-4 shrink-0 text-slate-400 group-hover:text-indigo-600" aria-hidden />
      <span className="sr-only">(yangi oynada ochiladi)</span>
    </a>
  );
}
