"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, TOKEN_KEY } from "./api";

export type Role = "admin" | "teacher" | "student";

export type User = {
  id: number;
  full_name: string;
  username: string;
  role: Role;
  subject?: string | null; // faqat o'qituvchi uchun
};

export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  // Sahifa yangilanganda tokenni tekshirib, foydalanuvchini tiklaymiz
  useEffect(() => {
    const restore = localStorage.getItem(TOKEN_KEY)
      ? api
          .get<{ user: User }>("/auth/me")
          .then(({ data }) => setUser(data.user))
          .catch(logout)
      : Promise.resolve();
    restore.finally(() => setLoading(false));
  }, [logout]);

  const login = useCallback((token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(user);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth AuthProvider ichida ishlatilishi kerak");
  return ctx;
}
