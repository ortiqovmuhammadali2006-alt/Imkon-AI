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

## Holat

- [x] Umumiy login va rolga qarab yo'naltirish
- [x] Admin paneli: o'qituvchilar, o'quvchilar, oyliklar, nazorat
- [x] O'qituvchi API: darslar va fayllar, uy vazifalari, davomat, baholar
- [ ] O'qituvchi paneli (frontend)
- [ ] O'quvchi paneli: darslar, AI tushuntirish, vazifa topshirish, ovozli boshqaruv
