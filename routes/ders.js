
// Ders.js
const logger = require("../utils/logger"); // استيراد logger
logger.info("📄 Ders.js dosyası yüklendi", { timestamp: new Date().toISOString() });
const { tumKayitliKullanicilar } = require("../middleware/yetkiKontrol");

// Import third-party dependencies
const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const bcrypt = require("bcrypt");
const { body, param, query, validationResult } = require("express-validator");

// Import local configurations and middleware
const pool = require("../config/veritabani");
const { sadeceOgretmenVeAdmin, sadeceOgrenci, dersYonetimiGerekli } = require("../middleware/yetkiKontrol");

// Initialize Express router
const router = express.Router();

// Setup multer for file upload (in-memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


/**
 * @swagger
 * /api/ders/current-day:
 *   get:
 *     summary: "Bugünün derslerini getirir (dashboard için)"
 *     tags: [Ders, Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Bugünün dersleri başarıyla getirildi"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 courses:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/Ders"
 *       500:
 *         description: "Sunucu hatası"
 */
router.get("/current-day", sadeceOgretmenVeAdmin, async (req, res, next) => {
  logger.debug("🔍 Bugünün dersleri listeleme isteği alındı", { user_id: req.user?.id });

  try {
    const today = new Date();
    const currentHour = today.getHours();
    
    const { rows } = await pool.query(`
      SELECT 
        d.*,
        k.ad as ogretmen_ad,
        k.soyad as ogretmen_soyad,
        b.ad as bolum_adi
      FROM dersler d
      LEFT JOIN kullanicilar k ON d.ogretmen_id = k.id
      LEFT JOIN bolumler b ON d.bolum_id = b.id
      WHERE d.ders_saat IS NOT NULL
      ORDER BY d.ders_saat ASC
    `);
    
    const coursesWithStatus = rows.map(course => ({
      ...course,
      ders_saat_readable: `${course.ders_saat}:00`,
      is_current: course.ders_saat === currentHour,
      is_near: Math.abs(course.ders_saat - currentHour) <= 1 && course.ders_saat !== currentHour
    }));
    
    logger.info(`✅ ${rows.length} ders bulundu`, { user_id: req.user?.id, current_hour: currentHour });
    res.json({ courses: coursesWithStatus });
    
  } catch (err) {
    logger.error("❌ Bugünün derslerini getirme hatası", { error: err.message, stack: err.stack, user_id: req.user?.id });
    next(err);
  }
});

/**
 * @swagger
 * tags:
 *   name: Ders
 *   description: "Ders işlemleri, öğrenci yönetimi ve yoklama raporları"
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Ders:
 *       type: object
 *       required:
 *         - ad
 *         - bolum_id
 *         - ogretmen_id
 *         - donem
 *         - akademik_yil
 *       properties:
 *         id:
 *           type: integer
 *           description: "Dersin benzersiz IDsi"
 *           readOnly: true
 *         ad:
 *           type: string
 *           description: "Dersin adı"
 *         bolum_id:
 *           type: integer
 *           description: "Dersin ait olduğu bölümün IDsi"
 *         ogretmen_id:
 *           type: integer
 *           description: "Dersi veren öğretmenin IDsi"
 *         donem:
 *           type: string
 *           description: "Dersin verildiği dönem (örn: Güz, Bahar, Yaz)"
 *         akademik_yil:
 *           type: string
 *           description: "Dersin verildiği akademik yıl (örn: 2023-2024)"
 *         devamsizlik_limiti:
 *           type: integer
 *           description: "Dersteki maksimum devamsızlık limiti (yüzde olarak, örn: 30)"
 *           default: 30
 *         olusturulma_tarihi:
 *           type: string
 *           format: date-time
 *           description: "Dersin oluşturulma tarihi"
 *           readOnly: true
 *     DersInput:
 *       type: object
 *       required:
 *         - ad
 *         - bolum_id
 *         - ogretmen_id
 *         - donem
 *         - akademik_yil
 *       properties:
 *         ad:
 *           type: string
 *           description: "Dersin adı"
 *         bolum_id:
 *           type: integer
 *           description: "Dersin ait olduğu bölümün IDsi"
 *         ogretmen_id:
 *           type: integer
 *           description: "Dersi veren öğretmenin IDsi"
 *         donem:
 *           type: string
 *           description: "Dersin verildiği dönem (örn: Güz, Bahar, Yaz)"
 *         akademik_yil:
 *           type: string
 *           description: "Dersin verildiği akademik yıl (örn: 2023-2024)"
 *         devamsizlik_limiti:
 *           type: integer
 *           description: "Dersteki maksimum devamsızlık limiti (yüzde olarak, örn: 30)"
 *           default: 30
 *     ImportStudentResult:
 *       type: object
 *       properties:
 *         mesaj:
 *           type: string
 *         total_rows_in_excel:
 *           type: integer
 *         successfully_registered:
 *           type: integer
 *         already_registered_in_course:
 *           type: integer
 *         newly_created_students:
 *           type: integer
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               row_number:
 *                 type: integer
 *               student_data:
 *                 type: object
 *               error:
 *                 type: string
 *     YoklamaRaporuOgrenci:
 *       type: object
 *       properties:
 *         ogrenci_id:
 *           type: integer
 *         universite_kodu:
 *           type: string
 *         ad:
 *           type: string
 *         soyad:
 *           type: string
 *         eposta:
 *           type: string
 *         toplam_oturum_sayisi:
 *           type: integer
 *         katildigi_oturum_sayisi:
 *           type: integer
 *         katilmadigi_oturum_sayisi:
 *           type: integer
 *         izinli_sayisi:
 *           type: integer
 *         gec_gelme_sayisi:
 *           type: integer
 *         katilim_yuzdesi:
 *           type: number
 *           format: float
 *         devamsizlik_durumu:
 *           type: string
 *           enum: [gecti, kaldi, sinirda]
 *     YoklamaRaporu:
 *       type: object
 *       properties:
 *         ders_id:
 *           type: integer
 *         ders_adi:
 *           type: string
 *         devamsizlik_limiti_yuzde:
 *           type: integer
 *         toplam_ders_oturumu:
 *           type: integer
 *         ogrenciler:
 *           type: array
 *           items:
 *             $ref: "#/components/schemas/YoklamaRaporuOgrenci"
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

// ------------------- Dashboard Routes -------------------
/**
 * @swagger
 * /api/ders/dashboard-stats:
 *   get:
 *     summary: "Ana Dashboard için temel istatistikleri getirir"
 *     tags: [Ders, Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: facultyId
 *         schema:
 *           type: integer
 *         description: "Fakülte ID'sine göre filtrele (opsiyonel)"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: "Filtreleme için başlangıç tarihi (YYYY-MM-DD) (opsiyonel)"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: "Filtreleme için bitiş tarihi (YYYY-MM-DD) (opsiyonel)"
 *     responses:
 *       200:
 *         description: "Dashboard istatistiklerini içeren bir nesne"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalStudents:
 *                   type: integer
 *                 totalCourses:
 *                   type: integer
 *                 totalSessions:
 *                   type: integer
 *                 averageAttendance:
 *                   type: number
 */
router.get("/top-performing-courses", sadeceOgretmenVeAdmin, async (req, res, next) => {
  logger.debug("🔍 Yüksek katılım dersleri listeleme isteği alındı", { user_id: req.user?.id });
  try {
    const query = `
      SELECT id, ad as ders_adi, katilim_orani, toplam_ogrenci, ogretmen_adi, ogretmen_soyadi
      FROM (
        SELECT
          d.id, d.ad, k.ad as ogretmen_adi, k.soyad as ogretmen_soyadi,
          (SELECT COUNT(*) FROM ders_kayitlari dk WHERE dk.ders_id = d.id AND dk.alinma_tipi = 'zorunlu') as toplam_ogrenci,
          (
            SELECT AVG(session_data.attendance_percentage)
            FROM (
              SELECT
                (COUNT(y.id) FILTER (WHERE y.durum IN ('katildi', 'gec_geldi')) * 100.0) /
                NULLIF((SELECT COUNT(*) FROM ders_kayitlari dk WHERE dk.ders_id = o.ders_id AND dk.alinma_tipi = 'zorunlu'), 0)
                AS attendance_percentage
              FROM oturumlar o
              LEFT JOIN yoklamalar y ON y.oturum_id = o.id
              WHERE o.ders_id = d.id
              GROUP BY o.id
            ) AS session_data
          ) AS katilim_orani
        FROM dersler d
        LEFT JOIN kullanicilar k ON d.ogretmen_id = k.id
      ) AS CourseAttendance
      WHERE katilim_orani IS NOT NULL
      ORDER BY katilim_orani DESC
      LIMIT 5;
    `;
    const { rows } = await pool.query(query);
    logger.info(`✅ ${rows.length} yüksek katılım dersi bulundu`, { user_id: req.user?.id });
    res.status(200).json(rows);
  } catch (err) {
    logger.error("❌ Yüksek katılım dersleri listeleme hatası", { error: err.message, stack: err.stack, user_id: req.user?.id });
    next(err);
  }
});

/**
 * @swagger
 * /api/ders/low-attendance-courses:
 *   get:
 *     summary: "Katılım oranı düşük olan dersleri listeler"
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: "Döndürülecek maksimum ders sayısı"
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: integer
 *           default: 50
 *         description: "Düşük katılım olarak kabul edilecek yüzde eşiği (örn: 50%)"
 *     responses:
 *       200:
 *         description: "Katılım oranı düşük derslerin listesi"
 */
router.get("/low-attendance-courses", sadeceOgretmenVeAdmin, async (req, res, next) => {
  logger.debug("🔍 Düşük katılım dersleri listeleme isteği alındı", { user_id: req.user?.id });
  try {
    const query = `
      SELECT id, ad as ders_adi, katilim_orani, toplam_ogrenci, ogretmen_adi, ogretmen_soyadi
      FROM (
        SELECT
          d.id, d.ad, k.ad as ogretmen_adi, k.soyad as ogretmen_soyadi,
          (SELECT COUNT(*) FROM ders_kayitlari dk WHERE dk.ders_id = d.id AND dk.alinma_tipi = 'zorunlu') as toplam_ogrenci,
          (
            SELECT AVG(session_data.attendance_percentage)
            FROM (
              SELECT
                (COUNT(y.id) FILTER (WHERE y.durum IN ('katildi', 'gec_geldi')) * 100.0) /
                NULLIF((SELECT COUNT(*) FROM ders_kayitlari dk WHERE dk.ders_id = o.ders_id AND dk.alinma_tipi = 'zorunlu'), 0)
                AS attendance_percentage
              FROM oturumlar o
              LEFT JOIN yoklamalar y ON y.oturum_id = o.id
              WHERE o.ders_id = d.id
              GROUP BY o.id
            ) AS session_data
          ) AS katilim_orani
        FROM dersler d
        LEFT JOIN kullanicilar k ON d.ogretmen_id = k.id
      ) AS CourseAttendance
      WHERE katilim_orani IS NOT NULL AND katilim_orani < 50
      ORDER BY katilim_orani ASC
      LIMIT 5;
    `;
    const { rows } = await pool.query(query);
    logger.info(`✅ ${rows.length} düşük katılım dersi bulundu`, { user_id: req.user?.id });
    res.status(200).json(rows);
  } catch (err) {
    logger.error("❌ Düşük katılım dersleri listeleme hatası", { error: err.message, stack: err.stack, user_id: req.user?.id });
    next(err);
  }
});

