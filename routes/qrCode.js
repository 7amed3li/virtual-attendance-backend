const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const pool = require("../config/veritabani");
const { canAccessSessionData } = require('./oturumListe');
const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient(); // Prisma Client'ı oluştur -ÖZGÜRCAN


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
    if (rol === "admin") {
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
                return next();
            }
        } catch (err) {
            return res.status(500).json({ mesaj: "Yetki kontrolü sırasında sunucu hatası" });
        }
    }
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
    if (!oturum_id || !konum_ad || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ mesaj: "oturum_id, konum_ad, latitude ve longitude gereklidir." });
    }
    try {
        const oturumResult = await pool.query(
            `SELECT o.*, d.ad as ders_adi FROM oturumlar o JOIN dersler d ON o.ders_id = d.id WHERE o.id = $1`,
            [oturum_id]
        );
        if (oturumResult.rows.length === 0) {
            return res.status(404).json({ mesaj: "Oturum bulunamadı." });
        }
        const oturum = oturumResult.rows[0];
        const qrPayload = {
            oturumId: oturum_id,
            latitude,
            longitude,
            count: oturum.max_count || 1
        };
        const qrTokenValiditySeconds = parseInt(process.env.QR_TOKEN_VALIDITY_SECONDS || "10");
        const qrData = jwt.sign(qrPayload, process.env.JWT_SECRET || "gizliAnahtar", {
            expiresIn: qrTokenValiditySeconds
        });
        res.status(200).json({
            qrData: qrData,
            expiresIn: qrTokenValiditySeconds
        });
    } catch (err) {
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
  try {
    const { rows } = await pool.query("SELECT ad, enlem as latitude, boylam as longitude FROM fakulteler");
    res.json(rows);
  } catch (err) {
    console.error("Fakülte konumları alınırken hata:", err);
    res.status(500).json({ mesaj: "Fakülte konumları alınamadı." });
  }
});

module.exports = { router, KONUM_LISTESI };
