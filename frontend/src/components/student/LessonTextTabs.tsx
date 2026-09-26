"use client";

import { useEffect, useRef, useState } from "react";
import { Apple, BookA, FileText, ImageIcon, Lightbulb, ListChecks, MessageSquareText, type LucideIcon } from "lucide-react";
import { onVoiceAction, speak } from "@/lib/speech";
import type { Category } from "@/lib/types";
import type { StudentA11y } from "@/lib/student";
import SpeakButton from "./SpeakButton";

type Tab = { key: string; label: string; icon: LucideIcon; speech: string; body: React.ReactNode };

const textBody = (text: string) => (
  <p className="max-w-[70ch] text-lg leading-8 whitespace-pre-wrap text-slate-800">{text}</p>
);

// Dars mazmuni turli formatlarda. Platforma imkoniyati cheklangan o'quvchilar uchun — shuning uchun birinchi "Sodda o'rganish"
// (asosiy fikr + oddiy til), keyin misollar, atamalar, o'qituvchining asl matni, fayldagi matn, rasm tavsifi.
// Ovoz: "Imkon, sodda" / "misol" / "atamalar" — yorliq ochiladi va o'qiladi. onActiveText — "O'qib ber" ochiq yorliqni o'qiydi
export default function LessonTextTabs({
  content,
  a11y,
  category,
  onActiveText,
}: {
  content: string | null;
  a11y: StudentA11y;
  category?: Category;
  onActiveText: (text: string) => void;
}) {
  const tabs: Tab[] = [];
  if (a11y.simple_text)
    tabs.push({
      key: "simple",
      label: "Sodda o'rganish",
      icon: MessageSquareText,
      speech: [a11y.summary && `Asosiy fikr: ${a11y.summary}`, a11y.simple_text].filter(Boolean).join(" "),
      body: (
        <div className="space-y-5">
          {a11y.summary && (
            <div className="flex gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <Lightbulb className="mt-0.5 size-6 shrink-0 text-indigo-600" aria-hidden />
              <div>
                <p className="text-sm font-semibold tracking-wide text-indigo-700 uppercase">Asosiy fikr</p>
                <p className="mt-1 text-lg font-medium text-slate-900">{a11y.summary}</p>
              </div>
            </div>
          )}
          {/* Har bir fikr alohida qatorda — raqamlangan qadamlar, katta shrift */}
          <ol className="space-y-3">
            {a11y.simple_text
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
              .map((line, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-lg leading-8 text-slate-800">{line}</span>
                </li>
              ))}
          </ol>
        </div>
      ),
    });
  if (a11y.examples.length)
    tabs.push({
      key: "examples",
      label: "Misollar",
      icon: Apple,
      speech: a11y.examples.map((e, i) => `${i + 1}-misol. ${e}`).join(" "),
      body: (
        <ul className="grid gap-3 sm:grid-cols-2">
          {a11y.examples.map((e, i) => (
            <li key={i} className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-700">{i + 1}-misol</p>
              <p className="mt-1 text-lg leading-7 text-slate-800">{e}</p>
            </li>
          ))}
        </ul>
      ),
    });
  if (content) tabs.push({ key: "content", label: "O'qituvchi matni", icon: FileText, speech: content, body: textBody(content) });
  if (a11y.extracted_text)
    tabs.push({ key: "material", label: "Materialdagi matn", icon: ListChecks, speech: a11y.extracted_text, body: textBody(a11y.extracted_text) });
  if (a11y.key_terms.length)
    tabs.push({
      key: "terms",
      label: "Atamalar",
      icon: BookA,
      speech: a11y.key_terms.map((t) => `${t.term} — ${t.meaning}`).join(". "),
      body: (
        <dl className="grid gap-3 sm:grid-cols-2">
          {a11y.key_terms.map((t) => (
            <div key={t.term} className="rounded-xl bg-indigo-50 p-4 ring-1 ring-indigo-200">
              <dt className="text-lg font-semibold text-indigo-900">{t.term}</dt>
              <dd className="mt-1 text-slate-700">{t.meaning}</dd>
            </div>
          ))}
        </dl>
      ),
    });
  if (a11y.image_description)
    tabs.push({
      key: "image",
      label: "Rasm tavsifi",
      icon: ImageIcon,
      speech: a11y.image_description,
      body: textBody(a11y.image_description),
    });

  // Hamma o'quvchiga avval sodda o'rganish (tabs[0]); category — kelajakda toifaga qarab tartib uchun
  void category;
  const [activeKey, setActiveKey] = useState<string | undefined>(tabs[0]?.key);
  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  useEffect(() => {
    onActiveText(active?.speech ?? "");
  }, [active?.speech, onActiveText]);

  // "Imkon, sodda" / "Imkon, misol" / "Imkon, atamalar" — yorliq ochiladi va darhol o'qiladi
  const tabsRef = useRef(tabs);
  useEffect(() => {
    tabsRef.current = tabs;
  });
  useEffect(
    () =>
      onVoiceAction((action) => {
        const key = { simple: "simple", examples: "examples", terms: "terms" }[action as string];
        if (!key) return;
        const tab = tabsRef.current.find((t) => t.key === key);
        if (!tab) {
          speak(key === "examples" ? "Bu darsda misollar hali tayyor emas" : "Bu darsning sodda varianti hali tayyor emas", { quick: true });
          return;
        }
        setActiveKey(key);
        speak(tab.speech);
      }),
    []
  );

  if (!tabs.length) {
    return (
      <p className="text-slate-500">
        Dars matni kiritilmagan. Materialni ko&apos;ring yoki AI yordamchidan tushuntirishni so&apos;rang.
      </p>
    );
  }

  return (
    <div>
      {tabs.length > 1 && (
        <div role="tablist" aria-label="Dars mazmuni formatlari" className="mb-6 flex flex-wrap gap-2">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={active.key === key}
              onClick={() => setActiveKey(key)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 font-medium transition-colors ${
                active.key === key ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      )}
      <div role="tabpanel" aria-label={active.label} className="space-y-4">
        <SpeakButton text={active.speech} label={`"${active.label}" ni tinglash`} />
        {active.body}
      </div>
    </div>
  );
}
