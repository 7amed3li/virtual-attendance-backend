const express = require("express");
const router = express.Router();
const pool = require("../config/veritabani");
const { query, param, body, validationResult } = require("express-validator");
const { sadeceAdmin, sadeceOgretmenVeAdmin } = require("../middleware/yetkiKontrol");
const verifyToken = require("../middleware/verifyToken");
const logger = require('../utils/logger'); // إضافة استيراد logger

const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient();

const isAdmin = (req, res, next) => {
    logger.debug('🔍 Admin yetki kontrolü yapılıyor', { user_id: req.user?.id, rol: req.user?.rol });
    if (req.user && req.user.rol === "admin") {
        logger.debug('Kullanıcı admin, erişim izni verildi', { user_id: req.user?.id });
        next();
    } else {
        logger.warn('❌ Yetkisiz erişim: Admin yetkisi gerekiyor', { user_id: req.user?.id, rol: req.user?.rol });
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
        logger.debug('🔍 Üniversite genel rapor isteği alındı', { start_date: req.query.startDate, end_date: req.query.endDate, user_id: req.user?.id });
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('❌ Doğrulama hatası', { errors: errors.array(), start_date: req.query.startDate, end_date: req.query.endDate, user_id: req.user?.id });
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
            logger.debug('Genel katılım oranı hesaplanıyor', { start_date: startDate, end_date: endDate, user_id: req.user?.id });
            // Genel katılım oranı
            const genelOranQuery = `
                    WITH SessionAttendance AS (
                        SELECT
                            o.id AS oturum_id,
                            o.ders_id,
                            -- عدد الحضور الفعلي في كل جلسة
                            COUNT(y.id) FILTER (WHERE y.durum IN ('katildi', 'gec_geldi')) AS attended_count,
                            -- العدد الإجمالي للطلاب المسجلين في المادة لهذه الجلسة
                            (SELECT COUNT(dk.ogrenci_id) FROM ders_kayitlari dk WHERE dk.ders_id = o.ders_id) AS total_registered
                        FROM oturumlar o
                        LEFT JOIN yoklamalar y ON o.id = y.oturum_id
                        WHERE 1=1 ${dateFilter} -- تطبيق فلاتر التاريخ هنا
                        GROUP BY o.id, o.ders_id
                    )
                    SELECT
                        -- حساب متوسط النسب المئوية لجميع الجلسات
                        AVG(CASE
                            WHEN sa.total_registered > 0 THEN (sa.attended_count::FLOAT * 100.0 / sa.total_registered::FLOAT)
                            ELSE 0
                        END) AS genel_katilim_orani
                    FROM SessionAttendance sa;
                `;
            const genelOranResult = await pool.query(genelOranQuery, queryParams);
            const genel_katilim_orani = genelOranResult.rows[0]?.genel_katilim_orani || 0;

            logger.debug('Toplam öğrenci sayısı hesaplanıyor', { user_id: req.user?.id });
            // Toplam öğrenci sayısını çek
            const totalStudentsQuery = `
              SELECT COUNT(*) AS toplam_ogrenciler
              FROM kullanicilar 
              WHERE rol = 'ogrenci';
            `;
            const totalStudentsResult = await pool.query(totalStudentsQuery);
            const total_ogrenciler = parseInt(totalStudentsResult.rows[0]?.toplam_ogrenciler || 0);

            logger.debug('Toplam ders sayısı hesaplanıyor', { user_id: req.user?.id });
            // Toplam ders sayısını çek
            const totalCoursesQuery = `
              SELECT COUNT(*) AS toplam_dersler
              FROM dersler;
            `;
            const totalCoursesResult = await pool.query(totalCoursesQuery);
            const total_dersler = parseInt(totalCoursesResult.rows[0]?.toplam_dersler || 0);

            logger.debug('Fakülte bazlı oranlar hesaplanıyor', { start_date: startDate, end_date: endDate, user_id: req.user?.id });
            // Tüm fakülteleri göster
           const fakulteBazliQuery = `
            SELECT
                f.id AS fakulte_id,
                f.ad AS fakulte_adi,
                COALESCE(
                    (CAST(SUM(CASE WHEN y.durum IN ('katildi', 'gec_geldi') THEN 1 ELSE 0 END) AS FLOAT) * 100.0) /
                    NULLIF(CAST(COUNT(DISTINCT dk.ogrenci_id) AS FLOAT) * CAST(COUNT(DISTINCT o.id) AS FLOAT), 0),
                0) AS katilim_orani
            FROM fakulteler f
            LEFT JOIN bolumler b ON b.fakulte_id = f.id
            LEFT JOIN dersler d ON d.bolum_id = b.id
            LEFT JOIN ders_kayitlari dk ON dk.ders_id = d.id
            LEFT JOIN oturumlar o ON o.ders_id = d.id ${dateFilter.replace('AND o.tarih', 'AND o.tarih')}
            LEFT JOIN yoklamalar y ON y.oturum_id = o.id AND y.ogrenci_id = dk.ogrenci_id
            GROUP BY f.id, f.ad
            ORDER BY f.ad;
            `;
            const fakulteBazliResult = await pool.query(fakulteBazliQuery, queryParams);

            logger.info('✅ Üniversite genel raporu başarıyla oluşturuldu', { total_katilim_orani: genel_katilim_orani, fakulte_sayisi: fakulteBazliResult.rows.length, user_id: req.user?.id });
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
            logger.error('❌ Üniversite raporu hatası', { error: err.message, stack: err.stack, start_date: startDate, end_date: endDate, user_id: req.user?.id });
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
        logger.debug('🔍 Fakülte raporu isteği alındı', { faculty_id: req.params.facultyId, start_date: req.query.startDate, end_date: req.query.endDate, user_id: req.user?.id });
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('❌ Doğrulama hatası', { errors: errors.array(), faculty_id: req.params.facultyId, user_id: req.user?.id });
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
            logger.debug('Fakülte varlığı kontrol ediliyor', { faculty_id: facultyId, user_id: req.user?.id });
            const fakulteCheck = await pool.query("SELECT ad FROM fakulteler WHERE id = $1", [facultyId]);
            if (fakulteCheck.rows.length === 0) {
                logger.warn('❌ Fakülte bulunamadı', { faculty_id: facultyId, user_id: req.user?.id });
                return res.status(404).json({ mesaj: "Fakülte bulunamadı." });
            }
            const fakulte_adi = fakulteCheck.rows[0].ad;

            logger.debug('Genel katılım oranı hesaplanıyor', { faculty_id: facultyId, start_date: startDate, end_date: endDate, user_id: req.user?.id });
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

            logger.debug('Bölüm bazlı oranlar hesaplanıyor', { faculty_id: facultyId, start_date: startDate, end_date: endDate, user_id: req.user?.id });
            const bolumBazliQuery = `
            SELECT
                b.id AS bolum_id,
                b.ad AS bolum_adi,
                COALESCE(
                    (CAST(SUM(CASE WHEN y.durum IN ('katildi', 'gec_geldi') THEN 1 ELSE 0 END) AS FLOAT) * 100.0) /
                    NULLIF(CAST(COUNT(DISTINCT dk.ogrenci_id) AS FLOAT) * CAST(COUNT(DISTINCT o.id) AS FLOAT), 0),
                0) AS katilim_orani
            FROM bolumler b
            LEFT JOIN dersler d ON d.bolum_id = b.id
            LEFT JOIN ders_kayitlari dk ON dk.ders_id = d.id
            LEFT JOIN oturumlar o ON o.ders_id = d.id ${dateFilter.replace('AND o.tarih', 'AND o.tarih')}
            LEFT JOIN yoklamalar y ON y.oturum_id = o.id AND y.ogrenci_id = dk.ogrenci_id
            WHERE b.fakulte_id = $1
            GROUP BY b.id, b.ad
            ORDER BY b.ad;
            `;


            const bolumBazliResult = await pool.query(bolumBazliQuery, queryParams);

            logger.info('✅ Fakülte raporu başarıyla oluşturuldu', { faculty_id: facultyId, fakulte_adi, bolum_sayisi: bolumBazliResult.rows.length, user_id: req.user?.id });
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
            logger.error('❌ Fakülte raporu hatası', { error: err.message, stack: err.stack, faculty_id: facultyId, start_date: startDate, end_date: endDate, user_id: req.user?.id });
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
    logger.debug('🔍 Dashboard istatistik isteği alındı', { query: req.query, user_id: req.user?.id });
    try {
        const { startDate, endDate, facultyId } = req.query;

        // --- 1. بناء جملة WHERE والـ Parameters بشكل ديناميكي ---
        const whereClauses = [];
        const queryParams = [];
        let paramIndex = 1;

        if (facultyId) {
            whereClauses.push(`f.id = $${paramIndex++}`);
            queryParams.push(facultyId);
        }
        if (startDate) {
            // نستخدم ::date للتأكد من أننا نقارن التواريخ فقط
            whereClauses.push(`o.tarih::date >= $${paramIndex++}`);
            queryParams.push(startDate);
        }
        if (endDate) {
            whereClauses.push(`o.tarih::date <= $${paramIndex++}`);
            queryParams.push(endDate);
        }

        const mainWhereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // --- 2. تنفيذ جميع الاستعلامات بشكل متوازٍ لتحسين الأداء ---
        const [
            studentCountResult,
            courseCountResult,
            sessionCountResult,
            attendanceRateResult,
            facultyCountResult,
            facultyCourseResult,
            activeStudentsResult,
            activeCoursesResult
        ] = await Promise.all([
            // إجمالي الطلاب (لا يتأثر بالفلاتر)
            pool.query(`SELECT COUNT(*) as count FROM kullanicilar WHERE rol = 'ogrenci' AND hesap_durumu = 'aktif'`),
            // إجمالي المواد (لا يتأثر بالفلاتر)
            pool.query(`SELECT COUNT(*) as count FROM dersler`),
            // إجمالي الجلسات (يتأثر بالفلاتر)
            pool.query(`SELECT COUNT(DISTINCT o.id) as count FROM oturumlar o LEFT JOIN dersler d ON o.ders_id = d.id LEFT JOIN bolumler b ON d.bolum_id = b.id LEFT JOIN fakulteler f ON b.fakulte_id = f.id ${mainWhereClause}`, queryParams),
            // متوسط الحضور (يتأثر بالفلاتر)
            pool.query(`
                WITH SessionAttendance AS (
                    SELECT
                        o.id AS oturum_id,
                        (COUNT(y.id) FILTER (WHERE y.durum IN ('katildi', 'gec_geldi')))::FLOAT AS attended_count,
                        (SELECT COUNT(dk.ogrenci_id) FROM ders_kayitlari dk WHERE dk.ders_id = o.ders_id)::FLOAT AS total_registered
                    FROM oturumlar o
                    LEFT JOIN yoklamalar y ON o.id = y.oturum_id
                    LEFT JOIN dersler d ON o.ders_id = d.id
                    LEFT JOIN bolumler b ON d.bolum_id = b.id
                    LEFT JOIN fakulteler f ON b.fakulte_id = f.id
                    ${mainWhereClause}
                    GROUP BY o.id
                )
                SELECT AVG(CASE WHEN total_registered > 0 THEN (attended_count * 100.0 / total_registered) ELSE 0 END) as average_attendance
                FROM SessionAttendance
            `, queryParams),
            // إجمالي الكليات (لا يتأثر بالفلاتر)
            pool.query(`SELECT COUNT(*) as count FROM fakulteler`),
            // عدد المواد لكل كلية (لا يتأثر بالفلاتر)
            pool.query(`SELECT f.id as fakulte_id, f.ad as fakulte_adi, COUNT(d.id) as ders_sayisi FROM fakulteler f LEFT JOIN bolumler b ON b.fakulte_id = f.id LEFT JOIN dersler d ON d.bolum_id = b.id GROUP BY f.id, f.ad`),
            // الطلاب النشطون (يتأثر بالفلاتر)
            pool.query(`SELECT COUNT(DISTINCT y.ogrenci_id) as active_students FROM yoklamalar y JOIN oturumlar o ON y.oturum_id = o.id JOIN dersler d ON o.ders_id = d.id JOIN bolumler b ON d.bolum_id = b.id JOIN fakulteler f ON b.fakulte_id = f.id ${mainWhereClause.replace(/o\.tarih/g, 'y.zaman')}`, queryParams),
            // المواد النشطة (يتأثر بالفلاتر)
            pool.query(`SELECT COUNT(DISTINCT o.ders_id) as active_courses FROM oturumlar o JOIN dersler d ON o.ders_id = d.id JOIN bolumler b ON d.bolum_id = b.id JOIN fakulteler f ON b.fakulte_id = f.id ${mainWhereClause}`, queryParams)
        ]);

        // --- 3. تجميع النتائج وإرسالها ---
        const responseData = {
            totalStudents: parseInt(studentCountResult.rows[0].count, 10) || 0,
            totalCourses: parseInt(courseCountResult.rows[0].count, 10) || 0,
            totalSessions: parseInt(sessionCountResult.rows[0].count, 10) || 0,
            averageAttendance: parseFloat(attendanceRateResult.rows[0].average_attendance || 0).toFixed(2),
            totalFaculties: parseInt(facultyCountResult.rows[0].count, 10) || 0,
            facultyCourses: facultyCourseResult.rows.map(row => ({
                fakulte_id: row.fakulte_id,
                fakulte_adi: row.fakulte_adi,
                ders_sayisi: parseInt(row.ders_sayisi, 10)
            })),
            activeStudents: parseInt(activeStudentsResult.rows[0].active_students, 10) || 0,
            activeCourses: parseInt(activeCoursesResult.rows[0].active_courses, 10) || 0,
        };

        logger.info('✅ Dashboard istatistikleri başarıyla oluşturuldu', { user_id: req.user?.id, stats: responseData });
        res.json(responseData);

    } catch (err) {
        console.error('Error while generating dashboard stats:', err.message, err.stack);
        logger.error('❌ Dashboard istatistik hatası', { error: err.message, stack: err.stack, query: req.query, user_id: req.user?.id });
        res.status(500).json({ message: 'Dashboard istatistikleri oluşturulurken bir sunucu hatası oluştu.' });
    }
});


