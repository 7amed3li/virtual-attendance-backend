const express = require("express");
const router = express.Router();
const pool = require("../config/veritabani");
const { query, param, validationResult } = require("express-validator");
const { sadeceAdmin } = require("../middleware/yetkiKontrol");
const verifyToken = require("../middleware/verifyToken");


const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient(); // Prisma Client'ı oluştur -ÖZGÜRCAN


const isAdmin = (req, res, next) => {
    if (req.user && req.user.rol === "admin") {
        next();
    } else {
        res.status(403).json({ mesaj: "Bu işlem için yetkiniz yok. Sadece adminler bu raporları görebilir." });
    }
};

/**
 * @swagger
 * tags:
 *   name: Raporlar
 *   description: Genel yoklama raporları ve istatistikleri
 */

/**
 * @swagger
 * /api/reports/university:
 *   get:
 *     summary: Üniversite genelinde yoklama istatistiklerini getirir.
 *     tags: [Raporlar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Rapor için başlangıç tarihi (YYYY-MM-DD).
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Rapor için bitiş tarihi (YYYY-MM-DD).
 *     responses:
 *       200:
 *         description: Üniversite geneli yoklama istatistikleri.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_katilim_orani:
 *                   type: number
 *                   format: float
 *                 fakulte_bazli_oranlar:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       fakulte_id:
 *                         type: integer
 *                       fakulte_adi:
 *                         type: string
 *                       katilim_orani:
 *                         type: number
 *                         format: float
 *       400:
 *         description: Geçersiz tarih formatı.
 *       403:
 *         description: Yetkisiz erişim.
 *       500:
 *         description: Sunucu hatası.
 */
router.get(
    "/university",
    isAdmin,
    [
        query("startDate").optional().isISO8601().toDate().withMessage("Başlangıç tarihi YYYY-MM-DD formatında olmalıdır."),
        query("endDate").optional().isISO8601().toDate().withMessage("Bitiş tarihi YYYY-MM-DD formatında olmalıdır.")
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ hatalar: errors.array() });
        }

        const { startDate, endDate } = req.query;
        let dateFilter = "";
        const queryParams = [];

        if (startDate && endDate) {
            dateFilter = "AND o.tarih BETWEEN $1 AND $2";
            queryParams.push(startDate, endDate);
        } else if (startDate) {
            dateFilter = "AND o.tarih >= $1";
            queryParams.push(startDate);
        } else if (endDate) {
            dateFilter = "AND o.tarih <= $1";
            queryParams.push(endDate);
        }

        try {
            // Genel katılım oranı
            const genelOranQuery = `
                SELECT 
                    CAST(SUM(CASE WHEN y.durum = 'katildi' OR y.durum = 'gec_geldi' THEN 1 ELSE 0 END) AS FLOAT) * 100.0 /
                    NULLIF(COUNT(y.id), 0) AS genel_katilim_orani
                FROM yoklamalar y
                JOIN oturumlar o ON y.oturum_id = o.id
                WHERE 1=1 ${dateFilter};
            `;
            const genelOranResult = await pool.query(genelOranQuery, queryParams);
            const genel_katilim_orani = genelOranResult.rows[0]?.genel_katilim_orani || 0;
                        // Toplam öğrenci sayısını çek
            const totalStudentsQuery = `
              SELECT COUNT(*) AS toplam_ogrenciler
              FROM kullanicilar 
              WHERE rol = 'ogrenci';
            `;
            const totalStudentsResult = await pool.query(totalStudentsQuery);
            const total_ogrenciler = parseInt(totalStudentsResult.rows[0]?.toplam_ogrenciler || 0);

            // Toplam ders sayısını çek
            const totalCoursesQuery = `
              SELECT COUNT(*) AS toplam_dersler
              FROM dersler;
            `;
            const totalCoursesResult = await pool.query(totalCoursesQuery);
            const total_dersler = parseInt(totalCoursesResult.rows[0]?.toplam_dersler || 0);

            // Tüm fakülteleri göster
           const fakulteBazliQuery = `
            SELECT 
                f.id AS fakulte_id,
                f.ad AS fakulte_adi,
                COALESCE(
                    (SELECT 
                        ROUND(CAST(SUM(CASE WHEN y2.durum = 'katildi' OR y2.durum = 'gec_geldi' THEN 1 ELSE 0 END) AS FLOAT) * 100.0 /
                        NULLIF(COUNT(y2.id), 0))
                     FROM yoklamalar y2
                     JOIN oturumlar o2 ON y2.oturum_id = o2.id
                     JOIN dersler d2 ON o2.ders_id = d2.id
                     JOIN bolumler b2 ON d2.bolum_id = b2.id
                     WHERE b2.fakulte_id = f.id ${dateFilter}
                    ), 0
                ) AS katilim_orani
            FROM fakulteler f
            ORDER BY f.ad;
        `;

            const fakulteBazliResult = await pool.query(fakulteBazliQuery, queryParams);

            res.status(200).json({
            total_katilim_orani: parseFloat(genel_katilim_orani.toFixed(2)),
            total_ogrenciler,
            total_dersler,
            total_fakulteler: fakulteBazliResult.rows.length,
            fakulte_bazli_oranlar: fakulteBazliResult.rows.map(row => ({
                ...row,
                katilim_orani: parseFloat(row.katilim_orani.toFixed(2))
            }))
        });


        } catch (err) {
            console.error("Üniversite raporu hatası:", err);
            next(err);
        }
    }
);

