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
import ProfileModal from "@/components/ProfileModal";

export const OPEN_PROFILE_EVENT = "imkon:open-profile";

export type NavItem = { href: string; label: string; icon: LucideIcon };

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  teacher: "O'qituvchi",
  student: "O'quvchi",
};

// Har bir rolning o'z ko'rinishi. Rang: asosiy (indigo) shkala <html class="role-..."> orqali almashtiriladi
// (globals.css): admin — binafsha, o'qituvchi — indigo, o'quvchi — ko'k. Shuning uchun bu yerda faqat indigo-* yoziladi.
// Tuzilish ham farq qiladi: admin — oq va binafsha, ixcham menyu, faol band chap chiziq bilan; o'qituvchi — to'ldirilgan faol band;
// o'quvchi — katta, bosish oson tugmalar va rangli belgi kataklari.
type RoleTheme = {
  page: string;
  sidebar: string;
  logoLight: boolean;
  menuLabel: string;
  navItem: string;
  navItemActive: string;
  navIndicator: string;
  navSize: string;
  iconBox: string;
  navIcon: string;
  navIconActive: string;
  userCard: string;
  userName: string;
  userRole: string;
  header: string;
  loader: string;
  logoutHover: string;
  badge: string;
  closeBtn: string;
};

const ROLE_THEME: Record<Role, RoleTheme> = {
  admin: {
    page: "bg-canvas",
    sidebar: "border-r border-line bg-surface",
    logoLight: false,
    menuLabel: "text-indigo-500",
    navItem: "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700",
    navItemActive: "bg-indigo-50 text-indigo-700 font-semibold",
    navIndicator: "bg-indigo-600",
    navSize: "px-3 py-2 text-[15px]",
    iconBox: "size-8 rounded-lg",
    navIcon: "text-slate-500 group-hover:text-indigo-600",
    navIconActive: "bg-indigo-600 text-white shadow-md shadow-indigo-600/30",
    userCard: "bg-indigo-50 ring-indigo-200 hover:bg-indigo-100",
    userName: "text-slate-900",
    userRole: "text-indigo-700",
    header: "bg-surface/85 border-line",
    loader: "text-indigo-600",
    logoutHover: "text-slate-500 hover:bg-red-50 hover:text-red-600",
    badge: "border-indigo-200 bg-indigo-50 text-indigo-700",
    closeBtn: "text-slate-500",
  },
  teacher: {
    page: "bg-canvas",
    sidebar: "border-r border-line bg-surface",
    logoLight: false,
    menuLabel: "text-slate-400",
    navItem: "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700",
    navItemActive: "bg-indigo-600 text-white shadow-md shadow-indigo-600/25",
    navIndicator: "hidden",
    navSize: "px-3 py-2.5",
    iconBox: "size-8 rounded-lg",
    navIcon: "text-slate-500 group-hover:text-indigo-600",
    navIconActive: "text-white",
    userCard: "bg-slate-50 ring-line hover:bg-indigo-50",
    userName: "text-slate-900",
    userRole: "text-slate-500",
    header: "bg-surface/85 border-line",
    loader: "text-indigo-600",
    logoutHover: "text-slate-500 hover:bg-red-50 hover:text-red-600",
    badge: "border-indigo-200 bg-indigo-50 text-indigo-700",
    closeBtn: "text-slate-500",
  },
  student: {
    page: "bg-canvas",
    sidebar: "border-r border-indigo-200 bg-gradient-to-b from-indigo-50 to-surface",
    logoLight: false,
    menuLabel: "text-indigo-700/70",
    navItem: "text-slate-700 hover:bg-surface hover:text-indigo-700 hover:shadow-sm",
    navItemActive: "bg-surface text-indigo-700 shadow-md ring-2 ring-indigo-200",
    navIndicator: "hidden",
    navSize: "px-3 py-3 text-[17px]",
    iconBox: "size-10 rounded-xl",
    navIcon: "bg-indigo-100 text-indigo-600",
    navIconActive: "bg-indigo-600 text-white shadow-md shadow-indigo-600/30",
    userCard: "bg-surface shadow-sm ring-indigo-200 hover:bg-indigo-50",
    userName: "text-slate-900",
    userRole: "text-indigo-700",
    header: "bg-surface/85 border-indigo-200",
    loader: "text-indigo-600",
    logoutHover: "text-slate-500 hover:bg-red-50 hover:text-red-600",
    badge: "border-indigo-200 bg-indigo-100 text-indigo-700",
    closeBtn: "text-slate-500",
  },
};