// Son aktiviteleri getir (son oturumlar + yoklamalar)
router.get('/recent-activities', verifyToken, isAdmin, async (req, res) => {
    logger.debug('🔍 Son aktiviteler isteği alındı', { limit: req.query.limit, user_id: req.user?.id });
    try {
        const limit = parseInt(req.query.limit) || 10;

        logger.debug('Son oturumlar çekiliyor', { limit, user_id: req.user?.id });
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

        logger.debug('Son yoklamalar çekiliyor', { limit, user_id: req.user?.id });
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

        logger.info('✅ Son aktiviteler başarıyla alındı', { session_count: sessionsResult.rows.length, attendance_count: attendanceResult.rows.length, user_id: req.user?.id });
        res.json({
            sessions: sessionsResult.rows,
            attendance: attendanceResult.rows
        });
    } catch (err) {
        console.error('Recent activities hatası:', err.message);
        logger.error('❌ Son aktiviteler hatası', { error: err.message, stack: err.stack, limit: req.query.limit, user_id: req.user?.id });
        res.status(500).json({ message: 'Recent activities alınırken hata oluştu.' });
    }
});

// Düşük katılımlı dersleri getir
router.get('/low-attendance-courses', verifyToken, isAdmin, async (req, res) => {
    logger.debug('🔍 Düşük katılımlı dersler isteği alındı', { limit: req.query.limit, threshold: req.query.threshold, user_id: req.user?.id });
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

        logger.info('✅ Düşük katılımlı dersler başarıyla alındı', { course_count: result.rows.length, threshold, limit, user_id: req.user?.id });
        res.json(result.rows);
    } catch (err) {
        console.error('Low attendance courses hatası:', err.message);
        logger.error('❌ Düşük katılımlı dersler hatası', { error: err.message, stack: err.stack, limit: req.query.limit, threshold: req.query.threshold, user_id: req.user?.id });
        res.status(500).json({ message: 'Düşük katılımlı dersler alınırken hata oluştu.' });
    }
});