/**
 * @swagger
 * /api/reports/faculty/{facultyId}:
 *   get:
 *     summary: Belirli bir fakültenin yoklama istatistiklerini getirir.
 *     tags: [Raporlar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: facultyId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Fakülte IDsi.
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Rapor için başlangıç tarihi (YYYY-MM-DD).
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Rapor için bitiş tarihi (YYYY-MM-DD).
 *     responses:
 *       200:
 *         description: Fakülte yoklama istatistikleri.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 fakulte_adi:
 *                   type: string
 *                 total_katilim_orani:
 *                   type: number
 *                   format: float
 *                 bolum_bazli_oranlar:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       bolum_id:
 *                         type: integer
 *                       bolum_adi:
 *                         type: string
 *                       katilim_orani:
 *                         type: number
 *                         format: float
 *       400:
 *         description: Geçersiz ID veya tarih formatı.
 *       403:
 *         description: Yetkisiz erişim.
 *       404:
 *         description: Fakülte bulunamadı.
 *       500:
 *         description: Sunucu hatası.
 */
router.get(
    "/faculty/:facultyId",
    isAdmin,
    [
        param("facultyId").isInt({ gt: 0 }).withMessage("Fakülte ID geçerli bir tamsayı olmalıdır."),
        query("startDate").optional().isISO8601().toDate().withMessage("Başlangıç tarihi YYYY-MM-DD formatında olmalıdır."),
        query("endDate").optional().isISO8601().toDate().withMessage("Bitiş tarihi YYYY-MM-DD formatında olmalıdır.")
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ hatalar: errors.array() });
        }

        const { facultyId } = req.params;
        const { startDate, endDate } = req.query;
        let dateFilter = "";
        const queryParams = [facultyId];
        let paramCounter = 2;

        if (startDate && endDate) {
            dateFilter = `AND o.tarih BETWEEN $${paramCounter++} AND $${paramCounter++}`;
            queryParams.push(startDate, endDate);
        } else if (startDate) {
            dateFilter = `AND o.tarih >= $${paramCounter++}`;
            queryParams.push(startDate);
        } else if (endDate) {
            dateFilter = `AND o.tarih <= $${paramCounter++}`;
            queryParams.push(endDate);
        }

        try {
            const fakulteCheck = await pool.query("SELECT ad FROM fakulteler WHERE id = $1", [facultyId]);
            if (fakulteCheck.rows.length === 0) {
                return res.status(404).json({ mesaj: "Fakülte bulunamadı." });
            }
            const fakulte_adi = fakulteCheck.rows[0].ad; // تم تعديل هذا السطر

            const genelOranQuery = `
                SELECT 
                    CAST(SUM(CASE WHEN y.durum = 'katildi' OR y.durum = 'gec_geldi' THEN 1 ELSE 0 END) AS FLOAT) * 100.0 /
                    NULLIF(COUNT(y.id), 0) AS genel_katilim_orani
                FROM yoklamalar y
                JOIN oturumlar o ON y.oturum_id = o.id
                JOIN dersler d ON o.ders_id = d.id
                JOIN bolumler b ON d.bolum_id = b.id
                WHERE b.fakulte_id = $1 ${dateFilter};
            `;

            const genelOranResult = await pool.query(genelOranQuery, queryParams);
            const genel_katilim_orani = genelOranResult.rows[0]?.genel_katilim_orani || 0;

            const bolumBazliQuery = `
                SELECT 
                    b.id AS bolum_id,
                    b.ad AS bolum_adi,
                    CAST(SUM(CASE WHEN y.durum = 'katildi' OR y.durum = 'gec_geldi' THEN 1 ELSE 0 END) AS FLOAT) * 100.0 /
                    NULLIF(COUNT(y.id), 0) AS katilim_orani
                FROM yoklamalar y
                JOIN oturumlar o ON y.oturum_id = o.id
                JOIN dersler d ON o.ders_id = d.id
                JOIN bolumler b ON d.bolum_id = b.id
                WHERE b.fakulte_id = $1 ${dateFilter}
                GROUP BY b.id, b.ad
                ORDER BY b.ad;

            `;
            const bolumBazliResult = await pool.query(bolumBazliQuery, queryParams);

            res.status(200).json({
                fakulte_adi,
                total_katilim_orani: parseFloat(genel_katilim_orani.toFixed(2)),
                bolum_bazli_oranlar: bolumBazliResult.rows.map(row => ({
                    ...row,
                    katilim_orani: parseFloat(row.katilim_orani.toFixed(2))
                }))
            });

        } catch (err) {
            console.error(`Fakülte ${facultyId} raporu hatası:`, err);
            next(err);
        }
    }
);
// Ana Panel için yeni route
/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: Genel dashboard istatistiklerini getirir.
 *     tags: [Raporlar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Rapor için başlangıç tarihi (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Rapor için bitiş tarihi (YYYY-MM-DD)
 *       - in: query
 *         name: facultyId
 *         schema:
 *           type: integer
 *         description: Fakülte ID'si
 *     responses:
 *       200:
 *         description: Başarılı, dashboard verileri döndürülür.
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
 *                 activeCourses:
 *                   type: integer
 *                 activeStudents:
 *                   type: integer
 *                 totalFaculties:
 *                   type: integer
 *                 facultyCourses:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Yetkilendirme hatası
 *       500:
 *         description: Sunucu hatası
 */

router.get("/dashboard", verifyToken, isAdmin, async (req, res) => {
  try {
    const { startDate, endDate, facultyId } = req.query;

    const buildFilters = (tableAlias) => {
      let filterClause = "WHERE 1=1";
      const params = [];
      let paramCounter = 1;

      if (facultyId) {
        filterClause += ` AND f.id = $${paramCounter++}`;
        params.push(facultyId);
      }

      if (startDate && endDate) {
        filterClause += ` AND ${tableAlias}.tarih BETWEEN $${paramCounter++} AND $${paramCounter++}`;
        params.push(startDate, endDate);
      } else if (startDate) {
        filterClause += ` AND ${tableAlias}.tarih >= $${paramCounter++}`;
        params.push(startDate);
      } else if (endDate) {
        filterClause += ` AND ${tableAlias}.tarih <= $${paramCounter++}`;
        params.push(endDate);
      }
      return { filterClause, params };
    };

    let studentCountQuery;
    let studentCountParams = [];
    if (facultyId) {
      studentCountQuery = `
        SELECT COUNT(DISTINCT k.id) 
        FROM kullanicilar k 
        JOIN ders_kayitlari dk ON k.id = dk.ogrenci_id 
        JOIN dersler d ON dk.ders_id = d.id 
        JOIN bolumler b ON d.bolum_id = b.id 
        JOIN fakulteler f ON b.fakulte_id = f.id 
        WHERE k.rol = 'ogrenci' AND k.hesap_durumu = 'aktif' AND f.id = $1`;
      studentCountParams.push(facultyId);
    } else {
      studentCountQuery = `
        SELECT COUNT(*) 
        FROM kullanicilar 
        WHERE rol = 'ogrenci' AND hesap_durumu = 'aktif'`;
    }
    const studentCountResult = await pool.query(studentCountQuery, studentCountParams);

    let courseCountQuery;
    let courseCountParams = [];
    if (facultyId) {
      courseCountQuery = `
        SELECT COUNT(DISTINCT d.id) 
        FROM dersler d 
        JOIN bolumler b ON d.bolum_id = b.id 
        JOIN fakulteler f ON b.fakulte_id = f.id 
        WHERE f.id = $1`;
      courseCountParams.push(facultyId);
    } else {
      courseCountQuery = "SELECT COUNT(*) FROM dersler";
    }
    const courseCountResult = await pool.query(courseCountQuery, courseCountParams);

    const sessionFilters = buildFilters("o");
    const attendanceFilters = buildFilters("o");

    const sessionCountQuery = `
      SELECT COUNT(*) 
      FROM oturumlar o 
      LEFT JOIN dersler d ON o.ders_id = d.id 
      LEFT JOIN bolumler b ON d.bolum_id = b.id 
      LEFT JOIN fakulteler f ON b.fakulte_id = f.id 
      ${sessionFilters.filterClause}`;
    const sessionCountResult = await pool.query(sessionCountQuery, sessionFilters.params);

    const attendanceRateQuery = `
      SELECT AVG(CASE WHEN y.durum = 'katildi' THEN 1 ELSE 0 END) * 100 as average_attendance
      FROM yoklamalar y
      JOIN oturumlar o ON y.oturum_id = o.id
      LEFT JOIN dersler d ON o.ders_id = d.id
      LEFT JOIN bolumler b ON d.bolum_id = b.id
      LEFT JOIN fakulteler f ON b.fakulte_id = f.id
      ${attendanceFilters.filterClause}`;
    const attendanceRateResult = await pool.query(attendanceRateQuery, attendanceFilters.params);

    const facultyCountResult = await pool.query("SELECT COUNT(*) FROM fakulteler");

    const facultyCourseResult = await pool.query(
      `SELECT f.id as fakulte_id, f.ad as fakulte_adi, COUNT(d.id) as ders_sayisi
       FROM fakulteler f
       LEFT JOIN bolumler b ON b.fakulte_id = f.id
       LEFT JOIN dersler d ON d.bolum_id = b.id
       GROUP BY f.id, f.ad`
    );

    let activeCoursesResult, activeStudentsResult;
    const intervalSeconds = endDate && startDate ? Math.floor((new Date(endDate) - new Date(startDate)) / 1000) : 86400;

    let activeCoursesQuery = `
      SELECT COUNT(DISTINCT o.ders_id) as active_courses
      FROM oturumlar o
      WHERE o.olusturma_tarihi >= NOW() - INTERVAL '${intervalSeconds} seconds'`;
    let activeStudentsQuery = `
      SELECT COUNT(DISTINCT y.ogrenci_id) as active_students
      FROM yoklamalar y
      WHERE y.zaman >= NOW() - INTERVAL '${intervalSeconds} seconds'`;

    if (facultyId) {
      activeCoursesQuery = `
        SELECT COUNT(DISTINCT o.ders_id) as active_courses
        FROM oturumlar o
        JOIN dersler d ON o.ders_id = d.id
        JOIN bolumler b ON d.bolum_id = b.id
        JOIN fakulteler f ON b.fakulte_id = f.id
        WHERE f.id = $1 AND o.olusturma_tarihi >= NOW() - INTERVAL '${intervalSeconds} seconds'`;
      activeStudentsQuery = `
        SELECT COUNT(DISTINCT y.ogrenci_id) as active_students
        FROM yoklamalar y
        JOIN oturumlar o ON y.oturum_id = o.id
        JOIN dersler d ON o.ders_id = d.id
        JOIN bolumler b ON d.bolum_id = b.id
        JOIN fakulteler f ON b.fakulte_id = f.id
        WHERE f.id = $1 AND y.zaman >= NOW() - INTERVAL '${intervalSeconds} seconds'`;
    }

    activeCoursesResult = await pool.query(activeCoursesQuery, facultyId ? [facultyId] : []);
    activeStudentsResult = await pool.query(activeStudentsQuery, facultyId ? [facultyId] : []);

    const totalStudents = parseInt(studentCountResult.rows[0].count, 10);
    const totalCourses = parseInt(courseCountResult.rows[0].count, 10);
    const totalSessions = parseInt(sessionCountResult.rows[0].count, 10);
    const averageAttendance = attendanceRateResult.rows[0].average_attendance ? parseFloat(attendanceRateResult.rows[0].average_attendance) : 0;
    const totalFaculties = parseInt(facultyCountResult.rows[0].count, 10);
    const facultyCourses = facultyCourseResult.rows.map(row => ({
      fakulte_id: row.fakulte_id,
      fakulte_adi: row.fakulte_adi,
      ders_sayisi: parseInt(row.ders_sayisi, 10)
    }));

    res.json({
      totalStudents,
      totalCourses,
      totalSessions,
      averageAttendance,
      activeCourses: parseInt(activeCoursesResult.rows[0].active_courses, 10),
      activeStudents: parseInt(activeStudentsResult.rows[0].active_students, 10),
      totalFaculties,
      facultyCourses
    });

  } catch (err) {
    console.error('Error while generating dashboard stats:', err.message);
    res.status(500).json({ message: 'Dashboard istatistikleri oluşturulurken bir sunucu hatası oluştu.' });
  }
});

// Dashboard için yeni endpoint'ler

// Son aktiviteleri getir (son oturumlar + yoklamalar)
router.get('/recent-activities', verifyToken, isAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        // Son oturumları çek
        const recentSessionsQuery = `
            SELECT 
                o.id,
                o.tarih,
                o.saat,
                o.konu,
                d.ad as ders_adi,
                k.ad as ogretmen_adi,
                k.soyad as ogretmen_soyadi,
                COUNT(y.id) as katilim_sayisi,
                'session' as type
            FROM oturumlar o
            LEFT JOIN dersler d ON o.ders_id = d.id
            LEFT JOIN kullanicilar k ON d.ogretmen_id = k.id
            LEFT JOIN yoklamalar y ON o.id = y.oturum_id AND y.durum = 'katildi'
            WHERE o.tarih >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY o.id, d.ad, k.ad, k.soyad
            ORDER BY o.tarih DESC, o.saat DESC
            LIMIT $1`;
        
        const sessionsResult = await pool.query(recentSessionsQuery, [limit]);
        
        // Son yoklamaları çek
        const recentAttendanceQuery = `
            SELECT 
                y.id,
                y.zaman,
                y.durum,
                k.ad as ogrenci_adi,
                k.soyad as ogrenci_soyadi,
                d.ad as ders_adi,
                'attendance' as type
            FROM yoklamalar y
            LEFT JOIN kullanicilar k ON y.ogrenci_id = k.id
            LEFT JOIN oturumlar o ON y.oturum_id = o.id
            LEFT JOIN dersler d ON o.ders_id = d.id
            WHERE y.zaman >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
            ORDER BY y.zaman DESC
            LIMIT $1`;
        
        const attendanceResult = await pool.query(recentAttendanceQuery, [limit]);
        
        res.json({
            sessions: sessionsResult.rows,
            attendance: attendanceResult.rows
        });
        
    } catch (err) {
        console.error('Recent activities hatası:', err.message);
        res.status(500).json({ message: 'Recent activities alınırken hata oluştu.' });
    }
});

