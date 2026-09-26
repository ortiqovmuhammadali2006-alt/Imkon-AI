"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, Cake, CalendarDays, GraduationCap, LogOut, Phone, UserRound, Users, type LucideIcon } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import type { Role } from "@/lib/auth";
import type { Category } from "@/lib/types";
import { formatDate, formatGrade } from "@/lib/format";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import CategoryBadge from "@/components/ui/CategoryBadge";
import { ErrorState } from "@/components/ui/States";

type Profile = {
  full_name: string;
  username: string;
  role: Role;
  phone: string | null;
  created_at: string;
  // o'quvchi
  category?: Category;
  grade?: string | null;
  birth_date?: string | null;
  teachers?: { full_name: string; subject: string | null }[];
  // o'qituvchi
  subject?: string | null;
  students_count?: number;
  lessons_count?: number;
};

const ROLE_LABEL: Record<Role, string> = { admin: "Administrator", teacher: "O'qituvchi", student: "O'quvchi" };

function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <dt className="flex-1 text-sm text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{children}</dd>
    </div>
  );
}

// Yon menyudagi foydalanuvchi kartasi bosilganda ochiladigan profil
export default function ProfileModal({ open, onClose, onLogout }: { open: boolean; onClose: () => void; onLogout: () => void }) {
  const { data: p, isLoading, error } = useQuery({
    queryKey: ["auth", "profile"],
    queryFn: async () => (await api.get<Profile>("/auth/profile")).data,
    enabled: open,
  });

  return (
    <Modal open={open} title="Profil" onClose={onClose}>
      {isLoading ? (
        <div className="space-y-3" aria-label="Yuklanmoqda">
          <div className="skeleton h-20" />
          <div className="skeleton h-40" />
        </div>
      ) : error || !p ? (
        <ErrorState message={getErrorMessage(error)} />
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Avatar name={p.full_name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-xl font-bold text-slate-900">{p.full_name}</p>
              <p className="text-sm text-slate-500">
                {ROLE_LABEL[p.role]}
                {p.subject && ` · ${p.subject}`}
              </p>
            </div>
          </div>

          <dl className="mt-5 divide-y divide-line rounded-2xl px-4 ring-1 ring-line">
            <Row icon={UserRound} label="Login">{p.username}</Row>
            {p.phone && <Row icon={Phone} label="Telefon">{p.phone}</Row>}
            {p.role === "student" && (
              <>
                {p.grade && <Row icon={GraduationCap} label="Sinf">{formatGrade(p.grade)}</Row>}
                {p.category && (
                  <Row icon={UserRound} label="Toifa">
                    <CategoryBadge category={p.category} />
                  </Row>
                )}
                {p.birth_date && <Row icon={Cake} label="Tug'ilgan sana">{formatDate(p.birth_date)}</Row>}
              </>
            )}
            {p.role === "teacher" && (
              <>
                <Row icon={Users} label="O'quvchilar">{p.students_count ?? 0}</Row>
                <Row icon={BookOpen} label="Darslar">{p.lessons_count ?? 0}</Row>
              </>
            )}
            <Row icon={CalendarDays} label="Ro'yxatdan o'tgan">{formatDate(p.created_at)}</Row>
          </dl>

          {p.role === "student" && (
            <section className="mt-5">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">O&apos;qituvchilarim</h3>
              {p.teachers?.length ? (
                <ul className="space-y-2">
                  {p.teachers.map((t) => (
                    <li key={t.full_name} className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
                      <Avatar name={t.full_name} size="sm" />
                      <span className="flex-1 truncate font-medium text-slate-800">{t.full_name}</span>
                      {t.subject && <span className="badge bg-indigo-50 text-indigo-700">{t.subject}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Hali o&apos;qituvchi biriktirilmagan</p>
              )}
            </section>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary">
              Yopish
            </button>
            <button onClick={onLogout} className="btn-danger">
              <LogOut className="size-4" aria-hidden /> Tizimdan chiqish
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
