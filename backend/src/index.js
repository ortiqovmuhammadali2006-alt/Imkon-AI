require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const multer = require("multer");
const authRoutes = require("./routes/auth");
const { UPLOAD_DIR, MAX_SIZE_MB } = require("./middleware/upload");

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", db: err.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", require("./routes/admin"));
app.use("/api/teacher", require("./routes/teacher"));
app.use("/api/student", require("./routes/student"));
app.use("/api/chat", require("./routes/chat"));

// Yuklangan dars materiallari va vazifa fayllari
app.use("/uploads", express.static(UPLOAD_DIR));

// Express 5 async xatolarni shu yerga yuboradi
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ message: err.message });
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? `Fayl hajmi ${MAX_SIZE_MB} MB dan oshmasligi kerak`
        : "Faylni yuklashda xatolik";
    return res.status(400).json({ message });
  }
  if (err.code === "23505" && err.constraint === "users_username_key") {
    return res.status(409).json({ message: "Bu login band, boshqasini tanlang" });
  }
  console.error(err);
  res.status(500).json({ message: "Serverda xatolik yuz berdi" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
