import { GraduationCap } from "lucide-react";

export default function Logo({ size = "md", light = false }: { size?: "md" | "lg"; light?: boolean }) {
  const lg = size === "lg";
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md shadow-indigo-600/30 ${
          lg ? "size-12" : "size-9"
        }`}
      >
        <GraduationCap className={lg ? "size-7" : "size-5"} aria-hidden />
      </div>
      <div className="leading-tight">
        <p className={`font-bold tracking-tight ${lg ? "text-2xl" : "text-lg"} ${light ? "text-white" : "text-slate-900"}`}>
          Imkon <span className={light ? "text-brand-200" : "text-indigo-600"}>AI</span>
        </p>
        <p className={`text-xs ${light ? "text-brand-100/80" : "text-slate-500"}`}>Har bir o&apos;quvchiga imkon</p>
      </div>
    </div>
  );
}
