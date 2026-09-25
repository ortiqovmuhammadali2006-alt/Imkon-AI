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
    // Login oynasi: fon to'liq oq (tungi rejim yoniq bo'lsa ham — .theme-light), forma o'rtada qalqib chiqqan karta
    <main className="theme-light flex flex-1 flex-col items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-md animate-pop rounded-3xl bg-white p-8 shadow-[0_24px_64px_-12px_rgb(15_23_42/0.22),0_4px_16px_-4px_rgb(15_23_42/0.08)] ring-1 ring-slate-200/70 sm:p-10">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>

        <h1 className="text-center text-3xl font-bold tracking-tight text-slate-900">Tizimga kirish</h1>
        <p className="mt-2 text-center text-slate-500">Administrator bergan login va parolingizni kiriting</p>

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

        <p className="mt-8 rounded-xl bg-slate-100/80 px-4 py-3 text-center text-sm text-slate-600">
          Login yoki parolingizni unutdingizmi? Maktab administratoriga murojaat qiling.
        </p>
      </div>
      <p className="mt-8 text-sm text-slate-400">© {new Date().getFullYear()} Imkon AI</p>
    </main>
  );
}
