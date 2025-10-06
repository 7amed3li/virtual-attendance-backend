const express = require("express");
const router = express.Router();
const pool = require("../config/veritabani");
const logger = require('../utils/logger');

// --- START: التعديل النهائي هنا ---
// استيراد verifyToken مباشرة لأنه تم تصديره مباشرة
const verifyToken = require("../middleware/verifyToken");

// استيراد sadeceOgrenci كجزء من كائن لأنه تم تصديره داخل كائن
const { sadeceOgrenci } = require("../middleware/yetkiKontrol");
// --- END: التعديل النهائي هنا ---

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * @swagger
 * tags:
 *   name: Yoklama
 *   description: Öğrencinin yoklama kayıtlarını listeleme
 */

/**
 * @swagger
 * /api/yoklama/{ogrenciId}:
 *   get:
 *     summary: Belirtilen öğrencinin tüm yoklama kayıtlarını getirir
 *     tags: [Yoklama]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ogrenciId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Öğrencinin kullanıcı ID'si
 *     responses:
 *       200:
 *         description: Yoklama kayıtları
 */
router.get("/:ogrenciId", verifyToken, sadeceOgrenci, async (req, res, next) => {
    logger.debug('🔍 Öğrenci yoklama kayıtları listeleme isteği alındı', { ogrenci_id: req.params.ogrenciId, user_id: req.user?.id });
    const { ogrenciId } = req.params;

    // Öğrencinin sadece kendi kayıtlarını görebileceğini kontrol et
    if (parseInt(ogrenciId) !== req.user.id) {
        logger.warn('❌ Yetkisiz erişim: Öğrenci yalnızca kendi yoklama kayıtlarını görebilir', { ogrenci_id: ogrenciId, user_id: req.user?.id });
        return res.status(403).json({ mesaj: "Yalnızca kendi yoklama kayıtlarınızı görebilirsiniz." });
    }

    try {
        logger.debug('Yoklama kayıtları sorgulanıyor', { ogrenci_id: ogrenciId, user_id: req.user?.id });
        const { rows } = await pool.query(
            `SELECT y.*, o.ders_id, o.tarih, o.saat
             FROM yoklamalar y
             JOIN oturumlar o ON y.oturum_id = o.id
             WHERE y.ogrenci_id = $1`,
            [ogrenciId]
        );
        logger.info('✅ Yoklama kayıtları başarıyla alındı', { ogrenci_id: ogrenciId, kayit_sayisi: rows.length, user_id: req.user?.id });
        res.json(rows);
    } catch (err) {
        logger.error('❌ Yoklama kayıtları alınırken hata', { error: err.message, stack: err.stack, ogrenci_id: ogrenciId, user_id: req.user?.id });
        next(err);
    }
});

module.exports = router;
