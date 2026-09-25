import axios, { AxiosError } from "axios";

export const TOKEN_KEY = "imkon_token";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

api.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Token muddati tugagan bo'lsa — tizimdan chiqarib, login sahifasiga qaytarish
api.interceptors.response.use(undefined, (error: AxiosError) => {
  const isLogin = error.config?.url?.startsWith("/auth/login");
  if (error.response?.status === 401 && !isLogin && typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    if (window.location.pathname !== "/login") window.location.href = "/login";
  }
  return Promise.reject(error);
});

// Backend qaytargan xabarni olish (toast uchun)
export function getErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    return error.response?.data?.message ?? "Server bilan bog'lanib bo'lmadi";
  }
  return "Noma'lum xatolik";
}