// En performanslı dersleri getir
router.get('/top-performing-courses', verifyToken, isAdmin, async (req, res) => {
    logger.debug('🔍 En performanslı dersler isteği alındı', { limit: req.query.limit, threshold: req.query.threshold, user_id: req.user?.id });
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

        logger.info('✅ En performanslı dersler başarıyla alındı', { course_count: result.rows.length, threshold, limit, user_id: req.user?.id });
        res.json(result.rows);
    } catch (err) {
        console.error('Top performing courses hatası:', err.message);
        logger.error('❌ En performanslı dersler hatası', { error: err.message, stack: err.stack, limit: req.query.limit, threshold: req.query.threshold, user_id: req.user?.id });
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
        logger.debug('🔍 Bölüm raporu isteği alındı', { department_id: req.params.departmentId, start_date: req.query.startDate, end_date: req.query.endDate, user_id: req.user?.id });
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('❌ Doğrulama hatası', { errors: errors.array(), department_id: req.params.departmentId, user_id: req.user?.id });
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
            logger.debug('Bölüm ders bazlı rapor hesaplanıyor', { department_id: departmentId, start_date: startDate, end_date: endDate, user_id: req.user?.id });
            const dersQuery = `
            SELECT
                d.id AS ders_id,
                d.ad AS ders_adi,
                COUNT(DISTINCT dk.ogrenci_id) AS toplam_ogrenci,
                COUNT(DISTINCT o.id) AS toplam_oturum,
                COALESCE(
                    (CAST(SUM(CASE WHEN y.durum IN ('katildi', 'gec_geldi') THEN 1 ELSE 0 END) AS FLOAT) * 100.0) /
                    NULLIF(CAST(COUNT(DISTINCT dk.ogrenci_id) AS FLOAT) * CAST(COUNT(DISTINCT o.id) AS FLOAT), 0),
                0) AS katilim_orani
            FROM dersler d
            INNER JOIN ders_kayitlari dk ON dk.ders_id = d.id
            LEFT JOIN oturumlar o ON o.ders_id = d.id ${dateFilter.replace('AND o.tarih', 'AND o.tarih')}
            LEFT JOIN yoklamalar y ON y.oturum_id = o.id AND y.ogrenci_id = dk.ogrenci_id
            WHERE d.bolum_id = $1
            GROUP BY d.id, d.ad
            ORDER BY d.ad;
            `;
            const dersResult = await pool.query(dersQuery, queryParams);

            logger.info('✅ Bölüm raporu başarıyla oluşturuldu', { department_id: departmentId, ders_sayisi: dersResult.rows.length, user_id: req.user?.id });
            res.status(200).json(
            dersResult.rows.map(row => ({
                ...row,
                toplam_ogrenci: parseInt(row.toplam_ogrenci),
                toplam_oturum: parseInt(row.toplam_oturum), // <-- السطر الصحيح
                katilim_orani: parseFloat(row.katilim_orani.toFixed(2))
            }))
        );

        } catch (err) {
            console.error("Bölüm dersi rapor hatası:", err);
            logger.error('❌ Bölüm dersi rapor hatası', { error: err.message, stack: err.stack, department_id: departmentId, start_date: startDate, end_date: endDate, user_id: req.user?.id });
            next(err);
        }
    }
);

