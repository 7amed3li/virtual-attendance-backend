const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const authHeader = req.header("Authorization");
  if (!authHeader) {
    return res.status(401).json({ mesaj: "Token gerekli" });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  jwt.verify(token, process.env.JWT_SECRET || "gizliAnahtar", (err, decoded) => {
    
    if (err) {
      return res.status(403).json({ mesaj: "Token geçersiz veya süresi dolmuş" });
    }

    req.user = decoded;
    next();
  });
}
console.log("🔐 JWT_SECRET kullanılıyor:", process.env.JWT_SECRET);

module.exports = verifyToken;
