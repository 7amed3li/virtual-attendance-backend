const path = require('path'); // استدعاء مكتبة path

// تحديد المسار الكامل لملف .env بشكل صريح
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require("express");
const logger = require('./utils/logger');const cors = require("cors");
const jwt = require("jsonwebtoken");
const { router: qrRouter, KONUM_LISTESI } = require("./routes/qrCode");
const ogrenciExcelRouter = require('./routes/ogrenciExcel');
const pool = require("./config/veritabani"); // استيراد pool مرة واحدة في الأعلى

const app = express();
const PORT = 9090; // Sabit port
const BASE_PATH = '/qr'; // Sabit base path

logger.info("🚀 Uygulama başlatılıyor...");

// CORS ayarları
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || 
        origin.startsWith('http://localhost' ) || 
        origin.startsWith('http://192.168.56.1' ) ||
        origin.startsWith('https://yzdd.gop.edu.tr' ) ||
        origin.startsWith('http://yzdd.gop.edu.tr' ) ||
        origin.startsWith('http://127.0.0.1' )) {
      callback(null, true);
    } else {
      // استخدم next لتمرير الخطأ إلى معالج الأخطاء المركزي
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

logger.info("📝 Swagger dokümantasyonu ayarlanıyor...");
app.use(`${BASE_PATH}/api-docs`, swaggerUi.serve, swaggerUi.setup(specs));

// Verify JWT middleware
function verifyToken(req, res, next) {
  logger.debug("🔒 Token kontrolü yapılıyor..."); // استخدام debug للمعلومات التفصيلية

  const authHeader = req.header("Authorization");
  if (!authHeader) {
    logger.warn("❌ Token eksik!", { path: req.path });
    return res.status(401).json({ mesaj: "Token gerekli" });
  }

  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;

  if (!process.env.JWT_SECRET) {
    // هذا خطأ فادح في الإعدادات، يجب تسجيله كـ error
    logger.error("❗ FATAL: JWT_SECRET ortam değişkeni eksik!");
    return res.status(500).json({ mesaj: "Sunucu yapılandırması eksik (JWT_SECRET)" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      logger.warn(`⛔ Geçersiz token! Sebep: ${err.message}`, { path: req.path });
      return res.status(403).json({ mesaj: "Token geçersiz veya süresi dolmuş" });
    }
    req.user = decoded;
    logger.debug(`✅ Token geçerli - Kullanıcı ID: ${decoded.id}`);
    next();
  });
}

// Routes (BASE_PATH ile prefix)
logger.info("📦 Rotalar yükleniyor...");
logger.info(`🔧 BASE_PATH: ${BASE_PATH}`);
logger.info(`🔧 JWT_SECRET: ${process.env.JWT_SECRET ? "Tanımlı" : "Tanımsız"}`);

// Auth route'u en başta mount et
app.use(`${BASE_PATH}/api`, require("./routes/auth"));
logger.info(`✅ Auth route mounted at: ${BASE_PATH}/api`);

// Diğer route'ları mount et
app.use(`${BASE_PATH}/api/kullanici`, require("./routes/kullaniciRotasi"));
app.use(`${BASE_PATH}/api/users`, require("./routes/kullaniciRotasi"));
app.use(`${BASE_PATH}/api/admin`, require("./routes/admin"));

app.get(`${BASE_PATH}/api/ders/current-day`, async (req, res, next) => { // إضافة next
  try {
    const today = new Date();
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    
    const { rows } = await pool.query(`
      SELECT d.*, k.ad as ogretmen_ad, k.soyad as ogretmen_soyad, b.ad as bolum_adi
      FROM dersler d
      LEFT JOIN kullanicilar k ON d.ogretmen_id = k.id
      LEFT JOIN bolumler b ON d.bolum_id = b.id
      WHERE d.ders_saat IS NOT NULL AND d.ders_saat >= $1 AND d.ders_saat <= $2
      ORDER BY d.ders_saat ASC
    `, [currentHour - 1, currentHour + 2]);
    
    const coursesWithStatus = rows.map(course => {
      const courseHour = course.ders_saat;
      const isCurrent = courseHour === currentHour;
      const isNear = Math.abs(courseHour - currentHour) <= 1;
      
      return {
        ...course,
        ders_saat_readable: `${courseHour}:00`,
        is_current: isCurrent,
        is_near: isNear && !isCurrent
      };
    });
    
    res.json({
      current_time: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`,
      current_hour: currentHour,
      courses: coursesWithStatus
    });
    
  } catch (err) {
    // تمرير الخطأ إلى المعالج المركزي
    next(err); 
  }
});

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
app.use(`${BASE_PATH}/api/bildirim`, require("./routes/bildirim"));

// Excel router
app.use(`${BASE_PATH}/api/excel`, ogrenciExcelRouter);

// Konumlar endpoint
app.get(`${BASE_PATH}/api/konumlar`, verifyToken, (req, res) => {
  res.json(KONUM_LISTESI);
});

// Health check endpoint
app.get(`${BASE_PATH}`, (req, res) => {
  logger.info("📡 Sağlık kontrolü isteği alındı.");
  res.send("✅ QR Kod Yoklama Sistemi çalışıyor!");
});

// =================================================================
// ==                معالج الأخطاء المركزي العالمي                 ==
// == (يجب أن يكون هذا آخر `app.use` قبل `app.listen`)            ==
// =================================================================
app.use((err, req, res, next) => {
  // 1. سجل الخطأ باستخدام logger
  logger.error(err.message, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    // يمكنك إضافة المزيد من السياق إذا أردت
    // ip: req.ip,
    // user: req.user ? req.user.id : 'Guest'
  });

  // 2. أرسل استجابة خطأ عامة إلى العميل
  const status = err.status || 500;
  const message = err.isJoi ? 'Geçersiz giriş verileri' : (err.message || "Sunucuda beklenmeyen bir hata oluştu.");

  res.status(status).json({
    mesaj: message,
    // لا ترسل تفاصيل الخطأ (stack) في بيئة الإنتاج لأسباب أمنية
    ...(process.env.NODE_ENV !== "production" && { detay: err.stack })
  });
});

// Export app for testing
module.exports = { app, verifyToken };

// Server başlat
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 Sunucu ${PORT} portunda çalışıyor... http://localhost:${PORT}${BASE_PATH}` );
  });
}
