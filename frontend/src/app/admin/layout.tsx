"use client";

import { LayoutDashboard, UserCog, Users, Wallet, Activity, CalendarDays, MessagesSquare } from "lucide-react";
import DashboardShell, { type NavItem } from "@/components/DashboardShell";

const nav: NavItem[] = [
  { href: "/admin", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/admin/teachers", label: "O'qituvchilar", icon: UserCog },
  { href: "/admin/students", label: "O'quvchilar", icon: Users },
  { href: "/admin/schedule", label: "Dars jadvali", icon: CalendarDays },
  { href: "/admin/salaries", label: "Oyliklar", icon: Wallet },
  { href: "/admin/monitoring", label: "Nazorat", icon: Activity },
  { href: "/admin/chat", label: "AI suhbat", icon: MessagesSquare },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell role="admin" nav={nav}>
      {children}
    </DashboardShell>
  );
}
