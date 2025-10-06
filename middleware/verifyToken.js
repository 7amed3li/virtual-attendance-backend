const jwt = require("jsonwebtoken");
const logger = require('../utils/logger'); // إضافة استيراد logger

function verifyToken(req, res, next) {
    logger.debug('🔍 Token doğrulama isteği alındı', { url: req.originalUrl, method: req.method });
    const authHeader = req.header("Authorization");
    if (!authHeader) {
        logger.warn('❌ Authorization başlığı eksik', { url: req.originalUrl });
        return res.status(401).json({ mesaj: "Token gerekli" });
    }

    const token = authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : authHeader;
    logger.debug('Token ayrıştırıldı', { token: token.substring(0, 10) + '...' }); // Güvenlik için token'ın sadece ilk 10 karakterini logla

    jwt.verify(token, process.env.JWT_SECRET || "gizliAnahtar", (err, decoded) => {
        if (err) {
            logger.error('❌ Token doğrulama hatası', { error: err.message, stack: err.stack, url: req.originalUrl });
            return res.status(403).json({ mesaj: "Token geçersiz veya süresi dolmuş" });
        }

        req.user = decoded;
        logger.info('✅ Token başarıyla doğrulandı', { user_id: decoded.id, rol: decoded.rol, url: req.originalUrl });
        next();
    });
}

console.log("🔐 JWT_SECRET kullanılıyor:", process.env.JWT_SECRET);
logger.info('🔐 JWT_SECRET başlatıldı', { jwt_secret: process.env.JWT_SECRET ? 'Tanımlı' : 'Varsayılan (gizliAnahtar)' });


module.exports = verifyToken;
