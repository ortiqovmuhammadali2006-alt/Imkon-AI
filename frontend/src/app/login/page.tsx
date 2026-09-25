"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Accessibility, Eye, EyeOff, Headphones, Loader2, LockKeyhole, LogIn, Sparkles, UserRound } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { ROLE_HOME, useAuth, type User } from "@/lib/auth";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { LOGIN_WELCOME_KEY } from "@/lib/voiceMode";

const FEATURES = [
  { icon: Sparkles, title: "AI o'qituvchi yordamchisi", text: "Har bir darsni o'quvchiga mos, sodda tilda tushuntiradi" },
  { icon: Headphones, title: "Ovozli boshqaruv", text: "Darslarni tinglash va platformani ovoz bilan boshqarish" },
  { icon: Accessibility, title: "Har bir o'quvchiga mos", text: "Ko'rish, eshitish va harakati cheklanganlar uchun qulay" },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) router.replace(ROLE_HOME[user.role]);
  }, [user, router]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ token: string; user: User }>("/auth/login", { username, password });
      return data;
    },
    onSuccess: ({ token, user }) => {
      // O'quvchi panelida ovoz rejimi o'zi yoqiladi va "qayerdasiz" aytiladi (components/student/VoiceControl)
      if (user.role === "student") {
        try {
          sessionStorage.setItem(LOGIN_WELCOME_KEY, "1");
        } catch {}
      }
      login(token, user);
      toast.success(`Xush kelibsiz, ${user.full_name}!`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <main className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Chap tomon: platforma haqida */}
      <section className="relative hidden overflow-hidden bg-indigo-600 p-12 text-white lg:flex lg:flex-col">
        <div
          className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]"
          aria-hidden
        />

        <div className="relative">
          <Logo size="lg" light />
        </div>

        <div className="relative my-auto max-w-lg animate-slide-up">
          <h1 className="text-4xl leading-tight font-bold tracking-tight xl:text-5xl">
            Ta&apos;lim — <span className="text-brand-200">har bir bola</span> uchun ochiq
          </h1>
          <p className="mt-4 text-lg text-brand-100/90">
            Imkoniyati cheklangan o&apos;quvchilar uchun sun&apos;iy intellektga asoslangan ta&apos;lim platformasi.
          </p>

          <ul className="mt-10 space-y-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="size-5" aria-hidden />
                </div>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-brand-100/80">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-brand-200/70">© {new Date().getFullYear()} Imkon AI</p>
      </section>

      {/* O'ng tomon: kirish formasi */}
      <section className="relative flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md animate-pop">
          <div className="mb-8 lg:hidden">
            <Logo size="lg" />
          </div>

          <h2 className="text-3xl font-bold tracking-tight">Tizimga kirish</h2>
          <p className="mt-2 text-slate-500">Administrator bergan login va parolingizni kiriting</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="mt-8 space-y-5"
          >
            <div>
              <label htmlFor="username" className="label">
                Login
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  id="username"
                  autoComplete="username"
                  autoFocus
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input py-3 pl-11 text-lg"
                  placeholder="login"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">
                Parol
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input py-3 pr-12 pl-11 text-lg"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                  className="absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={mutation.isPending} className="btn-primary w-full py-3.5 text-lg">
              {mutation.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <LogIn className="size-5" aria-hidden />}
              Kirish
            </button>
          </form>

          <p className="mt-8 rounded-xl bg-slate-100/80 px-4 py-3 text-sm text-slate-600">
            Login yoki parolingizni unutdingizmi? Maktab administratoriga murojaat qiling.
          </p>
        </div>
      </section>
    </main>
  );
}