/**
 * @swagger
 * /api/ders/top-performing-courses:
 *   get:
 *     summary: "Katılım oranı yüksek olan dersleri listeler"
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get("/top-performing-courses", sadeceOgretmenVeAdmin, async (req, res, next) => {
  logger.debug("🔍 Yüksek katılım dersleri listeleme isteği alındı", { user_id: req.user?.id });
  try {
    const query = `
      SELECT id, ad as ders_adi, katilim_orani, toplam_ogrenci, ogretmen_adi, ogretmen_soyadi
      FROM (
        SELECT
          d.id, d.ad, k.ad as ogretmen_adi, k.soyad as ogretmen_soyadi,
          (SELECT COUNT(*) FROM ders_kayitlari dk WHERE dk.ders_id = d.id AND dk.alinma_tipi = 'zorunlu') as toplam_ogrenci,
          (
            SELECT AVG(session_data.attendance_percentage)
            FROM (
              SELECT
                (COUNT(y.id) FILTER (WHERE y.durum IN ('katildi', 'gec_geldi')) * 100.0) /
                NULLIF((SELECT COUNT(*) FROM ders_kayitlari dk WHERE dk.ders_id = o.ders_id AND dk.alinma_tipi = 'zorunlu'), 0)
                AS attendance_percentage
              FROM oturumlar o
              LEFT JOIN yoklamalar y ON y.oturum_id = o.id
              WHERE o.ders_id = d.id
              GROUP BY o.id
            ) AS session_data
          ) AS katilim_orani
        FROM dersler d
        LEFT JOIN kullanicilar k ON d.ogretmen_id = k.id
      ) AS CourseAttendance
      WHERE katilim_orani IS NOT NULL
      ORDER BY katilim_orani DESC
      LIMIT 5;
    `;
    const { rows } = await pool.query(query);
    logger.info(`✅ ${rows.length} yüksek katılım dersi bulundu`, { user_id: req.user?.id });
    res.status(200).json(rows);
  } catch (err) {
    logger.error("❌ Yüksek katılım dersleri listeleme hatası", { error: err.message, stack: err.stack, user_id: req.user?.id });
    next(err);
  }
});


/**
 * @swagger
 * /api/ders/recent-activities:
 *   get:
 *     summary: "Son aktiviteleri (oturumları) listeler"
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 */
// في ملف ders.js

router.get("/recent-activities", sadeceOgretmenVeAdmin, async (req, res, next) => {
  logger.debug("🔍 Son aktiviteler listeleme isteği alındı", { user_id: req.user?.id });

  try {
    const query = `
      SELECT 
        o.id,
        o.konu,
        o.tarih,
        o.saat,
        d.ad as ders_adi,
        -- استخدم COALESCE لضمان عدم الحصول على NULL
        COALESCE(dk_counts.total, 0) as toplam_ogrenci,
        COALESCE(y_counts.attended, 0) as katilan_ogrenci,
        TO_CHAR(o.tarih, 'YYYY-MM-DD') || 'T' || TO_CHAR(o.saat, 'HH24:MI:SS') as time
      FROM oturumlar o
      JOIN dersler d ON o.ders_id = d.id
      -- ربط فرعي لحساب إجمالي الطلاب المسجلين
      LEFT JOIN (
        SELECT ders_id, COUNT(ogrenci_id) as total
        FROM ders_kayitlari
        GROUP BY ders_id
      ) dk_counts ON dk_counts.ders_id = o.ders_id
      -- ربط فرعي لحساب عدد الحضور
      LEFT JOIN (
        SELECT oturum_id, COUNT(id) as attended
        FROM yoklamalar
        WHERE durum IN ('katildi', 'gec_geldi')
        GROUP BY oturum_id
      ) y_counts ON y_counts.oturum_id = o.id
      ORDER BY o.tarih DESC, o.saat DESC 
      LIMIT 5;
    `;
    
    const { rows } = await pool.query(query);
    
    // تحويل القيم إلى أرقام صحيحة لضمان التوافق
    const formattedRows = rows.map(row => ({
      ...row,
      toplam_ogrenci: parseInt(row.toplam_ogrenci, 10),
      katilan_ogrenci: parseInt(row.katilan_ogrenci, 10)
    }));

    logger.info(`✅ ${formattedRows.length} aktivite bulundu`, { user_id: req.user?.id });
    res.json(formattedRows);
  } catch (err) {
    logger.error("❌ Son aktiviteleri getirme hatası", { error: err.message, stack: err.stack, user_id: req.user?.id });
    next(err);
  }
});


// ------------------- Course Management Routes -------------------

/**
 * @swagger
 * /api/ders/list-by-ids:
 *   post:
 *     summary: "Belirtilen ID listesindeki oturumların detaylarını getirir"
 *     tags: [Ders, Rapor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: "Oturumların listesi başarıyla getirildi"
 */