/**
 * @swagger
 * /api/reports/analytics-data:
 *   post:
 *     summary: "Zaman aralığına göre gruplandırılmış yoklama analizi verilerini getirir."
 *     tags: [Raporlar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               timeRange:
 *                 type: string
 *                 enum: [daily, weekly, monthly]
 *     responses:
 *       200:
 *         description: "Analiz verileri başarıyla alındı."
 */
router.post(
  "/analytics-data",
  isAdmin,
  [body("timeRange").isIn(['daily', 'weekly', 'monthly']).withMessage("timeRange must be daily, weekly, or monthly")],
  async (req, res, next) => {
    const { timeRange } = req.body;
    logger.debug('🔍 Analiz verisi isteği alındı', { time_range: timeRange, user_id: req.user?.id });
    let dateGroup;
    switch (timeRange) {
      case 'weekly': dateGroup = "DATE_TRUNC('week', o.tarih)"; break;
      case 'monthly': dateGroup = "DATE_TRUNC('month', o.tarih)"; break;
      default: dateGroup = "DATE(o.tarih)"; break;
    }
    try {
      const query = `
        SELECT 
          T.period_start,
          ROUND(AVG(T.attendance_percentage)) as average_attendance
        FROM (
          SELECT 
            ${dateGroup}::date as period_start,
            (
              COUNT(y.id) FILTER (WHERE y.durum IN ('katildi', 'gec_geldi')) * 100.0 
              / 
              NULLIF((SELECT COUNT(*) FROM ders_kayitlari dk WHERE dk.ders_id = o.ders_id AND dk.alinma_tipi = 'zorunlu'), 0)
            ) as attendance_percentage
          FROM oturumlar o
          LEFT JOIN yoklamalar y ON y.oturum_id = o.id
          WHERE (SELECT COUNT(*) FROM ders_kayitlari dk WHERE dk.ders_id = o.ders_id AND dk.alinma_tipi = 'zorunlu') > 0
          GROUP BY o.id, period_start
        ) AS T
        WHERE T.attendance_percentage IS NOT NULL
        GROUP BY T.period_start
        ORDER BY T.period_start ASC;
      `;
      const { rows: attendanceTrend } = await pool.query(query);
      logger.info(`✅ Analiz verisi başarıyla oluşturuldu`, { time_range: timeRange, data_points: attendanceTrend.length, user_id: req.user?.id });
      res.status(200).json({ attendanceTrend });
    } catch (err) {
      logger.error("❌ Analiz verisi hatası", { error: err.message, stack: err.stack, time_range: timeRange, user_id: req.user?.id });
      res.status(500).json({ mesaj: err.message, detay: err.stack });
    }
  }
);

