"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2, LockKeyhole, LogIn, UserRound } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { ROLE_HOME, useAuth, type User } from "@/lib/auth";
import Logo from "@/components/ui/Logo";
import { LOGIN_WELCOME_KEY } from "@/lib/voiceMode";

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
    // Login oynasi: fon to'liq oq (tungi rejim yoniq bo'lsa ham — .theme-light), forma o'rtada qalqib chiqqan karta,
    // karta ko'k (.brand-blue — indigo o'rniga ko'k qiymatlar)
    <main className="theme-light brand-blue flex flex-1 flex-col items-center justify-center bg-white px-4 py-12">
      <div className="login-card relative w-full max-w-md animate-pop rounded-3xl bg-indigo-600 p-8 text-white ring-1 ring-white/10 -translate-y-1 shadow-[0_2px_4px_rgb(15_23_42/0.06),0_16px_32px_-8px_rgb(15_23_42/0.18),0_48px_96px_-24px_rgb(37_99_235/0.55)] sm:p-10">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" light />
        </div>

        <h1 className="text-center text-3xl font-bold tracking-tight text-white">Tizimga kirish</h1>
        <p className="mt-2 text-center text-brand-100">Administrator bergan login va parolingizni kiriting</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="mt-8 space-y-5"
        >
          <div>
            <label htmlFor="username" className="label text-white">
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
                className="input py-3 pl-11 text-lg text-slate-900 focus:border-white focus:ring-white/40"
                placeholder="login"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="label text-white">
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
                className="input py-3 pr-12 pl-11 text-lg text-slate-900 focus:border-white focus:ring-white/40"
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

          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-lg font-semibold text-indigo-700 shadow-lg shadow-black/15 transition-all duration-150 hover:bg-indigo-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mutation.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <LogIn className="size-5" aria-hidden />}
            Kirish
          </button>
        </form>

        <p className="mt-8 rounded-xl bg-white/10 px-4 py-3 text-center text-sm text-brand-100 ring-1 ring-white/15">
          Login yoki parolingizni unutdingizmi? Maktab administratoriga murojaat qiling.
        </p>
      </div>
      <p className="mt-8 text-sm text-slate-400">© {new Date().getFullYear()} Imkon AI</p>
    </main>
  );
}
