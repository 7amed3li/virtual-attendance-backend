
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const pool = require("../config/veritabani");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const transporter = require("../config/mailer");
const logger = require("../utils/logger"); // استيراد logger

const { body, validationResult } = require("express-validator");

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
 *                 rol:
 *                   type: string
 *       400:
 *         description: Doğrulama hatası (eksik/yanlış veri)
 *       401:
 *         description: Kullanıcı bulunamadı veya şifre yanlış
 *       403:
 *         description: Hesap pasif
 *       500:
 *         description: Sunucu hatası
 */
router.post(
  "/giris",
  [
    body("universite_kodu")
      .notEmpty().withMessage("universite_kodu gerekli")
      .isAlphanumeric().withMessage("universite_kodu alfanümerik olmalı"),
    body("sifre")
      .notEmpty().withMessage("sifre gerekli")
      .isLength({ min: 6 }).withMessage("sifre en az 6 karakter olmalı"),
  ],
  async (req, res) => {
    logger.debug("🔍 Başlangıç: Kullanıcı giriş isteği alındı", { universite_kodu: req.body.universite_kodu });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array() });
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { universite_kodu, sifre } = req.body;

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error("❗ FATAL: JWT_SECRET ortam değişkeni eksik!");
      return res.status(500).json({ mesaj: "Sunucu yapılandırması hatalı: JWT_SECRET eksik" });
    }

    try {
      const result = await pool.query(
        "SELECT * FROM kullanicilar WHERE universite_kodu = $1",
        [universite_kodu]
      );

      if (result.rows.length === 0) {
        logger.warn("❌ Kullanıcı bulunamadı", { universite_kodu });
        return res.status(401).json({ mesaj: "Giriş başarısız. Kullanıcı bulunamadı veya şifre hatalı." });
      }

      const kullanici = result.rows[0];

      if (kullanici.aktif_mi === false) {
        logger.warn("⛔ Pasif hesap giriş denemesi", { universite_kodu });
        return res.status(403).json({ mesaj: "Hesabınız pasif durumda. Lütfen yöneticiyle iletişime geçin." });
      }


      const sifreDogruMu = await bcrypt.compare(sifre, kullanici.sifre);

      if (!sifreDogruMu) {
        logger.warn("❌ Yanlış şifre", { universite_kodu });
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

      logger.info("✅ Giriş başarılı", { user_id: kullanici.id, rol: kullanici.rol });
      res.json({
        mesaj: "Giriş başarılı",
        token,
        rol: kullanici.rol,
      });
    } catch (err) {
      logger.error("🔴 Giriş hatası", { error: err.message, stack: err.stack });
      res.status(500).json({ mesaj: "Sunucu hatası", detay: err.message });
    }
  }
);

/**
 * @swagger
 * /api/auth/request-password-reset:
 *   post:
 *     summary: Şifre sıfırlama talebi oluşturur ve kullanıcıya 6 haneli kod gönderir.
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
 *         description: Talep başarılı. E-posta adresi sistemde kayıtlıysa, sıfırlama kodu gönderilecektir.
 */
