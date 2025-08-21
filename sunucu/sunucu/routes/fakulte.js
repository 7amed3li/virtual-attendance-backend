const express = require("express");
const router = express.Router();
const pool = require("../config/veritabani");
const { body, param, validationResult } = require("express-validator");
const { sadeceAdmin } = require("../middleware/yetkiKontrol"); // ✅ صلاحيات الادمن
const verifyToken = require("../middleware/verifyToken");
const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient(); // Prisma Client'ı oluştur -ÖZGÜRCAN


/**
 * @swagger
 * tags:
 *   name: Fakulte
 *   description: Fakülte yönetim işlemleri
 */

/**
 * @swagger
 * /api/fakulte:
 *   get:
 *     summary: Tüm fakülteleri listeler
 *     tags: [Fakulte]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Fakülte listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   ad:
 *                     type: string
 */
router.get("/", verifyToken, async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM fakulteler");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/fakulte/ekle:
 *   post:
 *     summary: Yeni bir fakülte ekler
 *     tags: [Fakulte]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ad
 *             properties:
 *               ad:
 *                 type: string
 *                 description: Fakülte adı
 *     responses:
 *       201:
 *         description: Fakülte başarıyla eklendi
 *       400:
 *         description: Geçersiz istek
 *       500:
 *         description: Sunucu hatası
 */
router.post(
  "/ekle",
  sadeceAdmin,
  [
    body("ad").notEmpty().withMessage("Fakülte adı gerekli"),
    body("enlem").isFloat().withMessage("Enlem geçerli bir sayı olmalı"),
    body("boylam").isFloat().withMessage("Boylam geçerli bir sayı olmalı")
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ hatalar: errors.array() });

    const { ad, enlem, boylam } = req.body;
    try {
      const { rows } = await pool.query(
        "INSERT INTO fakulteler (ad, enlem, boylam) VALUES ($1, $2, $3) RETURNING *",
        [ad, enlem, boylam]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/fakulte/{id}:
 *   put:
 *     summary: Mevcut fakültenin adını günceller
 *     tags: [Fakulte]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Fakülte ID'si
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ad:
 *                 type: string
 *     responses:
 *       200:
 *         description: Fakülte güncellendi
 *       400:
 *         description: Geçersiz istek
 *       404:
 *         description: Fakülte bulunamadı
 */
router.put(
  "/:id",
  sadeceAdmin,
  [
    param("id").isInt().withMessage("Geçerli bir fakülte ID girilmelidir."),
    body("ad").notEmpty().withMessage("Fakülte adı gerekli"),
    body("enlem").isFloat().withMessage("Enlem geçerli bir sayı olmalı"),
    body("boylam").isFloat().withMessage("Boylam geçerli bir sayı olmalı")
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ hatalar: errors.array() });

    const { id } = req.params;
    const { ad, enlem, boylam } = req.body;
    try {
      const result = await pool.query(
        "UPDATE fakulteler SET ad = $1, enlem = $2, boylam = $3 WHERE id = $4 RETURNING *",
        [ad, enlem, boylam, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ mesaj: "Fakülte bulunamadı" });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/fakulte/{id}:
 *   delete:
 *     summary: Belirtilen fakülteyi siler
 *     tags: [Fakulte]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Fakülte ID'si
 *     responses:
 *       204:
 *         description: Silme başarılı
 *       404:
 *         description: Fakülte bulunamadı
 */
router.delete("/:id", sadeceAdmin, async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM fakulteler WHERE id = $1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ mesaj: "Fakülte bulunamadı" });
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
});
/**
 * @swagger
 * /api/fakulte/{id}:
 *   get:
 *     summary: Belirli bir fakülteyi getirir
 *     tags: [Fakulte]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Fakülte ID'si
 *     responses:
 *       200:
 *         description: Fakülte bulundu
 *       404:
 *         description: Fakülte bulunamadı
 */
router.get("/:id", sadeceAdmin, async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM fakulteler WHERE id = $1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ mesaj: "Fakülte bulunamadı" });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});
module.exports = router;