router.post(
  "/list-by-ids",
  tumKayitliKullanicilar,
  [
    body("ids").isArray({ min: 1 }).withMessage("ID listesi boş olmamalıdır."),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası: /list-by-ids", { errors: errors.array(), user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { ids } = req.body;
    logger.debug("🔍 Oturumları ID listesi ile getirme isteği", { ids, user_id: req.user?.id });

    try {
      // --- ✅ بداية الاستعلام المصحح ---
      const query = `
        SELECT 
          o.id,
          o.konu,
          o.tarih,
          d.ad as ders_adi,
          COALESCE(y_counts.attended, 0) as katilan_ogrenci,
          COALESCE(dk_counts.total, 0) as toplam_ogrenci
        FROM oturumlar o
        JOIN dersler d ON o.ders_id = d.id
        LEFT JOIN (
          SELECT ders_id, COUNT(ogrenci_id) as total
          FROM ders_kayitlari
          GROUP BY ders_id
        ) dk_counts ON dk_counts.ders_id = o.ders_id
        LEFT JOIN (
          SELECT oturum_id, COUNT(id) as attended
          FROM yoklamalar
          WHERE durum IN ('katildi', 'gec_geldi')
          GROUP BY oturum_id
        ) y_counts ON y_counts.oturum_id = o.id
        WHERE o.id = ANY($1::int[])
        ORDER BY o.tarih DESC, o.saat DESC;
      `;
      // --- 🔚 نهاية الاستعلام المصحح ---

      const { rows } = await pool.query(query, [ids]);
      
      const formattedRows = rows.map(row => ({
        ...row,
        toplam_ogrenci: parseInt(row.toplam_ogrenci, 10),
        katilan_ogrenci: parseInt(row.katilan_ogrenci, 10)
      }));

      logger.info(`✅ ${formattedRows.length} oturum detayı ID listesi ile getirildi`, { user_id: req.user?.id });
      res.status(200).json(formattedRows);
    } catch (err) {
      logger.error("❌ Oturumları ID listesi ile getirme hatası", { error: err.message, stack: err.stack, user_id: req.user?.id });
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/ders:
 *   get:
 *     summary: "Tüm dersleri listeler (admin tüm dersler, öğretmen kendi dersleri)"
 *     tags: [Ders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: "Sayfa numarası"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: "Sayfadaki ders sayısı"
 *     responses:
 *       200:
 *         description: "Derslerin listesi"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/Ders"
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *       403:
 *         description: "Yetkisiz erişim"
 */
router.get(
  "/",
  sadeceOgretmenVeAdmin,
  [
    query("page").optional().isInt({ min: 1 }).toInt().withMessage("Page tamsayı ve 1'den büyük olmalı"),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt().withMessage("Limit 1-100 arasında olmalı")
  ],
  async (req, res, next) => {
    logger.debug("🔍 Tüm dersler listeleme isteği alındı", { user_id: req.user?.id, page: req.query.page, limit: req.query.limit });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    try {
      if (!req.user || !req.user.id || !Number.isInteger(req.user.id)) {
        logger.warn("⛔ Geçersiz kullanıcı bilgisi", { user_id: req.user?.id });
        return res.status(401).json({ mesaj: "Geçersiz kullanıcı bilgisi" });
      }

      let whereClause = "";
      const queryParams = [];
      
      if (req.user.rol === "ogretmen") {
        whereClause = " WHERE d.ogretmen_id = $1";
        queryParams.push(req.user.id);
      }

      const countQuery = `SELECT COUNT(*) FROM dersler d ${whereClause}`;
      const dataQuery = `
        SELECT 
          d.*,
          (SELECT COUNT(dk.ogrenci_id) FROM ders_kayitlari dk WHERE dk.ders_id = d.id) as ogrenci_sayisi
        FROM dersler d
        ${whereClause}
        ORDER BY d.id ASC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `;

      const dataParams = [...queryParams, limit, offset];

      const [{ rows: dataRows }, { rows: countRows }] = await Promise.all([
        pool.query(dataQuery, dataParams),
        pool.query(countQuery, queryParams)
      ]);

      const total = countRows[0] ? parseInt(countRows[0].count, 10) : 0;
      
      logger.info(`✅ ${dataRows.length} ders bulundu`, { user_id: req.user.id, total, page, limit });
      res.json({
        data: dataRows,
        total: total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      });

    } catch (err) {
      logger.error("❌ Ders listeleme hatası", { error: err.message, stack: err.stack, user_id: req.user?.id });
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/ders/{id}:
 *   get:
 *     summary: "Belirli bir dersi getirir"
 *     tags: [Ders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: "Getirilecek dersin ID'si"
 *     responses:
 *       200:
 *         description: "Ders bulundu ve döndürüldü"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Ders"
 *       400:
 *         description: "Geçersiz istek verisi"
 *       403:
 *         description: "Yetkisiz erişim"
 *       404:
 *         description: "Ders bulunamadı"
 */
router.get(
  "/:id",
  sadeceOgretmenVeAdmin,
  [
    param("id").isInt({ gt: 0 }).withMessage("Geçerli bir ders ID girilmelidir.")
  ],
  async (req, res, next) => {
    logger.debug("🔍 Ders detayları isteği alındı", { ders_id: req.params.id, user_id: req.user?.id });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), ders_id: req.params.id, user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }
    const { id } = req.params;
    try {
      const dersQuery = `
        SELECT 
          d.*, 
          b.ad AS bolum_ad, 
          f.ad AS fakulte_ad, 
          k.ad AS ogretmen_ad, 
          k.soyad AS ogretmen_soyad
        FROM dersler d
        LEFT JOIN bolumler b ON d.bolum_id = b.id
        LEFT JOIN fakulteler f ON b.fakulte_id = f.id
        LEFT JOIN kullanicilar k ON d.ogretmen_id = k.id
        WHERE d.id = $1
      `;
      const { rows } = await pool.query(dersQuery, [id]);
      if (rows.length === 0) {
        logger.warn("❌ Ders bulunamadı", { ders_id: id, user_id: req.user?.id });
        return res.status(404).json({ mesaj: "Ders bulunamadı." });
      }
      logger.info("✅ Ders detayları getirildi", { ders_id: id, user_id: req.user?.id });
      res.json(rows[0]);
    } catch (err) {
      logger.error("❌ Ders detayları getirme hatası", { error: err.message, stack: err.stack, ders_id: id, user_id: req.user?.id });
      next(err);
    }
  }
);
/**
 * @swagger
 * /api/ders/ekle:
 *   post:
 *     summary: "Yeni bir ders ekler"
 *     tags: [Ders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/DersInput"
 *     responses:
 *       201:
 *         description: "Ders başarıyla eklendi"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Ders"
 *       400:
 *         description: "Geçersiz istek verisi"
 *       403:
 *         description: "Yetkisiz erişim (Sadece admin veya öğretmenler)"
 */
router.post(
  "/ekle",
  dersYonetimiGerekli(),
  [
    body("ad").notEmpty().withMessage("Ders adı gerekli"),
    body("kod").notEmpty().withMessage("kod gerekli"),
    body("bolum_id").isInt({ gt: 0 }).withMessage("bolum_id geçerli bir tamsayı olmalı"),
    body("ogretmen_id").isInt({ gt: 0 }).withMessage("ogretmen_id geçerli bir tamsayı olmalı"),
    body("donem").notEmpty().withMessage("donem gerekli"),
    body("akademik_yil").notEmpty().withMessage("akademik_yil gerekli"),
    body("devamsizlik_limiti").optional().isInt({ min: 0, max: 100 }).withMessage("Devamsızlık limiti 0-100 arasında bir tamsayı olmalı"),

    body("min_yoklama_yuzdesi").optional().isInt({ min: 0, max: 100 }).withMessage("Minimum yoklama yüzdesi 0-100 arasında bir tamsayı olmalı"),
    body("sinif").optional().isString().isLength({ max: 10 }).withMessage("Sınıf en fazla 10 karakter olmalı"),
    body("sube").optional().isString().isLength({ max: 10 }).withMessage("Şube en fazla 10 karakter olmalı"),
    body("ders_saat").optional().isInt({ min: 0, max: 23 }).withMessage("Ders saati 0-23 arasında olmalı")
  ],
  async (req, res, next) => {
    logger.debug("🔍 Yeni ders ekleme isteği alındı", { user_id: req.user?.id, ders_ad: req.body.ad });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    // --- التعديل هنا ---
    const { ad, kod, bolum_id, ogretmen_id, donem, akademik_yil, devamsizlik_limiti = 30, min_yoklama_yuzdesi = 50, sinif = null, sube = null, ders_saat = null } = req.body;

    try {
      const { rows } = await pool.query(
        `INSERT INTO dersler (ad, kod, bolum_id, ogretmen_id, donem, akademik_yil, devamsizlik_limiti, min_yoklama_yuzdesi, sinif, sube, ders_saat)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        // --- التعديل هنا ---
        [ad, kod, bolum_id, ogretmen_id, donem, akademik_yil, devamsizlik_limiti, min_yoklama_yuzdesi, sinif, sube, ders_saat]
      );
      logger.info("✅ Ders başarıyla eklendi", { ders_id: rows[0].id, ad, user_id: req.user?.id });
      res.status(201).json(rows[0]);
    } catch (err) {
      logger.error("❌ Ders ekleme hatası", { error: err.message, stack: err.stack, ad, user_id: req.user?.id });
      next(err);
    }
  }
);


/**
 * @swagger
 * /api/ders/{id}:
 *   put:
 *     summary: "Mevcut bir dersi günceller"
 *     tags: [Ders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: "Güncellenecek dersin IDsi"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/DersInput"
 *     responses:
 *       200:
 *         description: "Ders başarıyla güncellendi"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Ders"
 *       400:
 *         description: "Geçersiz istek verisi veya güncellenecek alan yok"
 *       403:
 *         description: "Yetkisiz erişim"
 *       404:
 *         description: "Ders bulunamadı"
 */
router.put(
  "/:id",
  dersYonetimiGerekli(),
  [
    param("id").isInt().withMessage("Ders ID tamsayı olmalı"),
    body("ad").optional().notEmpty().withMessage("Ders adı boş olamaz"),
    body("kod").optional().notEmpty().withMessage("Kod boş olamaz"),
    body("bolum_id").optional().isInt({ gt: 0 }).withMessage("Bölüm ID geçerli bir tamsayı olmalı"),
    body("ogretmen_id").optional().isInt({ gt: 0 }).withMessage("Öğretmen ID geçerli bir tamsayı olmalı"),
    body("donem").optional().notEmpty().withMessage("Dönem boş olamaz"),
    body("akademik_yil").optional().notEmpty().withMessage("Akademik yıl boş olamaz"),
    body("devamsizlik_limiti").optional().isInt({ min: 0, max: 100 }).withMessage("Devamsızlık limiti 0-100 arasında bir tamsayı olmalı"),
    body("sinif").optional().isString().isLength({ max: 10 }).withMessage("Sınıf en fazla 10 karakter olmalı"),
    body("sube").optional().isString().isLength({ max: 10 }).withMessage("Şube en fazla 10 karakter olmalı"),
    body("min_yoklama_yuzdesi").optional().isInt({ min: 0, max: 100 }).withMessage("Minimum yoklama yüzdesi 0-100 arasında bir tamsayı olmalı")
  ],
  async (req, res, next) => {
    logger.debug("🔍 Ders güncelleme isteği alındı", { ders_id: req.params.id, user_id: req.user?.id });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), ders_id: req.params.id, user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { id } = req.params;
    const { ad, kod, bolum_id, ogretmen_id, donem, akademik_yil, devamsizlik_limiti, sinif, sube, ders_saat, min_yoklama_yuzdesi } = req.body;

    try {
      const currentDers = await pool.query("SELECT * FROM dersler WHERE id = $1", [id]);
      if (currentDers.rows.length === 0) {
        logger.warn("❌ Ders bulunamadı", { ders_id: id, user_id: req.user?.id });
        return res.status(404).json({ mesaj: "Ders bulunamadı" });
      }

      const updateFields = [];
      const updateValues = [];
      let queryIndex = 1;

      if (ad !== undefined) {
        updateFields.push(`ad = $${queryIndex++}`);
        updateValues.push(ad);
      }
      if (kod !== undefined) {
        updateFields.push(`kod = $${queryIndex++}`);
        updateValues.push(kod);
      }
      if (bolum_id !== undefined) {
        updateFields.push(`bolum_id = $${queryIndex++}`);
        updateValues.push(bolum_id);
      }
      if (ogretmen_id !== undefined) {
        updateFields.push(`ogretmen_id = $${queryIndex++}`);
        updateValues.push(ogretmen_id);
      }
      if (donem !== undefined) {
        updateFields.push(`donem = $${queryIndex++}`);
        updateValues.push(donem);
      }
      if (akademik_yil !== undefined) {
        updateFields.push(`akademik_yil = $${queryIndex++}`);
        updateValues.push(akademik_yil);
      }
      if (devamsizlik_limiti !== undefined) {
        updateFields.push(`devamsizlik_limiti = $${queryIndex++}`);
        updateValues.push(devamsizlik_limiti);
      }
      if (sinif !== undefined) {
        updateFields.push(`sinif = $${queryIndex++}`);
        updateValues.push(sinif);
      }
      if (sube !== undefined) {
        updateFields.push(`sube = $${queryIndex++}`);
        updateValues.push(sube);
      }
      if (ders_saat !== undefined) {
        updateFields.push(`ders_saat = $${queryIndex++}`);
        updateValues.push(ders_saat);
      }
      if (min_yoklama_yuzdesi !== undefined) {
        updateFields.push(`min_yoklama_yuzdesi = $${queryIndex++}`);
        updateValues.push(min_yoklama_yuzdesi);
      }

      if (updateFields.length === 0) {
        logger.warn("❌ Güncellenecek alan yok", { ders_id: id, user_id: req.user?.id });
        return res.status(400).json({ mesaj: "Güncellenecek alan yok" });
      }
      
      updateValues.push(id);
      const { rows } = await pool.query(
        `UPDATE dersler SET ${updateFields.join(", ")} WHERE id = $${queryIndex} RETURNING *`,
        updateValues
      );
      logger.info("✅ Ders başarıyla güncellendi", { ders_id: id, user_id: req.user?.id });
      res.status(200).json(rows[0]);
    } catch (err) {
      logger.error("❌ Ders güncelleme hatası", { error: err.message, stack: err.stack, ders_id: id, user_id: req.user?.id });
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/ders/{id}:
 *   delete:
 *     summary: "Mevcut bir dersi siler"
 *     tags: [Ders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: "Silinecek dersin IDsi"
 *     responses:
 *       200:
 *         description: "Ders başarıyla silindi"
 *       403:
 *         description: "Yetkisiz erişim"
 *       404:
 *         description: "Ders bulunamadı"
 *       409:
 *         description: "Ders silinemedi (ilişkili veriler mevcut)"
 */
router.delete(
  "/:id",
  dersYonetimiGerekli(),
  [
    param("id").isInt().withMessage("Ders ID tamsayı olmalı")
  ],
  async (req, res, next) => {
    logger.debug("🔍 Ders silme isteği alındı", { ders_id: req.params.id, user_id: req.user?.id });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), ders_id: req.params.id, user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }
    
    const { id } = req.params;

    try {
      const result = await pool.query("DELETE FROM dersler WHERE id = $1 RETURNING *", [id]);
      if (result.rows.length === 0) {
        logger.warn("❌ Ders bulunamadı", { ders_id: id, user_id: req.user?.id });
        return res.status(404).json({ mesaj: "Ders bulunamadı" });
      }
      logger.info("✅ Ders başarıyla silindi", { ders_id: id, user_id: req.user?.id });
      res.status(200).json({ mesaj: `Ders (ID: ${id}) başarıyla silindi.` });
    } catch (err) {
      logger.error("❌ Ders silme hatası", { error: err.message, stack: err.stack, ders_id: id, user_id: req.user?.id });
      if (err.code === "23503") {
        logger.warn("⚠️ Ders silinemedi: İlişkili veriler mevcut", { ders_id: id, user_id: req.user?.id, detay: err.detail });
        return res.status(409).json({
          mesaj: "Ders silinemedi. Bu derse kayıtlı öğrenciler veya oluşturulmuş oturumlar/yoklamalar olabilir. Lütfen önce bu ilişkili verileri kaldırın.",
          detay: err.detail
        });
      }
      next(err);
    }
  }
);

// ------------------- Student Management Routes -------------------
/**
 * @swagger
 * /api/ders/ogrenci-dersleri:
 *   get:
 *     summary: "Öğrencinin kayıtlı olduğu dersleri listeler"
 *     tags: [Ders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: "Sayfa numarası"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: "Sayfadaki ders sayısı"
 *     responses:
 *       200:
 *         description: "Öğrencinin ders listesi"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/Ders"
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *       403:
 *         description: "Yetkisiz erişim"
 */
router.get(
  "/ogrenci-dersleri",
  sadeceOgrenci,
  [
    query("page").optional().isInt({ min: 1 }).toInt().withMessage("Page tamsayı ve 1'den büyük olmalı"),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt().withMessage("Limit 1-100 arasında olmalı")
  ],
  async (req, res, next) => {
    logger.debug("🔍 Öğrenci dersleri listeleme isteği alındı", { user_id: req.user?.id, page: req.query.page, limit: req.query.limit });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    try {
      if (!req.user || !req.user.id || !Number.isInteger(req.user.id)) {
        logger.warn("⛔ Geçersiz kullanıcı bilgisi", { user_id: req.user?.id });
        return res.status(401).json({ mesaj: "Geçersiz kullanıcı bilgisi" });
      }

      // --- التعديل هنا ---
      // تم تحديث الاستعلام ليشمل اسم الدرس، الكود، الفصل، والشعبة، واسم المعلم
      const queryText = `
        SELECT 
          d.id, 
          d.ad,           
          d.kod,          
          d.sinif,        
          d.sube,
          u.ad as ogretmen_ad,
          u.soyad as ogretmen_soyad
        FROM dersler d
        JOIN ders_kayitlari dk ON d.id = dk.ders_id
        LEFT JOIN kullanicilar u ON d.ogretmen_id = u.id
        WHERE dk.ogrenci_id = $1
        ORDER BY d.id ASC
        LIMIT $2 OFFSET $3
      `;
      const countQuery = `
        SELECT COUNT(*)
        FROM dersler d
        JOIN ders_kayitlari dk ON d.id = dk.ders_id
        WHERE dk.ogrenci_id = $1
      `;
      const { rows } = await pool.query(queryText, [req.user.id, limit, offset]);
      const { rows: countRows } = await pool.query(countQuery, [req.user.id]);

      logger.info(`✅ ${rows.length} ders bulundu`, { user_id: req.user.id, total: countRows[0]?.count || 0, page, limit });
      res.json({
        data: rows,
        total: countRows[0] ? parseInt(countRows[0].count || 0) : 0,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    } catch (err) {
      logger.error("❌ Öğrenci dersleri listeleme hatası", { error: err.message, stack: err.stack, user_id: req.user?.id });
      next(err);
    }
  }
);


/**
 * @swagger
 * /api/ders/kayit:
 *   post:
 *     summary: "Bir öğrenciyi bir derse kaydeder"
 *     tags: [Ders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ders_id
 *               - universite_kodu
 *               - alinma_tipi
 *             properties:
 *               ders_id:
 *                 type: integer
 *               universite_kodu:
 *                 type: string
 *               alinma_tipi:
 *                 type: string
 *                 enum:
 *                   - zorunlu
 *                   - alttan
 *                   - devamlı alttan
 *     responses:
 *       201:
 *         description: "Öğrenci başarıyla derse kaydedildi"
 *       400:
 *         description: "Geçersiz istek verisi"
 *       403:
 *         description: "Yetkisiz erişim"
 *       404:
 *         description: "Ders veya öğrenci bulunamadı"
 *       409:
 *         description: "Öğrenci zaten bu derse kayıtlı"
 */
router.post(
  "/kayit",
  dersYonetimiGerekli(),
  [
    body("ders_id").isInt({ gt: 0 }).withMessage("ders_id geçerli bir tamsayı olmalı"),
    body("universite_kodu").isString().notEmpty().withMessage("universite_kodu zorunludur"),
    body("alinma_tipi").isIn(["zorunlu", "alttan", "devamlı alttan"]).withMessage("alinma_tipi 'zorunlu', 'alttan' veya 'devamlı alttan' olmalı")
  ],
  async (req, res, next) => {
    logger.debug("🔍 Öğrenci ders kaydı isteği alındı", { user_id: req.user?.id, ders_id: req.body.ders_id, universite_kodu: req.body.universite_kodu });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { ders_id, universite_kodu, alinma_tipi } = req.body;
    try {
      const dersExists = await pool.query("SELECT id FROM dersler WHERE id = $1", [ders_id]);
      if (dersExists.rows.length === 0) {
        logger.warn("❌ Ders bulunamadı", { ders_id, user_id: req.user?.id });
        return res.status(404).json({ mesaj: "Ders bulunamadı" });
      }

      const ogrenciResult = await pool.query("SELECT id FROM kullanicilar WHERE universite_kodu = $1 AND rol = 'ogrenci'", [universite_kodu]);
      if (ogrenciResult.rows.length === 0) {
        logger.warn("❌ Öğrenci bulunamadı", { universite_kodu, user_id: req.user?.id });
        return res.status(404).json({ mesaj: "Öğrenci bulunamadı veya rolü öğrenci değil" });
      }
      const ogrenci_id = ogrenciResult.rows[0].id;

      const check = await pool.query(
        "SELECT * FROM ders_kayitlari WHERE ders_id = $1 AND ogrenci_id = $2 AND alinma_tipi = $3",
        [ders_id, ogrenci_id, alinma_tipi]
      );
      if (check.rows.length > 0) {
        logger.warn("⚠️ Öğrenci zaten bu derse kayıtlı", { ders_id, ogrenci_id, alinma_tipi, user_id: req.user?.id });
        return res.status(409).json({ mesaj: "Öğrenci zaten bu derse kayıtlı" });
      }

      const { rows } = await pool.query(
        "INSERT INTO ders_kayitlari (ders_id, ogrenci_id, alinma_tipi) VALUES ($1, $2, $3) RETURNING *",
        [ders_id, ogrenci_id, alinma_tipi]
      );
      logger.info("✅ Öğrenci başarıyla derse kaydedildi", { ders_id, ogrenci_id, alinma_tipi, user_id: req.user?.id });
      res.status(201).json({ mesaj: "Öğrenci başarıyla derse kaydedildi", kayit: rows[0] });
    } catch (err) {
      logger.error("❌ Öğrenci ders kaydı hatası", { error: err.message, stack: err.stack, ders_id, universite_kodu, user_id: req.user?.id });
      next(err);
    }
  }
);
/**
 * @swagger
 * /api/ders/{dersId}/ogrenci-katilim-durumlari:
 *   get:
 *     summary: "Belirli bir derse kayıtlı öğrencilerin katılım durumlarını getirir"
 *     description: "Bu endpoint, belirtilen derse kayıtlı tüm öğrencilerin o ders için toplam katılım ve katılmama sayılarını döndürür. Öğretmen panelinde öğrenci listesinde gösterilmek üzere tasarlanmıştır."
 *     tags: [Ders, Öğrenci]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dersId
 *         required: true
 *         schema:
 *           type: integer
 *         description: "Katılım durumları getirilecek dersin ID'si"
 *     responses:
 *       200:
 *         description: "Öğrenci katılım durumları başarıyla getirildi"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ders_id:
 *                   type: integer
 *                   description: "Ders ID'si"
 *                 ders_adi:
 *                   type: string
 *                   description: "Ders adı"
 *                 toplam_oturum:
 *                   type: integer
 *                   description: "Ders için toplam oturum sayısı"
 *                 ogrenciler:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       ogrenci_id:
 *                         type: integer
 *                       universite_kodu:
 *                         type: string
 *                       ad:
 *                         type: string
 *                       soyad:
 *                         type: string
 *                       alinma_tipi:
 *                         type: string
 *                       katildigi_oturum:
 *                         type: integer
 *                         description: "Katıldığı oturum sayısı"
 *                       katilmadigi_oturum:
 *                         type: integer
 *                         description: "Katılmadığı oturum sayısı"
 *                       katilim_yuzdesi:
 *                         type: number
 *                         description: "Katılım yüzdesi"
 *       404:
 *         description: "Ders bulunamadı"
 *       500:
 *         description: "Sunucu hatası"
 */
router.get(
  "/:dersId/ogrenci-katilim-durumlari",
  dersYonetimiGerekli(),
  [
    param("dersId").isInt({ gt: 0 }).withMessage("Geçerli bir ders ID girilmelidir.")
  ],
  async (req, res, next) => {
    const { dersId } = req.params;
    logger.debug("🔍 Öğrenci katılım durumları isteği alındı", { user_id: req.user?.id, dersId });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), dersId, user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    try {
      // Önce dersin var olup olmadığını kontrol et
      const dersResult = await pool.query("SELECT id, ad FROM dersler WHERE id = $1", [dersId]);
      if (dersResult.rows.length === 0) {
        logger.warn("❌ Ders bulunamadı", { dersId, user_id: req.user?.id });
        return res.status(404).json({ mesaj: "Ders bulunamadı." });
      }
      const ders = dersResult.rows;

      // Ders için toplam oturum sayısını al
      const oturumResult = await pool.query("SELECT COUNT(*) as toplam_oturum FROM oturumlar WHERE ders_id = $1", [dersId]);
      const toplamOturum = parseInt(oturumResult.rows.toplam_oturum || 0);

      // Öğrenci katılım durumlarını hesapla
      const query = `
        SELECT 
          k.id AS ogrenci_id,
          k.universite_kodu,
          k.ad,
          k.soyad,
          dk.alinma_tipi,
          COUNT(o.id) AS toplam_oturum_sayisi,
          SUM(CASE WHEN y.durum IN ('katildi', 'gec_geldi') THEN 1 ELSE 0 END) AS katildigi_oturum,
          SUM(CASE WHEN y.durum = 'katilmadi' OR y.durum IS NULL THEN 1 ELSE 0 END) AS katilmadigi_oturum
        FROM kullanicilar k
        JOIN ders_kayitlari dk ON k.id = dk.ogrenci_id
        LEFT JOIN oturumlar o ON o.ders_id = dk.ders_id
        LEFT JOIN yoklamalar y ON y.oturum_id = o.id AND y.ogrenci_id = k.id
        WHERE dk.ders_id = $1 AND k.rol = 'ogrenci'
        GROUP BY k.id, k.universite_kodu, k.ad, k.soyad, dk.alinma_tipi
        ORDER BY k.soyad, k.ad
      `;

      const { rows: ogrenciler } = await pool.query(query, [dersId]);

      // Sonuçları formatla
      const formattedOgrenciler = ogrenciler.map(ogrenci => {
        const katildigiOturum = parseInt(ogrenci.katildigi_oturum || 0);
        const toplamOturumSayisi = parseInt(ogrenci.toplam_oturum_sayisi || 0);
        
        // Katılmadığı oturum sayısını toplamdan çıkararak bul
        const katilmadigiOturum = toplamOturumSayisi - katildigiOturum;
        
        const katilimYuzdesi = toplamOturumSayisi > 0 
          ? parseFloat(((katildigiOturum / toplamOturumSayisi) * 100).toFixed(2)) // 2 ondalık basamak
          : 0;

        return {
          ogrenci_id: ogrenci.ogrenci_id,
          universite_kodu: ogrenci.universite_kodu,
          ad: ogrenci.ad,
          soyad: ogrenci.soyad,
          alinma_tipi: ogrenci.alinma_tipi,
          katildigi_oturum: katildigiOturum,
          katilmadigi_oturum: katilmadigiOturum,
          katilim_yuzdesi: katilimYuzdesi
        };
      });

      // --- السطر الذي تم تصحيحه ---
      logger.info(`✅ ${formattedOgrenciler.length} öğrencinin katılım durumu getirildi`, { 
        dersId, 
        ders_adi: ders.ad, 
        toplam_oturum: toplamOturum,
        user_id: req.user?.id 
      });

      res.status(200).json({
        ders_id: ders.id,
        ders_adi: ders.ad,
        toplam_oturum: toplamOturum,
        ogrenciler: formattedOgrenciler
      });

    } catch (err) {
      logger.error("❌ Öğrenci katılım durumları getirme hatası", { 
        error: err.message, 
        stack: err.stack, 
        dersId, 
        user_id: req.user?.id 
      });
      next(err);
    }
  }
);


/**
 * @swagger
 * /api/ders/{dersId}/ogrenciler:
 *   delete:
 *     summary: "Bir derse kayıtlı tüm öğrencileri siler"
 *     tags: [Ders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dersId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Tüm öğrenciler dersten başarıyla silindi"
 */
router.delete(
  "/:dersId/ogrenciler",
  dersYonetimiGerekli(),
  [param("dersId").isInt()],
  async (req, res, next) => {
    logger.debug("🔍 Derse kayıtlı tüm öğrencileri silme isteği alındı", { ders_id: req.params.dersId, user_id: req.user?.id });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), ders_id: req.params.dersId, user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { dersId } = req.params;
    try {
      const result = await pool.query("DELETE FROM ders_kayitlari WHERE ders_id = $1", [dersId]);
      logger.info(`✅ Derse kayıtlı ${result.rowCount} öğrenci silindi`, { ders_id: dersId, user_id: req.user?.id });
      res.status(200).json({ mesaj: `Derse kayıtlı ${result.rowCount} öğrenci silindi.` });
    } catch (err) {
      logger.error("❌ Öğrencileri silme hatası", { error: err.message, stack: err.stack, ders_id: dersId, user_id: req.user?.id });
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/ders/{dersId}/ogrenciler:
 *   get:
 *     summary: "Bir derse kayıtlı öğrencileri listeler"
 *     tags: [Ders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dersId
 *         required: true
 *         schema:
 *           type: integer
 *         description: "Öğrencilerin listeleneceği dersin IDsi"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: "Sayfa numarası"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: "Sayfadaki öğrenci sayısı"
 *     responses:
 *       200:
 *         description: "Öğrenci listesi"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       ogrenci_id:
 *                         type: integer
 *                       universite_kodu:
 *                         type: string
 *                       ad:
 *                         type: string
 *                       soyad:
 *                         type: string
 *                       eposta:
 *                         type: string
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *       403:
 *         description: "Yetkisiz erişim"
 *       404:
 *         description: "Ders bulunamadı"
 */
router.get(
  "/:dersId/ogrenciler",
  dersYonetimiGerekli(),
  [
    param("dersId").isInt({ gt: 0 }).withMessage("Geçerli bir ders ID girilmelidir."),
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    query("search").optional().isString().trim(),
    query("alinma_tipi").optional().isString().trim(),
  ],
  async (req, res, next) => {
    logger.debug("🔍 Derse kayıtlı öğrencileri listeleme isteği alındı", { ders_id: req.params.dersId, user_id: req.user?.id, page: req.query.page, limit: req.query.limit });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), ders_id: req.params.dersId, user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { dersId } = req.params;
    const { page = 1, limit = 10, search, alinma_tipi } = req.query;
    const offset = (page - 1) * limit;

    try {
      let whereClauses = ["dk.ders_id = $1", "k.rol = 'ogrenci'"];
      const queryParams = [dersId];

      if (search) {
        queryParams.push(`%${search}%`);
        whereClauses.push(`(k.ad ILIKE $${queryParams.length} OR k.soyad ILIKE $${queryParams.length} OR k.universite_kodu ILIKE $${queryParams.length})`);
      }

      if (alinma_tipi) {
        queryParams.push(alinma_tipi);
        whereClauses.push(`dk.alinma_tipi = $${queryParams.length}`);
      }

      const whereString = whereClauses.join(" AND ");

      const dataQuery = `
        SELECT k.id AS ogrenci_id, k.universite_kodu, k.ad, k.soyad, k.eposta, dk.alinma_tipi
        FROM kullanicilar k
        JOIN ders_kayitlari dk ON k.id = dk.ogrenci_id
        WHERE ${whereString}
        ORDER BY k.soyad, k.ad
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `;
      
      const countQuery = `
        SELECT COUNT(*) FROM kullanicilar k
        JOIN ders_kayitlari dk ON k.id = dk.ogrenci_id
        WHERE ${whereString}
      `;

      const { rows } = await pool.query(dataQuery, [...queryParams, limit, offset]);
      const { rows: countRows } = await pool.query(countQuery, queryParams);
      
      logger.info(`✅ ${rows.length} öğrenci bulundu`, { ders_id: dersId, user_id: req.user?.id, total: countRows[0]?.count || 0 });
      res.json({
        data: rows,
        total: countRows[0] ? parseInt(countRows[0].count) : 0,
        page: parseInt(page),
        limit: parseInt(limit),
      });
    } catch (err) {
      logger.error("❌ Derse kayıtlı öğrencileri listeleme hatası", { error: err.message, stack: err.stack, ders_id: dersId, user_id: req.user?.id });
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/ders/{dersId}/import-students:
 *   post:
 *     summary: "Bir Excel dosyasından öğrencileri bir derse aktarır ve kaydeder"
 *     tags: [Ders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dersId
 *         required: true
 *         schema:
 *           type: integer
 *         description: "Öğrencilerin aktarılacağı dersin IDsi"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               excelFile:
 *                 type: string
 *                 format: binary
 *                 description: "Öğrenci listesini içeren Excel dosyası (.xlsx)"
 *     responses:
 *       200:
 *         description: "Öğrenci aktarımı tamamlandı"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ImportStudentResult"
 *       400:
 *         description: "Geçersiz istek (örn: dosya yok, Excel formatı yanlış, eksik sütunlar)"
 *       403:
 *         description: "Yetkisiz erişim"
 *       404:
 *         description: "Ders bulunamadı"
 */
router.post(
  "/:dersId/import-students",
  dersYonetimiGerekli(),
  upload.single("excelFile"),
  [
    param("dersId").isInt({ gt: 0 }).withMessage("Geçerli bir ders ID girilmelidir.")
  ],
  async (req, res, next) => {
    logger.debug("🔍 Öğrenci aktarma isteği alındı", { ders_id: req.params.dersId, user_id: req.user?.id });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), ders_id: req.params.dersId, user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    if (!req.file) {
      logger.warn("❌ Excel dosyası yüklenmedi", { ders_id: req.params.dersId, user_id: req.user?.id });
      return res.status(400).json({ mesaj: "Excel dosyası yüklenmedi." });
    }

    const { dersId } = req.params;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const dersExists = await client.query("SELECT id FROM dersler WHERE id = $1", [dersId]);
      if (dersExists.rows.length === 0) {
        logger.warn("❌ Ders bulunamadı", { ders_id: dersId, user_id: req.user?.id });
        await client.query('ROLLBACK');
        return res.status(404).json({ mesaj: "Ders bulunamadı" });
      }

      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const studentDataFromExcel = xlsx.utils.sheet_to_json(worksheet);

      if (studentDataFromExcel.length === 0) {
        logger.warn("❌ Excel dosyası boş", { ders_id: dersId, user_id: req.user?.id });
        await client.query('ROLLBACK');
        return res.status(400).json({ mesaj: "Excel dosyası boş." });
      }

      const firstRow = studentDataFromExcel[0];
      if (!firstRow.hasOwnProperty("Öğrenci No")) {
        logger.warn("❌ Excel dosyasında 'Öğrenci No' sütunu eksik", { ders_id: dersId, user_id: req.user?.id });
        await client.query('ROLLBACK');
        return res.status(400).json({ mesaj: "'Öğrenci No' sütunu eksik." });
      }

      let successfullyRegistered = 0;
      let alreadyRegisteredInCourse = 0;
      let newlyCreatedStudents = 0;
      const errorDetails = [];

      logger.info("📌 Öğrenci aktarımı başladı", { ders_id: dersId, total_rows: studentDataFromExcel.length, user_id: req.user?.id });

      for (let i = 0; i < studentDataFromExcel.length; i++) {
        const row = studentDataFromExcel[i];
        const universiteKodu = row["Öğrenci No"] ? String(row["Öğrenci No"]).trim() : null;
        
        logger.debug(`🔍 Satır ${i + 2} işleniyor`, { universite_kodu: universiteKodu, ders_id: dersId, user_id: req.user?.id });

        if (!universiteKodu) {
          logger.warn("⚠️ Öğrenci No boş", { row_number: i + 2, ders_id: dersId, user_id: req.user?.id });
          errorDetails.push({ row_number: i + 2, student_data: row, error: "'Öğrenci No' alanı boş." });
          continue;
        }

        const alinmaTipiRaw = row["Alış/Ö.Not"];
        logger.debug(`🔍 HAM DEĞER ('Alış/Ö.Not' sütunundan): ${alinmaTipiRaw}`, { row_number: i + 2, ders_id: dersId, user_id: req.user?.id });

        const alinmaTipiLower = alinmaTipiRaw ? String(alinmaTipiRaw).toLowerCase() : "zorunlu";
        logger.debug(`🔍 KÜÇÜK HARFE ÇEVRİLMİŞ DEĞER: ${alinmaTipiLower}`, { row_number: i + 2, ders_id: dersId, user_id: req.user?.id });

        let alinmaTipi = "zorunlu";
        if (alinmaTipiLower.includes("alttan")) {
          alinmaTipi = "alttan";
          logger.debug("🔍 KARAR: 'alttan' kelimesi bulundu. Sonuç: 'alttan'", { row_number: i + 2, ders_id: dersId, user_id: req.user?.id });
        } else if (alinmaTipiLower.includes("üsten")) {
          alinmaTipi = "üsten";
          logger.debug("🔍 KARAR: 'üsten' kelimesi bulundu. Sonuç: 'üsten'", { row_number: i + 2, ders_id: dersId, user_id: req.user?.id });
        } else {
          logger.debug("🔍 KARAR: 'alttan' veya 'üsten' bulunamadı. Sonuç 'zorunlu' olarak kaldı.", { row_number: i + 2, ders_id: dersId, user_id: req.user?.id });
        }

        logger.debug(`🔍 VERİTABANINA YAZILACAK NİHAİ DEĞER: ${alinmaTipi}`, { row_number: i + 2, ders_id: dersId, user_id: req.user?.id });

        try {
          let studentResult = await client.query("SELECT id FROM kullanicilar WHERE universite_kodu = $1", [universiteKodu]);
          let studentId;

          if (studentResult.rows.length === 0) {
            const adSoyad = row["Adı Soyadı"] ? String(row["Adı Soyadı"]).trim() : "Bilinmeyen Öğrenci";
            const [ad, ...soyadArr] = adSoyad.split(' ');
            const soyad = soyadArr.join(' ');
            const defaultPassword = await bcrypt.hash('P@ssword123', 10);

            const newStudentResult = await client.query(
              "INSERT INTO kullanicilar (universite_kodu, ad, soyad, sifre, rol) VALUES ($1, $2, $3, $4, 'ogrenci') RETURNING id",
              [universiteKodu, ad, soyad, defaultPassword]
            );
            studentId = newStudentResult.rows[0].id;
            newlyCreatedStudents++;
            logger.info("✅ Yeni öğrenci oluşturuldu", { universite_kodu: universiteKodu, student_id: studentId, ders_id: dersId, user_id: req.user?.id });
          } else {
            studentId = studentResult.rows[0].id;
          }

          const registrationCheck = await client.query(
            "SELECT id FROM ders_kayitlari WHERE ders_id = $1 AND ogrenci_id = $2",
            [dersId, studentId]
          );

          if (registrationCheck.rows.length > 0) {
            alreadyRegisteredInCourse++;
            logger.warn("⚠️ Öğrenci zaten derse kayıtlı", { universite_kodu: universiteKodu, ders_id: dersId, user_id: req.user?.id });
          } else {
            await client.query(
              "INSERT INTO ders_kayitlari (ders_id, ogrenci_id, alinma_tipi) VALUES ($1, $2, $3)",
              [dersId, studentId, alinmaTipi]
            );
            successfullyRegistered++;
            logger.info("✅ Öğrenci derse kaydedildi", { universite_kodu: universiteKodu, ders_id: dersId, alinma_tipi: alinmaTipi, user_id: req.user?.id });
          }
        } catch (dbError) {
          logger.error("❌ Veritabanı hatası", { error: dbError.message, stack: dbError.stack, universite_kodu: universiteKodu, row_number: i + 2, ders_id: dersId, user_id: req.user?.id });
          errorDetails.push({ row_number: i + 2, student_data: row, error: dbError.message });
        }
      }

      await client.query('COMMIT');
      logger.info("✅ Öğrenci aktarımı tamamlandı", { 
        ders_id: dersId, 
        total_rows: studentDataFromExcel.length, 
        successfully_registered: successfullyRegistered, 
        already_registered: alreadyRegisteredInCourse, 
        newly_created_students: newlyCreatedStudents, 
        errors: errorDetails.length, 
        user_id: req.user?.id 
      });
      res.status(200).json({
        mesaj: "Öğrenci aktarımı tamamlandı.",
        total_rows_in_excel: studentDataFromExcel.length,
        successfully_registered: successfullyRegistered,
        already_registered_in_course: alreadyRegisteredInCourse,
        newly_created_students: newlyCreatedStudents,
        errors: errorDetails
      });
    } catch (err) {
      logger.error("❌ Öğrenci aktarımı hatası", { error: err.message, stack: err.stack, ders_id: dersId, user_id: req.user?.id });
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

/**
 * @swagger
 * /api/ders/kayit-sil:
 *   delete:
 *     summary: "Bir öğrencinin ders kaydını siler"
 *     tags: [Ders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ders_id
 *               - ogrenci_id
 *             properties:
 *               ders_id:
 *                 type: integer
 *               ogrenci_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: "Öğrenci ders kaydından başarıyla silindi"
 *       400:
 *         description: "Geçersiz istek verisi"
 *       403:
 *         description: "Yetkisiz erişim"
 *       404:
 *         description: "Ders, öğrenci veya kayıt bulunamadı"
 */
router.delete(
  "/kayit-sil",
  dersYonetimiGerekli(),
  [
    body("ders_id").isInt({ gt: 0 }).withMessage("ders_id geçerli bir tamsayı olmalı"),
    body("ogrenci_id").isInt({ gt: 0 }).withMessage("ogrenci_id geçerli bir tamsayı olmalı")
  ],
  async (req, res, next) => {
    logger.debug("🔍 Öğrenci ders kaydı silme isteği alındı", { user_id: req.user?.id, body: req.body });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { ders_id, ogrenci_id } = req.body;
    try {
      const result = await pool.query(
        "DELETE FROM ders_kayitlari WHERE ders_id = $1 AND ogrenci_id = $2 RETURNING *",
        [ders_id, ogrenci_id]
      );
      if (result.rows.length === 0) {
        logger.warn("❌ Kayıt bulunamadı", { ders_id, ogrenci_id, user_id: req.user?.id });
        return res.status(404).json({ mesaj: "Kayıt bulunamadı" });
      }
      logger.info("✅ Öğrenci ders kaydından başarıyla silindi", { ders_id, ogrenci_id, user_id: req.user?.id });
      res.status(200).json({ mesaj: "Öğrenci ders kaydından başarıyla silindi" });
    } catch (err) {
      logger.error("❌ Öğrenci ders kaydı silme hatası", { error: err.message, stack: err.stack, ders_id, ogrenci_id, user_id: req.user?.id });
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/ders/{dersId}/ogrenci/{universiteKodu}:
 *   delete:
 *     summary: "Bir öğrencinin ders kaydını üniversite kodu ile siler"
 *     tags: [Ders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dersId
 *         required: true
 *         schema:
 *           type: integer
 *         description: "Ders ID"
 *       - in: path
 *         name: universiteKodu
 *         required: true
 *         schema:
 *           type: string
 *         description: "Öğrencinin üniversite kodu"
 *     responses:
 *       200:
 *         description: "Öğrenci ders kaydından başarıyla silindi"
 */
router.delete(
  "/:dersId/ogrenci/:universiteKodu",
  dersYonetimiGerekli(),
  [
    param("dersId").isInt({ gt: 0 }).withMessage("dersId geçerli bir tamsayı olmalı"),
    param("universiteKodu").notEmpty().withMessage("universiteKodu boş olamaz")
  ],
  async (req, res, next) => {
    const { dersId, universiteKodu } = req.params;
    logger.debug("🔍 Öğrenci ders kaydı (üniversite kodu ile) silme isteği alındı", { user_id: req.user?.id, dersId, universiteKodu });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    try {
      const ogrenciResult = await pool.query(
        "SELECT id FROM kullanicilar WHERE universite_kodu = $1 AND rol = 'ogrenci'",
        [universiteKodu]
      );

      if (ogrenciResult.rows.length === 0) {
        logger.warn("❌ Öğrenci bulunamadı", { universiteKodu, user_id: req.user?.id });
        return res.status(404).json({ mesaj: "Öğrenci bulunamadı" });
      }

      const ogrenciId = ogrenciResult.rows[0].id;
      const result = await pool.query(
        "DELETE FROM ders_kayitlari WHERE ders_id = $1 AND ogrenci_id = $2 RETURNING *",
        [dersId, ogrenciId]
      );

      if (result.rows.length === 0) {
        logger.warn("❌ Bu öğrenci bu derse kayıtlı değil", { dersId, ogrenciId, user_id: req.user?.id });
        return res.status(404).json({ mesaj: "Bu öğrenci bu derse kayıtlı değil" });
      }

      logger.info("✅ Öğrenci dersten başarıyla çıkarıldı", { dersId, ogrenciId, universiteKodu, user_id: req.user?.id });
      res.status(200).json({
        mesaj: `${universiteKodu} numaralı öğrenci dersten başarıyla çıkarıldı`,
        silinen_kayit: result.rows[0]
      });
    } catch (err) {
      logger.error("❌ Öğrenci silme hatası", { error: err.message, stack: err.stack, dersId, universiteKodu, user_id: req.user?.id });
      next(err);
    }
  }
);

// ------------------- Attendance Report Routes -------------------
/**
 * @swagger
 * /api/ders/{dersId}/yoklama-raporu:
 *   get:
 *     summary: "Belirli bir ders için kapsamlı yoklama raporu alır"
 *     tags: [Ders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dersId
 *         required: true
 *         schema:
 *           type: integer
 *         description: "Raporu alınacak dersin IDsi"
 *     responses:
 *       200:
 *         description: "Yoklama raporu başarıyla alındı"
 */
router.get(
  "/:dersId/yoklama-raporu",
  dersYonetimiGerekli(),
  [
    param("dersId").isInt({ gt: 0 }).withMessage("Geçerli bir ders ID girilmelidir.")
  ],
  async (req, res, next) => {
    const { dersId } = req.params;
    logger.debug("🔍 Yoklama raporu isteği alındı", { user_id: req.user?.id, dersId });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    try {
      const dersResult = await pool.query("SELECT id, ad, devamsizlik_limiti FROM dersler WHERE id = $1", [dersId]);
      if (dersResult.rows.length === 0) {
        logger.warn("❌ Ders bulunamadı", { dersId, user_id: req.user?.id });
        return res.status(404).json({ mesaj: "Ders bulunamadı." });
      }
      const ders = dersResult.rows[0];

      const raporQuery = `
        SELECT 
          k.id AS ogrenci_id,
          k.universite_kodu,
          k.ad,
          k.soyad,
          k.eposta,
          COUNT(o.id) AS toplam_oturum_sayisi,
          SUM(CASE WHEN y.durum IN ('katildi', 'gec_geldi') THEN 1 ELSE 0 END) AS katildi_kaydi,
          SUM(CASE WHEN y.durum = 'izinli' THEN 1 ELSE 0 END) AS izinli_kaydi,
          SUM(CASE WHEN y.durum = 'gec_geldi' THEN 1 ELSE 0 END) AS gec_gelme_kaydi
        FROM kullanicilar k
        JOIN ders_kayitlari dk ON k.id = dk.ogrenci_id
        LEFT JOIN oturumlar o ON o.ders_id = dk.ders_id
        LEFT JOIN yoklamalar y ON y.oturum_id = o.id AND y.ogrenci_id = k.id
        WHERE dk.ders_id = $1 AND k.rol = 'ogrenci'
        GROUP BY k.id, k.universite_kodu, k.ad, k.soyad, k.eposta
        ORDER BY k.soyad, k.ad
      `;
      const { rows: ogrenciler } = await pool.query(raporQuery, [dersId]);

       const raporOgrenciler = ogrenciler.map(ogrenci => {
        // --- بداية التعديل ---

        // 1. تحويل القيم المستلمة من قاعدة البيانات إلى أرقام صحيحة لضمان دقة الحسابات
        const toplamOturum = parseInt(ogrenci.toplam_oturum_sayisi, 10) || 0;
        const katildiKaydi = parseInt(ogrenci.katildi_kaydi, 10) || 0;
        const izinliKaydi = parseInt(ogrenci.izinli_kaydi, 10) || 0;
        const gecGelmeKaydi = parseInt(ogrenci.gec_gelme_kaydi, 10) || 0;

        // 2. حساب إجمالي الحضور (يشمل الحضور العادي، المتأخر، والإذن)
        // katildi_kaydi يحتوي بالفعل على gec_geldi، لذلك لا نحتاج لجمعه مرة أخرى.
        const toplamEtkinKatilim = katildiKaydi; // katildi_kaydi = katıldı + geç geldi

        // 3. حساب النسبة المئوية بشكل صحيح
        // (عدد مرات الحضور الفعلي / إجمالي عدد الجلسات) * 100
        const katilimYuzdesi = toplamOturum > 0 ? (toplamEtkinKatilim / toplamOturum) * 100 : 0;

        // 4. حساب عدد مرات الغياب
        const katilmadigi = Math.max(0, toplamOturum - toplamEtkinKatilim);
        
        // 5. حساب نسبة الغياب وتحديد الحالة (ناجح، راسب، على الحافة)
        const devamsizlikYuzdesi = 100 - katilimYuzdesi;
        let devamsizlikDurumu = "gecti";
        if (ders.devamsizlik_limiti !== null && devamsizlikYuzdesi > ders.devamsizlik_limiti) {
          devamsizlikDurumu = "kaldi";
        } else if (ders.devamsizlik_limiti !== null && devamsizlikYuzdesi > (ders.devamsizlik_limiti - 10) && devamsizlikYuzdesi <= ders.devamsizlik_limiti) {
          devamsizlikDurumu = "sinirda";
        }

        return {
          ogrenci_id: ogrenci.ogrenci_id,
          universite_kodu: ogrenci.universite_kodu,
          ad: ogrenci.ad,
          soyad: ogrenci.soyad,
          eposta: ogrenci.eposta,
          toplam_oturum_sayisi: toplamOturum,
          katildigi_oturum_sayisi: toplamEtkinKatilim, // <-- استخدام القيمة الصحيحة هنا
          katilmadigi_oturum_sayisi: katilmadigi,
          izinli_sayisi: izinliKaydi,
          gec_gelme_sayisi: gecGelmeKaydi,
          katilim_yuzdesi: parseFloat(katilimYuzdesi.toFixed(2)), // <-- استخدام النسبة الصحيحة هنا
          devamsizlik_durumu: devamsizlikDurumu
        };
      });

      logger.info("✅ Yoklama raporu başarıyla oluşturuldu", { dersId, ogrenci_sayisi: raporOgrenciler.length, user_id: req.user?.id });
      res.status(200).json({
        ders_id: ders.id,
        ders_adi: ders.ad,
        devamsizlik_limiti_yuzde: ders.devamsizlik_limiti,
        toplam_ders_oturumu: parseInt(ogrenciler[0]?.toplam_oturum_sayisi || 0),
        ogrenciler: raporOgrenciler
      });
    } catch (err) {
      logger.error("❌ Yoklama raporu oluşturma hatası", { error: err.message, stack: err.stack, dersId, user_id: req.user?.id });
      next(err);
    }
  }
);

router.get("/ogrenci-ders-raporu/:ogrenciId", sadeceOgrenci, async (req, res) => {
    const { ogrenciId } = req.params;
    logger.debug("🔍 Öğrenci ders raporu isteği alındı", { user_id: req.user?.id, ogrenciId });

    try {
        const query = `
            SELECT 
                d.id as ders_id,
                d.ad as ders_adi,
                (SELECT COUNT(*) FROM oturumlar o WHERE o.ders_id = d.id) as toplam_oturum,
                (SELECT COUNT(*) 
                 FROM yoklamalar y
                 JOIN oturumlar o ON y.oturum_id = o.id
                 WHERE o.ders_id = d.id AND y.ogrenci_id = $1 AND y.durum IN ('katildi', 'gec_geldi')) as katildigi_oturum
            FROM dersler d
            JOIN ders_kayitlari dk ON d.id = dk.ders_id
            WHERE dk.ogrenci_id = $1;
        `;

        const { rows } = await pool.query(query, [ogrenciId]);

        const report = rows.map(row => ({
            id: row.ders_id,
            ad: row.ders_adi,
            devamsizlik: parseInt(row.toplam_oturum) - parseInt(row.katildigi_oturum)
        }));

        logger.info("✅ Öğrenci ders raporu başarıyla oluşturuldu", { ogrenciId, ders_sayisi: report.length, user_id: req.user?.id });
        res.json(report);

    } catch (err) {
        logger.error("❌ Öğrenci ders raporu hatası", { error: err.message, stack: err.stack, ogrenciId, user_id: req.user?.id });
        res.status(500).json({ mesaj: "Rapor alınırken bir hata oluştu." });
    }
});

router.post(
  "/:dersId/haftalik-yoklama-guncelle",
  sadeceOgretmenVeAdmin,
  [
    param("dersId").isInt({ gt: 0 }).withMessage("Geçerli bir ders ID girilmelidir."),
    body("yuzde").isInt({ min: 0, max: 100 }).withMessage("Yüzde değeri 0-100 arasında olmalı"),
    body("oturumId").isInt({ gt: 0 }).withMessage("Geçerli bir oturum ID girilmelidir.")
  ],
  async (req, res, next) => {
    const { dersId } = req.params;
    const { yuzde, oturumId } = req.body;
    logger.debug("🔍 Haftalık yoklama güncelleme isteği alındı", { user_id: req.user?.id, dersId, yuzde, oturumId });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    try {
      const oturumlarRes = await pool.query(
        "SELECT id FROM oturumlar WHERE ders_id = $1 ORDER BY tarih, saat",
        [dersId]
      );
      
      if (oturumlarRes.rows.length === 0) {
        logger.warn("❌ Bu derse ait oturum bulunamadı", { dersId, user_id: req.user?.id });
        return res.status(404).json({ mesaj: "Bu derse ait oturum bulunamadı" });
      }

      const oturumlar = oturumlarRes.rows.map(row => row.id);
      const toplamOturum = oturumlar.length;
      const esik = Math.ceil((toplamOturum * yuzde) / 100);

      logger.info("📊 Haftalık yoklama hesaplama başladı", { dersId, toplamOturum, yuzde, esik, user_id: req.user?.id });

      const ogrencilerRes = await pool.query(
        "SELECT ogrenci_id FROM ders_kayitlari WHERE ders_id = $1",
        [dersId]
      );

      if (ogrencilerRes.rows.length === 0) {
        logger.warn("❌ Bu derse kayıtlı öğrenci bulunamadı", { dersId, user_id: req.user?.id });
        return res.status(404).json({ mesaj: "Bu derse kayıtlı öğrenci bulunamadı" });
      }

      const ogrenciler = ogrencilerRes.rows.map(row => row.ogrenci_id);
      let guncellenenOgrenci = 0;

      for (const ogrenciId of ogrenciler) {
        const katilimRes = await pool.query(`
          SELECT COUNT(DISTINCT oturum_id) as katildigi_oturum
          FROM yoklamalar 
          WHERE ogrenci_id = $1 
          AND oturum_id = ANY($2) 
          AND durum IN ('katildi', 'gec_geldi')
        `, [ogrenciId, oturumlar]);

        const katildigiOturum = parseInt(katilimRes.rows[0].katildigi_oturum);
        const yeniDurum = katildigiOturum >= esik ? 'katildi' : 'katilmadi';

        logger.debug(`🔄 Öğrenci ${ogrenciId}: ${katildigiOturum}/${toplamOturum} katıldı → ${yeniDurum}`, { dersId, user_id: req.user?.id });

        for (const oturumIdToUpdate of oturumlar) {
          const checkRes = await pool.query(
            'SELECT id FROM yoklamalar WHERE oturum_id = $1 AND ogrenci_id = $2',
            [oturumIdToUpdate, ogrenciId]
          );

          if (checkRes.rows.length > 0) {
            await pool.query(`
              UPDATE yoklamalar 
              SET durum = $1 
              WHERE oturum_id = $2 AND ogrenci_id = $3
            `, [yeniDurum, oturumIdToUpdate, ogrenciId]);
          } else {
            await pool.query(`
              INSERT INTO yoklamalar (oturum_id, ogrenci_id, durum, zaman, count)
              VALUES ($1, $2, $3, NOW(), 0)
            `, [oturumIdToUpdate, ogrenciId, yeniDurum]);
          }
        }
        guncellenenOgrenci++;
      }

      logger.info("✅ Haftalık yoklama başarıyla güncellendi", { dersId, toplamOturum, esik, guncellenenOgrenci, user_id: req.user?.id });
      res.status(200).json({ 
        mesaj: `Haftalık yoklama yüzdesi %${yuzde} olarak uygulandı`,
        toplamOturum: toplamOturum,
        esik: esik,
        guncellenenOgrenci: guncellenenOgrenci
      });

    } catch (err) {
      logger.error("❌ Haftalık yoklama güncelleme hatası", { error: err.message, stack: err.stack, dersId, user_id: req.user?.id });
      res.status(500).json({ 
        mesaj: "Sunucu hatası", 
        detay: err.message 
      });
    }
  }
);
/**
 * @swagger
 * /api/ders/get-by-ids:
 *   post:
 *     summary: "Belirtilen ID listesindeki derslerin detaylarını getirir"
 *     description: "Bu endpoint, bir ID dizisi alarak bu ID'lere karşılık gelen derslerin tam detaylarını (öğretmen adı, öğrenci sayısı, katılım oranı vb.) döndürür. Raporlama sayfaları için kullanılır."
 *     tags: [Ders, Rapor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: "Detayları getirilecek derslerin ID listesi"
 *                 example: [1, 2, 5]
 *     responses:
 *       200:
 *         description: "Derslerin detaylı listesi başarıyla getirildi"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   ders_adi:
 *                     type: string
 *                   kod:
 *                     type: string
 *                   katilim_orani:
 *                     type: number
 *                   toplam_ogrenci:
 *                     type: integer
 *                   ogretmen_adi:
 *                     type: string
 *                   ogretmen_soyadi:
 *                     type: string
 *       400:
 *         description: "Geçersiz istek (ID listesi boş veya format yanlış)"
 *       500:
 *         description: "Sunucu hatası"
 */
router.post(
  "/get-by-ids", // <-- مسار جديد ومخصص للمواد
  tumKayitliKullanicilar,
  [
    body("ids").isArray({ min: 1 }).withMessage("ID listesi boş olmamalıdır.")
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { ids } = req.body;
    try {
      const query = `
        SELECT 
          id, 
          ad as ders_adi, 
          kod,
          katilim_orani, 
          toplam_ogrenci, 
          ogretmen_adi, 
          ogretmen_soyadi
        FROM (
          SELECT
            d.id,
            d.ad,
            d.kod,
            k.ad as ogretmen_adi,
            k.soyad as ogretmen_soyadi,
            (SELECT COUNT(*) FROM ders_kayitlari dk WHERE dk.ders_id = d.id) as toplam_ogrenci,
            (
              SELECT AVG(session_data.attendance_percentage)
              FROM (
                SELECT
                  (COUNT(y.id) FILTER (WHERE y.durum IN ('katildi', 'gec_geldi')) * 100.0)
                  /
                  NULLIF((SELECT COUNT(*) FROM ders_kayitlari dk WHERE dk.ders_id = o.ders_id), 0)
                  AS attendance_percentage
                FROM oturumlar o
                LEFT JOIN yoklamalar y ON y.oturum_id = o.id
                WHERE o.ders_id = d.id
                GROUP BY o.id
              ) AS session_data
            ) AS katilim_orani
          FROM dersler d
          LEFT JOIN kullanicilar k ON d.ogretmen_id = k.id
        ) AS CourseAttendance
        WHERE id = ANY($1::int[]);
      `;

      const { rows } = await pool.query(query, [ids]);
      
      const formattedRows = rows.map(row => ({
        ...row,
        katilim_orani: Math.round(parseFloat(row.katilim_orani) || 0),
        toplam_ogrenci: parseInt(row.toplam_ogrenci, 10) || 0,
      }));

      res.status(200).json(formattedRows);
    } catch (err) {
      next(err);
    }
  }
);
/**
 * @swagger
 * /api/ders/over-absenteeism-students-count:
 *   get:
 *     summary: "Devamsızlık sınırını aşan öğrenci sayısını getirir"
 *     tags: [Dashboard, Rapor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Devamsızlık sınırını aşan öğrenci sayısını içeren nesne"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: "Devamsızlık sınırını aşan öğrenci sayısı"
 *       500:
 *         description: "Sunucu hatası"
 */
router.get("/over-absenteeism-students-count", sadeceOgretmenVeAdmin, async (req, res, next) => {
  logger.debug("🔍 Devamsızlık sınırını aşan öğrenci sayısı isteği alındı", { user_id: req.user?.id });

  try {
    const query = `
      WITH StudentAttendanceSummary AS (
        SELECT
          dk.ogrenci_id,
          d.id AS ders_id,
          d.devamsizlik_limiti,
          COUNT(o.id) AS toplam_oturum_sayisi,
          SUM(CASE WHEN y.durum IN ('katildi', 'gec_geldi') THEN 1 ELSE 0 END) AS katildigi_oturum_sayisi
        FROM ders_kayitlari dk
        JOIN dersler d ON dk.ders_id = d.id
        LEFT JOIN oturumlar o ON o.ders_id = d.id
        LEFT JOIN yoklamalar y ON y.oturum_id = o.id AND y.ogrenci_id = dk.ogrenci_id
        GROUP BY dk.ogrenci_id, d.id, d.devamsizlik_limiti
      ),
      StudentAbsenteeism AS (
        SELECT
          ogrenci_id,
          ders_id,
          devamsizlik_limiti,
          toplam_oturum_sayisi,
          katildigi_oturum_sayisi,
          -- Calculate absenteeism percentage
          CASE
            WHEN toplam_oturum_sayisi = 0 THEN 0 -- If no sessions, 0% absenteeism
            ELSE ( (toplam_oturum_sayisi - katildigi_oturum_sayisi) * 100.0 / toplam_oturum_sayisi )
          END AS devamsizlik_yuzdesi
        FROM StudentAttendanceSummary
      )
      SELECT
        COUNT(DISTINCT sa.ogrenci_id) AS over_absenteeism_students_count
      FROM StudentAbsenteeism sa
      WHERE sa.devamsizlik_yuzdesi > sa.devamsizlik_limiti;
    `;

    const { rows } = await pool.query(query);
    const count = parseInt(rows[0]?.over_absenteeism_students_count || 0);

    logger.info(`✅ Devamsızlık sınırını aşan ${count} öğrenci bulundu`, { user_id: req.user?.id });
    res.status(200).json({ count });
  } catch (err) {
    logger.error("❌ Devamsızlık sınırını aşan öğrenci sayısı getirme hatası", { error: err.message, stack: err.stack, user_id: req.user?.id });
    next(err);
  }
});
// ------------------- Error Handling Middleware -------------------
router.use((err, req, res, next) => {
  // استخدام logger هنا لتسجيل الأخطاء العامة
  logger.error("❌ Sunucuda genel bir hata oluştu", {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    user_id: req.user?.id
  });
  res.status(500).json({ mesaj: "Sunucuda bir hata oluştu", error: err.message });
});
// في ملف ders.js، يمكنك إضافته بعد المسار الذي يجلب العدد

/**
 * @swagger
 * /api/ders/over-absenteeism-students-list:
 *   get:
 *     summary: "Devamsızlık sınırını aşan öğrencilerin detaylı listesini getirir"
 *     tags: [Dashboard, Rapor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Öğrencilerin ve devamsızlık yaptıkları derslerin listesi"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   ogrenci_id:
 *                     type: integer
 *                   ogrenci_adi:
 *                     type: string
 *                   ogrenci_soyadi:
 *                     type: string
 *                   universite_kodu:
 *                     type: string
 *                   ders_adi:
 *                     type: string
 *                   devamsizlik_yuzdesi:
 *                     type: number
 *                   devamsizlik_limiti:
 *                     type: integer
 *       500:
 *         description: "Sunucu hatası"
 */
router.get("/over-absenteeism-students-list", sadeceOgretmenVeAdmin, async (req, res, next) => {
  logger.debug("🔍 Devamsızlık sınırını aşan öğrenci listesi isteği alındı", { user_id: req.user?.id });

  try {
    const query = `
      WITH StudentAttendanceSummary AS (
        SELECT
          dk.ogrenci_id,
          d.id AS ders_id,
          d.ad AS ders_adi,
          d.devamsizlik_limiti,
          COUNT(o.id) AS toplam_oturum_sayisi,
          SUM(CASE WHEN y.durum IN ('katildi', 'gec_geldi') THEN 1 ELSE 0 END) AS katildigi_oturum_sayisi
        FROM ders_kayitlari dk
        JOIN dersler d ON dk.ders_id = d.id
        LEFT JOIN oturumlar o ON o.ders_id = d.id
        LEFT JOIN yoklamalar y ON y.oturum_id = o.id AND y.ogrenci_id = dk.ogrenci_id
        GROUP BY dk.ogrenci_id, d.id, d.ad, d.devamsizlik_limiti
      ),
      StudentAbsenteeism AS (
        SELECT
          ogrenci_id,
          ders_id,
          ders_adi,
          devamsizlik_limiti,
          CASE
            WHEN toplam_oturum_sayisi = 0 THEN 0
            ELSE ( (toplam_oturum_sayisi - katildigi_oturum_sayisi) * 100.0 / toplam_oturum_sayisi )
          END AS devamsizlik_yuzdesi
        FROM StudentAttendanceSummary
      )
      SELECT
        sa.ogrenci_id,
        k.ad AS ogrenci_adi,
        k.soyad AS ogrenci_soyadi,
        k.universite_kodu,
        sa.ders_adi,
        sa.devamsizlik_limiti,
        ROUND(sa.devamsizlik_yuzdesi) AS devamsizlik_yuzdesi
      FROM StudentAbsenteeism sa
      JOIN kullanicilar k ON sa.ogrenci_id = k.id
      WHERE sa.devamsizlik_yuzdesi > sa.devamsizlik_limiti
      ORDER BY k.soyad, k.ad, sa.ders_adi;
    `;

    const { rows } = await pool.query(query);
    logger.info(`✅ Devamsızlık sınırını aşan ${rows.length} kayıt bulundu`, { user_id: req.user?.id });
    res.status(200).json(rows);
  } catch (err) {
    logger.error("❌ Devamsızlık sınırını aşan öğrenci listesi getirme hatası", { error: err.message, stack: err.stack, user_id: req.user?.id });
    next(err);
  }
});

module.exports = router;