/**
 * @swagger
 * /api/reports/active-students-list:
 *   get:
 *     summary: "Belirtilen filtrelere göre aktif olan öğrencilerin listesini getirir."
 *     tags: [Raporlar, Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: facultyId
 *         schema: { type: integer }
 *         description: "Fakülte ID'sine göre filtrele"
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: "Başlangıç tarihi (YYYY-MM-DD)"
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         description: "Bitiş tarihi (YYYY-MM-DD)"
 *     responses:
 *       200:
 *         description: "Aktif öğrencilerin listesi"
 *       500:
 *         description: "Sunucu hatası"
 */
router.get("/active-students-list", verifyToken, isAdmin, async (req, res, next) => {
    const { facultyId, startDate, endDate } = req.query;
    logger.debug('🔍 Aktif öğrenci listesi isteği alındı', { query: req.query });

    try {
        const params = [];
        let paramIndex = 1;
        let whereClauses = [];

        if (facultyId) {
            whereClauses.push(`f.id = $${paramIndex++}`);
            params.push(facultyId);
        }
        if (startDate) {
            whereClauses.push(`y.zaman::date >= $${paramIndex++}`);
            params.push(startDate);
        }
        if (endDate) {
            whereClauses.push(`y.zaman::date <= $${paramIndex++}`);
            params.push(endDate);
        }

        // إذا لم يتم تحديد أي فلتر تاريخ، افترض اليوم
        if (!startDate && !endDate) {
            whereClauses.push(`y.zaman >= CURRENT_DATE`);
        }

        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const query = `
            SELECT DISTINCT ON (k.id)
                k.id as ogrenci_id,
                k.universite_kodu,
                k.ad,
                k.soyad,
                k.eposta,
                b.ad as bolum_adi,
                f.ad as fakulte_adi,
                y.zaman as son_aktivite
            FROM yoklamalar y
            JOIN kullanicilar k ON y.ogrenci_id = k.id
            LEFT JOIN oturumlar o ON y.oturum_id = o.id
            LEFT JOIN dersler d ON o.ders_id = d.id
            LEFT JOIN bolumler b ON d.bolum_id = b.id
            LEFT JOIN fakulteler f ON b.fakulte_id = f.id
            ${whereClause}
            ORDER BY k.id, y.zaman DESC;
        `;

        const { rows } = await pool.query(query, params);
        logger.info(`✅ ${rows.length} aktif öğrenci bulundu.`);
        res.status(200).json(rows);

    } catch (err) {
        logger.error('❌ Aktif öğrenci listesi getirme hatası', { error: err.message, stack: err.stack });
        next(err);
    }
});

