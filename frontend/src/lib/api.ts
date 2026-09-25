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

// Backend qaytargan xabarni olish (toast uchun)
export function getErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    return error.response?.data?.message ?? "Server bilan bog'lanib bo'lmadi";
  }
  return "Noma'lum xatolik";
}
