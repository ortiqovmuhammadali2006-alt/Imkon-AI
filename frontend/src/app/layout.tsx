import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { cookies } from "next/headers";
import "./globals.css";
import Providers from "./providers";
import AnimatedBackground from "@/components/ui/AnimatedBackground";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Imkon AI",
  description: "Imkoniyati cheklangan o'quvchilar uchun ta'lim platformasi",
};

// Tungi rejim: tanlangan rejim cookie'dan o'qilib, sahifa darhol to'g'ri rangda yuboriladi.
// Tanlov bo'lmasa — public/theme-init.js tizim sozlamasiga qaraydi
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = (await cookies()).get("imkon_theme")?.value;
  return (
    <html
      lang="uz"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ${theme === "dark" ? "dark" : ""}`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" src="/theme-init.js" strategy="beforeInteractive" />
        <AnimatedBackground />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