// Düşük katılımlı dersleri getir
router.get('/low-attendance-courses', verifyToken, isAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const threshold = parseInt(req.query.threshold) || 50; // %50'nin altı
        
        const query = `
            WITH ders_istatistikleri AS (
                SELECT 
                    d.id,
                    d.ad as ders_adi,
                    k.ad as ogretmen_adi,
                    k.soyad as ogretmen_soyadi,
                    COUNT(DISTINCT o.id) as toplam_oturum,
                    COUNT(DISTINCT dk.ogrenci_id) as toplam_ogrenci,
                    COUNT(CASE WHEN y.durum = 'katildi' THEN 1 END) as toplam_katilim,
                    CASE 
                        WHEN COUNT(DISTINCT o.id) > 0 AND COUNT(DISTINCT dk.ogrenci_id) > 0 
                        THEN ROUND(
                            (COUNT(CASE WHEN y.durum = 'katildi' THEN 1 END)::decimal / 
                            (COUNT(DISTINCT o.id) * COUNT(DISTINCT dk.ogrenci_id))) * 100, 2
                        )
                        ELSE 0 
                    END as katilim_orani
                FROM dersler d
                LEFT JOIN kullanicilar k ON d.ogretmen_id = k.id
                LEFT JOIN oturumlar o ON d.id = o.ders_id
                LEFT JOIN ders_kayitlari dk ON d.id = dk.ders_id
                LEFT JOIN yoklamalar y ON o.id = y.oturum_id AND y.ogrenci_id = dk.ogrenci_id
                WHERE o.tarih >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY d.id, d.ad, k.ad, k.soyad
                HAVING COUNT(DISTINCT o.id) > 0
            )
            SELECT * FROM ders_istatistikleri 
            WHERE katilim_orani < $1
            ORDER BY katilim_orani ASC
            LIMIT $2`;
        
        const result = await pool.query(query, [threshold, limit]);
        
        res.json(result.rows);
        
    } catch (err) {
        console.error('Low attendance courses hatası:', err.message);
        res.status(500).json({ message: 'Düşük katılımlı dersler alınırken hata oluştu.' });
    }
});

