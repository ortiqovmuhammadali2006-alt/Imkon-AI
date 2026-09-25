"use client";

import { LayoutDashboard, BookOpen, CalendarCheck, CalendarDays, Star, MessagesSquare } from "lucide-react";
import DashboardShell, { type NavItem } from "@/components/DashboardShell";

const nav: NavItem[] = [
  { href: "/teacher", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/teacher/schedule", label: "Dars jadvali", icon: CalendarDays },
  { href: "/teacher/lessons", label: "Darslar va materiallar", icon: BookOpen },
  { href: "/teacher/attendance", label: "Davomat", icon: CalendarCheck },
  { href: "/teacher/grades", label: "Baholar", icon: Star },
  { href: "/teacher/chat", label: "AI suhbat", icon: MessagesSquare },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell role="teacher" nav={nav}>
      {children}
    </DashboardShell>
  );
}
