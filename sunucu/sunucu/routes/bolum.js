const express = require("express");
const router = express.Router();
const pool = require("../config/veritabani");
const { body, param, validationResult } = require("express-validator");
const verifyToken = require("../middleware/verifyToken");

const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient(); // Prisma Client'ı oluştur -ÖZGÜRCAN



/**
 * @swagger
 * tags:
 *   name: Bolum
 *   description: Bölüm yönetim işlemleri
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Bolum:
 *       type: object
 *       required:
 *         - id
 *         - ad
 *         - fakulte_id
 *       properties:
 *         id:
 *           type: integer
 *           description: Bölümün benzersiz ID'si
 *         ad:
 *           type: string
 *           description: Bölümün adı
 *         fakulte_id:
 *           type: integer
 *           description: Bölümün bağlı olduğu fakültenin ID'si
 */

/**
 * @swagger
 * /api/bolum:
 *   get:
 *     summary: Tüm bölümleri listeler
 *     tags: [Bolum]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bölüm listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Bolum'
 *       403:
 *         description: Yetkisiz erişim
 */
router.get("/", verifyToken, async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM bolumler");
    res.json(rows);
  } catch (err) {
    console.error("❌ Bölümler alınamadı:", err);
    next(err);
  }
});

/**
 * @swagger
 * /api/bolum/ekle:
 *   post:
 *     summary: Yeni bir bölüm ekler
 *     tags: [Bolum]
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
 *               - fakulte_id
 *             properties:
 *               ad:
 *                 type: string
 *               fakulte_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Bölüm eklendi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bolum'
 *       400:
 *         description: Geçersiz istek
 *       409:
 *         description: Çakışma (örneğin, bölüm zaten mevcut)
 */
router.post(
  "/ekle",
  verifyToken,
  [
    body("ad").notEmpty().withMessage("Bölüm adı gerekli"),
    body("fakulte_id").isInt().withMessage("fakulte_id bir tamsayı olmalı")
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ hatalar: errors.array() });

    const { ad, fakulte_id } = req.body;

    console.log(`📌 Yeni bölüm ekleniyor: ${ad}, fakülte ID: ${fakulte_id}`);

    try {
      const { rows } = await pool.query(
        "INSERT INTO bolumler (ad, fakulte_id) VALUES ($1, $2) RETURNING *",
        [ad, fakulte_id]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error("❌ Bölüm ekleme hatası:", err);
      if (err.code === "23505") { // Unique violation
        return res.status(409).json({ mesaj: "Bu bölüm zaten mevcut" });
      }
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/bolum/{id}:
 *   put:
 *     summary: Bölüm adını günceller
 *     tags: [Bolum]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
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
 *         description: Bölüm güncellendi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bolum'
 *       404:
 *         description: Bölüm bulunamadı
 */
router.put(
  "/:id",
  verifyToken,
  [
    param("id").isInt().withMessage("id bir tamsayı olmalı"),
    body("ad").notEmpty().withMessage("Bölüm adı gerekli")
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ hatalar: errors.array() });

    const { id } = req.params;
    const { ad } = req.body;

    console.log(`✏️ Bölüm güncelleniyor: ID=${id}, yeni ad=${ad}`);

    try {
      const result = await pool.query(
        "UPDATE bolumler SET ad = $1 WHERE id = $2 RETURNING *",
        [ad, id]
      );

      if (result.rows.length === 0) return res.status(404).json({ mesaj: "Bölüm bulunamadı" });

      res.json(result.rows[0]);
    } catch (err) {
      console.error("❌ Bölüm güncelleme hatası:", err);
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/bolum/{id}:
 *   delete:
 *     summary: Belirtilen bölümü siler
 *     tags: [Bolum]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Silme başarılı
 *       404:
 *         description: Bölüm bulunamadı
 *       409:
 *         description: Silme başarısız (ilişkili veriler mevcut)
 */
router.delete(
  "/:id",
  verifyToken,
  [param("id").isInt().withMessage("id bir tamsayı olmalı")],
  async (req, res, next) => {
    const { id } = req.params;

    console.log(`🗑️ Bölüm siliniyor: ID=${id}`);

    try {
      const result = await pool.query("DELETE FROM bolumler WHERE id = $1", [id]);

      if (result.rowCount === 0) return res.status(404).json({ mesaj: "Bölüm bulunamadı" });

      res.sendStatus(204);
    } catch (err) {
      console.error("❌ Bölüm silme hatası:", err);
      if (err.code === "23503") { // Foreign key violation
        return res.status(409).json({ mesaj: "Bu bölüm silinemez, ilişkili veriler mevcut" });
      }
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/bolum/{id}:
 *   get:
 *     summary: Belirli bir bölümün detaylarını getirir
 *     tags: [Bolum]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Bölüm ID'si
 *     responses:
 *       200:
 *         description: Bölüm detayları
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bolum'
 *       404:
 *         description: Bölüm bulunamadı
 */
router.get(
  "/:id",
  verifyToken,
  [param("id").isInt().withMessage("id bir tamsayı olmalı")],
  async (req, res, next) => {
    const { id } = req.params;
    try {
      const result = await pool.query("SELECT * FROM bolumler WHERE id = $1", [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ mesaj: "Bölüm bulunamadı" });
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);
module.exports = router;