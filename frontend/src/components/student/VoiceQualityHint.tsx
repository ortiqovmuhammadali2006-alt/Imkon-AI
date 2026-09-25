"use client";

import { useEffect, useState } from "react";
import { Volume2, X } from "lucide-react";
import { hasClearUzbekVoice, speak } from "@/lib/speech";

const DISMISS_KEY = "imkon_voice_hint_dismissed";

// O'zbekcha ovoz topilmasa (serverda Azure yo'q va brauzerda ham yo'q) — Microsoft Edge'ni tavsiya qiladi.
// Edge'da tabiiy o'zbekcha "Madina" va "Sardor" ovozlari bepul bor
export default function VoiceQualityHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (dismissed) return;
    let alive = true;
    hasClearUzbekVoice().then((ok) => alive && setShow(!ok));
    return () => {
      alive = false;
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  return (
    <div role="note" className="mb-6 flex animate-fade-in flex-col gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 sm:flex-row sm:items-center">
      <Volume2 className="size-6 shrink-0 text-amber-600" aria-hidden />
      <div className="flex-1 text-amber-950">
        <p className="font-semibold">Aniq o&apos;zbekcha ovoz uchun Microsoft Edge&apos;dan foydalaning</p>
        <p className="text-sm text-amber-900/80">
          Brauzeringizda o&apos;zbekcha ovoz yo&apos;q, shuning uchun matn boshqa tildagi ovoz bilan o&apos;qilmoqda. Edge&apos;da
          tabiiy o&apos;zbekcha ovozlar (Madina, Sardor) bepul bor.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button onClick={() => speak("Salom! Bu hozirgi ovoz. Darslar shu ovoz bilan o'qiladi.")} className="btn-secondary px-3 py-1.5 text-sm">
          <Volume2 className="size-4" aria-hidden /> Ovozni tinglash
        </button>
        <button onClick={dismiss} className="icon-btn" aria-label="Maslahatni yopish">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
