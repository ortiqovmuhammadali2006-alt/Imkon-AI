import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

const TONES = {
  indigo: "from-indigo-500 to-violet-500 shadow-indigo-500/30",
  sky: "from-sky-500 to-indigo-500 shadow-sky-500/30",
  emerald: "from-emerald-500 to-teal-500 shadow-emerald-500/30",
  amber: "from-amber-400 to-orange-500 shadow-amber-500/30",
  violet: "from-violet-500 to-fuchsia-500 shadow-violet-500/30",
  rose: "from-rose-500 to-pink-500 shadow-rose-500/30",
};

export type Tone = keyof typeof TONES;

export default function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  tone = "indigo",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: Tone;
}) {
  const body = (
    <>
      <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${TONES[tone]}`}>
        <Icon className="size-6" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        {hint && <p className="truncate text-sm text-slate-400">{hint}</p>}
      </div>
      {href && (
        <ArrowUpRight className="size-5 shrink-0 self-start text-slate-300 transition-colors group-hover:text-indigo-500" aria-hidden />
      )}
    </>
  );

  return href ? (
    <Link href={href} className="card card-hover group flex items-center gap-4 p-5">
      {body}
    </Link>
  ) : (
    <div className="card flex items-center gap-4 p-5">{body}</div>
  );
}
