"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { ROLE_HOME, useAuth, type Role, type User } from "@/lib/auth";
import Logo from "@/components/ui/Logo";
import Avatar from "@/components/ui/Avatar";
import ThemeToggle from "@/components/ui/ThemeToggle";

export type NavItem = { href: string; label: string; icon: LucideIcon };

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  teacher: "O'qituvchi",
  student: "O'quvchi",
};

function NavLinks({ nav, role, pathname, onNavigate }: { nav: NavItem[]; role: Role; pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Asosiy menyu" className="space-y-1">
      {nav.map(({ href, label, icon: Icon }) => {
        // Bosh sahifa faqat o'zida, qolganlari ichki sahifalarda ham faol ko'rinadi
        const active = href === ROLE_HOME[role] ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-colors ${
              active
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
            }`}
          >
            {active && <span className="absolute top-2 bottom-2 left-0 w-1 rounded-r-full bg-indigo-600" aria-hidden />}
            <span
              className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                active ? "bg-surface text-indigo-600 shadow-sm" : "text-slate-500 group-hover:text-slate-700"
              }`}
            >
              <Icon className="size-[18px]" aria-hidden />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserCard({ user, role, onLogout }: { user: User; role: Role; onLogout: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <Avatar name={user.full_name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">{user.full_name}</p>
        <p className="truncate text-xs text-slate-500">
          {ROLE_LABEL[role]}
          {user.subject && ` · ${user.subject}`}
        </p>
      </div>
      <button onClick={onLogout} className="icon-btn hover:bg-red-50 hover:text-red-600" aria-label="Tizimdan chiqish" title="Chiqish">
        <LogOut className="size-5" />
      </button>
    </div>
  );
}

// Rolga qarab himoyalangan panel: yon menyu (kompyuterda) / ochiladigan menyu (telefonda) + kontent
export default function DashboardShell({
  role,
  nav,
  toolbar,
  children,
}: {
  role: Role;
  nav: NavItem[];
  toolbar?: React.ReactNode; // yuqori panelning o'ng tomonidagi qo'shimcha tugmalar
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.role !== role) router.replace(ROLE_HOME[user.role]);
  }, [user, loading, role, router]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  if (loading || !user || user.role !== role) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Logo size="lg" />
        <Loader2 className="size-6 animate-spin text-indigo-600" aria-label="Yuklanmoqda" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    toast.success("Tizimdan chiqdingiz");
  };

  return (
    <div className="flex flex-1">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-indigo-600 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Asosiy kontentga o&apos;tish
      </a>

      {/* Kompyuter: doimiy yon menyu */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-slate-200/70 bg-surface/80 backdrop-blur-xl lg:flex">
        <div className="px-6 py-6">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto px-4">
          <p className="mb-2 px-3 text-xs font-semibold tracking-wider text-slate-400 uppercase">Menyu</p>
          <NavLinks nav={nav} role={role} pathname={pathname} />
        </div>
        <div className="p-4">
          <UserCard user={user} role={role} onLogout={handleLogout} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Yuqori panel: telefonda menyu tugmasi, o'ngda panel asboblari (ovoz, tungi rejim) */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/70 bg-surface/85 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-10">
          <button onClick={() => setDrawerOpen(true)} className="icon-btn -ml-1 lg:hidden" aria-label="Menyuni ochish" aria-expanded={drawerOpen}>
            <Menu className="size-6" />
          </button>
          <div className="hidden sm:block lg:hidden">
            <Logo />
          </div>
          <p className="hidden text-sm font-medium text-slate-500 lg:block">{ROLE_LABEL[role]} paneli</p>
          <div className="ml-auto flex items-center gap-2">
            {toolbar}
            <ThemeToggle />
          </div>
        </header>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menyu">
            <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] animate-slide-up flex-col bg-surface shadow-2xl">
              <div className="flex items-center justify-between px-5 py-5">
                <Logo />
                <button onClick={() => setDrawerOpen(false)} className="icon-btn" aria-label="Menyuni yopish">
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4">
                <NavLinks nav={nav} role={role} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
              </div>
              <div className="p-4">
                <UserCard user={user} role={role} onLogout={handleLogout} />
              </div>
            </div>
          </div>
        )}

        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
