const express = require("express");
const router = express.Router();
const pool = require("../config/veritabani");
const { param, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient(); // Prisma Client'ı oluştur -ÖZGÜRCAN


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

    if (rol === 'admin') {
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
                return next();
            }
        } catch (err) {
            return next(err);
        }
    }
    res.status(403).json({ mesaj: "Bu işlem için yetkiniz yok." });
};


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
router.get("/ders/:dersId", 
    async (req, res, next) => {
        const { dersId } = req.params;
        const { id: userId, rol } = req.user;

        if (rol === 'admin') return next();

        if (rol === 'ogretmen') {
            try {
                const course = await pool.query("SELECT ogretmen_id FROM dersler WHERE id = $1", [dersId]);
                if (course.rows.length === 0) return res.status(404).json({ mesaj: "Ders bulunamadı." });
                if (course.rows[0].ogretmen_id === userId) return next();
            } catch (err) { return next(err); }
        }

        // Öğrenci ise, o derse kayıtlı mı kontrol et
        if (rol === 'ogrenci') {
            try {
                const kayit = await pool.query("SELECT id FROM ders_kayitlari WHERE ders_id = $1 AND ogrenci_id = $2", [dersId, userId]);
                if (kayit.rows.length > 0) return next();
                else return res.status(403).json({ mesaj: "Bu dersin oturumlarını görüntüleme yetkiniz yok (kayıtlı değilsiniz)." });
            } catch (err) { return next(err); }
        }

        return res.status(403).json({ mesaj: "Bu dersin oturumlarını görüntüleme yetkiniz yok." });
    },
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
            const { rows } = await pool.query(
            "SELECT * FROM oturumlar WHERE ders_id = $1 ORDER BY tarih DESC, saat DESC",
            [dersId]
            );
            res.json(rows);
        } catch (err) {
            next(err);
        }
    }
);

// /api/oturum/ogrenci-ders/:dersId endpointi, /api/oturum/ders/:dersId ile aynı işlevi görsün
router.get("/ogrenci-ders/:dersId",
    async (req, res, next) => {
        const { dersId } = req.params;
        const { id: userId, rol } = req.user;

        if (rol === 'admin') return next();

        if (rol === 'ogretmen') {
            try {
                const course = await pool.query("SELECT ogretmen_id FROM dersler WHERE id = $1", [dersId]);
                if (course.rows.length === 0) return res.status(404).json({ mesaj: "Ders bulunamadı." });
                if (course.rows[0].ogretmen_id === userId) return next();
            } catch (err) { return next(err); }
        }

        // Öğrenci ise, o derse kayıtlı mı kontrol et
        if (rol === 'ogrenci') {
            try {
                const kayit = await pool.query("SELECT id FROM ders_kayitlari WHERE ders_id = $1 AND ogrenci_id = $2", [dersId, userId]);
                if (kayit.rows.length > 0) return next();
                else return res.status(403).json({ mesaj: "Bu dersin oturumlarını görüntüleme yetkiniz yok (kayıtlı değilsiniz)." });
            } catch (err) { return next(err); }
        }

        return res.status(403).json({ mesaj: "Bu dersin oturumlarını görüntüleme yetkiniz yok." });
    },
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
            const { rows } = await pool.query(
            "SELECT * FROM oturumlar WHERE ders_id = $1 ORDER BY tarih DESC, saat DESC",
            [dersId]
            );
            res.json(rows);
        } catch (err) {
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
            return res.status(400).json({ hatalar: errors.array() });
        }

        const { oturumId } = req.params;

        try {
            const oturumExists = await pool.query("SELECT id FROM oturumlar WHERE id = $1", [oturumId]);
            if (oturumExists.rows.length === 0) {
                return res.status(404).json({ mesaj: "Oturum bulunamadı." });
            }

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
                    y.konum  -- يمكنك تعديل هذا حسب الحاجة
                FROM yoklamalar y
                JOIN kullanicilar k ON y.ogrenci_id = k.id
                WHERE y.oturum_id = $1
                ORDER BY k.soyad, k.ad`,
                [oturumId]
            );



            res.status(200).json(yoklamaKayitlari.rows);
        } catch (err) {
            console.error("Yoklama listeleme hatası:", err);
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
    try {
      // Önce oturuma bağlı yoklamaları sil
      await pool.query("DELETE FROM yoklamalar WHERE oturum_id = $1", [oturumId]);
      // Sonra oturumu sil
      const result = await pool.query("DELETE FROM oturumlar WHERE id = $1 RETURNING *", [oturumId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ mesaj: "Oturum bulunamadı." });
      }
      res.json({ mesaj: "Oturum silindi.", oturum: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// Belirli bir ders ve gün için en yüksek max_count değerini döndüren endpoint
router.get("/son-oturum-no/:dersId/:tarih", async (req, res) => {
  const { dersId, tarih } = req.params;
  try {
    const { rows } = await pool.query(
      "SELECT COALESCE(MAX(max_count), 0) AS son_oturum_no FROM oturumlar WHERE ders_id = $1 AND tarih = $2",
      [dersId, tarih]
    );
    res.json({ son_oturum_no: parseInt(rows[0].son_oturum_no) });
  } catch (err) {
    res.status(500).json({ mesaj: 'Sunucu hatası', detay: err.message });
  }
});

// Oturum bitirme endpoint'i
router.post(
  "/:oturumId/bitir",
  canAccessSessionData, // Yetki kontrolü
  async (req, res, next) => {
    const { oturumId } = req.params;
    try {
      // 1. Oturumun max_count'unu al
      const oturumRes = await pool.query(
        "SELECT max_count FROM oturumlar WHERE id = $1",
        [oturumId]
      );
      if (oturumRes.rows.length === 0) {
        return res.status(404).json({ mesaj: "Oturum bulunamadı." });
      }
      const maxCount = oturumRes.rows[0].max_count;
      // 2. count >= max_count olanları 'katildi', diğerlerini 'katilmadi' yap
      await pool.query(
        `UPDATE yoklamalar SET durum = 'katildi'
         WHERE oturum_id = $1 AND count >= $2`,
        [oturumId, maxCount]
      );
      await pool.query(
        `UPDATE yoklamalar SET durum = 'katilmadi'
         WHERE oturum_id = $1 AND (count IS NULL OR count < $2)`,
        [oturumId, maxCount]
      );
      res.status(200).json({ mesaj: 'Yoklama bitirildi. Eksik öğrenciler katılmadı olarak işaretlendi.' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

