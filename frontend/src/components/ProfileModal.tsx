"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { BookOpen, Cake, CalendarDays, Camera, Check, GraduationCap, Loader2, LogOut, Pencil, Phone, Trash2, UserRound, Users, X, type LucideIcon } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth, type Role } from "@/lib/auth";
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
  avatar_url: string | null;
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
  const queryClient = useQueryClient();
  const { updateUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");

  const setProfile = (patch: Partial<Profile>) => {
    queryClient.setQueryData<Profile>(["auth", "profile"], (old) => (old ? { ...old, ...patch } : old));
    updateUser(patch);
  };

  const saveName = useMutation({
    mutationFn: async (full_name: string) => (await api.patch<{ full_name: string }>("/auth/profile", { full_name })).data,
    onSuccess: (data) => {
      setProfile(data);
      setEditingName(false);
      toast.success("Ism saqlandi");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("avatar", file);
      return (await api.post<{ avatar_url: string }>("/auth/avatar", form)).data;
    },
    onSuccess: (data) => {
      setProfile(data);
      toast.success("Profil rasmi yangilandi");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const removeAvatar = useMutation({
    mutationFn: async () => (await api.delete<{ avatar_url: null }>("/auth/avatar")).data,
    onSuccess: (data) => {
      setProfile(data);
      toast.success("Profil rasmi olib tashlandi");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // bir xil rasmni qayta tanlash mumkin bo'lsin
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Faqat rasm tanlang");
    if (file.size > 5 * 1024 * 1024) return toast.error("Rasm hajmi 5 MB dan oshmasligi kerak");
    uploadAvatar.mutate(file);
  };
  const avatarBusy = uploadAvatar.isPending || removeAvatar.isPending;

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
            {/* Profil rasmi: kamera tugmasi — yuklash */}
            <div className="relative shrink-0">
              <Avatar name={p.full_name} src={p.avatar_url} size="xl" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={avatarBusy}
                title="Rasm yuklash"
                aria-label="Profil rasmini yuklash"
                className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full border-2 border-surface bg-indigo-600 text-white shadow-md transition-colors hover:bg-indigo-700 disabled:opacity-60"
              >
                {avatarBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Camera className="size-4" aria-hidden />}
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={pickFile} />
            </div>

            <div className="min-w-0 flex-1">
              {editingName ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveName.mutate(name);
                  }}
                >
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input py-2"
                    aria-label="Ism va familiya"
                    placeholder="Ism va familiya"
                    maxLength={150}
                    autoFocus
                  />
                  <button type="submit" disabled={saveName.isPending} className="btn-primary px-3 py-2" aria-label="Saqlash" title="Saqlash">
                    {saveName.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
                  </button>
                  <button type="button" onClick={() => setEditingName(false)} className="btn-secondary px-3 py-2" aria-label="Bekor qilish" title="Bekor qilish">
                    <X className="size-4" aria-hidden />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="truncate text-xl font-bold text-slate-900">{p.full_name}</p>
                  {/* Ismni faqat administrator o'zi o'zgartiradi (o'qituvchi va o'quvchi ismini administrator kiritadi) */}
                  {p.role === "admin" && (
                    <button
                      type="button"
                      onClick={() => {
                        setName(p.full_name);
                        setEditingName(true);
                      }}
                      className="icon-btn"
                      aria-label="Ismni o'zgartirish"
                      title="Ismni o'zgartirish"
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
              )}
              <p className="text-sm text-slate-500">
                {ROLE_LABEL[p.role]}
                {p.subject && ` · ${p.subject}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={avatarBusy} className="btn-sm btn-sm-edit">
                  <Camera className="size-3.5" aria-hidden /> {p.avatar_url ? "Rasmni almashtirish" : "Rasm yuklash"}
                </button>
                {p.avatar_url && (
                  <button type="button" onClick={() => removeAvatar.mutate()} disabled={avatarBusy} className="btn-sm border-line bg-surface text-slate-600 hover:bg-slate-100">
                    <Trash2 className="size-3.5" aria-hidden /> Olib tashlash
                  </button>
                )}
              </div>
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
