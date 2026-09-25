// Tungi rejim. Foydalanuvchi tanlagan rejimni server cookie orqali darhol qo'yadi (src/app/layout.tsx);
// bu skript faqat tanlov bo'lmaganda tizim sozlamasini hisobga oladi va eski localStorage tanlovini cookie'ga ko'chiradi.
try {
  var KEY = "imkon_theme";
  var t = localStorage.getItem(KEY);
  if (t && document.cookie.indexOf(KEY + "=") === -1) {
    document.cookie = KEY + "=" + t + "; path=/; max-age=31536000; samesite=lax";
  }
  if (t === "dark" || (!t && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  }
} catch (e) {}
