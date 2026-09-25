"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { GraduationCap, Loader2, LogOut, type LucideIcon } from "lucide-react";
import { ROLE_HOME, useAuth, type Role } from "@/lib/auth";

export type NavItem = { href: string; label: string; icon: LucideIcon };

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  teacher: "O'qituvchi",
  student: "O'quvchi",
};

// Rolga qarab himoyalangan panel: yon menyu + kontent
export default function DashboardShell({
  role,
  nav,
  children,
}: {
  role: Role;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.role !== role) router.replace(ROLE_HOME[user.role]);
  }, [user, loading, role, router]);

  if (loading || !user || user.role !== role) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-indigo-600" aria-label="Yuklanmoqda" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    toast.success("Tizimdan chiqdingiz");
  };

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="flex flex-col border-b border-slate-200 bg-white md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-5 py-5">
          <GraduationCap className="size-7 text-indigo-600" aria-hidden />
          <span className="text-lg font-bold">Imkon AI</span>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 font-medium ${
                  active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden border-t border-slate-200 p-4 md:block">
          <p className="truncate font-medium">{user.full_name}</p>
          <p className="text-sm text-slate-500">{ROLE_LABEL[role]}</p>
          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-red-600 hover:bg-red-50"
          >
            <LogOut className="size-5" aria-hidden />
            Chiqish
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8">
        <div className="mb-4 flex items-center justify-between md:hidden">
          <p className="font-medium">{user.full_name}</p>
          <button onClick={handleLogout} className="flex items-center gap-1 text-red-600">
            <LogOut className="size-5" aria-hidden />
            Chiqish
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
