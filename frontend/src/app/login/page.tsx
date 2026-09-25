"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Eye, EyeOff, GraduationCap, Loader2, LogIn } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { ROLE_HOME, useAuth, type User } from "@/lib/auth";

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
      const { data } = await api.post<{ token: string; user: User }>("/auth/login", {
        username,
        password,
      });
      return data;
    },
    onSuccess: ({ token, user }) => {
      login(token, user);
      toast.success(`Xush kelibsiz, ${user.full_name}!`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 rounded-full bg-indigo-100 p-3">
            <GraduationCap className="size-8 text-indigo-600" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold">Imkon AI</h1>
          <p className="mt-1 text-slate-500">Tizimga kirish uchun login va parolingizni kiriting</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="mb-1.5 block text-sm font-medium">
              Login
            </label>
            <input
              id="username"
              autoComplete="username"
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
              Parol
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 text-lg outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-lg font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {mutation.isPending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <LogIn className="size-5" aria-hidden />
            )}
            Kirish
          </button>
        </form>
      </div>
    </main>
  );
}
