const express = require("express");
const router = express.Router();
const pool = require("../config/veritabani");
const { body, validationResult } = require("express-validator");
const verifyToken = require("../middleware/verifyToken");
const { sadeceOgretmen } = require("../middleware/yetkiKontrol");
const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient(); // Prisma Client'ı oluştur -ÖZGÜRCAN
/**
 * @swagger
 * tags:
 *   name: Oturum
 *   description: Ders oturumu yönetim işlemleri
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
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/oturum/ekle:
 *   post:
 *     summary: Yeni bir oturum (yoklama seansı) oluşturur
 *     tags: [Oturum]
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
 *               - tarih
 *               - saat
 *               - qr_anahtari
 *             properties:
 *               ders_id:
 *                 type: integer
 *                 description: Oturumun ait olduğu dersin ID'si
 *               tarih:
 *                 type: string
 *                 format: date
 *                 description: Oturum tarihi YYYY-MM-DD formatında
 *               saat:
 *                 type: string
 *                 pattern: '^\\d{2}:\\d{2}$'
 *                 description: Oturum saati HH:MM formatında
 *               konu:
 *                 type: string
 *                 description: Oturum konusu (opsiyonel)
 *               qr_anahtari:
 *                 type: string
 *                 description: Oturuma özel QR anahtarı
 *               derslik:
 *                 type: string
 *                 description: Fiziksel derslik bilgisi (opsiyonel)
 *               max_count:
 *                 type: integer
 *                 description: Maksimum öğrenci sayısı
 *     responses:
 *       201:
 *         description: Oturum başarıyla eklendi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mesaj:
 *                   type: string
 *                 oturum:
 *                   $ref: '#/components/schemas/Oturum'
 *       400:
 *         description: Geçersiz istek veya doğrulama hatası
 *       409:
 *         description: QR anahtarı zaten kullanılıyor
 *       500:
 *         description: Sunucu hatası
 */
router.post(
  "/ekle",
  verifyToken,
  sadeceOgretmen,
  [
    body("ders_id").isInt().withMessage("ders_id bir tamsayı olmalı"),
    body("tarih").isISO8601().withMessage("tarih YYYY-MM-DD formatında olmalı"),
    body("saat").matches(/^\d{2}:\d{2}$/).withMessage("saat HH:MM formatında olmalı"),
    body("konu").optional().isString().withMessage("konu metin olmalı"),
    body("qr_anahtari").notEmpty().withMessage("qr_anahtari gerekli"),
    body("derslik").optional().isString().withMessage("derslik metin olmalı"),
    body("max_count").isInt({ min: 1 }).withMessage("max_count bir tamsayı olmalı")
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ hatalar: errors.array() });
    }
    const { ders_id, tarih, saat, konu, qr_anahtari, derslik, max_count } = req.body;
    try {
      // Aynı gün ve ders için oturum var mı?
      const oturumRes = await pool.query(
        "SELECT id FROM oturumlar WHERE ders_id = $1 AND tarih = $2",
        [ders_id, tarih]
      );
      if (oturumRes.rows.length > 0) {
        // Varsa max_count'u güncellemeden önce mevcut yoklamalardaki en yüksek count'u bul
        const oturumId = oturumRes.rows[0].id;
        const yoklamaMaxCountRes = await pool.query(
          "SELECT COALESCE(MAX(count), 0) AS max_count FROM yoklamalar WHERE oturum_id = $1",
          [oturumId]
        );
        const mevcutMaxCount = yoklamaMaxCountRes.rows[0].max_count || 0;
        if (parseInt(max_count) < mevcutMaxCount) {
          return res.status(400).json({
            mesaj: `Mevcut yoklama sayısı (${mevcutMaxCount})'dan daha düşük bir değer seçilemez!`,
            kod: 'MAX_COUNT_TOO_LOW'
          });
        }
        // Güncelleme işlemi
        await pool.query(
          "UPDATE oturumlar SET max_count = $1, saat = $2, konu = $3, qr_anahtari = $4, derslik = $5 WHERE id = $6",
          [max_count, saat, konu, qr_anahtari, derslik, oturumId]
        );
        const updatedOturum = await pool.query("SELECT * FROM oturumlar WHERE id = $1", [oturumId]);
        return res.json({ mesaj: "Oturum güncellendi", oturum: updatedOturum.rows[0] });
      } else {
        // Yoksa yeni oturum oluştur
        const newOturum = await pool.query(
          `INSERT INTO oturumlar (ders_id, tarih, saat, konu, qr_anahtari, derslik, max_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [ders_id, tarih, saat, konu, qr_anahtari, derslik, max_count]
        );
        return res.json({ mesaj: "Oturum oluşturuldu", oturum: newOturum.rows[0] });
      }
    } catch (err) {
      console.error("Oturum ekleme hatası:", err);
      next(err);
    }
  }
);

module.exports = router;
