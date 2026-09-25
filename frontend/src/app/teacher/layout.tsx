"use client";

import { LayoutDashboard, BookOpen, CalendarCheck, Star } from "lucide-react";
import DashboardShell, { type NavItem } from "@/components/DashboardShell";

const nav: NavItem[] = [
  { href: "/teacher", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/teacher/lessons", label: "Darslar", icon: BookOpen },
  { href: "/teacher/attendance", label: "Davomat", icon: CalendarCheck },
  { href: "/teacher/grades", label: "Baholar", icon: Star },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell role="teacher" nav={nav}>
      {children}
    </DashboardShell>
  );
}
