"use client";

import Link from "next/link";
import { Activity, UserCog, UserPlus, Users, Wallet, type LucideIcon } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { useAdminStats } from "@/lib/admin";
import { useAuth } from "@/lib/auth";
import { CATEGORIES, currentMonth, formatDate, formatMoney, formatMonth } from "@/lib/format";
import type { Category } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/ui/States";

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <div className="card flex items-start gap-4 p-5">
      <div className={`rounded-xl p-3 ${tone}`}>
        <Icon className="size-6" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-2xl font-bold">{value}</p>
        <p className="text-sm text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

const QUICK_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin/teachers", label: "O'qituvchi qo'shish", icon: UserPlus },
  { href: "/admin/students", label: "O'quvchi qo'shish", icon: Users },
  { href: "/admin/salaries", label: "Oylik to'lash", icon: Wallet },
  { href: "/admin/monitoring", label: "Faollikni ko'rish", icon: Activity },
];

export default function AdminHome() {
  const { user } = useAuth();
  const { data, isLoading, error } = useAdminStats();

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={getErrorMessage(error)} />;

  const { teachers, students, salary } = data;
  const salaryPercent = salary.expected ? Math.min((salary.paid / salary.expected) * 100, 100) : 0;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Xush kelibsiz, {user?.full_name}!</h1>
        <p className="mt-1 text-slate-500">Platformaning umumiy holati</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={UserCog}
          label="O'qituvchilar"
          value={String(teachers.total)}
          hint={`${teachers.active} tasi faol`}
          tone="bg-indigo-100 text-indigo-700"
        />
        <StatCard
          icon={Users}
          label="O'quvchilar"
          value={String(students.total)}
          hint={`${students.active} tasi faol`}
          tone="bg-sky-100 text-sky-700"
        />
        <StatCard
          icon={Wallet}
          label={`${formatMonth(currentMonth())} oyliklari`}
          value={formatMoney(salary.paid)}
          hint={`${formatMoney(salary.expected)} dan`}
          tone="bg-emerald-100 text-emerald-700"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">O&apos;quvchilar toifalari</h2>
          <ul className="space-y-3">
            {(Object.keys(CATEGORIES) as Category[]).map((key) => {
              const count = students.by_category[key];
              const percent = students.total ? (count / students.total) * 100 : 0;
              return (
                <li key={key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{CATEGORIES[key].label}</span>
                    <span className="font-medium">{count} ta</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${percent}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">So&apos;nggi to&apos;lovlar</h2>
            <span className="text-sm text-slate-500">Bu oy: {Math.round(salaryPercent)}%</span>
          </div>
          {data.recent_payments.length === 0 ? (
            <p className="py-6 text-center text-slate-500">Hali to&apos;lov qilinmagan</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recent_payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{p.teacher_name}</p>
                    <p className="text-slate-500">
                      {formatMonth(p.month)} · {formatDate(p.paid_at)}
                    </p>
                  </div>
                  <p className="font-semibold whitespace-nowrap text-emerald-700">{formatMoney(p.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Tezkor amallar</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="card flex items-center gap-3 p-4 font-medium hover:ring-indigo-300"
            >
              <Icon className="size-5 text-indigo-600" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
