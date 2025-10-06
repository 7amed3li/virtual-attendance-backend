const express = require("express");
const router = express.Router();
const pool = require("../config/veritabani");
const logger = require('../utils/logger');
const { param, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient();

/**
 * @swagger
 * tags:
 *   name: Oturum
 *   description: Ders oturumu yönetim işlemleri ve yoklama listeleme
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Oturum:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         ders_id:
 *           type: integer
 *         tarih:
 *           type: string
 *           format: date
 *         saat:
 *           type: string
 *         konu:
 *           type: string
 *         qr_anahtari:
 *           type: string
 *         derslik:
 *           type: string
 *     YoklamaKaydi:
 *       type: object
 *       properties:
 *         yoklama_id:
 *           type: integer
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
 *         durum:
 *           type: string
 *           enum: [katildi, katilmadi, izinli, gec_geldi]
 *         giris_zamani:
 *           type: string
 *           format: date-time
 *         aciklama:
 *           type: string
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

// Middleware to check if the user can access session-related data
// Admin or the instructor of the course to which the session belongs
const canAccessSessionData = async (req, res, next) => {
    const { oturumId } = req.params;
    const { id: userId, rol } = req.user;

    logger.debug('🔍 Oturum veri erişim kontrolü yapılıyor', { oturum_id: oturumId, user_id: userId, rol });

    if (rol === 'admin') {
        logger.debug('Kullanıcı admin, erişim izni verildi', { user_id: userId });
        return next();
    }

    if (rol === 'ogretmen' && oturumId) {
        try {
            const sessionQuery = await pool.query(
                `SELECT d.ogretmen_id 
                 FROM oturumlar o
                 JOIN dersler d ON o.ders_id = d.id
                 WHERE o.id = $1`,
                [oturumId]
            );
            if (sessionQuery.rows.length > 0 && sessionQuery.rows[0].ogretmen_id === userId) {
                logger.debug('Öğretmen dersi yönetiyor, erişim izni verildi', { oturum_id: oturumId, user_id: userId });
                return next();
            }
        } catch (err) {
            logger.error('❌ Oturum erişim kontrolü hatası', { error: err.message, stack: err.stack, oturum_id: oturumId, user_id: userId });
            return next(err);
        }
    }
    logger.warn('❌ Yetkisiz erişim', { oturum_id: oturumId, user_id: userId, rol });
    res.status(403).json({ mesaj: "Bu işlem için yetkiniz yok." });
};

// /api/oturum/ogrenci-ders/:dersId endpointi, /api/oturum/ders/:dersId ile aynı işlevi görsün
router.get(
    "/ogrenci-ders/:dersId",
    async (req, res, next) => {
        const { dersId } = req.params;
        const { id: userId, rol } = req.user;

        logger.debug('🔍 Öğrenci ders oturumları listeleme isteği alındı', { ders_id: dersId, user_id: userId, rol });

        if (rol === 'admin') {
            logger.debug('Kullanıcı admin, erişim izni verildi', { ders_id: dersId, user_id: userId });
            return next();
        }

        if (rol === 'ogretmen') {
            try {
                const course = await pool.query("SELECT ogretmen_id FROM dersler WHERE id = $1", [dersId]);
                if (course.rows.length === 0) {
                    logger.warn('❌ Ders bulunamadı', { ders_id: dersId, user_id: userId });
                    return res.status(404).json({ mesaj: "Ders bulunamadı." });
                }
                if (course.rows[0].ogretmen_id === userId) {
                    logger.debug('Öğretmen dersi yönetiyor, erişim izni verildi', { ders_id: dersId, user_id: userId });
                    return next();
                }
            } catch (err) {
                logger.error('❌ Ders erişim kontrolü hatası', { error: err.message, stack: err.stack, ders_id: dersId, user_id: userId });
                return next(err);
            }
        }

        // Öğrenci ise, o derse kayıtlı mı kontrol et
        if (rol === 'ogrenci') {
            try {
                const kayit = await pool.query("SELECT id FROM ders_kayitlari WHERE ders_id = $1 AND ogrenci_id = $2", [dersId, userId]);
                if (kayit.rows.length > 0) {
                    logger.debug('Öğrenci derse kayıtlı, erişim izni verildi', { ders_id: dersId, user_id: userId });
                    return next();
                } else {
                    logger.warn('❌ Öğrenci derse kayıtlı değil', { ders_id: dersId, user_id: userId });
                    return res.status(403).json({ mesaj: "Bu dersin oturumlarını görüntüleme yetkiniz yok (kayıtlı değilsiniz)." });
                }
            } catch (err) {
                logger.error('❌ Ders kayıt kontrolü hatası', { error: err.message, stack: err.stack, ders_id: dersId, user_id: userId });
                return next(err);
            }
        }

        logger.warn('❌ Yetkisiz erişim', { ders_id: dersId, user_id: userId, rol });
        return res.status(403).json({ mesaj: "Bu dersin oturumlarını görüntüleme yetkiniz yok." });
    },
    [
        param("dersId").isInt({ gt: 0 }).withMessage("Geçerli bir ders ID girilmelidir.")
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('❌ Doğrulama hatası', { errors: errors.array(), ders_id: req.params.dersId, user_id: req.user?.id });
            return res.status(400).json({ hatalar: errors.array() });
        }
        const { dersId } = req.params;
        try {
            logger.debug('Oturumlar listeleniyor', { ders_id: dersId, user_id: req.user?.id });
            const { rows } = await pool.query(
                "SELECT * FROM oturumlar WHERE ders_id = $1 ORDER BY tarih DESC, saat DESC",
                [dersId]
            );
            logger.info('✅ Oturumlar başarıyla listelendi', { ders_id: dersId, oturum_sayisi: rows.length, user_id: req.user?.id });
            res.json(rows);
        } catch (err) {
            logger.error('❌ Oturum listeleme hatası', { error: err.message, stack: err.stack, ders_id: dersId, user_id: req.user?.id });
            next(err);
        }
    }
);

/**
 * @swagger
 * /api/oturum/ders/{dersId}:
 *   get:
 *     summary: Belirtilen dersin tüm oturumlarını listeler. Admin veya dersin öğretmeni erişebilir.
 *     tags: [Oturum]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dersId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ders ID'si
 *     responses:
 *       200:
 *         description: Oturum listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Oturum'
 *       403:
 *         description: Yetkisiz erişim
 *       404:
 *         description: Ders bulunamadı
 */
router.get(
    "/ders/:dersId",
    async (req, res, next) => {
        const { dersId } = req.params;
        const { id: userId, rol } = req.user;

        logger.debug('🔍 Ders oturumları listeleme isteği alındı', { ders_id: dersId, user_id: userId, rol });

        if (rol === 'admin') {
            logger.debug('Kullanıcı admin, erişim izni verildi', { ders_id: dersId, user_id: userId });
            return next();
        }

        if (rol === 'ogretmen') {
            try {
                const course = await pool.query("SELECT ogretmen_id FROM dersler WHERE id = $1", [dersId]);
                if (course.rows.length === 0) {
                    logger.warn('❌ Ders bulunamadı', { ders_id: dersId, user_id: userId });
                    return res.status(404).json({ mesaj: "Ders bulunamadı." });
                }
                if (course.rows[0].ogretmen_id === userId) {
                    logger.debug('Öğretmen dersi yönetiyor, erişim izni verildi', { ders_id: dersId, user_id: userId });
                    return next();
                }
            } catch (err) {
                logger.error('❌ Ders erişim kontrolü hatası', { error: err.message, stack: err.stack, ders_id: dersId, user_id: userId });
                return next(err);
            }
        }

        // Öğrenci ise, o derse kayıtlı mı kontrol et
        if (rol === 'ogrenci') {
            try {
                const kayit = await pool.query("SELECT id FROM ders_kayitlari WHERE ders_id = $1 AND ogrenci_id = $2", [dersId, userId]);
                if (kayit.rows.length > 0) {
                    logger.debug('Öğrenci derse kayıtlı, erişim izni verildi', { ders_id: dersId, user_id: userId });
                    return next();
                } else {
                    logger.warn('❌ Öğrenci derse kayıtlı değil', { ders_id: dersId, user_id: userId });
                    return res.status(403).json({ mesaj: "Bu dersin oturumlarını görüntüleme yetkiniz yok (kayıtlı değilsiniz)." });
                }
            } catch (err) {
                logger.error('❌ Ders kayıt kontrolü hatası', { error: err.message, stack: err.stack, ders_id: dersId, user_id: userId });
                return next(err);
            }
        }

        logger.warn('❌ Yetkisiz erişim', { ders_id: dersId, user_id: userId, rol });
        return res.status(403).json({ mesaj: "Bu dersin oturumlarını görüntüleme yetkiniz yok." });
    },
    [
        param("dersId").isInt({ gt: 0 }).withMessage("Geçerli bir ders ID girilmelidir.")
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('❌ Doğrulama hatası', { errors: errors.array(), ders_id: req.params.dersId, user_id: req.user?.id });
            return res.status(400).json({ hatalar: errors.array() });
        }
        const { dersId } = req.params;
        try {
            logger.debug('Oturumlar listeleniyor', { ders_id: dersId, user_id: req.user?.id });
            const { rows } = await pool.query(
                "SELECT * FROM oturumlar WHERE ders_id = $1 ORDER BY tarih DESC, saat DESC",
                [dersId]
            );
            logger.info('✅ Oturumlar başarıyla listelendi', { ders_id: dersId, oturum_sayisi: rows.length, user_id: req.user?.id });
            res.json(rows);
        } catch (err) {
            logger.error('❌ Oturum listeleme hatası', { error: err.message, stack: err.stack, ders_id: dersId, user_id: req.user?.id });
            next(err);
        }
    }
);