router.post(
  "/auth/request-password-reset",
  [body("eposta").isEmail().withMessage("Geçerli bir e-posta adresi giriniz.")],
  async (req, res) => {
    logger.debug("🔍 Başlangıç: Şifre sıfırlama talebi alındı", { eposta: req.body.eposta });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), eposta: req.body.eposta });
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { eposta } = req.body;

    try {
      const userQuery = await pool.query("SELECT id, ad FROM kullanicilar WHERE eposta = $1", [eposta]);

      if (userQuery.rows.length === 0) {
        logger.warn("⚠️ Kayıtlı olmayan e-posta ile sıfırlama talebi", { eposta });
        return res.status(200).json({
          mesaj: "Eğer bu e-posta adresi sistemimizde kayıtlıysa, bir sıfırlama kodu gönderilmiştir.",
        });
      }

      const user = userQuery.rows[0];

      // ✅ 1. إنشاء رمز رقمي آمن مكون من 6 أرقام
      const resetCode = crypto.randomInt(100000, 999999).toString();

      // تحديد مدة صلاحية الرمز (10 دقائق)
      const tokenExpiryMinutes = parseInt(process.env.RESET_TOKEN_EXPIRY_MINUTES || "10");
      const expiresAt = new Date(Date.now() + tokenExpiryMinutes * 60 * 1000);

      // ✅ 2. تخزين الرمز الرقمي (بدلاً من التوكن الطويل)
      await pool.query(
        "UPDATE kullanicilar SET reset_password_token = $1, reset_password_token_expires_at = $2 WHERE id = $3",
        [resetCode, expiresAt, user.id]
      );

      // ✅ 3. تحديث محتوى البريد الإلكتروني ليعرض الرمز
      const mailOptions = {
        to: eposta,
        from: `"QR Yoklama Sistemi" <${process.env.EMAIL_USER}>`,
        subject: "Şifre Sıfırlama Kodunuz",
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; text-align: center;">
            <h2>Merhaba ${user.ad},</h2>
            <p>Hesabınız için şifre sıfırlama talebinde bulundunuz.</p>
            <p>Şifrenizi sıfırlamak için kullanacağınız kod aşağıdadır. Bu kod <strong>${tokenExpiryMinutes} dakika</strong> geçerlidir.</p>
            <div style="font-size: 28px; font-weight: bold; letter-spacing: 8px; background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px auto; display: inline-block;">
              ${resetCode}
            </div>
            <hr>
            <p style="font-size: 0.9em; color: #777;">Eğer bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);

      logger.info("✅ Şifre sıfırlama kodu gönderildi", { eposta, user_id: user.id });
      res.status(200).json({
        mesaj: "Eğer bu e-posta adresi sistemimizde kayıtlıysa, bir sıfırlama kodu gönderilmiştir.",
      });
    } catch (err) {
      logger.error("🔴 Şifre sıfırlama talebi hatası", { error: err.message, stack: err.stack, eposta });
      res.status(500).json({ mesaj: "İşlem sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin." });
    }
  }
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Verilen kod ile şifreyi sıfırlar.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eposta
 *               - code
 *               - yeni_sifre
 *             properties:
 *               eposta:
 *                 type: string
 *                 format: email
 *                 description: Kullanıcının e-posta adresi.
 *               code:
 *                 type: string
 *                 description: E-posta ile gönderilen 6 haneli sıfırlama kodu.
 *               yeni_sifre:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: Yeni kullanıcı şifresi.
 *     responses:
 *       200:
 *         description: Şifre başarıyla sıfırlandı.
 *       400:
 *         description: Geçersiz veya süresi dolmuş kod.
 */
router.post(
  "/auth/reset-password",
  [
    body("eposta").isEmail().withMessage("Geçerli bir e-posta adresi giriniz."),
    body("code").isLength({ min: 6, max: 6 }).withMessage("Kod 6 haneli olmalıdır."),
    body("yeni_sifre").isLength({ min: 6 }).withMessage("Yeni şifre en az 6 karakter olmalı."),
  ],
  async (req, res) => {
    logger.debug("🔍 Başlangıç: Şifre sıfırlama isteği alındı", { eposta: req.body.eposta });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), eposta: req.body.eposta });
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { eposta, code, yeni_sifre } = req.body;

    try {
      const userQuery = await pool.query(
        "SELECT id, reset_password_token_expires_at FROM kullanicilar WHERE eposta = $1 AND reset_password_token = $2",
        [eposta, code]
      );

      if (userQuery.rows.length === 0) {
        logger.warn("❌ Geçersiz e-posta veya sıfırlama kodu", { eposta });
        return res.status(400).json({ mesaj: "Geçersiz e-posta veya sıfırlama kodu." });
      }

      const user = userQuery.rows[0];
      const now = new Date();

      if (user.reset_password_token_expires_at < now) {
        await pool.query(
          "UPDATE kullanicilar SET reset_password_token = NULL, reset_password_token_expires_at = NULL WHERE id = $1",
          [user.id]
        );
        logger.warn("⛔ Sıfırlama kodunun süresi dolmuş", { eposta, user_id: user.id });
        return res.status(400).json({ mesaj: "Sıfırlama kodunun süresi dolmuş. Lütfen yeni bir kod talep edin." });
      }

      const newHashedPassword = await bcrypt.hash(yeni_sifre, 10);

      await pool.query(
        "UPDATE kullanicilar SET sifre = $1, reset_password_token = NULL, reset_password_token_expires_at = NULL, son_sifre_degisikligi = CURRENT_TIMESTAMP WHERE id = $2",
        [newHashedPassword, user.id]
      );

      logger.info("✅ Şifre başarıyla sıfırlandı", { eposta, user_id: user.id });
      res.status(200).json({ mesaj: "Şifreniz başarıyla sıfırlandı." });
    } catch (err) {
      logger.error("🔴 Şifre sıfırlama hatası", { error: err.message, stack: err.stack, eposta });
      res.status(500).json({ mesaj: "İşlem sırasında bir hata oluştu." });
    }
  }
);

