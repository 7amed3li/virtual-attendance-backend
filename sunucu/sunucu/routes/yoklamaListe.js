const express = require("express");
const router = express.Router();
const pool = require("../config/veritabani");
const { verifyToken } = require("../middleware/verifyToken");
const { sadeceOgrenci } = require("../middleware/yetkiKontrol");
const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient(); // Prisma Client'ı oluştur -ÖZGÜRCAN

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
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   oturum_id:
 *                     type: integer
 *                   ogrenci_id:
 *                     type: integer
 *                   zaman:
 *                     type: string
 *                     format: date-time
 *                   durum:
 *                     type: string
 *                   konum:
 *                     type: string
 */
router.get("/:ogrenciId", async (req, res, next) => {
  const { ogrenciId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT y.*, o.ders_id, o.tarih, o.saat
       FROM yoklamalar y
       JOIN oturumlar o ON y.oturum_id = o.id
       WHERE y.ogrenci_id = $1`,
      [ogrenciId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
