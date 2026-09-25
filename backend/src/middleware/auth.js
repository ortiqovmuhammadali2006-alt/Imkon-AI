const jwt = require("jsonwebtoken");

// Tokenni tekshiradi va req.user ga { id, role } yozadi
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Tizimga kirilmagan" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Sessiya muddati tugagan, qayta kiring" });
  }
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