// =================================================================
// == FLUTTER PASSWORD RESET ENDPOINTS ==
// =================================================================

/**
 * @swagger
 * /api/auth/request-password-reset-flutter:
 *   post:
 *     summary: (FLUTTER) Şifre sıfırlama talebi oluşturur ve kullanıcıya 6 haneli kod gönderir.
 *     tags: [Auth, Flutter]
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
 *         description: Talep başarılı. E-posta adresi sistemde kayıtlıysa, sıfırlama kodu gönderilecektir.
 *       400:
 *         description: Geçersiz e-posta formatı.
 *       500:
 *         description: Sunucu hatası.
 */
router.post(
  "/auth/request-password-reset-flutter",
  [body("eposta").isEmail().withMessage("Geçerli bir e-posta adresi giriniz.")],
  async (req, res) => {
    logger.debug("🔍 Başlangıç: Flutter şifre sıfırlama talebi alındı", { eposta: req.body.eposta });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), eposta: req.body.eposta });
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { eposta } = req.body;

    try {
      const userQuery = await pool.query("SELECT id, ad FROM kullanicilar WHERE eposta = $1", [eposta]);

      if (userQuery.rows.length === 0) {
        logger.warn("⚠️ Kayıtlı olmayan e-posta ile sıfırlama talebi (Flutter)", { eposta });
        return res.status(200).json({
          mesaj: "Eğer bu e-posta adresi sistemimizde kayıtlıysa, bir sıfırlama kodu gönderilmiştir.",
        });
      }

      const user = userQuery.rows[0];

      // 1. إنشاء رمز رقمي آمن مكون من 6 أرقام
      const resetCode = crypto.randomInt(100000, 999999).toString();

      // 2. تحديد مدة صلاحية الرمز (مثلاً 10 دقائق)
      const tokenExpiryMinutes = parseInt(process.env.RESET_TOKEN_EXPIRY_MINUTES || "10");
      const expiresAt = new Date(Date.now() + tokenExpiryMinutes * 60 * 1000);

      // 3. تخزين الرمز (بدون تشفير لأنه قصير الأجل) وتاريخ الانتهاء
      await pool.query(
        "UPDATE kullanicilar SET reset_password_token = $1, reset_password_token_expires_at = $2 WHERE id = $3",
        [resetCode, expiresAt, user.id]
      );

      // 4. إعداد وإرسال البريد الإلكتروني
      const mailOptions = {
        to: eposta,
        from: `"QR Yoklama Sistemi" <${process.env.EMAIL_USER}>`,
        subject: "Şifre Sıfırlama Kodunuz",
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; text-align: center;">
            <h2>Merhaba ${user.ad},</h2>
            <p>Hesabınız için şifre sıfırlama talebinde bulundunuz.</p>
            <p>Şifrenizi sıfırlamak için kullanacağınız kod aşağıdadır. Bu kod <strong>${tokenExpiryMinutes} dakika</strong> geçerlidir.</p>
            <div style="font-size: 28px; font-weight: bold; letter-spacing: 8px; background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px auto; display: inline-block;">
              ${resetCode}
            </div>
            <hr>
            <p style="font-size: 0.9em; color: #777;">Eğer bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);

      logger.info("✅ Flutter şifre sıfırlama kodu gönderildi", { eposta, user_id: user.id });
      res.status(200).json({
        mesaj: "Eğer bu e-posta adresi sistemimizde kayıtlıysa, bir sıfırlama kodu gönderilmiştir.",
      });
    } catch (err) {
      logger.error("🔴 Flutter şifre sıfırlama talebi hatası", { error: err.message, stack: err.stack, eposta });
      res.status(500).json({ mesaj: "İşlem sırasında bir hata oluştu." });
    }
  }
);

