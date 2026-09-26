"use client";

import { useEffect, useState } from "react";
import { Hand } from "lucide-react";

const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

// Vaqt har doim Toshkent bo'yicha: kompyuterning soat mintaqasi noto'g'ri sozlangan bo'lsa ham
// (masalan, UTC) kechasi "Xayrli tong" chiqib qolmasin
function tashkentNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tashkent",
      hour: "numeric",
      hourCycle: "h23",
      day: "numeric",
      month: "numeric",
      weekday: "short",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { hour: Number(parts.hour), day: Number(parts.day), month: Number(parts.month) - 1, weekday };
}

// 05-11 tong, 11-18 kun, 18-22 kech, 22-05 tun
function greeting(hour: number) {
  if (hour >= 5 && hour < 11) return "Xayrli tong";
  if (hour >= 11 && hour < 18) return "Xayrli kun";
  if (hour >= 18 && hour < 22) return "Xayrli kech";
  return "Xayrli tun";
}

// Har daqiqada yangilanadi — sahifa ertalabdan kechgacha ochiq tursa ham salom vaqtga mos bo'ladi
function useTashkentTime() {
  const [now, setNow] = useState(tashkentNow);
  useEffect(() => {
    const id = setInterval(() => setNow(tashkentNow()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Bosh sahifalar uchun rangli salomlashish banneri
export default function WelcomeBanner({
  name,
  subtitle,
  children,
}: {
  name: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const firstName = name.split(/\s+/)[0];
  const now = useTashkentTime();
  return (
    // Bitta rang boshidan oxirigacha (gradient va xira dog'larsiz) — palitra bir xil bo'lsin
    <section className="relative overflow-hidden rounded-3xl bg-indigo-600 p-6 text-white shadow-xl shadow-indigo-600/20 sm:p-8">
      <div
        className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:20px_20px]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-100/90">{`${WEEKDAYS[now.weekday]}, ${now.day}-${MONTHS[now.month]}`}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {greeting(now.hour)}, {firstName}! <Hand className="ml-1 inline size-7 -rotate-12 align-[-0.1em]" aria-hidden />
          </h1>
          {subtitle && <p className="mt-2 max-w-xl text-brand-100/90">{subtitle}</p>}
        </div>
        {children && <div className="relative">{children}</div>}
      </div>
    </section>
  );
}
