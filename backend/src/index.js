require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const authRoutes = require("./routes/auth");

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

// Express 5 async xatolarni shu yerga yuboradi
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ message: err.message });
  if (err.code === "23505" && err.constraint === "users_username_key") {
    return res.status(409).json({ message: "Bu login band, boshqasini tanlang" });
  }
  console.error(err);
  res.status(500).json({ message: "Serverda xatolik yuz berdi" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