// En performanslı dersleri getir
router.get('/top-performing-courses', verifyToken, isAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const threshold = parseInt(req.query.threshold) || 75; // %75'in üstü
        
        const query = `
            WITH ders_istatistikleri AS (
                SELECT 
                    d.id,
                    d.ad as ders_adi,
                    k.ad as ogretmen_adi,
                    k.soyad as ogretmen_soyadi,
                    COUNT(DISTINCT o.id) as toplam_oturum,
                    COUNT(DISTINCT dk.ogrenci_id) as toplam_ogrenci,
                    COUNT(CASE WHEN y.durum = 'katildi' THEN 1 END) as toplam_katilim,
                    CASE 
                        WHEN COUNT(DISTINCT o.id) > 0 AND COUNT(DISTINCT dk.ogrenci_id) > 0 
                        THEN ROUND(
                            (COUNT(CASE WHEN y.durum = 'katildi' THEN 1 END)::decimal / 
                            (COUNT(DISTINCT o.id) * COUNT(DISTINCT dk.ogrenci_id))) * 100, 2
                        )
                        ELSE 0 
                    END as katilim_orani
                FROM dersler d
                LEFT JOIN kullanicilar k ON d.ogretmen_id = k.id
                LEFT JOIN oturumlar o ON d.id = o.ders_id
                LEFT JOIN ders_kayitlari dk ON d.id = dk.ders_id
                LEFT JOIN yoklamalar y ON o.id = y.oturum_id AND y.ogrenci_id = dk.ogrenci_id
                WHERE o.tarih >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY d.id, d.ad, k.ad, k.soyad
                HAVING COUNT(DISTINCT o.id) > 0
            )
            SELECT * FROM ders_istatistikleri 
            WHERE katilim_orani >= $1
            ORDER BY katilim_orani DESC
            LIMIT $2`;
        
        const result = await pool.query(query, [threshold, limit]);
        
        res.json(result.rows);
        
    } catch (err) {
        console.error('Top performing courses hatası:', err.message);
        res.status(500).json({ message: 'En performanslı dersler alınırken hata oluştu.' });
    }
});

