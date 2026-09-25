import { Construction } from "lucide-react";

// Keyingi bosqichlarda to'ldiriladigan sahifalar uchun vaqtinchalik blok
export default function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <section>
      <h1 className="mb-6 text-2xl font-bold">{title}</h1>
      <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <Construction className="mb-3 size-10 text-amber-500" aria-hidden />
        <p className="text-lg font-medium">Tez orada</p>
        <p className="mt-1 max-w-md text-slate-500">{description}</p>
      </div>
    </section>
  );
}
