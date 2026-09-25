"use client";

import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useTeacherMutation, type LessonA11y } from "@/lib/teacher";

const STEP_LABELS: Record<string, string> = {
  subtitle: "Subtitr va nutq matni",
  text: "Fayldagi matn",
  image: "Rasm tavsifi",
  simple: "Oddiy til va atamalar lug'ati",
};

// O'qituvchi uchun: qulaylik to'plami holati, natijalardan namuna va qayta yaratish
export default function AccessibilityPanel({ lessonId, a11y }: { lessonId: number; a11y?: LessonA11y }) {
  const regenerate = useTeacherMutation(
    () => api.post(`/teacher/lessons/${lessonId}/accessibility`),
    "Qulaylik to'plami qayta tayyorlanmoqda"
  );
  const busy = !a11y?.status || ["pending", "processing"].includes(a11y.status);
  const steps = Object.entries(a11y?.steps ?? {});

  return (
    <section className="card p-6" aria-live="polite">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 p-2.5 text-white shadow-md shadow-indigo-500/25">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Qulaylik to&apos;plami</h2>
            <p className="text-sm text-slate-500">Materialdan o&apos;quvchilar uchun avtomatik yaratilgan formatlar</p>
          </div>
        </div>
        <button onClick={() => regenerate.mutate(undefined)} disabled={busy || regenerate.isPending} className="btn-secondary px-3 py-1.5 text-sm">
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} aria-hidden />
          {busy ? "Tayyorlanmoqda..." : "Qayta yaratish"}
        </button>
      </div>

      {busy && steps.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-4 text-slate-600">
          <Loader2 className="size-5 animate-spin text-indigo-500" aria-hidden /> Material qayta ishlanmoqda. Bu bir necha daqiqa olishi mumkin.
        </p>
      ) : steps.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-4 text-slate-500">
          Qayta ishlanadigan material yo&apos;q. Dars matni yoki fayl qo&apos;shsangiz, formatlar avtomatik tayyorlanadi.
        </p>
      ) : (
        <ul className="space-y-2">
          {steps.map(([key, step]) => (
            <li key={key} className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
              {step.status === "done" ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="font-medium">
                  {STEP_LABELS[key] ?? key}
                  {step.source === "teacher" && <span className="ml-2 badge bg-sky-100 text-sky-800">sizning subtitringiz</span>}
                </p>
                {step.status === "failed" && <p className="text-sm text-amber-800">{step.error}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Natijalardan qisqa namuna */}
      {(a11y?.simple_text || a11y?.transcript || a11y?.image_description || a11y?.key_terms?.length) && (
        <details className="mt-4 rounded-xl ring-1 ring-slate-200">
          <summary className="cursor-pointer px-4 py-3 font-medium">Natijani ko&apos;rish</summary>
          <div className="space-y-4 border-t border-slate-100 px-4 py-4 text-sm">
            {a11y.simple_text && (
              <div>
                <p className="mb-1 font-semibold">Oddiy tilda</p>
                <p className="whitespace-pre-wrap text-slate-700">{a11y.simple_text}</p>
              </div>
            )}
            {a11y.key_terms?.length ? (
              <div>
                <p className="mb-1 font-semibold">Atamalar</p>
                <ul className="space-y-1 text-slate-700">
                  {a11y.key_terms.map((t) => (
                    <li key={t.term}>
                      <b>{t.term}</b> — {t.meaning}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {a11y.image_description && (
              <div>
                <p className="mb-1 font-semibold">Rasm tavsifi</p>
                <p className="text-slate-700">{a11y.image_description}</p>
              </div>
            )}
            {a11y.transcript && (
              <div>
                <p className="mb-1 font-semibold">Nutq matni</p>
                <p className="line-clamp-6 text-slate-700">{a11y.transcript}</p>
              </div>
            )}
          </div>
        </details>
      )}
    </section>
  );
}
