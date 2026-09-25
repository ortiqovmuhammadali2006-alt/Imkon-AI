"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ROLE_HOME, useAuth } from "@/lib/auth";

// Bosh sahifa: foydalanuvchini roliga qarab kerakli panelga yo'naltiradi
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? ROLE_HOME[user.role] : "/login");
  }, [user, loading, router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="size-8 animate-spin text-indigo-600" aria-label="Yuklanmoqda" />
    </div>
  );
}
