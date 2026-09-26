const jwt = require("jsonwebtoken");
const pool = require("../config/db");

// Tokenni tekshiradi va req.user ga { id, role } yozadi.
// Qo'shimcha: foydalanuvchi o'chirilgan/bloklangan bo'lsa yoki parol token berilgandan keyin o'zgartirilgan bo'lsa —
// token endi yaroqsiz (masalan, parol o'g'irlangan deb o'zgartirilganda eski sessiyalar ishlamaydi)
async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Tizimga kirilmagan" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Sessiya muddati tugagan, qayta kiring" });
  }
  const { rows } = await pool.query("SELECT role, is_active, password_changed_at FROM users WHERE id = $1", [payload.id]);
  const user = rows[0];
  const changedAfter = user?.password_changed_at && Math.floor(new Date(user.password_changed_at).getTime() / 1000) > payload.iat;
  if (!user || !user.is_active || changedAfter) {
    return res.status(401).json({ message: "Sessiya muddati tugagan, qayta kiring" });
  }
  req.user = { id: payload.id, role: user.role, iat: payload.iat };
  next();
}

// Faqat ko'rsatilgan rollarga ruxsat beradi
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Bu sahifaga ruxsat yo'q" });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
