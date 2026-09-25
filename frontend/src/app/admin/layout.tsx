"use client";

import { LayoutDashboard, UserCog, Users, Wallet, Activity, CalendarDays } from "lucide-react";
import DashboardShell, { type NavItem } from "@/components/DashboardShell";

const nav: NavItem[] = [
  { href: "/admin", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/admin/teachers", label: "O'qituvchilar", icon: UserCog },
  { href: "/admin/students", label: "O'quvchilar", icon: Users },
  { href: "/admin/schedule", label: "Dars jadvali", icon: CalendarDays },
  { href: "/admin/salaries", label: "Oyliklar", icon: Wallet },
  { href: "/admin/monitoring", label: "Nazorat", icon: Activity },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell role="admin" nav={nav}>
      {children}
    </DashboardShell>
  );
}
