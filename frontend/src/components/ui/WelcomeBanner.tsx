import { Hand } from "lucide-react";

const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Xayrli tun";
  if (h < 11) return "Xayrli tong";
  if (h < 18) return "Xayrli kun";
  return "Xayrli kech";
}

function todayText() {
  const d = new Date();
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}-${MONTHS[d.getMonth()]}`;
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
  return (
    // Bitta rang boshidan oxirigacha (gradient va xira dog'larsiz) — palitra bir xil bo'lsin
    <section className="relative overflow-hidden rounded-3xl bg-indigo-600 p-6 text-white shadow-xl shadow-indigo-600/20 sm:p-8">
      <div
        className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:20px_20px]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-100/90">{todayText()}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {greeting()}, {firstName}! <Hand className="ml-1 inline size-7 -rotate-12 align-[-0.1em]" aria-hidden />
          </h1>
          {subtitle && <p className="mt-2 max-w-xl text-brand-100/90">{subtitle}</p>}
        </div>
        {children && <div className="relative">{children}</div>}
      </div>
    </section>
  );
}