/**
 * @swagger
 * /api/reports/department/{departmentId}:
 *   get:
 *     summary: Belirli bir bölümün ders bazlı yoklama istatistiklerini getirir.
 *     tags: [Raporlar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Bölüm ID'si.
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Başlangıç tarihi (YYYY-MM-DD).
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Bitiş tarihi (YYYY-MM-DD).
 *     responses:
 *       200:
 *         description: Ders bazlı yoklama verileri.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   ders_id:
 *                     type: integer
 *                   ders_adi:
 *                     type: string
 *                   toplam_yoklama:
 *                     type: integer
 *                   katilim_orani:
 *                     type: number
 *                     format: float
 *       400:
 *         description: Geçersiz istek.
 *       403:
 *         description: Yetkisiz erişim.
 *       500:
 *         description: Sunucu hatası.
 */

router.get(
  "/department/:departmentId",
  isAdmin,
  [
    param("departmentId").isInt({ gt: 0 }).withMessage("Geçerli bölüm ID girin."),
    query("startDate").optional().isISO8601().toDate(),
    query("endDate").optional().isISO8601().toDate()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { departmentId } = req.params;
    const { startDate, endDate } = req.query;

    let dateFilter = "";
    const queryParams = [departmentId];
    let paramCounter = 2;

    if (startDate && endDate) {
      dateFilter = `AND o.tarih BETWEEN $${paramCounter++} AND $${paramCounter++}`;
      queryParams.push(startDate, endDate);
    } else if (startDate) {
      dateFilter = `AND o.tarih >= $${paramCounter++}`;
      queryParams.push(startDate);
    } else if (endDate) {
      dateFilter = `AND o.tarih <= $${paramCounter++}`;
      queryParams.push(endDate);
    }

    try {
      const dersQuery = `
       SELECT 
        d.id AS ders_id,
        d.ad AS ders_adi,
        COUNT(DISTINCT dk.ogrenci_id) AS toplam_ogrenci,
        COUNT(y.id) AS toplam_yoklama,
        COALESCE(
            CAST(SUM(CASE WHEN y.durum = 'katildi' OR y.durum = 'gec_geldi' THEN 1 ELSE 0 END) AS FLOAT) * 100.0 /
            NULLIF(COUNT(y.id), 0), 0
        ) AS katilim_orani
        FROM dersler d
        LEFT JOIN oturumlar o ON o.ders_id = d.id
        LEFT JOIN yoklamalar y ON y.oturum_id = o.id
        LEFT JOIN ders_kayitlari dk ON dk.ders_id = d.id
        WHERE d.bolum_id = $1 ${dateFilter}
        GROUP BY d.id, d.ad
        ORDER BY d.ad

      `;

      const dersResult = await pool.query(dersQuery, queryParams);

      res.status(200).json(
        dersResult.rows.map(row => ({
          ...row,
          toplam_ogrenci: parseInt(row.toplam_ogrenci),
          toplam_yoklama: parseInt(row.toplam_yoklama),
          katilim_orani: parseFloat(row.katilim_orani.toFixed(2))
        }))
      );
    } catch (err) {
      console.error("Bölüm dersi rapor hatası:", err);
      next(err);
    }
  }
);


module.exports = router;

