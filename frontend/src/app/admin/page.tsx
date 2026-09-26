"use client";

import Link from "next/link";
import { Activity, CalendarDays, UserCog, UserPlus, Users, Wallet, type LucideIcon } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { useAdminStats } from "@/lib/admin";
import { useAuth } from "@/lib/auth";
import { CATEGORIES, currentMonth, formatDate, formatMoney, formatMonth } from "@/lib/format";
import type { Category } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/ui/States";
import StatCard from "@/components/ui/StatCard";
import WelcomeBanner from "@/components/ui/WelcomeBanner";
import Avatar from "@/components/ui/Avatar";

const QUICK_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin/teachers", label: "O'qituvchi qo'shish", icon: UserPlus },
  { href: "/admin/students", label: "O'quvchi qo'shish", icon: Users },
  { href: "/admin/schedule", label: "Dars jadvali", icon: CalendarDays },
];

const CATEGORY_BAR: Record<Category, string> = {
  general: "from-indigo-500 to-indigo-600",
  visual: "from-indigo-500 to-indigo-600",
  hearing: "from-indigo-500 to-indigo-600",
  physical: "from-indigo-500 to-indigo-600",
};

export default function AdminHome() {
  const { user } = useAuth();
  const { data, isLoading, error } = useAdminStats();

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={getErrorMessage(error)} />;

  const { teachers, students, salary } = data;
  const salaryPercent = salary.expected ? Math.min((salary.paid / salary.expected) * 100, 100) : 0;

  return (
    <section className="space-y-8">
      <WelcomeBanner name={user?.full_name ?? ""} subtitle="Platformaning bugungi umumiy holati">
        <div className="flex flex-wrap gap-2">
          {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2 text-sm font-medium ring-1 ring-white/20 backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </WelcomeBanner>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={UserCog} label="O'qituvchilar" value={teachers.total} hint={`${teachers.active} tasi faol`} href="/admin/teachers" />
        <StatCard icon={Users} label="O'quvchilar" value={students.total} hint={`${students.active} tasi faol`} href="/admin/students" />
        <StatCard icon={Wallet} label={`${formatMonth(currentMonth())} oyliklari`} value={formatMoney(salary.paid)} hint={`${formatMoney(salary.expected)} dan`} href="/admin/salaries" />
        <StatCard icon={Activity} label="Nazorat" value="Faollik" hint="O'qituvchilar faoliyati" href="/admin/monitoring" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-5 text-lg font-semibold tracking-tight">O&apos;quvchilar toifalari</h2>
          {students.total === 0 ? (
            <p className="py-6 text-center text-slate-500">Hali o&apos;quvchi qo&apos;shilmagan</p>
          ) : (
            <ul className="space-y-4">
              {(Object.keys(CATEGORIES) as Category[]).map((key) => {
                const count = students.by_category[key];
                const percent = (count / students.total) * 100;
                return (
                  <li key={key}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-medium text-slate-700">{CATEGORIES[key].label}</span>
                      <span className="text-slate-500">
                        <b className="text-slate-900">{count}</b> ta · {Math.round(percent)}%
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${CATEGORY_BAR[key]}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">So&apos;nggi to&apos;lovlar</h2>
            <span className="badge bg-emerald-50 text-emerald-700">Bu oy: {Math.round(salaryPercent)}%</span>
          </div>
          {data.recent_payments.length === 0 ? (
            <p className="py-6 text-center text-slate-500">Hali to&apos;lov qilinmagan</p>
          ) : (
            <ul className="space-y-1">
              {data.recent_payments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50">
                  <Avatar name={p.teacher_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.teacher_name}</p>
                    <p className="text-sm text-slate-500">
                      {formatMonth(p.month)} · {formatDate(p.paid_at)}
                    </p>
                  </div>
                  <p className="font-semibold whitespace-nowrap text-emerald-700">+{formatMoney(p.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
