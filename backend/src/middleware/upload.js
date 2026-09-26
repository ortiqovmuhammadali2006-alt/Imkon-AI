const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { HttpError } = require("../utils/validation");
const { config } = require("../config");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Hujjatlar, rasmlar, audio (ko'rish cheklanganlar uchun), video (eshitish cheklanganlar uchun — subtitr bilan)
const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt",
  ".jpg", ".jpeg", ".png", ".webp", ".gif",
  ".mp3", ".wav", ".ogg", ".m4a",
  ".mp4", ".webm", ".vtt", ".srt",
  ".zip",
]);

const MAX_SIZE_MB = config.uploadMaxMb; // .env: UPLOAD_MAX_MB

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Brauzerlar kirill/o'zbek nomlarni latin1 da yuboradi — UTF-8 ga qaytaramiz
    file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new HttpError(400, `Bu turdagi fayl qabul qilinmaydi: ${ext || "noma'lum"}`));
    }
    cb(null, true);
  },
});

// Yuklangan fayl uchun { file_url, file_name }
function fileInfo(file) {
  return file ? { file_url: `/uploads/${file.filename}`, file_name: file.originalname } : null;
}

// Diskdan faylni o'chirish (xatolarni e'tiborsiz qoldiradi)
function removeFile(fileUrl) {
  if (!fileUrl?.startsWith("/uploads/")) return;
  fs.unlink(path.join(UPLOAD_DIR, path.basename(fileUrl)), () => {});
}

module.exports = { upload, fileInfo, removeFile, UPLOAD_DIR, MAX_SIZE_MB };