/**
 * @swagger
 * /api/auth/reset-password-flutter:
 *   post:
 *     summary: (FLUTTER) Verilen kod ile şifreyi sıfırlar.
 *     tags: [Auth, Flutter]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eposta
 *               - code
 *               - yeni_sifre
 *             properties:
 *               eposta:
 *                 type: string
 *                 format: email
 *                 description: Kullanıcının e-posta adresi.
 *               code:
 *                 type: string
 *                 description: E-posta ile gönderilen 6 haneli sıfırlama kodu.
 *               yeni_sifre:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: Yeni kullanıcı şifresi.
 *     responses:
 *       200:
 *         description: Şifre başarıyla sıfırlandı.
 *       400:
 *         description: Geçersiz veya süresi dolmuş kod.
 *       500:
 *         description: Sunucu hatası.
 */
router.post(
  "/auth/reset-password-flutter",
  [
    body("eposta").isEmail().withMessage("Geçerli bir e-posta adresi giriniz."),
    body("code").isLength({ min: 6, max: 6 }).withMessage("Kod 6 haneli olmalıdır."),
    body("yeni_sifre").isLength({ min: 6 }).withMessage("Yeni şifre en az 6 karakter olmalı."),
  ],
  async (req, res) => {
    logger.debug("🔍 Başlangıç: Flutter şifre sıfırlama isteği alındı", { eposta: req.body.eposta });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), eposta: req.body.eposta });
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { eposta, code, yeni_sifre } = req.body;

    try {
      const userQuery = await pool.query(
        "SELECT id, reset_password_token_expires_at FROM kullanicilar WHERE eposta = $1 AND reset_password_token = $2",
        [eposta, code]
      );

      if (userQuery.rows.length === 0) {
        logger.warn("❌ Geçersiz e-posta veya sıfırlama kodu (Flutter)", { eposta });
        return res.status(400).json({ mesaj: "Geçersiz e-posta veya sıfırlama kodu." });
      }

      const user = userQuery.rows[0];
      const now = new Date();

      if (user.reset_password_token_expires_at < now) {
        await pool.query(
          "UPDATE kullanicilar SET reset_password_token = NULL, reset_password_token_expires_at = NULL WHERE id = $1",
          [user.id]
        );
        logger.warn("⛔ Sıfırlama kodunun süresi dolmuş (Flutter)", { eposta, user_id: user.id });
        return res.status(400).json({ mesaj: "Sıfırlama kodunun süresi dolmuş. Lütfen yeni bir kod talep edin." });
      }

      const newHashedPassword = await bcrypt.hash(yeni_sifre, 10);

      await pool.query(
        "UPDATE kullanicilar SET sifre = $1, reset_password_token = NULL, reset_password_token_expires_at = NULL, son_sifre_degisikligi = CURRENT_TIMESTAMP WHERE id = $2",
        [newHashedPassword, user.id]
      );

      logger.info("✅ Flutter şifre başarıyla sıfırlandı", { eposta, user_id: user.id });
      res.status(200).json({ mesaj: "Şifreniz başarıyla sıfırlandı." });
    } catch (err) {
      logger.error("🔴 Flutter şifre sıfırlama hatası", { error: err.message, stack: err.stack, eposta });
      res.status(500).json({ mesaj: "İşlem sırasında bir hata oluştu." });
    }
  }
);

module.exports = router;


