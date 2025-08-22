const express = require("express");
const router = express.Router();
const pool = require("../config/veritabani");
const verifyToken = require("../middleware/verifyToken");
const { body, validationResult } = require("express-validator");

const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient(); // Prisma Client'ı oluştur -ÖZGÜRCAN


/**
 * @swagger
 * /api/ogretmen-bildirim:
 *   post:
 *     summary: Öğretmen dersine bildirim ekler
 *     tags: [Bildirimler]
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
 *               - baslik
 *               - icerik
 *             properties:
 *               ders_id:
 *                 type: integer
 *                 description: Bildirimin ait olduğu dersin ID'si
 *               baslik:
 *                 type: string
 *                 description: Bildirimin başlığı
 *               icerik:
 *                 type: string
 *                 description: Bildirimin içeriği
 *     responses:
 *       201:
 *         description: Bildirim başarıyla eklendi
 *       400:
 *         description: Geçersiz istek verisi
 *       403:
 *         description: Bu derse bildirim ekleme yetkiniz yok
 *       500:
 *         description: Sunucu hatası
 */


router.post(
  "/",
  verifyToken,
  [
    body("ders_id").isInt().withMessage("ders_id geçerli bir sayı olmalıdır."),
    body("baslik").notEmpty().withMessage("Başlık boş olamaz."),
    body("icerik").notEmpty().withMessage("İçerik boş olamaz."),
    body("kategori").optional().isString().withMessage("Kategori geçerli bir string olmalıdır.")
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { ders_id, baslik, icerik, kategori = 'Genel' } = req.body;
    const ogretmen_id = req.user.id; // Token'dan gelen kullanıcı

    try {
      // Önce öğretmen gerçekten o dersin sahibi mi kontrol et
      const dersKontrol = await pool.query(
        "SELECT * FROM dersler WHERE id = $1 AND ogretmen_id = $2",
        [ders_id, ogretmen_id]
      );

      if (dersKontrol.rows.length === 0) {
        return res.status(403).json({ mesaj: "Bu derse bildirim ekleme yetkiniz yok" });
      }

      // Bildirimi ekle
      await pool.query(
        "INSERT INTO bildirimler (kullanici_id, baslik, icerik, ders_id, kategori) VALUES ($1, $2, $3, $4, $5)",
        [ogretmen_id, baslik, icerik, ders_id, kategori]
      );

      res.status(201).json({ mesaj: "Bildirim başarıyla eklendi" });
    } catch (err) {
      console.error("Bildirim ekleme hatası:", err);
      res.status(500).json({ mesaj: "Sunucu hatası" });
    }
  }
);




module.exports = router;
