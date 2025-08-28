// Ders.js
console.log("Ders.js dosyası yüklendi:", new Date().toISOString());

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
    
    res.json({ courses: coursesWithStatus });
    
  } catch (err) {
    console.error("Bugünün derslerini getirme hatası:", err);
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
router.get("/dashboard-stats", sadeceOgretmenVeAdmin, async (req, res, next) => {
  try {
    const { facultyId, startDate, endDate } = req.query;

    let courseWhereClause = "";
    let sessionWhereClause = "";
    const params = [];

    if (facultyId) {
      params.push(parseInt(facultyId));
      const facultyParamIndex = `$${params.length}`;
      courseWhereClause += ` AND b.fakulte_id = ${facultyParamIndex}`;
      sessionWhereClause += ` AND o.ders_id IN (SELECT id FROM dersler d JOIN bolumler b ON d.bolum_id = b.id WHERE b.fakulte_id = ${facultyParamIndex})`;
    }

    if (startDate && endDate) {
      params.push(startDate, endDate);
      const startDateParamIndex = `$${params.length - 1}`;
      const endDateParamIndex = `$${params.length}`;
      sessionWhereClause += ` AND o.tarih BETWEEN ${startDateParamIndex} AND ${endDateParamIndex}`;
    }

    const [
      totalStudentsResult,
      totalCoursesResult,
      totalSessionsResult,
      averageAttendanceResult,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM kullanicilar WHERE rol = 'ogrenci'`),
      pool.query(
        `SELECT COUNT(d.id) FROM dersler d LEFT JOIN bolumler b ON d.bolum_id = b.id WHERE 1=1 ${courseWhereClause}`,
        facultyId ? [parseInt(facultyId)] : []
      ),
      pool.query(
        `SELECT COUNT(o.id) FROM oturumlar o WHERE 1=1 ${sessionWhereClause.replace('o.ders_id IN (SELECT id FROM dersler d JOIN bolumler b ON d.bolum_id = b.id WHERE b.fakulte_id = $1)', '1=1')}`, // Avoid double faculty filter
        params.filter(p => typeof p !== 'number') // Remove facultyId from params for this query
      ),
      pool.query(
        `WITH session_attendance AS (
          SELECT 
            o.id as oturum_id,
            (
              COUNT(y.id) FILTER (WHERE y.durum IN ('katildi', 'gec_geldi')) * 100.0 
              / 
              NULLIF((SELECT COUNT(*) FROM ders_kayitlari dk WHERE dk.ders_id = o.ders_id), 0)
            ) as attendance_percentage
          FROM oturumlar o
          LEFT JOIN yoklamalar y ON y.oturum_id = o.id
          WHERE 1=1 ${sessionWhereClause}
          GROUP BY o.id
        )
        SELECT AVG(attendance_percentage) as average_attendance FROM session_attendance WHERE attendance_percentage IS NOT NULL`,
        params
      ),
    ]);

    const stats = {
      totalStudents: parseInt(totalStudentsResult.rows[0].count || 0),
      totalCourses: parseInt(totalCoursesResult.rows[0].count || 0),
      totalSessions: parseInt(totalSessionsResult.rows[0].count || 0),
      averageAttendance: Math.round(parseFloat(averageAttendanceResult.rows[0]?.average_attendance || 0)),
    };

    res.status(200).json(stats);
  } catch (err) {
    console.error("Dashboard istatistikleri hatası:", err);
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
  try {
    const query = `
      SELECT id, ad as ders_adi, katilim_orani, toplam_ogrenci, ogretmen_adi, ogretmen_soyadi
      FROM (
        SELECT
          d.id,
          d.ad,
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
      WHERE katilim_orani IS NOT NULL AND katilim_orani < 50
      ORDER BY katilim_orani ASC
      LIMIT 5;
    `;

    const { rows } = await pool.query(query);
    res.status(200).json(rows);
  } catch (err) {
    console.error("[API ERROR] /low-attendance-courses:", err);
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
  try {
    // استعلام مشابه لـ low-attendance ولكن بترتيب عكسي
    const query = `
      SELECT id, ad as ders_adi, katilim_orani
      FROM (
        SELECT
          d.id,
          d.ad,
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
      ) AS CourseAttendance
      WHERE katilim_orani IS NOT NULL
      ORDER BY katilim_orani DESC
      LIMIT 5;
    `;
    const { rows } = await pool.query(query);
    res.status(200).json(rows);
  } catch (err) {
    console.error("[API ERROR] /top-performing-courses:", err);
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
router.get("/recent-activities", sadeceOgretmenVeAdmin, async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
            SELECT o.*, d.ad as ders_adi 
            FROM oturumlar o
            JOIN dersler d ON o.ders_id = d.id
            ORDER BY o.tarih DESC, o.saat DESC 
            LIMIT 5
        `);
        res.json(rows);
    } catch (err) {
        console.error("Son aktiviteleri getirme hatası:", err);
        next(err);
    }
});

// ------------------- Course Management Routes -------------------
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ hatalar: errors.array() });

    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    try {
      if (!req.user || !req.user.id || !Number.isInteger(req.user.id)) {
        return res.status(401).json({ mesaj: "Geçersiz kullanıcı bilgisi" });
      }

      let query = `
        SELECT 
          d.*,
          COALESCE(COUNT(dk.ogrenci_id), 0) as ogrenci_sayisi
        FROM dersler d
        LEFT JOIN ders_kayitlari dk ON d.id = dk.ders_id
      `;
      let countQuery = "SELECT COUNT(*) FROM dersler";
      const params = [];

      if (req.user.rol === "ogretmen") {
        query += " WHERE d.ogretmen_id = $1";
        countQuery += " WHERE ogretmen_id = $1";
        params.push(req.user.id);
      }

      query += " GROUP BY d.id";
      const limitParamIndex = params.length + 1;
      const offsetParamIndex = params.length + 2;
      query += ` ORDER BY d.id ASC LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;
      params.push(limit, offset);

      const { rows } = await pool.query(query, params);
      const { rows: countRows } = await pool.query(countQuery, req.user.rol === "ogretmen" ? [req.user.id] : []);

      res.json({
        data: rows,
        total: countRows[0] ? parseInt(countRows[0].count || 0) : 0,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    } catch (err) {
      console.error("Hata:", err);
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
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
        return res.status(404).json({ mesaj: "Ders bulunamadı." });
      }
      res.json(rows[0]);
    } catch (err) {
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
    body("sinif").optional().isString().isLength({ max: 10 }).withMessage("Sınıf en fazla 10 karakter olmalı"),
    body("sube").optional().isString().isLength({ max: 10 }).withMessage("Şube en fazla 10 karakter olmalı"),
    body("ders_saat").optional().isInt({ min: 0, max: 23 }).withMessage("Ders saati 0-23 arasında olmalı")
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ hatalar: errors.array() });

    const { ad, kod, bolum_id, ogretmen_id, donem, akademik_yil, devamsizlik_limiti = 30, sinif = null, sube = null, ders_saat = null } = req.body;

    try {
      const { rows } = await pool.query(
        `INSERT INTO dersler (ad, kod, bolum_id, ogretmen_id, donem, akademik_yil, devamsizlik_limiti, sinif, sube, ders_saat)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [ad, kod, bolum_id, ogretmen_id, donem, akademik_yil, devamsizlik_limiti, sinif, sube, ders_saat]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error("Ders ekleme hatası:", err);
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
    body("sube").optional().isString().isLength({ max: 10 }).withMessage("Şube en fazla 10 karakter olmalı")
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { id } = req.params;
    const { ad, kod, bolum_id, ogretmen_id, donem, akademik_yil, devamsizlik_limiti, sinif, sube, ders_saat } = req.body;

    try {
      const currentDers = await pool.query("SELECT * FROM dersler WHERE id = $1", [id]);
      if (currentDers.rows.length === 0) {
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
      if (updateFields.length === 0) {
        return res.status(400).json({ mesaj: "Güncellenecek alan yok" });
      }
      updateValues.push(id);
      const { rows } = await pool.query(
        `UPDATE dersler SET ${updateFields.join(", ")} WHERE id = $${queryIndex} RETURNING *`,
        updateValues
      );
      res.status(200).json(rows[0]);
    } catch (err) {
      console.error("Ders güncelleme hatası:", err);
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { id } = req.params;

    try {
      const result = await pool.query("DELETE FROM dersler WHERE id = $1 RETURNING *", [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ mesaj: "Ders bulunamadı" });
      }
      res.status(200).json({ mesaj: `Ders (ID: ${id}) başarıyla silindi.` });
    } catch (err) {
      console.error("Ders silme hatası:", err);
      if (err.code === "23503") {
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ hatalar: errors.array() });

    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    try {
      if (!req.user || !req.user.id || !Number.isInteger(req.user.id)) {
        return res.status(401).json({ mesaj: "Geçersiz kullanıcı bilgisi" });
      }

      const query = `
        SELECT d.*
        FROM dersler d
        JOIN ders_kayitlari dk ON d.id = dk.ders_id
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
      const { rows } = await pool.query(query, [req.user.id, limit, offset]);
      const { rows: countRows } = await pool.query(countQuery, [req.user.id]);

      res.json({
        data: rows,
        total: countRows[0] ? parseInt(countRows[0].count || 0) : 0,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    } catch (err) {
      console.error("Hata:", err);
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ hatalar: errors.array() });

    const { ders_id, universite_kodu, alinma_tipi } = req.body;
    try {
      const dersExists = await pool.query("SELECT id FROM dersler WHERE id = $1", [ders_id]);
      if (dersExists.rows.length === 0) return res.status(404).json({ mesaj: "Ders bulunamadı" });

      const ogrenciResult = await pool.query("SELECT id FROM kullanicilar WHERE universite_kodu = $1 AND rol = 'ogrenci'", [universite_kodu]);
      if (ogrenciResult.rows.length === 0) return res.status(404).json({ mesaj: "Öğrenci bulunamadı veya rolü öğrenci değil" });
      const ogrenci_id = ogrenciResult.rows[0].id;

      const check = await pool.query(
        "SELECT * FROM ders_kayitlari WHERE ders_id = $1 AND ogrenci_id = $2 AND alinma_tipi = $3",
        [ders_id, ogrenci_id, alinma_tipi]
      );
      if (check.rows.length > 0) return res.status(409).json({ mesaj: "Öğrenci zaten bu derse kayıtlı" });

      const { rows } = await pool.query(
        "INSERT INTO ders_kayitlari (ders_id, ogrenci_id, alinma_tipi) VALUES ($1, $2, $3) RETURNING *",
        [ders_id, ogrenci_id, alinma_tipi]
      );
      res.status(201).json({ mesaj: "Öğrenci başarıyla derse kaydedildi", kayit: rows[0] });
    } catch (err) {
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
    query("page").optional().isInt({ min: 1 }).toInt().withMessage("Page tamsayı ve 1'den büyük olmalı"),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt().withMessage("Limit 1-100 arasında olmalı")
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ hatalar: errors.array() });

    const { dersId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    try {
      const query = `
        SELECT k.id AS ogrenci_id, k.universite_kodu, k.ad, k.soyad, k.eposta, dk.alinma_tipi, dk.devamsizlik_durum
        FROM kullanicilar k
        JOIN ders_kayitlari dk ON k.id = dk.ogrenci_id
        WHERE dk.ders_id = $1 AND k.rol = 'ogrenci'
        ORDER BY k.soyad, k.ad
        LIMIT $2 OFFSET $3
      `;
      const countQuery = `
        SELECT COUNT(*) FROM kullanicilar k
        JOIN ders_kayitlari dk ON k.id = dk.ogrenci_id
        WHERE dk.ders_id = $1 AND k.rol = 'ogrenci'
      `;
      const { rows } = await pool.query(query, [dersId, limit, offset]);
      const { rows: countRows } = await pool.query(countQuery, [dersId]);
      res.json({
        data: rows,
        total: countRows[0] ? parseInt(countRows[0].count) : 0,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    } catch (err) {
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ hatalar: errors.array() });
    }

    if (!req.file) {
      return res.status(400).json({ mesaj: "Excel dosyası yüklenmedi." });
    }

    const { dersId } = req.params;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const dersExists = await client.query("SELECT id FROM dersler WHERE id = $1", [dersId]);
      if (dersExists.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ mesaj: "Ders bulunamadı." });
      }

      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawRows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
      let headerRowIndex = -1;
      let headerRow = [];

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (Array.isArray(row)) {
          const hasOgrenciNo = row.some(cell => cell && String(cell).includes("Öğrenci"));
          const hasAdSoyad = row.some(cell => cell && String(cell).includes("Adı") && String(cell).includes("Soyadı"));
          const hasAlinma = row.some(cell => cell && String(cell).includes("Alış") || String(cell).includes("Ö.Not"));
          if (hasOgrenciNo && hasAdSoyad && hasAlinma) {
            headerRowIndex = i;
            headerRow = row;
            break;
          }
        }
      }

      let studentDataFromExcel = [];
      if (headerRowIndex !== -1) {
        for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (Array.isArray(row)) {
            const noIdx = headerRow.findIndex(cell => cell && String(cell).includes("Öğrenci"));
            const adSoyadIdx = headerRow.findIndex(cell => cell && String(cell).includes("Adı") && String(cell).includes("Soyadı"));
            const alinmaIdx = headerRow.findIndex(cell => cell && (String(cell).includes("Alış") || String(cell).includes("Ö.Not")));
            const devamsizlikIdx = headerRow.findIndex(cell => cell && String(cell).includes("Dvmsz"));

            const universite_kodu = row[noIdx] ? String(row[noIdx]).trim() : null;
            const ad_soyad = row[adSoyadIdx] ? String(row[adSoyadIdx]).trim() : null;
            const alinma_tipi_raw = row[alinmaIdx] ? String(row[alinmaIdx]).trim() : null;
            const devamsizlik_durum = row[devamsizlikIdx] ? String(row[devamsizlikIdx]).trim() : null;

            let alinma_tipi = "zorunlu";
            if (alinma_tipi_raw) {
              if (alinma_tipi_raw.toLowerCase().includes("alttan")) {
                alinma_tipi = "alttan";
              } else if (alinma_tipi_raw.toLowerCase().includes("üsten")) {
                alinma_tipi = "üsten";
              } else if (alinma_tipi_raw.toLowerCase().includes("zorunlu")) {
                alinma_tipi = "zorunlu";
              }
            }

            if (universite_kodu) {
              studentDataFromExcel.push({
                universite_kodu,
                ad_soyad,
                alinma_tipi,
                devamsizlik_durum
              });
            }
          }
        }
      } else {
        studentDataFromExcel = xlsx.utils.sheet_to_json(worksheet);
        if (studentDataFromExcel.length > 0) {
          const expectedColumns = ["universite_kodu"];
          const firstRowCheck = studentDataFromExcel[0];
          for (const col of expectedColumns) {
            if (!Object.prototype.hasOwnProperty.call(firstRowCheck, col)) {
              await client.query('ROLLBACK');
              return res.status(400).json({
                mesaj: `Excel dosyasında beklenen sütunlar eksik. Olması gerekenler: ${expectedColumns.join(", ")}. Bulunanlar: ${Object.keys(firstRowCheck).join(", ")}`
              });
            }
          }
        }
      }

      if (studentDataFromExcel.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ mesaj: "Excel dosyası boş veya veri okunamadı." });
      }

      let successfullyRegistered = 0;
      let alreadyRegisteredInCourse = 0;
      const errorDetails = [];
      for (let i = 0; i < studentDataFromExcel.length; i++) {
        const row = studentDataFromExcel[i];
        const universiteKodu = row.universite_kodu ? String(row.universite_kodu).trim() : null;
        const alinmaTipi = row.alinma_tipi || "zorunlu";
        const devamsizlikDurum = row.devamsizlik_durum ? String(row.devamsizlik_durum).trim() : null;

        if (!universiteKodu) {
          errorDetails.push({ row_number: i + 2, student_data: row, error: "universite_kodu (veya Öğrenci No) alanı zorunludur." });
          continue;
        }

        try {
          let studentResult = await client.query("SELECT id FROM kullanicilar WHERE universite_kodu = $1", [universiteKodu]);
          let studentId;
          if (studentResult.rows.length === 0) {
            errorDetails.push({ row_number: i + 2, student_data: row, error: "Öğrenci bulunamadı. (Ad ve soyad zorunlu değil, yeni öğrenci oluşturulmaz)" });
            continue;
          } else {
            studentId = studentResult.rows[0].id;
          }

          const registrationCheck = await client.query(
            "SELECT id FROM ders_kayitlari WHERE ders_id = $1 AND ogrenci_id = $2",
            [dersId, studentId]
          );
          if (registrationCheck.rows.length > 0) {
            alreadyRegisteredInCourse++;
          } else {
            await client.query(
              "INSERT INTO ders_kayitlari (ders_id, ogrenci_id, alinma_tipi, devamsizlik_durum) VALUES ($1, $2, $3, $4)",
              [dersId, studentId, alinmaTipi, devamsizlikDurum ? [devamsizlikDurum] : []]
            );
            successfullyRegistered++;
          }
        } catch (dbError) {
          console.error(`Error processing student ${universiteKodu}:`, dbError);
          errorDetails.push({ row_number: i + 2, student_data: row, error: dbError.message });
        }
      }

      await client.query('COMMIT');
      res.status(200).json({
        mesaj: "Öğrenci aktarımı tamamlandı.",
        total_rows_in_excel: studentDataFromExcel.length,
        successfully_registered: successfullyRegistered,
        already_registered_in_course: alreadyRegisteredInCourse,
        errors: errorDetails
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error("Öğrenci aktarım hatası:", err);
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { ders_id, ogrenci_id } = req.body;
    try {
      const result = await pool.query(
        "DELETE FROM ders_kayitlari WHERE ders_id = $1 AND ogrenci_id = $2 RETURNING *",
        [ders_id, ogrenci_id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ mesaj: "Kayıt bulunamadı" });
      }
      res.status(200).json({ mesaj: "Öğrenci ders kaydından başarıyla silindi" });
    } catch (err) {
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
 *       400:
 *         description: "Geçersiz istek verisi"
 *       403:
 *         description: "Yetkisiz erişim"
 *       404:
 *         description: "Ders, öğrenci veya kayıt bulunamadı"
 */
router.delete(
  "/:dersId/ogrenci/:universiteKodu",
  dersYonetimiGerekli(),
  [
    param("dersId").isInt({ gt: 0 }).withMessage("dersId geçerli bir tamsayı olmalı"),
    param("universiteKodu").notEmpty().withMessage("universiteKodu boş olamaz")
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { dersId, universiteKodu } = req.params;
    try {
      const ogrenciResult = await pool.query(
        "SELECT id FROM kullanicilar WHERE universite_kodu = $1 AND rol = 'ogrenci'",
        [universiteKodu]
      );

      if (ogrenciResult.rows.length === 0) {
        return res.status(404).json({ mesaj: "Öğrenci bulunamadı" });
      }

      const ogrenciId = ogrenciResult.rows[0].id;
      const result = await pool.query(
        "DELETE FROM ders_kayitlari WHERE ders_id = $1 AND ogrenci_id = $2 RETURNING *",
        [dersId, ogrenciId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ mesaj: "Bu öğrenci bu derse kayıtlı değil" });
      }

      res.status(200).json({
        mesaj: `${universiteKodu} numaralı öğrenci dersten başarıyla çıkarıldı`,
        silinen_kayit: result.rows[0]
      });
    } catch (err) {
      console.error("Öğrenci silme hatası:", err);
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/YoklamaRaporu"
 *       403:
 *         description: "Yetkisiz erişim"
 *       404:
 *         description: "Ders bulunamadı"
 */
router.get(
  "/:dersId/yoklama-raporu",
  dersYonetimiGerekli(),
  [
    param("dersId").isInt({ gt: 0 }).withMessage("Geçerli bir ders ID girilmelidir.")
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ hatalar: errors.array() });
    }
    const { dersId } = req.params;

    try {
      const dersResult = await pool.query("SELECT id, ad, devamsizlik_limiti FROM dersler WHERE id = $1", [dersId]);
      if (dersResult.rows.length === 0) {
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
        const sadeceKatildi = ogrenci.katildi_kaydi - ogrenci.gec_gelme_kaydi;
        const toplamKatilim = ogrenci.katildi_kaydi + ogrenci.izinli_kaydi;
        const katilmadigi = Math.max(0, ogrenci.toplam_oturum_sayisi - toplamKatilim);

        const katilimYuzdesi = ogrenci.toplam_oturum_sayisi > 0 ? (toplamKatilim / ogrenci.toplam_oturum_sayisi) * 100 : 100;
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
          toplam_oturum_sayisi: parseInt(ogrenci.toplam_oturum_sayisi),
          katildigi_oturum_sayisi: sadeceKatildi,
          katilmadigi_oturum_sayisi: katilmadigi,
          izinli_sayisi: ogrenci.izinli_kaydi,
          gec_gelme_sayisi: ogrenci.gec_gelme_kaydi,
          katilim_yuzdesi: parseFloat(katilimYuzdesi.toFixed(2)),
          devamsizlik_durumu: devamsizlikDurumu
        };
      });

      res.status(200).json({
        ders_id: ders.id,
        ders_adi: ders.ad,
        devamsizlik_limiti_yuzde: ders.devamsizlik_limiti,
        toplam_ders_oturumu: parseInt(ogrenciler[0]?.toplam_oturum_sayisi || 0),
        ogrenciler: raporOgrenciler
      });
    } catch (err) {
      console.error("Yoklama raporu oluşturma hatası:", err);
      next(err);
    }
  }
);


// ------------------- Error Handling Middleware -------------------
router.use((err, req, res, next) => {
  console.error("Hata:", err);
  res.status(500).json({ mesaj: "Sunucuda bir hata oluştu", error: err.message });
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
  try {
    console.log("\n--- [BACKEND] Request received for /top-performing-courses ---");
    
    const query = `
      SELECT id, ad as ders_adi, katilim_orani
      FROM (
        SELECT
          d.id,
          d.ad,
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
      ) AS CourseAttendance
      WHERE katilim_orani IS NOT NULL
      ORDER BY katilim_orani DESC
      LIMIT 5;
    `;
    
    console.log("[BACKEND] Executing SQL query...");
    const { rows } = await pool.query(query);
    
    console.log(`[BACKEND] SQL query successful. Found ${rows.length} rows.`);
    console.log("[BACKEND] Sending data to frontend:", rows);
    
    res.status(200).json(rows);

  } catch (err) {
    console.error("[BACKEND] CATCH BLOCK: API ERROR in /top-performing-courses:", err);
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
router.get("/recent-activities", sadeceOgretmenVeAdmin, async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
            SELECT o.*, d.ad as ders_adi 
            FROM oturumlar o
            JOIN dersler d ON o.ders_id = d.id
            ORDER BY o.tarih DESC, o.saat DESC 
            LIMIT 5
        `);
        res.json(rows);
    } catch (err) {
        console.error("Son aktiviteleri getirme hatası:", err);
        next(err);
    }
});

module.exports = router;