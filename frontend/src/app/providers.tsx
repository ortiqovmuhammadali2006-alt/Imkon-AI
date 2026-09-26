"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/lib/auth";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            borderRadius: "8px",
            padding: "10px 14px",
            fontWeight: 500,
            boxShadow: "0 10px 30px -10px rgb(15 23 42 / 0.25)",
            border: "1px solid rgb(226 232 240)",
          },
          success: { iconTheme: { primary: "#4f46e5", secondary: "#fff" } },
        }}
      />
    </QueryClientProvider>
  );
}
