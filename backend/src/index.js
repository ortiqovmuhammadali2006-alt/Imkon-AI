const { config, validateEnv } = require("./config");
validateEnv(); // .env xato bo'lsa — tushunarli xabar bilan to'xtaydi

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const pool = require("./config/db");
const multer = require("multer");
const authRoutes = require("./routes/auth");
const { UPLOAD_DIR } = require("./middleware/upload");
const { signUploadsInJson, requireSignedUpload } = require("./utils/fileAccess");
const { resumePendingLessons } = require("./services/accessibility");

const app = express();
app.set("trust proxy", 1); // proksi (nginx, Render, Railway) ortida haqiqiy IP — login limiti uchun

app.use(
  helmet({
    // Fayllar (rasm, video, PDF) frontend domenida ko'rsatiladi
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // API JSON qaytaradi; PDF frontend sahifasidagi <iframe> ichida ochilishi kerak — faqat shu domenlarga ruxsat
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: helmet.contentSecurityPolicy.dangerouslyDisableDefaultSrc, // PDF ko'ruvchi ishlashi uchun
        frameAncestors: ["'self'", ...config.clientOrigins],
      },
    },
    frameguard: false,
  })
);
app.use(cors({ origin: config.clientOrigins }));
app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

// API javoblaridagi fayl havolalari imzolanadi (muddati cheklangan)
app.use("/api", signUploadsInJson);
app.use("/api/auth", authRoutes);
app.use("/api/admin", require("./routes/admin"));
app.use("/api/teacher", require("./routes/teacher"));
app.use("/api/student", require("./routes/student"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/tts", require("./routes/tts"));
app.use("/api/stt", require("./routes/stt"));

// Yuklangan fayllar — faqat imzolangan havola bilan (ochiq emas)
app.use("/uploads", requireSignedUpload, express.static(UPLOAD_DIR, { index: false, dotfiles: "deny" }));

// Express 5 async xatolarni shu yerga yuboradi
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ message: err.message });
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE" ? `Fayl hajmi ${config.uploadMaxMb} MB dan oshmasligi kerak` : "Faylni yuklashda xatolik";
    return res.status(400).json({ message });
  }
  if (err.code === "23505" && err.constraint === "users_username_key") {
    return res.status(409).json({ message: "Bu login band, boshqasini tanlang" });
  }
  console.error(err);
  res.status(500).json({ message: "Serverda xatolik yuz berdi" });
});

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  // Server to'xtaganda qayta ishlanayotgan darslar "processing"da qotib qolmasin — navbatga qaytariladi
  resumePendingLessons().catch((err) => console.error("Navbatni tiklashda xato:", err.message));
});