function NavLinks({ nav, role, pathname, onNavigate }: { nav: NavItem[]; role: Role; pathname: string; onNavigate?: () => void }) {
  const theme = ROLE_THEME[role];
  return (
    <nav aria-label="Asosiy menyu" className="space-y-1.5">
      {nav.map(({ href, label, icon: Icon }) => {
        const active = href === ROLE_HOME[role] ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`group relative flex items-center gap-3 rounded-xl font-medium transition-all duration-200 ${theme.navSize} ${
              active ? theme.navItemActive : theme.navItem
            }`}
          >
            {active && <span className={`absolute top-2 bottom-2 left-0 w-1 rounded-r-full ${theme.navIndicator}`} aria-hidden />}
            <span
              className={`flex shrink-0 items-center justify-center transition-colors ${theme.iconBox} ${
                active ? theme.navIconActive : theme.navIcon
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

function UserCard({ user, role, onOpen, onLogout }: { user: User; role: Role; onOpen: () => void; onLogout: () => void }) {
  const theme = ROLE_THEME[role];
  return (
    <div className={`flex items-center gap-1 rounded-2xl p-1.5 ring-1 transition-colors ${theme.userCard}`}>
      <button
        onClick={onOpen}
        aria-haspopup="dialog"
        title="Profilni ko'rish"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 text-left transition-colors"
      >
        <Avatar name={user.full_name} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-semibold ${theme.userName}`}>{user.full_name}</span>
          <span className={`block truncate text-xs ${theme.userRole}`}>
            {ROLE_LABEL[role]}
            {user.subject && ` · ${user.subject}`}
          </span>
        </span>
      </button>
      <button onClick={onLogout} className={`icon-btn transition-colors ${theme.logoutHover}`} aria-label="Tizimdan chiqish" title="Chiqish">
        <LogOut className="size-5" />
      </button>
    </div>
  );
}

export default function DashboardShell({
  role,
  nav,
  toolbar,
  children,
}: {
  role: Role;
  nav: NavItem[];
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const open = () => setProfileOpen(true);
    window.addEventListener(OPEN_PROFILE_EVENT, open);
    return () => window.removeEventListener(OPEN_PROFILE_EVENT, open);
  }, []);

  // Rol rangi butun sahifaga (oynalar, kalendar, bildirishnomalar ham) — globals.css: html.role-*
  useEffect(() => {
    const cls = `role-${role}`;
    document.documentElement.classList.add(cls);
    return () => document.documentElement.classList.remove(cls);
  }, [role]);

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
        <Loader2 className={`size-6 animate-spin ${ROLE_THEME[role].loader}`} aria-label="Yuklanmoqda" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    toast.success("Tizimdan chiqdingiz");
  };

  const theme = ROLE_THEME[role];

  return (
    <div className={`flex flex-1 ${theme.page}`}>
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-indigo-600 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Asosiy kontentga o&apos;tish
      </a>

      {/* Kompyuter: yon menyu */}
      <aside className={`sticky top-0 hidden h-screen w-72 shrink-0 flex-col backdrop-blur-xl lg:flex transition-colors duration-300 ${theme.sidebar}`}>
        <div className="flex flex-col items-start gap-3 px-6 py-6">
          <Logo light={theme.logoLight} />
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase ${theme.badge}`}>
            {ROLE_LABEL[role]} paneli
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 mt-2">
          <p className={`mb-3 px-3 text-xs font-semibold tracking-wider uppercase ${theme.menuLabel}`}>Menyu</p>
          <NavLinks nav={nav} role={role} pathname={pathname} />
        </div>
        <div className="p-4">
          <UserCard user={user} role={role} onOpen={() => setProfileOpen(true)} onLogout={handleLogout} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Yuqori panel */}
        <header className={`sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-10 transition-colors duration-300 ${theme.header}`}>
          <button onClick={() => setDrawerOpen(true)} className="icon-btn -ml-1 lg:hidden" aria-label="Menyuni ochish" aria-expanded={drawerOpen}>
            <Menu className="size-6" />
          </button>
          <div className="hidden sm:block lg:hidden">
            <Logo />
          </div>
          <p className="hidden text-sm font-medium text-slate-500 lg:flex lg:items-center lg:gap-2">
            {ROLE_LABEL[role]} paneli
          </p>
          <div className="ml-auto flex items-center gap-2">
            {toolbar}
            <ThemeToggle />
          </div>
        </header>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menyu">
            <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
            <div className={`absolute inset-y-0 left-0 flex w-80 max-w-[85vw] animate-slide-up flex-col shadow-2xl ${theme.sidebar.replace("border-r", "")}`}>
              <div className="flex items-center justify-between px-5 py-5">
                <Logo light={theme.logoLight} />
                <button onClick={() => setDrawerOpen(false)} className={`icon-btn ${theme.closeBtn}`} aria-label="Menyuni yopish">
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4">
                <NavLinks nav={nav} role={role} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
              </div>
              <div className="p-4">
                <UserCard
                  user={user}
                  role={role}
                  onOpen={() => {
                    setDrawerOpen(false);
                    setProfileOpen(true);
                  }}
                  onLogout={handleLogout}
                />
              </div>
            </div>
          </div>
        )}

        <ProfileModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          onLogout={() => {
            setProfileOpen(false);
            handleLogout();
          }}
        />

        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}