/**
 * @swagger
 * /api/oturum/{oturumId}/yoklama:
 *   get:
 *     summary: Belirtilen oturumun tüm yoklama kayıtlarını listeler. Admin veya dersin öğretmeni erişebilir.
 *     tags: [Oturum]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: oturumId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Yoklama kayıtları listelenecek oturumun ID'si
 *     responses:
 *       200:
 *         description: Yoklama kayıtları listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/YoklamaKaydi'
 *       400:
 *         description: Geçersiz oturum ID'si
 *       403:
 *         description: Yetkisiz erişim
 *       404:
 *         description: Oturum bulunamadı
 *       500:
 *         description: Sunucu hatası
 */
router.get(
    "/:oturumId/yoklama",
    canAccessSessionData, // Authorization middleware
    [
        param("oturumId").isInt({ gt: 0 }).withMessage("Geçerli bir oturum ID girilmelidir.")
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('❌ Doğrulama hatası', { errors: errors.array(), oturum_id: req.params.oturumId, user_id: req.user?.id });
            return res.status(400).json({ hatalar: errors.array() });
        }

        const { oturumId } = req.params;

        try {
            logger.debug('Oturum varlığı kontrol ediliyor', { oturum_id: oturumId, user_id: req.user?.id });
            const oturumExists = await pool.query("SELECT id FROM oturumlar WHERE id = $1", [oturumId]);
            if (oturumExists.rows.length === 0) {
                logger.warn('❌ Oturum bulunamadı', { oturum_id: oturumId, user_id: req.user?.id });
                return res.status(404).json({ mesaj: "Oturum bulunamadı." });
            }

            logger.debug('Yoklama kayıtları listeleniyor', { oturum_id: oturumId, user_id: req.user?.id });
            const yoklamaKayitlari = await pool.query(
                `SELECT 
                    y.id AS yoklama_id, 
                    k.id AS ogrenci_id, 
                    k.universite_kodu, 
                    k.ad, 
                    k.soyad, 
                    k.eposta,
                    y.durum, 
                    y.zaman AS giris_zamani,
                    y.konum,
                    y.tur_no,
                    y.count
                FROM yoklamalar y
                JOIN kullanicilar k ON y.ogrenci_id = k.id
                WHERE y.oturum_id = $1
                ORDER BY k.soyad, k.ad, y.tur_no NULLS LAST, y.zaman ASC`,
                [oturumId]
            );

            logger.info('✅ Yoklama kayıtları başarıyla listelendi', { oturum_id: oturumId, kayit_sayisi: yoklamaKayitlari.rows.length, user_id: req.user?.id });
            res.status(200).json(yoklamaKayitlari.rows);
        } catch (err) {
            console.error("Yoklama listeleme hatası:", err);
            logger.error('❌ Yoklama listeleme hatası', { error: err.message, stack: err.stack, oturum_id: oturumId, user_id: req.user?.id });
            next(err);
        }
    }
);

