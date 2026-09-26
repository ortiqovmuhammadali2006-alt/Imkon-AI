# Backend (Express). ffmpeg-static glibc talab qiladi — shuning uchun alpine emas, slim
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
RUN mkdir -p uploads

EXPOSE 5000
# Har ishga tushishda jadvallar tekshiriladi (IF NOT EXISTS — ma'lumot o'chmaydi), keyin server
CMD ["sh", "-c", "npm run migrate && npm start"]
