"use client";

import { useEffect, useState } from "react";
import { BookA, FileText, ImageIcon, ListChecks, MessageSquareText, type LucideIcon } from "lucide-react";
import type { Category } from "@/lib/types";
import type { StudentA11y } from "@/lib/student";
import SpeakButton from "./SpeakButton";

type Tab = { key: string; label: string; icon: LucideIcon; speech: string; body: React.ReactNode };

const textBody = (text: string) => (
  <p className="max-w-[70ch] text-lg leading-8 whitespace-pre-wrap text-slate-800">{text}</p>
);

// Dars mazmuni turli formatlarda: asl matn, oddiy til, fayldagi matn, atamalar, rasm tavsifi.
// onActiveText — "O'qib ber" ovozli buyrug'i ochiq yorliqni o'qishi uchun
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
  if (content) tabs.push({ key: "content", label: "Dars matni", icon: FileText, speech: content, body: textBody(content) });
  if (a11y.simple_text)
    tabs.push({ key: "simple", label: "Oddiy tilda", icon: MessageSquareText, speech: a11y.simple_text, body: textBody(a11y.simple_text) });
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
            <div key={t.term} className="rounded-xl bg-indigo-50 p-4 ring-1 ring-indigo-100">
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

  // Eshitishi cheklangan o'quvchiga avval oddiy til, qolganlarga — asl matn
  const preferred = category === "hearing" && a11y.simple_text ? "simple" : tabs[0]?.key;
  const [activeKey, setActiveKey] = useState<string | undefined>(preferred);
  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  useEffect(() => {
    onActiveText(active?.speech ?? "");
  }, [active?.speech, onActiveText]);

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
