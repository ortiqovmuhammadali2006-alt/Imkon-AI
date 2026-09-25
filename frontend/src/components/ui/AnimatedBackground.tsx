import {
  Atom,
  BookOpen,
  Calculator,
  Globe,
  GraduationCap,
  Headphones,
  Lightbulb,
  Music,
  Palette,
  PenLine,
  Puzzle,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";

// Suzib yuruvchi belgilar. Joylashuv va vaqtlar oldindan belgilangan (Math.random emas) —
// server va brauzerda bir xil chiqishi uchun
const FLOATERS: { icon: LucideIcon; left: string; size: number; duration: number; delay: number; tone: string }[] = [
  { icon: BookOpen, left: "4%", size: 34, duration: 38, delay: 0, tone: "text-indigo-500" },
  { icon: Star, left: "13%", size: 22, duration: 30, delay: -12, tone: "text-amber-400" },
  { icon: PenLine, left: "22%", size: 28, duration: 42, delay: -25, tone: "text-violet-500" },
  { icon: Lightbulb, left: "31%", size: 30, duration: 34, delay: -6, tone: "text-amber-500" },
  { icon: Atom, left: "40%", size: 36, duration: 46, delay: -30, tone: "text-sky-500" },
  { icon: Sparkles, left: "49%", size: 20, duration: 28, delay: -17, tone: "text-fuchsia-500" },
  { icon: GraduationCap, left: "58%", size: 38, duration: 44, delay: -3, tone: "text-indigo-500" },
  { icon: Calculator, left: "66%", size: 26, duration: 36, delay: -21, tone: "text-emerald-500" },
  { icon: Globe, left: "74%", size: 32, duration: 40, delay: -9, tone: "text-sky-500" },
  { icon: Music, left: "82%", size: 24, duration: 32, delay: -27, tone: "text-rose-500" },
  { icon: Puzzle, left: "89%", size: 28, duration: 38, delay: -14, tone: "text-violet-500" },
  { icon: Palette, left: "95%", size: 26, duration: 34, delay: -33, tone: "text-orange-500" },
  { icon: Headphones, left: "18%", size: 24, duration: 48, delay: -40, tone: "text-teal-500" },
  { icon: Star, left: "70%", size: 18, duration: 26, delay: -4, tone: "text-amber-400" },
];

// Butun sayt ortidagi shaffof animatsiyali fon: rangli "bulutlar" + suzib yuruvchi ta'lim belgilari.
// Kontent ortida turadi, sichqonchaga ta'sir qilmaydi, ekran o'qigichdan yashirilgan.
export default function AnimatedBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Rangli bulutlar */}
      <div className="bg-blob top-[-12%] left-[-8%] size-[38rem] bg-indigo-400/25 [animation-duration:26s]" />
      <div className="bg-blob top-[10%] right-[-12%] size-[34rem] bg-violet-400/20 [animation-delay:-8s] [animation-duration:30s]" />
      <div className="bg-blob bottom-[-18%] left-[25%] size-[40rem] bg-sky-300/20 [animation-delay:-15s] [animation-duration:34s]" />
      <div className="bg-blob right-[20%] bottom-[5%] size-[22rem] bg-fuchsia-300/15 [animation-delay:-4s] [animation-duration:22s]" />

      {/* Nozik nuqtali to'r */}
      <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(var(--color-slate-300)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)] dark:opacity-20" />

      {/* Suzib yuruvchi belgilar */}
      {FLOATERS.map(({ icon: Icon, left, size, duration, delay, tone }, i) => (
        <span
          key={i}
          className={`bg-floater ${tone}`}
          style={{ left, animationDuration: `${duration}s`, animationDelay: `${delay}s` }}
        >
          <Icon style={{ width: size, height: size }} strokeWidth={1.6} />
        </span>
      ))}
    </div>
  );
}
