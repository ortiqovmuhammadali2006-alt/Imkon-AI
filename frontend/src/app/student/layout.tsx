"use client";

import { LayoutDashboard, BookOpen, Brain, CalendarDays, ClipboardList, Star, MessagesSquare } from "lucide-react";
import DashboardShell, { type NavItem } from "@/components/DashboardShell";
import VoiceControl from "@/components/student/VoiceControl";
import VoiceQualityHint from "@/components/student/VoiceQualityHint";
import ImkonRobot from "@/components/robot/ImkonRobot";

const nav: NavItem[] = [
  { href: "/student", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/student/schedule", label: "Dars jadvali", icon: CalendarDays },
  { href: "/student/lessons", label: "Darslarim", icon: BookOpen },
  { href: "/student/assignments", label: "Vazifalar", icon: ClipboardList },
  { href: "/student/grades", label: "Baholarim", icon: Star },
  { href: "/student/knowledge", label: "Mening bilimim", icon: Brain },
  { href: "/student/chat", label: "AI suhbat", icon: MessagesSquare },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell role="student" nav={nav} toolbar={<VoiceControl />}>
      <VoiceQualityHint />
      {children}
      {/* Imkon robot-yordamchi — o'quvchi panelining har bir sahifasida pastki o'ng burchakda */}
      <ImkonRobot />
    </DashboardShell>
  );
}
