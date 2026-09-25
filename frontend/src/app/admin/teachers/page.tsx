"use client";

import { useMemo, useState } from "react";
import { Lock, LockOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useAdminMutation, useTeachers } from "@/lib/admin";
import { formatMoney } from "@/lib/format";
import type { Teacher } from "@/lib/types";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";
import TeacherForm from "@/components/admin/TeacherForm";
import StatusBadge from "@/components/admin/StatusBadge";

export default function TeachersPage() {
  const { data, isLoading, error } = useTeachers();
  const [search, setSearch] = useState("");
  // undefined — yopiq, null — yangi qo'shish, Teacher — tahrirlash
  const [editing, setEditing] = useState<Teacher | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Teacher | null>(null);

  const toggleStatus = useAdminMutation(
    (t: Teacher) => api.patch(`/admin/teachers/${t.id}/status`, { is_active: !t.is_active }),
    "Holat o'zgartirildi"
  );
  const remove = useAdminMutation(
    (t: Teacher) => api.delete(`/admin/teachers/${t.id}`),
    "O'qituvchi o'chirildi",
    () => setDeleting(null)
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!data || !q) return data ?? [];
    return data.filter((t) =>
      [t.full_name, t.username, t.subject, t.phone].some((v) => v?.toLowerCase().includes(q))
    );
  }, [data, search]);

  const addButton = (
    <button onClick={() => setEditing(null)} className="btn-primary">
      <Plus className="size-5" aria-hidden />
      Yangi o&apos;qituvchi
    </button>
  );

  return (
    <section>
      <PageHeader
        title="O'qituvchilar"
        description={data ? `Jami: ${data.length} ta` : undefined}
        action={addButton}
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error)} />
      ) : data!.length === 0 ? (
        <EmptyState message="Hali o'qituvchi qo'shilmagan" action={addButton} />
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 p-4">
            <div className="relative max-w-sm">
              <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                aria-label="Qidirish"
                placeholder="Ism, login yoki fan bo'yicha qidirish"
                className="input pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3">O&apos;qituvchi</th>
                  <th className="px-4 py-3">Fan</th>
                  <th className="px-4 py-3">Telefon</th>
                  <th className="px-4 py-3 text-right">Oylik</th>
                  <th className="px-4 py-3 text-center">O&apos;quvchilar</th>
                  <th className="px-4 py-3">Holat</th>
                  <th className="px-4 py-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{t.full_name}</p>
                      <p className="text-slate-500">@{t.username}</p>
                    </td>
                    <td className="px-4 py-3">{t.subject || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{t.phone || "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatMoney(t.monthly_salary)}</td>
                    <td className="px-4 py-3 text-center">{t.students_count}</td>
                    <td className="px-4 py-3">
                      <StatusBadge active={t.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditing(t)} className="icon-btn" aria-label="Tahrirlash" title="Tahrirlash">
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => toggleStatus.mutate(t)}
                          className="icon-btn"
                          aria-label={t.is_active ? "Bloklash" : "Blokdan chiqarish"}
                          title={t.is_active ? "Bloklash" : "Blokdan chiqarish"}
                        >
                          {t.is_active ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
                        </button>
                        <button
                          onClick={() => setDeleting(t)}
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
        title={editing ? "O'qituvchini tahrirlash" : "Yangi o'qituvchi"}
        onClose={() => setEditing(undefined)}
      >
        <TeacherForm key={editing?.id ?? "new"} teacher={editing ?? undefined} onDone={() => setEditing(undefined)} />
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        title="O'qituvchini o'chirish"
        message={
          <>
            <b>{deleting?.full_name}</b> o&apos;chirilsa, uning darslari, davomat, baholar va oylik tarixi ham
            o&apos;chib ketadi. Faqat vaqtincha to&apos;xtatish kerak bo&apos;lsa, bloklash tavsiya etiladi.
          </>
        }
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}
