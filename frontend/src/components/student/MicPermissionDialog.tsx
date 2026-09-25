"use client";

import { Globe, Lock, MicOff, RefreshCw, Settings, type LucideIcon } from "lucide-react";
import Modal from "@/components/ui/Modal";

type Guide = { title: string; icon: LucideIcon; intro: string; steps: React.ReactNode[] };

// Xato turiga qarab tushunarli ko'rsatma
function guideFor(code: string): Guide {
  if (code === "audio-capture") {
    return {
      title: "Mikrofon topilmadi",
      icon: MicOff,
      intro: "Kompyuter mikrofonni ko'rmayapti yoki uni boshqa dastur band qilgan.",
      steps: [
        "Mikrofon yoki quloqchin kompyuterga ulanganini tekshiring.",
        "Zoom, Telegram kabi mikrofonni ishlatayotgan dasturlarni yoping.",
        <>
          Windows&apos;da <b>Sozlamalar → Maxfiylik → Mikrofon</b> bo&apos;limida brauzerga ruxsat yoqilganini tekshiring.
        </>,
      ],
    };
  }
  if (code === "unsupported" || code === "language-not-supported") {
    return {
      title: "Brauzer ovozni tanimaydi",
      icon: Globe,
      intro: "Bu brauzerda ovozli boshqaruv ishlamaydi.",
      steps: [
        <>
          Platformani <b>Google Chrome</b> yoki <b>Microsoft Edge</b> brauzerida oching.
        </>,
        "Brauzer eng so'nggi versiyaga yangilanganini tekshiring.",
      ],
    };
  }
  // not-allowed / service-not-allowed — ruxsat berilmagan
  return {
    title: "Mikrofonga ruxsat berilmagan",
    icon: Lock,
    intro: "Ovozli boshqaruv ishlashi uchun brauzer mikrofondan foydalanishiga ruxsat bering.",
    steps: [
      <>
        Manzil satrining chap tomonidagi <b>🔒 qulf</b> (yoki <b>ⓘ</b>) belgisini bosing.
      </>,
      <>
        <b>Mikrofon</b> yonidagi tanlovni <b>&quot;Ruxsat berish&quot;</b> ga o&apos;zgartiring.
      </>,
      <>
        Sahifani yangilang (<b>F5</b>) yoki pastdagi <b>&quot;Qayta urinish&quot;</b> tugmasini bosing.
      </>,
    ],
  };
}

export default function MicPermissionDialog({
  code,
  onRetry,
  onClose,
}: {
  code: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  if (!code) return null;
  const guide = guideFor(code);
  const Icon = guide.icon;
  const canRetry = code !== "unsupported" && code !== "language-not-supported";

  return (
    <Modal open title={guide.title} onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/30">
          <Icon className="size-8" aria-hidden />
        </div>
        <p className="text-slate-600">{guide.intro}</p>
      </div>

      <ol className="mt-6 space-y-3">
        {guide.steps.map((step, i) => (
          <li key={i} className="flex gap-3 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{i + 1}</span>
            <span className="pt-0.5 text-slate-700">{step}</span>
          </li>
        ))}
      </ol>

      {code === "not-allowed" && (
        <p className="mt-4 flex items-start gap-2 text-sm text-slate-500">
          <Settings className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Qulf belgisi ko&apos;rinmasa: brauzer sozlamalarida <b>Maxfiylik → Sayt sozlamalari → Mikrofon</b> bo&apos;limida shu
            saytga ruxsat bering.
          </span>
        </p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">
          Yopish
        </button>
        {canRetry && (
          <button onClick={onRetry} className="btn-primary">
            <RefreshCw className="size-4" aria-hidden /> Qayta urinish
          </button>
        )}
      </div>
    </Modal>
  );
}
