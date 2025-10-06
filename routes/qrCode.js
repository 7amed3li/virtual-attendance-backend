
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const pool = require("../config/veritabani");
const logger = require('../utils/logger'); // إضافة استيراد logger
const { canAccessSessionData } = require('./oturumListe');
const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient();

// Sabit konum listesi (dışa aktarılacak)
const KONUM_LISTESI = [
  { ad: "Muhendislik", latitude: 40.3321324819595, longitude: 36.484079917748815 },
  { ad: "B Blok", latitude: 40.124, longitude: 36.457 },
  { ad: "C Blok", latitude: 40.125, longitude: 36.458 },
  { ad: "D Blok", latitude: 40.126, longitude: 36.459 }
];

/**
 * Sadece admin veya ilgili dersin öğretmeni QR kodu üretebilir
 */
const isInstructorOrAdmin = async (req, res, next) => {
    const { id: userId, rol } = req.user;
    const { oturum_id } = req.body;

    logger.debug('🔍 QR kod üretim yetki kontrolü yapılıyor', { oturum_id, user_id: userId, rol });

    if (rol === "admin") {
        logger.debug('Kullanıcı admin, erişim izni verildi', { user_id: userId });
        return next();
    }

    if (rol === "ogretmen" && oturum_id) {
        try {
            const sessionQuery = await pool.query(
                `SELECT d.ogretmen_id 
                 FROM oturumlar o
                 JOIN dersler d ON o.ders_id = d.id
                 WHERE o.id = $1`,
                [oturum_id]
            );
            if (sessionQuery.rows.length > 0 && sessionQuery.rows[0].ogretmen_id === userId) {
                logger.debug('Öğretmen dersi yönetiyor, erişim izni verildi', { oturum_id, user_id: userId });
                return next();
            }
        } catch (err) {
            logger.error('❌ Yetki kontrolü hatası', { error: err.message, stack: err.stack, oturum_id, user_id: userId });
            return res.status(500).json({ mesaj: "Yetki kontrolü sırasında sunucu hatası" });
        }
    }

    logger.warn('❌ Yetkisiz erişim: QR kod üretimi', { oturum_id, user_id: userId, rol });
    res.status(403).json({ mesaj: "Bu işlem için yetkiniz yok. Sadece dersin öğretmeni veya admin QR kod üretebilir." });
};

/**
 * @swagger
 * tags:
 *   name: QRCode
 *   description: QR Kod üretimi ve yönetimi
 */

/**
 * @swagger
 * /api/qr/generate:
 *   post:
 *     summary: Bir ders oturumu için dinamik QR kod verisi üretir.
 *     tags: [QRCode]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oturum_id
 *               - konum_ad
 *               - latitude
 *               - longitude
 *             properties:
 *               oturum_id:
 *                 type: integer
 *                 description: QR kodun üretileceği ders oturumunun ID'si.
 *               konum_ad:
 *                 type: string
 *                 description: Seçilen konumun adı.
 *               latitude:
 *                 type: number
 *                 description: Seçilen konumun enlemi.
 *               longitude:
 *                 type: number
 *                 description: Seçilen konumun boylamı.
 *     responses:
 *       200:
 *         description: "QR kod verisi başarıyla üretildi."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qrData:
 *                   type: string
 *                   description: QR koda dönüştürülecek şifreli veri.
 *                 expiresIn:
 *                    type: integer
 *                    description: Token geçerlilik süresi (saniye).
 *       400:
 *         description: "Geçersiz istek (örn: eksik parametre)."
 *       403:
 *         description: "Yetkisiz erişim."
 *       404:
 *         description: "Oturum bulunamadı."
 *       500:
 *         description: "Sunucu hatası."
 */
router.post("/generate", isInstructorOrAdmin, async (req, res, next) => {
    const { oturum_id, konum_ad, latitude, longitude } = req.body;

    logger.debug('🔍 QR kod üretim isteği alındı', { oturum_id, konum_ad, latitude, longitude, user_id: req.user?.id });

    if (!oturum_id || !konum_ad || latitude === undefined || longitude === undefined) {
        logger.warn('❌ Eksik parametreler', { oturum_id, konum_ad, latitude, longitude, user_id: req.user?.id });
        return res.status(400).json({ mesaj: "oturum_id, konum_ad, latitude ve longitude gereklidir." });
    }

    try {
        logger.debug('Oturum kontrol ediliyor', { oturum_id, user_id: req.user?.id });
        const oturumResult = await pool.query(
            `SELECT o.*, d.ad as ders_adi FROM oturumlar o JOIN dersler d ON o.ders_id = d.id WHERE o.id = $1`,
            [oturum_id]
        );
        if (oturumResult.rows.length === 0) {
            logger.warn('❌ Oturum bulunamadı', { oturum_id, user_id: req.user?.id });
            return res.status(404).json({ mesaj: "Oturum bulunamadı." });
        }

        const oturum = oturumResult.rows[0];
        logger.debug('Oturum bilgileri alındı', { oturum_id, ders_adi: oturum.ders_adi, max_count: oturum.max_count, user_id: req.user?.id });

        const qrPayload = {
            oturumId: oturum_id,
            latitude,
            longitude,
            count: oturum.max_count || 1
        };
        const qrTokenValiditySeconds = parseInt(process.env.QR_TOKEN_VALIDITY_SECONDS || "10");
        logger.debug('QR kod verisi oluşturuluyor', { oturum_id, qr_payload: qrPayload, expires_in: qrTokenValiditySeconds, user_id: req.user?.id });

        const qrData = jwt.sign(qrPayload, process.env.JWT_SECRET || "gizliAnahtar", {
            expiresIn: qrTokenValiditySeconds
        });

        logger.info('✅ QR kod başarıyla üretildi', { oturum_id, expires_in: qrTokenValiditySeconds, user_id: req.user?.id });
        res.status(200).json({
            qrData: qrData,
            expiresIn: qrTokenValiditySeconds
        });
    } catch (err) {
        logger.error('❌ QR kod üretim hatası', { error: err.message, stack: err.stack, oturum_id, user_id: req.user?.id });
        next(err);
    }
});

/**
 * @swagger
 * /api/qr/konumlar:
 *   get:
 *     summary: Sabit konum listesini döndürür
 *     tags: [QRCode]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Konum listesi başarıyla döndü."
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
 *         description: "Token gerekli."
 *       403:
 *         description: "Token geçersiz veya süresi dolmuş."
 */
router.get("/konumlar", async (req, res) => {
    logger.debug('🔍 Konum listesi isteği alındı', { user_id: req.user?.id });
    try {
        const { rows } = await pool.query("SELECT ad, enlem as latitude, boylam as longitude FROM fakulteler");
        logger.info('✅ Konum listesi başarıyla alındı', { konum_sayisi: rows.length, user_id: req.user?.id });
        res.json(rows);
    } catch (err) {
        console.error("Fakülte konumları alınırken hata:", err);
        logger.error('❌ Fakülte konumları alınırken hata', { error: err.message, stack: err.stack, user_id: req.user?.id });
        res.status(500).json({ mesaj: "Fakülte konumları alınamadı." });
    }
});

module.exports = { router, KONUM_LISTESI };
``