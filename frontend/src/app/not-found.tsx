import Link from "next/link";
import { Home, SearchX } from "lucide-react";
import Logo from "@/components/ui/Logo";

// Mavjud bo'lmagan sahifa (masalan, eski yoki noto'g'ri manzil): sayt uslubida, bosh sahifaga qaytish tugmasi bilan.
// "/" foydalanuvchini roliga qarab o'z paneliga yo'naltiradi
export default function NotFound() {
  return (
    <main className="theme-light brand-blue flex flex-1 flex-col items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-xl shadow-indigo-600/10">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <SearchX className="size-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Sahifa topilmadi</h1>
        <p className="mt-2 text-slate-600">Bu sahifa mavjud emas yoki olib tashlangan. Bosh sahifaga qaytib, kerakli bo&apos;limni tanlang.</p>
        <Link href="/" className="btn-primary mt-6 w-full">
          <Home className="size-4" aria-hidden /> Bosh sahifaga qaytish
        </Link>
      </div>
    </main>
  );
}
