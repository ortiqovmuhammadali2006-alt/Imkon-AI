"use client";

import { LayoutDashboard, BookOpen, ClipboardList } from "lucide-react";
import DashboardShell, { type NavItem } from "@/components/DashboardShell";

const nav: NavItem[] = [
  { href: "/student", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/student/lessons", label: "Darslarim", icon: BookOpen },
  { href: "/student/assignments", label: "Vazifalar", icon: ClipboardList },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell role="student" nav={nav}>
      {children}
    </DashboardShell>
  );
}
