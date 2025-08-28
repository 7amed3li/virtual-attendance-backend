require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { router: qrRouter, KONUM_LISTESI } = require("./routes/qrCode");
const ogrenciExcelRouter = require('./routes/ogrenciExcel');


const app = express();
const PORT = 9090; // Sabit port
const BASE_PATH = '/qr'; // Sabit base path

console.log("🚀 Uygulama başlatılıyor...");

// CORS ayarları
app.use(cors({
  origin: function (origin, callback) {
    // Origin yoksa (ör: Postman) veya localhost/192.168.56.1 ile başlıyorsa izin ver
    if (!origin || 
        origin.startsWith('http://localhost') || 
        origin.startsWith('http://192.168.56.1') ||
        origin.startsWith('http://127.0.0.1')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// JSON parser
app.use(express.json());

// Swagger setup
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const swaggerOptions = require("./config/swaggerOptions");
const specs = swaggerJsdoc(swaggerOptions);

console.log("📝 Swagger dokümantasyonu ayarlanıyor...");
app.use(`${BASE_PATH}api-docs`, swaggerUi.serve, swaggerUi.setup(specs));

// Verify JWT middleware
function verifyToken(req, res, next) {
  console.log("🔒 Token kontrolü yapılıyor...");

  const authHeader = req.header("Authorization");
  if (!authHeader) {
    console.warn("❌ Token eksik!");
    return res.status(401).json({ mesaj: "Token gerekli" });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  if (!process.env.JWT_SECRET) {
    console.error("❗ JWT_SECRET ortam değişkeni eksik!");
    return res.status(500).json({ mesaj: "Sunucu yapılandırması eksik (JWT_SECRET)" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.warn("⛔ Geçersiz token!");
      return res.status(403).json({ mesaj: "Token geçersiz veya süresi dolmuş" });
    }
    req.user = decoded;
    console.log("✅ Token geçerli - Kullanıcı ID:", decoded.id);
    next();
  });
}


// Routes (BASE_PATH ile prefix)
console.log("📦 Rotalar yükleniyor...");
console.log("🔧 BASE_PATH:", BASE_PATH);
console.log("🔧 JWT_SECRET:", process.env.JWT_SECRET ? "Tanımlı" : "Tanımsız");


// Auth route'u en başta mount et
app.use(`${BASE_PATH}/api`, require("./routes/auth"));
console.log("✅ Auth route mounted at:", `${BASE_PATH}/api`);

// Diğer route'ları mount et
app.use(`${BASE_PATH}/api/kullanici`, require("./routes/kullaniciRotasi"));
app.use(`${BASE_PATH}/api/users`, require("./routes/kullaniciRotasi"));
app.use(`${BASE_PATH}/api/admin`, require("./routes/admin"));
app.use(`${BASE_PATH}/api/ders`, verifyToken, require("./routes/ders"));
app.use(`${BASE_PATH}/api/oturum`, verifyToken, require("./routes/oturumEkle"));
app.use(`${BASE_PATH}/api/oturum`, verifyToken, require("./routes/oturumListe"));
app.use(`${BASE_PATH}/api/yoklama`, verifyToken, require("./routes/yoklamaEkle"));
app.use(`${BASE_PATH}/api/yoklama`, verifyToken, require("./routes/yoklamaListe"));
app.use(`${BASE_PATH}/api/fakulte`, verifyToken, require("./routes/fakulte"));
app.use(`${BASE_PATH}/api/bolum`, verifyToken, require("./routes/bolum"));
app.use(`${BASE_PATH}/api/qr`, verifyToken, qrRouter);
app.use(`${BASE_PATH}/api/reports`, verifyToken, require("./routes/raporRotasi"));
app.use(`${BASE_PATH}/api/bildirimler`, require("./routes/bildirim"));
app.use(`${BASE_PATH}/api/ogretmen-bildirim`, require("./routes/bildirimEkle"));

// Excel router'ı en sona mount et
app.use(`${BASE_PATH}/api/excel`, ogrenciExcelRouter);

/**
 * @swagger
 * /api/konumlar:
 *   get:
 *     summary: Sabit konum listesini döndürür
 *     tags: [Konumlar]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Konum listesi başarıyla döndü
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   ad:
 *                     type: string
 *                   latitude:
 *                     type: number
 *                   longitude:
 *                     type: number
 *       401:
 *         description: Token gerekli
 *       403:
 *         description: Token geçersiz veya süresi dolmuş
 */
app.get(`${BASE_PATH}/api/konumlar`, verifyToken, (req, res) => {
  res.json(KONUM_LISTESI);
});

// Health check endpoint
app.get(`${BASE_PATH}`, (req, res) => {
  console.log("📡 Sağlık kontrolü isteği alındı.");
  res.send("✅ QR Kod Yoklama Sistemi çalışıyor!");
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("💥 Hata:", err.stack);
  const status = err.status || 500;
  res.status(status).json({
    mesaj: err.message || "Sunucu hatası",
    ...(process.env.NODE_ENV !== "production" && { detay: err.stack })
  });
});

// Export app for testing
module.exports = { app, verifyToken };


// Server başlat
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Sunucu ${PORT} portunda çalışıyor...`);
  });
}