// =================================================================
// --- ✅ (Teacher Reports) ---
// =================================================================

/**
 * @swagger
 * /api/reports/course/{courseId}/sessions:
 *   get:
 *     summary: "Bir derse ait tüm oturumları listeler (Öğretmen Raporu için)"
 *     tags: [Raporlar, Öğretmen]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: integer }
 *         description: "Oturumları listelenecek dersin ID'si"
 *     responses:
 *       200:
 *         description: "Derse ait oturumların listesi"
 */
router.get("/course/:courseId/sessions", verifyToken, sadeceOgretmenVeAdmin, async (req, res, next) => {
    const { courseId } = req.params;
    logger.debug(`🔍 Bir derse ait oturumlar isteniyor: Ders ID ${courseId}`);

    try {
        const query = `
            SELECT 
                o.id,
                o.konu,
                o.tarih,
                TO_CHAR(o.saat, 'HH24:MI') as saat,
                (SELECT COUNT(y.id) FROM yoklamalar y WHERE y.oturum_id = o.id AND y.durum IN ('katildi', 'gec_geldi')) as katilan_sayisi,
                (SELECT COUNT(dk.ogrenci_id) FROM ders_kayitlari dk WHERE dk.ders_id = o.ders_id) as toplam_kayitli
            FROM oturumlar o
            WHERE o.ders_id = $1
            ORDER BY o.tarih DESC, o.saat DESC;
        `;
        const { rows } = await pool.query(query, [courseId]);
        logger.info(`✅ ${rows.length} oturum bulundu: Ders ID ${courseId}`);
        res.status(200).json(rows);
    } catch (err) {
        logger.error(`❌ Ders oturumları alınırken hata: Ders ID ${courseId}`, { error: err.message });
        next(err);
    }
});