// Oturum silme endpoint'i
router.delete(
    "/:oturumId",
    canAccessSessionData, // Yetki kontrolü
    async (req, res, next) => {
        const { oturumId } = req.params;
        logger.debug('🔍 Oturum silme isteği alındı', { oturum_id: oturumId, user_id: req.user?.id });
        try {
            logger.debug('Yoklamalar siliniyor', { oturum_id: oturumId, user_id: req.user?.id });
            await pool.query("DELETE FROM yoklamalar WHERE oturum_id = $1", [oturumId]);
            logger.debug('Oturum siliniyor', { oturum_id: oturumId, user_id: req.user?.id });
            const result = await pool.query("DELETE FROM oturumlar WHERE id = $1 RETURNING *", [oturumId]);
            if (result.rows.length === 0) {
                logger.warn('❌ Oturum bulunamadı', { oturum_id: oturumId, user_id: req.user?.id });
                return res.status(404).json({ mesaj: "Oturum bulunamadı." });
            }
            logger.info('✅ Oturum başarıyla silindi', { oturum_id: oturumId, user_id: req.user?.id });
            res.json({ mesaj: "Oturum silindi.", oturum: result.rows[0] });
        } catch (err) {
            logger.error('❌ Oturum silme hatası', { error: err.message, stack: err.stack, oturum_id: oturumId, user_id: req.user?.id });
            next(err);
        }
    }
);

