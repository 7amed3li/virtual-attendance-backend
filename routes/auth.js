const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const pool = require("../config/veritabani");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient(); // Prisma Client'ı oluştur -ÖZGÜRCAN

/**
 * @swagger
 * /api/giris:
 *   post:
 *     summary: Universite kodu ve sifre ile giriş yapar
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - universite_kodu
 *               - sifre
 *             properties:
 *               universite_kodu:
 *                 type: string
 *                 description: Üniversite tarafından verilen benzersiz kod
 *               sifre:
 *                 type: string
 *                 description: Kullanıcı şifresi
 *     responses:
 *       200:
 *         description: Giriş başarılı, token döner
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mesaj:
 *                   type: string
 *                 token:
 *                   type: string
 *       400:
 *         description: Doğrulama hatası (eksik/yanlış veri)
 *       401:
 *         description: Kullanıcı bulunamadı veya şifre yanlış
 *       500:
 *         description: Sunucu hatası
 */
const { body, validationResult } = require("express-validator");

router.post(
  "/giris",
  [
    body("universite_kodu")
      .notEmpty().withMessage("universite_kodu gerekli")
      .isAlphanumeric().withMessage("universite_kodu alfanümerik olmalı"),
    body("sifre")
      .notEmpty().withMessage("sifre gerekli")
      .isLength({ min: 6 }).withMessage("sifre en az 6 karakter olmalı")
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { universite_kodu, sifre } = req.body;

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ mesaj: "Sunucu yapılandırması hatalı: JWT_SECRET eksik" });
    }

    try {
      const result = await pool.query(
        "SELECT * FROM kullanicilar WHERE universite_kodu = $1",
        [universite_kodu]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ mesaj: "Giriş başarısız. Kullanıcı bulunamadı veya şifre hatalı." });
      }

      const kullanici = result.rows[0];

      if (kullanici.aktif_mi === false) {
        return res.status(403).json({ mesaj: "Hesabınız pasif durumda. Lütfen yöneticiyle iletişime geçin." });
      }

      const sifreDogruMu = await bcrypt.compare(sifre, kullanici.sifre);
      if (!sifreDogruMu) {
        return res.status(401).json({ mesaj: "Giriş başarısız. Kullanıcı bulunamadı veya şifre hatalı." });
      }

      const token = jwt.sign(
        { id: kullanici.id, rol: kullanici.rol },
        jwtSecret,
        { expiresIn: "2h" } // Token süresi 2 saat
      );

      await pool.query(
        "UPDATE kullanicilar SET giris_sayisi = giris_sayisi + 1, son_giris = CURRENT_TIMESTAMP WHERE id = $1",
        [kullanici.id]
      );

      res.json({
        mesaj: "Giriş başarılı",
        token,
        rol: kullanici.rol
      });

    } catch (err) {
      console.error("🔴 Giriş hatası:", err);
      res.status(500).json({ mesaj: "Sunucu hatası", detay: err.message });
    }
  }
);

/**
 * @swagger
 * /api/auth/request-password-reset:
 *   post:
 *     summary: Şifre sıfırlama talebi oluşturur.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eposta
 *             properties:
 *               eposta:
 *                 type: string
 *                 format: email
 *                 description: Şifresi sıfırlanacak kullanıcının e-posta adresi.
 *     responses:
 *       200:
 *         description: Şifre sıfırlama talebi alındı. E-posta gönderildi (simüle edildi).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mesaj:
 *                   type: string
 *                 resetToken: 
 *                   type: string
 *                   description: Geliştirme/test için sıfırlama tokeni (normalde e-posta ile gönderilir).
 *       400:
 *         description: Doğrulama hatası (geçersiz e-posta formatı).
 *       404:
 *         description: Bu e-posta adresine sahip kullanıcı bulunamadı.
 *       500:
 *         description: Sunucu hatası.
 */
router.post(
    "/auth/request-password-reset",
    [body("eposta").isEmail().withMessage("Geçerli bir e-posta adresi giriniz.")],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ hatalar: errors.array() });
        }

        const { eposta } = req.body;

        try {
            const userQuery = await pool.query("SELECT id, universite_kodu FROM kullanicilar WHERE eposta = $1", [eposta]);
            if (userQuery.rows.length === 0) {
                return res.status(404).json({ mesaj: "Bu e-posta adresine sahip kullanıcı bulunamadı." });
            }
            const user = userQuery.rows[0];

            const resetToken = crypto.randomBytes(32).toString("hex");
            const hashedResetToken = crypto.createHash("sha256").update(resetToken).digest("hex"); // Store hashed token

            const tokenExpiryMinutes = parseInt(process.env.RESET_TOKEN_EXPIRY_MINUTES || "60");
            const expiresAt = new Date(Date.now() + tokenExpiryMinutes * 60 * 1000);

            await pool.query(
                "UPDATE kullanicilar SET reset_password_token = $1, reset_password_token_expires_at = $2 WHERE id = $3",
                [hashedResetToken, expiresAt, user.id]
            );

            res.status(200).json({
                mesaj: "Şifre sıfırlama talebiniz alındı. Lütfen e-postanızı kontrol edin.",
                resetToken: resetToken
 // Only show in dev
            });

        } catch (err) {
            console.error("Şifre sıfırlama talebi hatası:", err);
            next(err);
        }
    }
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Verilen token ile şifreyi sıfırlar.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - yeni_sifre
 *             properties:
 *               token:
 *                 type: string
 *                 description: E-posta ile gönderilen şifre sıfırlama tokeni.
 *               yeni_sifre:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: Yeni kullanıcı şifresi.
 *     responses:
 *       200:
 *         description: Şifre başarıyla sıfırlandı.
 *       400:
 *         description: Doğrulama hatası (token veya şifre eksik/geçersiz).
 *       401:
 *         description: Geçersiz veya süresi dolmuş token.
 *       500:
 *         description: Sunucu hatası.
 */
router.post(
    "/auth/reset-password",
    [
        body("token").notEmpty().withMessage("Token gerekli."),
        body("yeni_sifre").isLength({ min: 6 }).withMessage("Yeni şifre en az 6 karakter olmalı.")
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ hatalar: errors.array() });
        }

        const { token, yeni_sifre } = req.body;
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        try {
            const userQuery = await pool.query(
                "SELECT id, reset_password_token_expires_at FROM kullanicilar WHERE reset_password_token = $1", 
                [hashedToken]
            );

            if (userQuery.rows.length === 0) {
                return res.status(401).json({ mesaj: "Geçersiz şifre sıfırlama tokeni." });
            }

            const user = userQuery.rows[0];
            const now = new Date();

            if (user.reset_password_token_expires_at < now) {
                await pool.query("UPDATE kullanicilar SET reset_password_token = NULL, reset_password_token_expires_at = NULL WHERE id = $1", [user.id]);
                return res.status(401).json({ mesaj: "Şifre sıfırlama tokeninin süresi dolmuş." });
            }

            const newHashedPassword = await bcrypt.hash(yeni_sifre, 10);

            await pool.query(
                "UPDATE kullanicilar SET sifre = $1, reset_password_token = NULL, reset_password_token_expires_at = NULL, son_sifre_degisikligi = CURRENT_TIMESTAMP WHERE id = $2",
                [newHashedPassword, user.id]
            );

            res.status(200).json({ mesaj: "Şifreniz başarıyla sıfırlandı." });

        } catch (err) {
            console.error("Şifre sıfırlama hatası:", err);
            next(err);
        }
    }
);


module.exports = router;