/**
 * @swagger
 * /api/reports/session/{sessionId}/attendance:
 *   get:
 *     summary: "Belirli bir oturumun yoklama listesini getirir (Öğretmen Raporu için)"
 *     tags: [Raporlar, Öğretmen]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: integer }
 *         description: "Yoklama listesi getirilecek oturumun ID'si"
 *     responses:
 *       200:
 *         description: "Oturumun yoklama listesi"
 */
router.get("/session/:sessionId/attendance", verifyToken, sadeceOgretmenVeAdmin, async (req, res, next) => {
    const { sessionId } = req.params;
    logger.debug(`🔍 Bir oturumun yoklama listesi isteniyor: Oturum ID ${sessionId}`);

    try {
        const query = `
            SELECT 
                k.id as ogrenci_id,
                k.universite_kodu,
                k.ad,
                k.soyad,
                y.id as yoklama_id,
                COALESCE(y.durum, 'katilmadi') as durum
            FROM ders_kayitlari dk
            JOIN kullanicilar k ON dk.ogrenci_id = k.id
            LEFT JOIN yoklamalar y ON y.ogrenci_id = dk.ogrenci_id AND y.oturum_id = $1
            WHERE dk.ders_id = (SELECT ders_id FROM oturumlar WHERE id = $1)
            ORDER BY k.soyad, k.ad;
        `;
        const { rows } = await pool.query(query, [sessionId]);
        logger.info(`✅ ${rows.length} öğrencinin yoklama durumu bulundu: Oturum ID ${sessionId}`);
        res.status(200).json(rows);
    } catch (err) {
        logger.error(`❌ Oturum yoklama listesi alınırken hata: Oturum ID ${sessionId}`, { error: err.message });
        next(err);
    }
});

/**
 * @swagger
 * /api/reports/attendance:
 *   put:
 *     summary: "Bir öğrencinin yoklama durumunu manuel olarak günceller (Öğretmen Raporu için)"
 *     tags: [Raporlar, Öğretmen]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ogrenci_id: { type: integer }
 *               oturum_id: { type: integer }
 *               yeni_durum: { type: string, enum: [katildi, katilmadi, gec_geldi, izinli] }
 *     responses:
 *       200:
 *         description: "Yoklama durumu başarıyla güncellendi."
 */
