# Imkon AI

Imkoniyati cheklangan o'quvchilar uchun ta'lim platformasi. Admin, o'qituvchi va o'quvchi bitta login sahifasidan kiradi va o'z paneliga yo'naltiriladi.

## Texnologiyalar

- **Frontend:** Next.js, Tailwind CSS, React Query, lucide-react, react-hot-toast
- **Backend:** Node.js, Express, PostgreSQL (pg), JWT, multer, helmet
- **AI:** OpenAI (tushuntirish, AI o'qituvchi, subtitr, nutqni tanish), Azure / Edge o'zbekcha ovoz

## Tuzilma

```
frontend/            Next.js ilova (http://localhost:3000)
backend/             Express API (http://localhost:5000/api)
backend/test/        integratsion testlar (npm test)
docker-compose.yml   hammasini bitta buyruq bilan ishga tushirish
.github/workflows/   CI: lint, tiplar, build va testlar
```

## Tez ishga tushirish (Docker)

```bash
cp .env.example .env        # POSTGRES_PASSWORD, JWT_SECRET, ADMIN_PASSWORD, OPENAI_API_KEY ni to'ldiring
docker compose up --build
docker compose exec backend npm run seed   # ixtiyoriy: namoyish ma'lumotlari
```

## Qo'lda ishga tushirish

1. `backend/.env.example` dan nusxa olib `backend/.env` yarating. Majburiy:
   - `JWT_SECRET` — kamida 32 belgi: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `DB_*` — PostgreSQL ulanishi
   - `ADMIN_PASSWORD` — kamida 8 belgi (namuna parollar qabul qilinmaydi)

   Server bu qiymatlar noto'g'ri bo'lsa ishga tushmaydi va sababini aytadi.
2. Backend:
   ```bash
   cd backend
   npm install
   npm run migrate   # baza, jadvallar va birinchi admin
   npm run seed      # ixtiyoriy: 2 o'qituvchi, har toifadan o'quvchi, darslar, vazifalar, jadval
   npm run dev
   ```
3. Frontend (`frontend/.env.example` dan nusxa olib `frontend/.env.local`):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. http://localhost:3000 — `ADMIN_USERNAME` / `ADMIN_PASSWORD` bilan kiring.
5. AI uchun `backend/.env` ga `OPENAI_API_KEY` yozing (bo'sh bo'lsa, AI tugmalari "sozlanmagan" xabarini ko'rsatadi).
6. Aniq o'zbekcha ovoz uchun (ixtiyoriy) `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` (oyiga 500 000 belgigacha bepul).

Limitlar, fayl hajmi, AI modellari va boshqa chegaralar `backend/.env` orqali sozlanadi — ro'yxati `backend/.env.example` oxirida (`backend/src/config.js`).

## Testlar

Backend ishlab turganda (`npm run dev`):

```bash
cd backend
npm test          # asosiy testlar (OpenAI kerak emas)
npm run test:ai   # AI testlari ham (OpenAI kaliti va mablag' kerak)
```

Testlar o'zi yaratgan ma'lumotni o'zi o'chiradi. GitHub'ga har push'da CI ularni toza bazada ishga tushiradi.

## Xavfsizlik

- Yuklangan fayllar ochiq emas: API muddati cheklangan imzolangan havola beradi (`FILE_URL_TTL_HOURS`, standart 12 soat).
- Login: bir IP + login bo'yicha 15 daqiqada 10 ta noto'g'ri urinishdan keyin bloklanadi.
- Foydalanuvchi profil oynasida o'z parolini o'zgartira oladi; parol o'zgarsa yoki foydalanuvchi bloklansa, eski sessiyalar bekor bo'ladi. Admin o'qituvchi/o'quvchi parolini tahrirlash orqali tiklaydi.
- AI, ovoz va chat limitlari bazada (`usage_log`) hisoblanadi — server qayta ishga tushsa ham saqlanadi va sarf hisobi uchun ham ishlatiladi.
- `helmet` xavfsizlik sarlavhalari.

## Holat

- [x] Umumiy login va rolga qarab yo'naltirish
- [x] Admin paneli: o'qituvchilar, o'quvchilar, oyliklar, nazorat, dars jadvali
- [x] O'qituvchi paneli: darslar va fayllar, YouTube video, vazifalar (fayl bilan), davomat, baholar
- [x] O'quvchi paneli: jadval, darslar, sodda o'rganish, AI o'qituvchi, AI suhbat, vazifa topshirish, ovozli boshqaruv ("Imkon")
- [x] Qulaylik to'plami: avtomatik subtitr, PDF/Word/PowerPoint matni, rasm tavsifi, sodda bayon, misollar, atamalar, test
