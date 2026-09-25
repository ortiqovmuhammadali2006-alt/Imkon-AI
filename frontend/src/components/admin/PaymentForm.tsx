"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAdminMutation } from "@/lib/admin";
import { formatMoney, formatMonth } from "@/lib/format";
import type { SalaryRow } from "@/lib/types";

export default function PaymentForm({
  row,
  month,
  onDone,
}: {
  row: SalaryRow;
  month: string;
  onDone: () => void;
}) {
  const remaining = Math.max(row.monthly_salary - row.paid, 0);
  const [amount, setAmount] = useState(remaining ? String(remaining) : "");
  const [note, setNote] = useState("");

  const mutation = useAdminMutation(
    () => api.post("/admin/salaries/payments", { teacher_id: row.id, month, amount: Number(amount), note }),
    "To'lov qayd etildi",
    onDone
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(undefined);
      }}
      className="space-y-4"
    >
      <dl className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
        <div>
          <dt className="text-slate-500">Oylik</dt>
          <dd className="font-semibold">{formatMoney(row.monthly_salary)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">To&apos;langan</dt>
          <dd className="font-semibold text-emerald-700">{formatMoney(row.paid)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Qolgan</dt>
          <dd className="font-semibold text-amber-700">{formatMoney(remaining)}</dd>
        </div>
      </dl>
      <p className="text-sm text-slate-600">
        <b>{row.full_name}</b> — {formatMonth(month)} uchun to&apos;lov
      </p>
      <div>
        <label htmlFor="p-amount" className="label">Summa (so&apos;m) *</label>
        <input
          id="p-amount"
          type="number"
          required
          min={1}
          step={1000}
          className="input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="p-note" className="label">Izoh</label>
        <input
          id="p-note"
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Masalan: avans, bonus"
        />
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onDone} className="btn-secondary">
          Bekor qilish
        </button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          To&apos;lash
        </button>
      </div>
    </form>
  );
}
