import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dasturlash rejimidagi "N" belgisi pastki chap burchakda foydalanuvchi kartasini to'sib qo'yadi
  devIndicators: false,
  // Olib tashlangan bo'limlarning eski manzillari (saqlangan havola, brauzer tarixi) — o'quvchi bosh sahifasiga
  async redirects() {
    return [{ source: "/student/knowledge", destination: "/student", permanent: false }];
  },
};

export default nextConfig;
