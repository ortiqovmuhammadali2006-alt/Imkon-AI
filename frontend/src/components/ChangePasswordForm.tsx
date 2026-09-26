"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { api, getErrorMessage, TOKEN_KEY } from "@/lib/api";

const MIN = 8;

// Profil oynasida: o'z parolini o'zgartirish. Muvaffaqiyatli bo'lsa, boshqa qurilmalardagi sessiyalar bekor bo'ladi,
// shu qurilma esa yangi token bilan davom etadi
export default function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ current: "", next: "", repeat: "" });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: async () =>
      (await api.post<{ token: string }>("/auth/password", { current_password: form.current, new_password: form.next })).data,
    onSuccess: ({ token }) => {
      localStorage.setItem(TOKEN_KEY, token);
      toast.success("Parol o'zgartirildi");
      setForm({ current: "", next: "", repeat: "" });
      setOpen(false);
      onDone?.();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const mismatch = form.repeat.length > 0 && form.next !== form.repeat;
  const tooShort = form.next.length > 0 && form.next.length < MIN;

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary w-full">
        <KeyRound className="size-4" aria-hidden /> Parolni o&apos;zgartirish
      </button>
    );

  const type = show ? "text" : "password";
  return (
    <form
      className="space-y-3 rounded-lg border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!mismatch && !tooShort) mutation.mutate();
      }}
    >
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-semibold text-slate-900">
          <KeyRound className="size-4 text-indigo-600" aria-hidden /> Parolni o&apos;zgartirish
        </p>
        <button type="button" onClick={() => setShow((v) => !v)} className="icon-btn" aria-label={show ? "Parolni yashirish" : "Parolni ko'rsatish"}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <div>
        <label htmlFor="pw-current" className="label">Joriy parol</label>
        <input id="pw-current" type={type} required autoComplete="current-password" className="input" value={form.current} onChange={set("current")} />
      </div>
      <div>
        <label htmlFor="pw-new" className="label">Yangi parol</label>
        <input id="pw-new" type={type} required minLength={MIN} autoComplete="new-password" className="input" value={form.next} onChange={set("next")} aria-invalid={tooShort} />
        <p className={`mt-1 text-sm ${tooShort ? "text-red-700" : "text-slate-500"}`}>Kamida {MIN} ta belgi. Harf va raqamlarni aralashtiring.</p>
      </div>
      <div>
        <label htmlFor="pw-repeat" className="label">Yangi parolni takrorlang</label>
        <input id="pw-repeat" type={type} required autoComplete="new-password" className="input" value={form.repeat} onChange={set("repeat")} aria-invalid={mismatch} />
        {mismatch && <p className="mt-1 text-sm text-red-700">Parollar bir xil emas</p>}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          Bekor qilish
        </button>
        <button type="submit" disabled={mutation.isPending || mismatch || tooShort} className="btn-primary">
          {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />} Saqlash
        </button>
      </div>
    </form>
  );
}
