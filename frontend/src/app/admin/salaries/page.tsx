"use client";

import { useState } from "react";
import { Wallet, Banknote, Trash2 } from "lucide-react";
import { MonthPicker } from "@/components/ui/DatePicker";
import { api, getErrorMessage } from "@/lib/api";
import { useAdminMutation, useSalaries, useSalaryPayments } from "@/lib/admin";
import { currentMonth, formatDate, formatMoney, formatMonth } from "@/lib/format";
import type { SalaryPayment, SalaryRow } from "@/lib/types";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";
import PaymentForm from "@/components/admin/PaymentForm";

function PayStatus({ row }: { row: SalaryRow }) {
  if (row.monthly_salary > 0 && row.paid >= row.monthly_salary) {
    return <span className="badge bg-emerald-100 text-emerald-700">To&apos;langan</span>;
  }
  if (row.paid > 0) return <span className="badge bg-amber-100 text-amber-800">Qisman</span>;
  return <span className="badge bg-slate-100 text-slate-600">To&apos;lanmagan</span>;
}

export default function SalariesPage() {
  const [month, setMonth] = useState(currentMonth);
  const salaries = useSalaries(month);
  const payments = useSalaryPayments(month);
  const [paying, setPaying] = useState<SalaryRow | null>(null);
  const [deleting, setDeleting] = useState<SalaryPayment | null>(null);

  const remove = useAdminMutation(
    (p: SalaryPayment) => api.delete(`/admin/salaries/payments/${p.id}`),
    "To'lov bekor qilindi",
    () => setDeleting(null)
  );

  const rows = salaries.data ?? [];
  const expected = rows.filter((r) => r.is_active).reduce((sum, r) => sum + r.monthly_salary, 0);
  const paid = rows.reduce((sum, r) => sum + r.paid, 0);

  return (
    <section>
      <PageHeader icon={Wallet}
        title="Oyliklar"
        description="O'qituvchilarga oylik to'lash va to'lovlar tarixi"
        action={
          <div>
            <label htmlFor="month" className="label">Oy</label>
            <MonthPicker id="month" className="sm:w-52" value={month} onChange={setMonth} />
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-slate-500">Jami oylik fondi</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(expected)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">To&apos;langan</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{formatMoney(paid)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">Qolgan</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{formatMoney(Math.max(expected - paid, 0))}</p>
        </div>
      </div>

      {salaries.isLoading ? (
        <LoadingState />
      ) : salaries.error ? (
        <ErrorState message={getErrorMessage(salaries.error)} />
      ) : rows.length === 0 ? (
        <EmptyState message="Oylik to'lash uchun avval o'qituvchi qo'shing" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">O&apos;qituvchi</th>
                <th className="px-4 py-3 text-right">Oylik</th>
                <th className="px-4 py-3 text-right">To&apos;langan</th>
                <th className="px-4 py-3">Jarayon</th>
                <th className="px-4 py-3">Holat</th>
                <th className="px-4 py-3 text-right">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const percent = r.monthly_salary ? Math.min((r.paid / r.monthly_salary) * 100, 100) : 0;
                return (
                  <tr key={r.id} className={r.is_active ? "hover:bg-slate-50" : "opacity-60"}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{r.full_name}</p>
                          <p className="text-slate-500">{r.subject || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatMoney(r.monthly_salary)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatMoney(r.paid)}</td>
                    <td className="px-4 py-3">
                      <div
                        className="h-2 w-32 overflow-hidden rounded-full bg-slate-100"
                        role="progressbar"
                        aria-valuenow={Math.round(percent)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <PayStatus row={r} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setPaying(r)} className="btn-secondary px-3 py-1.5 text-sm">
                        <Banknote className="size-4" aria-hidden />
                        To&apos;lash
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-10 mb-4 text-lg font-semibold">{formatMonth(month)} — to&apos;lovlar tarixi</h2>
      {payments.isLoading ? (
        <LoadingState />
      ) : !payments.data?.length ? (
        <p className="card px-5 py-8 text-center text-slate-500">Bu oyda hali to&apos;lov qilinmagan</p>
      ) : (
        <ul className="card divide-y divide-line">
          {payments.data.map((p) => (
            <li key={p.id} className="flex items-center gap-4 px-5 py-3">
              <div className="flex-1">
                <p className="font-medium">{p.teacher_name}</p>
                <p className="text-sm text-slate-500">
                  {formatDate(p.paid_at)}
                  {p.note && ` · ${p.note}`}
                </p>
              </div>
              <p className="font-semibold whitespace-nowrap text-emerald-700">{formatMoney(p.amount)}</p>
              <button
                onClick={() => setDeleting(p)}
                className="icon-btn hover:bg-red-50 hover:text-red-600"
                aria-label="To'lovni bekor qilish"
                title="Bekor qilish"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={paying !== null} title="Oylik to'lash" onClose={() => setPaying(null)}>
        {paying && <PaymentForm key={paying.id} row={paying} month={month} onDone={() => setPaying(null)} />}
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        title="To'lovni bekor qilish"
        message={
          <>
            <b>{deleting?.teacher_name}</b> uchun {deleting && formatMoney(deleting.amount)} to&apos;lov
            yozuvi o&apos;chiriladi.
          </>
        }
        confirmLabel="Ha, o'chirish"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}
