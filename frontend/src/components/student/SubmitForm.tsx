"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Mic, Paperclip, Send, X } from "lucide-react";
import { listenOnce } from "@/lib/speech";
import { useSubmitAssignment } from "@/lib/student";

const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp,.mp3,.wav,.ogg,.m4a,.mp4,.webm,.zip";

// Vazifa javobini topshirish: matn (yozib yoki ovoz bilan) va/yoki fayl
export default function SubmitForm({
  assignmentId,
  initialText,
  initialFileName,
  onDone,
}: {
  assignmentId: number;
  initialText?: string | null;
  initialFileName?: string | null;
  onDone?: () => void;
}) {
  const [text, setText] = useState(initialText ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useSubmitAssignment(assignmentId, onDone);

  const dictate = async () => {
    setListening(true);
    try {
      const heard = await listenOnce();
      if (heard) setText((t) => (t ? `${t} ${heard}` : heard));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setListening(false);
    }
  };

  const fileName = file?.name ?? (!removeFile ? initialFileName : null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ answerText: text, file, removeFile });
      }}
      className="space-y-3"
    >
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor={`answer-${assignmentId}`} className="text-sm font-medium text-slate-700">
            Javobingiz
          </label>
          <button
            type="button"
            onClick={dictate}
            disabled={listening}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm ${
              listening ? "animate-pulse bg-red-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Mic className="size-4" aria-hidden /> {listening ? "Tinglayapman..." : "Ovoz bilan yozish"}
          </button>
        </div>
        <textarea
          id={`answer-${assignmentId}`}
          rows={5}
          className="input resize-y"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Javobni shu yerga yozing yoki ovoz bilan ayting"
        />
      </div>

      {fileName ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-300 px-3.5 py-2.5">
          <Paperclip className="size-5 shrink-0 text-indigo-600" aria-hidden />
          <span className="flex-1 truncate">{fileName}</span>
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
        <label className="btn-secondary cursor-pointer">
          <Paperclip className="size-4" aria-hidden /> Fayl biriktirish
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                setRemoveFile(false);
              }
            }}
          />
        </label>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={mutation.isPending || (!text.trim() && !fileName)} className="btn-primary">
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          {initialText || initialFileName ? "Qayta topshirish" : "Topshirish"}
        </button>
      </div>
    </form>
  );
}
