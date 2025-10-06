const express = require("express");
const router = express.Router();
const pool = require("../config/veritabani");
const { body, validationResult } = require("express-validator");
const verifyToken = require("../middleware/verifyToken");
const { sadeceOgretmen } = require("../middleware/yetkiKontrol");
const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient();
const logger = require('../utils/logger');

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
    logger.debug("🔍 Yeni oturum ekleme isteği alındı", { ders_id: req.body.ders_id, user_id: req.user?.id });
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), ders_id: req.body.ders_id, user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { ders_id, tarih, saat, konu, qr_anahtari, derslik, max_count } = req.body;
    try {
      // Aynı gün ve ders için oturum var mı?
      logger.debug("Oturum varlığı kontrol ediliyor", { ders_id, tarih, user_id: req.user?.id });
      const oturumRes = await pool.query(
        "SELECT id FROM oturumlar WHERE ders_id = $1 AND tarih = $2",
        [ders_id, tarih]
      );

      if (oturumRes.rows.length > 0) {
        const oturumId = oturumRes.rows[0].id;
        logger.debug("Oturum bulundu, max_count kontrol ediliyor", { oturum_id: oturumId, ders_id, user_id: req.user?.id });

        // Varsa max_count'u güncellemeden önce mevcut yoklamalardaki en yüksek count'u bul
        const yoklamaMaxCountRes = await pool.query(
          "SELECT COALESCE(MAX(count), 0) AS max_count FROM yoklamalar WHERE oturum_id = $1",
          [oturumId]
        );
        const mevcutMaxCount = yoklamaMaxCountRes.rows[0].max_count || 0;

        if (parseInt(max_count) < mevcutMaxCount) {
          logger.warn("❌ max_count mevcut yoklama sayısından düşük", { max_count, mevcut_max_count: mevcutMaxCount, oturum_id: oturumId, user_id: req.user?.id });
          return res.status(400).json({
            mesaj: `Mevcut yoklama sayısı (${mevcutMaxCount})'dan daha düşük bir değer seçilemez!`,
            kod: 'MAX_COUNT_TOO_LOW'
          });
        }

        // Güncelleme işlemi
        logger.debug("Oturum güncelleniyor", { oturum_id: oturumId, ders_id, user_id: req.user?.id });
        await pool.query(
          "UPDATE oturumlar SET max_count = $1, saat = $2, konu = $3, qr_anahtari = $4, derslik = $5 WHERE id = $6",
          [max_count, saat, konu, qr_anahtari, derslik, oturumId]
        );
        const updatedOturum = await pool.query("SELECT * FROM oturumlar WHERE id = $1", [oturumId]);
        logger.info("✅ Oturum başarıyla güncellendi", { oturum_id: oturumId, ders_id, user_id: req.user?.id });
        return res.json({ mesaj: "Oturum güncellendi", oturum: updatedOturum.rows[0] });
      } else {
        // Yoksa yeni oturum oluştur
        logger.debug("Yeni oturum oluşturuluyor", { ders_id, tarih, user_id: req.user?.id });
        const newOturum = await pool.query(
          `INSERT INTO oturumlar (ders_id, tarih, saat, konu, qr_anahtari, derslik, max_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [ders_id, tarih, saat, konu, qr_anahtari, derslik, max_count]
        );
        logger.info("✅ Oturum başarıyla oluşturuldu", { oturum_id: newOturum.rows[0].id, ders_id, user_id: req.user?.id });
        return res.json({ mesaj: "Oturum oluşturuldu", oturum: newOturum.rows[0] });
      }
    } catch (err) {
      console.error("Oturum ekleme hatası:", err);
      logger.error("❌ Oturum ekleme hatası", { error: err.message, stack: err.stack, ders_id, user_id: req.user?.id });
      next(err);
    }
  }
);
/**
 * @swagger
 * /api/oturum/list-by-ids:
 *   post:
 *     summary: "Belirtilen ID listesindeki oturumları getirir"
 *     tags: [Oturum, Rapor]
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
 *                 description: "Detayları getirilecek oturumların ID listesi"
 *     responses:
 *       200:
 *         description: "Oturum listesi başarıyla getirildi"
 *       400:
 *         description: "Geçersiz istek verisi"
 */
router.post(
  "/list-by-ids",
  verifyToken, // 👈 تأكد من أن المستخدم مسجل دخوله
  sadeceOgretmen, // 👈 استخدم صلاحية مناسبة، مثلاً sadeceOgretmen أو sadeceOgretmenVeAdmin
  [
    body("ids")
      .isArray({ min: 1 }).withMessage("ID listesi bir dizi olmalı ve boş olmamalıdır.")
      .custom((ids) => {
        if (!ids.every(id => Number.isInteger(id) && id > 0)) {
          throw new Error("Tüm ID'ler pozitif tamsayı olmalıdır.");
        }
        return true;
      }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ /oturum/list-by-ids doğrulama hatası", { errors: errors.array(), user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { ids } = req.body;
    logger.debug("🔍 ID listesine göre oturum listeleme isteği alındı", { user_id: req.user?.id, count: ids.length });

    try {
      const query = `
        SELECT 
          o.id,
          o.konu,
          o.tarih,
          o.saat,
          o.durum,
          d.ad as ders_adi,
          k.ad as ogretmen_adi,
          k.soyad as ogretmen_soyadi,
          (SELECT COUNT(*) FROM yoklamalar y WHERE y.oturum_id = o.id AND y.durum IN ('katildi', 'gec_geldi')) as katilim_sayisi,
          (SELECT COUNT(*) FROM ders_kayitlari dk WHERE dk.ders_id = o.ders_id) as toplam_kayitli_ogrenci
        FROM oturumlar o
        JOIN dersler d ON o.ders_id = d.id
        LEFT JOIN kullanicilar k ON d.ogretmen_id = k.id
        WHERE o.id = ANY($1::int[])
        ORDER BY o.tarih DESC, o.saat DESC;
      `;

      const { rows } = await pool.query(query, [ids]);

      // تحويل البيانات قبل إرسالها
      const formattedRows = rows.map(row => ({
        ...row,
        katilim_sayisi: parseInt(row.katilim_sayisi) || 0,
        toplam_kayitli_ogrenci: parseInt(row.toplam_kayitli_ogrenci) || 0,
        katilim_orani: row.toplam_kayitli_ogrenci > 0 ? Math.round((parseInt(row.katilim_sayisi, 10) / parseInt(row.toplam_kayitli_ogrenci, 10)) * 100) : 0
      }));

      logger.info(`✅ ID listesine göre ${formattedRows.length} oturum bulundu`, { user_id: req.user?.id });
      res.status(200).json(formattedRows);

    } catch (err) {
      logger.error("❌ ID listesine göre oturum listeleme hatası", { error: err.message, stack: err.stack, user_id: req.user?.id });
      next(err);
    }
  }
);

module.exports = router;
