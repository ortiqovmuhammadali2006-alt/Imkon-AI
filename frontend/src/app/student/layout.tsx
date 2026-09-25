"use client";

import { LayoutDashboard, BookOpen, CalendarDays, ClipboardList, Star } from "lucide-react";
import DashboardShell, { type NavItem } from "@/components/DashboardShell";
import VoiceControl from "@/components/student/VoiceControl";

const nav: NavItem[] = [
  { href: "/student", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/student/schedule", label: "Dars jadvali", icon: CalendarDays },
  { href: "/student/lessons", label: "Darslarim", icon: BookOpen },
  { href: "/student/assignments", label: "Vazifalar", icon: ClipboardList },
  { href: "/student/grades", label: "Baholarim", icon: Star },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell role="student" nav={nav}>
      <div className="pb-24">{children}</div>
      <VoiceControl />
    </DashboardShell>
  );
}