router.put("/attendance", verifyToken, sadeceOgretmenVeAdmin, async (req, res, next) => {
    const { ogrenci_id, oturum_id, yeni_durum } = req.body;
    logger.debug(`🔄 Yoklama manuel güncelleme isteği: Öğrenci ${ogrenci_id}, Oturum ${oturum_id}, Yeni Durum: ${yeni_durum}`);

    try {
        const existingAttendance = await pool.query(
            'SELECT id FROM yoklamalar WHERE ogrenci_id = $1 AND oturum_id = $2',
            [ogrenci_id, oturum_id]
        );

        if (existingAttendance.rows.length > 0) {
            const yoklamaId = existingAttendance.rows[0].id;
            const { rows } = await pool.query(
                'UPDATE yoklamalar SET durum = $1, zaman = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
                [yeni_durum, yoklamaId]
            );
            res.status(200).json({ mesaj: "Yoklama durumu başarıyla güncellendi.", data: rows[0] });
        } else {
            const { rows } = await pool.query(
                'INSERT INTO yoklamalar (ogrenci_id, oturum_id, durum, zaman, tarama_tipi) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4) RETURNING *',
                [ogrenci_id, oturum_id, yeni_durum, 'manuel']
            );
            res.status(201).json({ mesaj: "Öğrenci için yeni yoklama kaydı oluşturuldu.", data: rows[0] });
        }
    } catch (err) {
        logger.error(`❌ Manuel yoklama güncellenirken hata`, { error: err.message, body: req.body });
        next(err);
    }
});

/**
 * @swagger
 * /api/reports/attendance/session-select:
 *   post:
 *     summary: "Öğrencinin belirli bir oturumdaki katılmama durumunu katıldıya çevirir (Oturum Seç butonu için)"
 *     tags: [Raporlar, Öğretmen]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ogrenci_id: { type: integer }
 *               oturum_id: { type: integer }
 *               tur_no: { type: integer }
 *     responses:
 *       200:
 *         description: "Öğrenci katıldı olarak işaretlendi."
 *       400:
 *         description: "Geçersiz istek."
 *       500:
 *         description: "Sunucu hatası."
 */
router.post("/attendance/session-select", verifyToken, sadeceOgretmenVeAdmin, async (req, res, next) => {
    const { ogrenci_id, oturum_id, tur_no } = req.body;
    logger.debug(`🔄 Oturum seç isteği: Öğrenci ${ogrenci_id}, Oturum ${oturum_id}, Tur ${tur_no}`);

    try {
        // Önce mevcut yoklama kaydını kontrol et
        const existingAttendance = await pool.query(
            'SELECT id, durum, tur_no FROM yoklamalar WHERE ogrenci_id = $1 AND oturum_id = $2 AND tur_no = $3',
            [ogrenci_id, oturum_id, tur_no]
        );

        if (existingAttendance.rows.length > 0) {
            // Mevcut kayıt varsa durumunu güncelle
            const yoklamaId = existingAttendance.rows[0].id;
            const { rows } = await pool.query(
                'UPDATE yoklamalar SET durum = $1, zaman = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
                ['katildi', yoklamaId]
            );
            logger.info(`✅ Mevcut yoklama kaydı güncellendi: Öğrenci ${ogrenci_id}, Tur ${tur_no}`);
            res.status(200).json({ 
                mesaj: "Öğrenci katıldı olarak işaretlendi.", 
                data: rows[0],
                action: 'updated'
            });
        } else {
            // Yeni kayıt oluştur
            const { rows } = await pool.query(
                'INSERT INTO yoklamalar (ogrenci_id, oturum_id, durum, zaman, tarama_tipi, tur_no) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5) RETURNING *',
                [ogrenci_id, oturum_id, 'katildi', 'manuel', tur_no]
            );
            logger.info(`✅ Yeni yoklama kaydı oluşturuldu: Öğrenci ${ogrenci_id}, Tur ${tur_no}`);
            res.status(201).json({ 
                mesaj: "Öğrenci için yeni katılım kaydı oluşturuldu.", 
                data: rows[0],
                action: 'created'
            });
        }
    } catch (err) {
        logger.error(`❌ Oturum seç işlemi hatası`, { error: err.message, body: req.body });
        next(err);
    }
});

module.exports = router;
