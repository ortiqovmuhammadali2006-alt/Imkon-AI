"use client";

import { useMemo, useState } from "react";
import { Users, Lock, LockOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useAdminMutation, useStudents } from "@/lib/admin";
import { CATEGORIES, formatDate, formatGrade } from "@/lib/format";
import type { Category, Student } from "@/lib/types";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";
import StudentForm from "@/components/admin/StudentForm";
import StatusBadge from "@/components/admin/StatusBadge";

export default function StudentsPage() {
  const { data, isLoading, error } = useStudents();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [editing, setEditing] = useState<Student | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Student | null>(null);

  const toggleStatus = useAdminMutation(
    (s: Student) => api.patch(`/admin/students/${s.id}/status`, { is_active: !s.is_active }),
    "Holat o'zgartirildi"
  );
  const remove = useAdminMutation(
    (s: Student) => api.delete(`/admin/students/${s.id}`),
    "O'quvchi o'chirildi",
    () => setDeleting(null)
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter(
      (s) =>
        (category === "all" || s.category === category) &&
        (!q || [s.full_name, s.username, s.grade, s.phone].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [data, search, category]);

  const addButton = (
    <button onClick={() => setEditing(null)} className="btn-primary">
      <Plus className="size-5" aria-hidden />
      Yangi o&apos;quvchi
    </button>
  );

  return (
    <section>
      <PageHeader icon={Users}
        title="O'quvchilar"
        description={data ? `Jami: ${data.length} ta` : undefined}
        action={addButton}
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error)} />
      ) : data!.length === 0 ? (
        <EmptyState message="Hali o'quvchi qo'shilmagan" action={addButton} />
      ) : (
        <div className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                aria-label="Qidirish"
                placeholder="Ism, login yoki sinf bo'yicha qidirish"
                className="input pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Toifa bo'yicha filtr"
              className="input sm:w-56"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category | "all")}
            >
              <option value="all">Barcha toifalar</option>
              {(Object.keys(CATEGORIES) as Category[]).map((key) => (
                <option key={key} value={key}>
                  {CATEGORIES[key].label}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3">O&apos;quvchi</th>
                  <th className="px-4 py-3">Toifa</th>
                  <th className="px-4 py-3">Sinf</th>
                  <th className="px-4 py-3">Tug&apos;ilgan sana</th>
                  <th className="px-4 py-3">O&apos;qituvchilari</th>
                  <th className="px-4 py-3">Holat</th>
                  <th className="px-4 py-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{s.full_name}</p>
                          <p className="text-slate-500">@{s.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${CATEGORIES[s.category].className}`}>
                        {CATEGORIES[s.category].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatGrade(s.grade) || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(s.birth_date)}</td>
                    <td className="px-4 py-3">
                      {s.teachers.length ? (
                        s.teachers.map((t) => t.full_name).join(", ")
                      ) : (
                        <span className="text-amber-600">Biriktirilmagan</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={s.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditing(s)} className="icon-btn" aria-label="Tahrirlash" title="Tahrirlash">
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => toggleStatus.mutate(s)}
                          className="icon-btn"
                          aria-label={s.is_active ? "Bloklash" : "Blokdan chiqarish"}
                          title={s.is_active ? "Bloklash" : "Blokdan chiqarish"}
                        >
                          {s.is_active ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
                        </button>
                        <button
                          onClick={() => setDeleting(s)}
                          className="icon-btn hover:bg-red-50 hover:text-red-600"
                          aria-label="O'chirish"
                          title="O'chirish"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      Hech narsa topilmadi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={editing !== undefined}
        title={editing ? "O'quvchini tahrirlash" : "Yangi o'quvchi"}
        onClose={() => setEditing(undefined)}
      >
        <StudentForm key={editing?.id ?? "new"} student={editing ?? undefined} onDone={() => setEditing(undefined)} />
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        title="O'quvchini o'chirish"
        message={
          <>
            <b>{deleting?.full_name}</b> o&apos;chirilsa, uning davomati, baholari va topshirgan vazifalari ham
            o&apos;chib ketadi.
          </>
        }
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}