// Belirli bir ders ve gün için en yüksek max_count değerini döndüren endpoint
router.get(
    "/son-oturum-no/:dersId/:tarih",
    async (req, res) => {
        const { dersId, tarih } = req.params;
        logger.debug('🔍 Son oturum numarası isteği alındı', { ders_id: dersId, tarih, user_id: req.user?.id });
        try {
            const { rows } = await pool.query(
                "SELECT COALESCE(MAX(max_count), 0) AS son_oturum_no FROM oturumlar WHERE ders_id = $1 AND tarih = $2",
                [dersId, tarih]
            );
            logger.info('✅ Son oturum numarası başarıyla alındı', { ders_id: dersId, tarih, son_oturum_no: rows[0].son_oturum_no, user_id: req.user?.id });
            res.json({ son_oturum_no: parseInt(rows[0].son_oturum_no) });
        } catch (err) {
            logger.error('❌ Son oturum numarası alma hatası', { error: err.message, stack: err.stack, ders_id: dersId, tarih, user_id: req.user?.id });
            res.status(500).json({ mesaj: 'Sunucu hatası', detay: err.message });
        }
    }
);

// Oturum bitirme endpoint'i
router.post(
    "/:oturumId/bitir",
    canAccessSessionData, // Yetki kontrolü
    async (req, res, next) => {
        const { oturumId } = req.params;
        logger.debug('🔍 Oturum bitirme isteği alındı', { oturum_id: oturumId, user_id: req.user?.id });
        try {
            // 1. Oturumun max_count'unu al
            logger.debug('Oturum max_count kontrol ediliyor', { oturum_id: oturumId, user_id: req.user?.id });
            const oturumRes = await pool.query(
                "SELECT max_count FROM oturumlar WHERE id = $1",
                [oturumId]
            );
            if (oturumRes.rows.length === 0) {
                logger.warn('❌ Oturum bulunamadı', { oturum_id: oturumId, user_id: req.user?.id });
                return res.status(404).json({ mesaj: "Oturum bulunamadı." });
            }
            const maxCount = oturumRes.rows[0].max_count;
            logger.debug('max_count alındı', { oturum_id: oturumId, max_count: maxCount, user_id: req.user?.id });

            // 2. count >= max_count olanları 'katildi', diğerlerini 'katilmadi' yap
            logger.debug('Yoklamalar güncelleniyor: katildi', { oturum_id: oturumId, max_count: maxCount, user_id: req.user?.id });
            await pool.query(
                `UPDATE yoklamalar SET durum = 'katildi'
                 WHERE oturum_id = $1 AND count >= $2`,
                [oturumId, maxCount]
            );
            logger.debug('Yoklamalar güncelleniyor: katilmadi', { oturum_id: oturumId, max_count: maxCount, user_id: req.user?.id });
            await pool.query(
                `UPDATE yoklamalar SET durum = 'katilmadi'
                 WHERE oturum_id = $1 AND (count IS NULL OR count < $2)`,
                [oturumId, maxCount]
            );

            // Gün bazlı normalize: aynı günün tüm oturumlarına göre eşik uygula
            logger.debug('Gün bazlı normalizasyon başlatılıyor', { oturum_id: oturumId, user_id: req.user?.id });
            const metaRes = await pool.query(
                `SELECT o.ders_id, o.tarih, d.min_yoklama_yuzdesi
                 FROM oturumlar o
                 JOIN dersler d ON d.id = o.ders_id
                 WHERE o.id = $1`,
                [oturumId]
            );
            if (metaRes.rows.length > 0) {
                const dersId = metaRes.rows[0].ders_id;
                const tarih = metaRes.rows[0].tarih;
                const minYuzde = parseInt(metaRes.rows[0].min_yoklama_yuzdesi || 0, 10);
                logger.debug('Ders bilgileri alındı', { oturum_id: oturumId, ders_id: dersId, tarih, min_yoklama_yuzdesi: minYuzde, user_id: req.user?.id });

                // Gün bazlı tek değer: o güne ait oturumların max_count'undan en büyüğü
                logger.debug('Gün max_count hesaplanıyor', { ders_id: dersId, tarih, user_id: req.user?.id });
                const gunMaxRes = await pool.query(
                    `SELECT COALESCE(MAX(max_count), 0) AS gun_max
                     FROM oturumlar WHERE ders_id = $1 AND tarih = $2`,
                    [dersId, tarih]
                );
                const gunMax = parseInt(gunMaxRes.rows[0]?.gun_max || 0, 10);
                const yuzdeNum = isNaN(minYuzde) ? 0 : minYuzde;
                const esik = Math.ceil((gunMax * yuzdeNum) / 100); // yüzde=0 ise eşik=0 (hiç okutmasa da katıldı sayılır)
                logger.debug('Eşik hesaplandı', { ders_id: dersId, tarih, gun_max: gunMax, min_yuzde: yuzdeNum, esik, user_id: req.user?.id });

                // Eğer dersin min_yoklama_yuzdesi 0 ise, o güne ait tüm yoklamaları katıldı olarak işaretle
                if (yuzdeNum === 0) {
                    logger.debug('min_yoklama_yuzdesi 0, tüm yoklamalar katildi olarak işaretleniyor', { ders_id: dersId, tarih, user_id: req.user?.id });
                    // Eksik satırlar varsa oluştur
                    await pool.query(
                        `WITH gun_oturumlar AS (
                           SELECT id FROM oturumlar WHERE ders_id = $1 AND tarih = $2
                         ), ogrenciler AS (
                           SELECT dk.ogrenci_id FROM ders_kayitlari dk WHERE dk.ders_id = $1
                         ), missing AS (
                           SELECT go.id AS oturum_id, o.ogrenci_id
                           FROM gun_oturumlar go
                           CROSS JOIN ogrenciler o
                           LEFT JOIN yoklamalar y ON y.oturum_id = go.id AND y.ogrenci_id = o.ogrenci_id
                           WHERE y.id IS NULL
                         )
                         INSERT INTO yoklamalar (oturum_id, ogrenci_id, durum, count, zaman)
                         SELECT oturum_id, ogrenci_id, 'katildi', 0, NOW() FROM missing`,
                        [dersId, tarih]
                    );
                    logger.debug('Eksik yoklamalar oluşturuldu', { ders_id: dersId, tarih, user_id: req.user?.id });
                    await pool.query(
                        `UPDATE yoklamalar SET durum = 'katildi'
                         WHERE oturum_id IN (SELECT id FROM oturumlar WHERE ders_id = $1 AND tarih = $2)`,
                        [dersId, tarih]
                    );
                    logger.info('✅ Yoklama bitirildi: min_yoklama_yuzdesi=0, tüm öğrenciler katıldı', { oturum_id: oturumId, ders_id: dersId, tarih, user_id: req.user?.id });
                    return res.status(200).json({ mesaj: 'Yoklama bitirildi (yüzde=0 → herkes katıldı).' });
                }

                // Katılanlar
                logger.debug('Katılanlar güncelleniyor', { ders_id: dersId, tarih, esik, user_id: req.user?.id });
                await pool.query(
                    `WITH gun_oturumlar AS (
                       SELECT id FROM oturumlar WHERE ders_id = $1 AND tarih = $2
                     ), ogr_katilim AS (
                       SELECT y.ogrenci_id,
                              COALESCE(SUM(COALESCE(y.count,0)),0) AS kat
                       FROM yoklamalar y
                       WHERE y.oturum_id IN (SELECT id FROM gun_oturumlar)
                       GROUP BY y.ogrenci_id
                     )
                     UPDATE yoklamalar y SET durum = 'katildi'
                     WHERE y.oturum_id IN (SELECT id FROM gun_oturumlar)
                       AND y.ogrenci_id IN (SELECT ogrenci_id FROM ogr_katilim WHERE kat >= $3)`,
                    [dersId, tarih, esik]
                );

                // Katılmayanlar
                logger.debug('Katılmayanlar güncelleniyor', { ders_id: dersId, tarih, esik, user_id: req.user?.id });
                await pool.query(
                    `WITH gun_oturumlar AS (
                       SELECT id FROM oturumlar WHERE ders_id = $1 AND tarih = $2
                     ), ogr_katilim AS (
                       SELECT y.ogrenci_id,
                              COALESCE(SUM(COALESCE(y.count,0)),0) AS kat
                       FROM yoklamalar y
                       WHERE y.oturum_id IN (SELECT id FROM gun_oturumlar)
                       GROUP BY y.ogrenci_id
                     )
                     UPDATE yoklamalar y SET durum = 'katilmadi'
                     WHERE y.oturum_id IN (SELECT id FROM gun_oturumlar)
                       AND y.ogrenci_id IN (SELECT ogrenci_id FROM ogr_katilim WHERE kat < $3)`,
                    [dersId, tarih, esik]
                );
            }
            logger.info('✅ Yoklama bitirildi: Eksik öğrenciler katılmadı olarak işaretlendi', { oturum_id: oturumId, user_id: req.user?.id });
            res.status(200).json({ mesaj: 'Yoklama bitirildi. Eksik öğrenciler katılmadı olarak işaretlendi.' });
        } catch (err) {
            logger.error('❌ Oturum bitirme hatası', { error: err.message, stack: err.stack, oturum_id: oturumId, user_id: req.user?.id });
            next(err);
        }
    }
);

module.exports = router;