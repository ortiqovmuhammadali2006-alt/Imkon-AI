# Imkon AI

Imkoniyati cheklangan o'quvchilar uchun ta'lim platformasi. Admin, o'qituvchi va o'quvchi bitta login sahifasidan kiradi va o'z paneliga yo'naltiriladi.

## Texnologiyalar

- **Frontend:** Next.js, Tailwind CSS, React Query, lucide-react, react-hot-toast
- **Backend:** Node.js, Express, PostgreSQL (pg), JWT, multer

## Tuzilma

```
frontend/   Next.js ilova (http://localhost:3000)
backend/    Express API (http://localhost:5000/api)
```

## Ishga tushirish

1. `backend/.env.example` dan nusxa olib `backend/.env` yarating va PostgreSQL parolini yozing.
2. Backend:
   ```bash
   cd backend
   npm install
   npm run migrate   # baza, jadvallar va birinchi admin
   npm run dev
   ```
3. Frontend (`frontend/.env.local` ichida `NEXT_PUBLIC_API_URL=http://localhost:5000/api`):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. http://localhost:3000 — `.env` dagi `ADMIN_USERNAME` / `ADMIN_PASSWORD` bilan kiring.
5. AI uchun `backend/.env` ga `OPENAI_API_KEY` yozing (bo'sh bo'lsa, AI tugmalari "sozlanmagan" xabarini ko'rsatadi).

## Holat

- [x] Umumiy login va rolga qarab yo'naltirish
- [x] Admin paneli: o'qituvchilar, o'quvchilar, oyliklar, nazorat, dars jadvali
- [x] O'qituvchi API: darslar va fayllar, uy vazifalari, davomat, baholar
- [x] O'qituvchi paneli: darslar, vazifalarni tekshirish, davomat, baholar
- [x] O'quvchi paneli: jadval, darslar, AI tushuntirish (OpenAI), ovoz bilan o'qish, vazifa topshirish, baholar, ovozli boshqaruv
- [x] Qulaylik to'plami: avtomatik subtitr (Whisper), .srt/.vtt subtitr, PDF/Word matni, rasm tavsifi, oddiy til va atamalar lug'ati
