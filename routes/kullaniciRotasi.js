const express = require("express");
const router = express.Router();
const pool = require("../config/veritabani");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, param, validationResult } = require("express-validator");
const verifyToken = require("../middleware/verifyToken");
const { sadeceAdmin } = require("../middleware/yetkiKontrol");
const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient(); 
const logger = require('../utils/logger');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Kullanıcı kimlik doğrulama, profil ve şifre yönetimi işlemleri
 */

/**
 * @swagger
 * /api/users/me/profile:
 *   put:
 *     summary: Oturum açmış kullanıcının profil bilgilerini günceller.
 *     tags: [Auth, Kullanıcı]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ad:
 *                 type: string
 *                 description: Kullanıcının adı.
 *               soyad:
 *                 type: string
 *                 description: Kullanıcının soyadı.
 *               eposta:
 *                 type: string
 *                 format: email
 *                 description: Kullanıcının e-posta adresi (eğer değiştirilebilir ise).
 *               telefon:
 *                 type: string
 *                 description: Kullanıcının telefon numarası (eğer varsa).
 *     responses:
 *       200:
 *         description: Profil başarıyla güncellendi.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Kullanici' # Assuming Kullanici schema exists
 *       400:
 *         description: Doğrulama hatası veya güncellenecek alan yok.
 *       401:
 *         description: Yetkisiz erişim (token gerekli).
 *       409:
 *         description: E-posta zaten kullanımda (eğer e-posta değiştiriliyorsa).
 *       500:
 *         description: Sunucu hatası.
 */
router.put(
    "/me/profile",
    verifyToken,
    [
        // قواعد التحقق من صحة البيانات المدخلة
        body("ad").optional().isString().trim().notEmpty().withMessage("Ad boş olamaz."),
        body("soyad").optional().isString().trim().notEmpty().withMessage("Soyad boş olamaz."),
        body("eposta").optional().isEmail().withMessage("Geçerli bir e-posta adresi giriniz."),
        body("telefon").optional().isString().trim(),
        // إضافة قاعدة تحقق للقسم إذا كان سيتم تحديثه
        body("bolum_id").optional().isInt({ gt: 0 }).withMessage("Geçerli bir bölüm ID girilmelidir.")
    ],
    async (req, res, next) => {
        logger.debug("🔍 Profil güncelleme isteği alındı", { user_id: req.user?.id });

        // التحقق من وجود أخطاء في البيانات المدخلة
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn("❌ Doğrulama hatası", { errors: errors.array(), user_id: req.user?.id });
            return res.status(400).json({ hatalar: errors.array() });
        }

        const userId = req.user.id;
        // استخراج الحقول القابلة للتحديث من جسم الطلب
        const { ad, soyad, eposta, telefon, bolum_id } = req.body;

        // بناء كائن يحتوي فقط على الحقول التي سيتم تحديثها
        const updateFields = {};
        if (ad) updateFields.ad = ad;
        if (soyad) updateFields.soyad = soyad;
        if (eposta) updateFields.eposta = eposta;
        if (telefon !== undefined) updateFields.telefon = telefon;
        if (bolum_id) updateFields.bolum_id = bolum_id;

        // إذا لم يتم إرسال أي حقل للتحديث، يتم إرجاع خطأ
        if (Object.keys(updateFields).length === 0) {
            logger.warn("❌ Güncellenecek alan belirtilmedi", { user_id: userId });
            return res.status(400).json({ mesaj: "Güncellenecek alan belirtilmedi." });
        }

        try {
            // التحقق مما إذا كان البريد الإلكتروني الجديد مستخدماً من قبل شخص آخر
            if (eposta) {
                const emailCheck = await pool.query("SELECT id FROM kullanicilar WHERE eposta = $1 AND id != $2", [eposta, userId]);
                if (emailCheck.rows.length > 0) {
                    logger.warn("❌ E-posta zaten kullanımda", { eposta, user_id: userId });
                    return res.status(409).json({ mesaj: "Bu e-posta adresi zaten başka bir kullanıcı tarafından kullanılıyor." });
                }
            }

            // --- بداية منطق التحديث والاسترجاع المعدل ---

            // 1. بناء جملة SET ديناميكياً لتحديث الحقول المطلوبة فقط
            const setClauses = Object.keys(updateFields).map((key, index) => `${key} = $${index + 1}`);
            const values = Object.values(updateFields);
            values.push(userId);

            // 2. تنفيذ استعلام التحديث
            const updateQuery = `UPDATE kullanicilar SET ${setClauses.join(", ")}, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING id`;
            const updateResult = await pool.query(updateQuery, values);

            // التحقق من أن عملية التحديث تمت بنجاح
            if (updateResult.rowCount === 0) {
                logger.warn("❌ Kullanıcı bulunamadı (güncelleme sırasında)", { user_id: userId });
                return res.status(404).json({ mesaj: "Güncelleme sırasında kullanıcı bulunamadı." });
            }

            // 3. بعد نجاح التحديث، تنفيذ استعلام جديد لجلب البيانات الكاملة والمحدثة
            const selectQuery = `
                SELECT 
                    k.id, 
                    k.universite_kodu, 
                    k.ad, 
                    k.soyad, 
                    k.eposta, 
                    k.rol, 
                    k.telefon, 
                    k.aktif_mi,
                    b.ad AS bolum_adi,     
                    f.ad AS fakulte_adi     
                FROM kullanicilar k
                LEFT JOIN bolumler b ON k.bolum_id = b.id
                LEFT JOIN fakulteler f ON b.fakulte_id = f.id
                WHERE k.id = $1;
            `;
            const { rows } = await pool.query(selectQuery, [userId]);

            // --- نهاية منطق التحديث والاسترجاع المعدل ---

            logger.info("✅ Profil başarıyla güncellendi", { user_id: userId, updated_fields: Object.keys(updateFields) });
            
            // 4. إرجاع الكائن الكامل الذي يحتوي على جميع البيانات المحدثة
            res.status(200).json(rows[0]);

        } catch (err) {
            logger.error("❌ Profil güncelleme hatası", { error: err.message, stack: err.stack, user_id: userId });
            next(err);
        }
    }
);


/**
 * @swagger
 * /api/users/me/change-password:
 *   put:
 *     summary: Oturum açmış kullanıcının şifresini değiştirir.
 *     tags: [Auth, Kullanıcı]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mevcut_sifre
 *               - yeni_sifre
 *             properties:
 *               mevcut_sifre:
 *                 type: string
 *                 format: password
 *                 description: Kullanıcının mevcut şifresi.
 *               yeni_sifre:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: Kullanıcının yeni şifresi.
 *     responses:
 *       200:
 *         description: Şifre başarıyla değiştirildi.
 *       400:
 *         description: Doğrulama hatası (eksik veya geçersiz şifreler).
 *       401:
 *         description: Yetkisiz erişim veya mevcut şifre yanlış.
 *       500:
 *         description: Sunucu hatası.
 */
router.put(
    "/me/change-password",
    verifyToken,
    [
        body("mevcut_sifre").notEmpty().withMessage("Mevcut şifre gerekli."),
        body("yeni_sifre").isLength({ min: 6 }).withMessage("Yeni şifre en az 6 karakter olmalı.")
    ],
    async (req, res, next) => {
        logger.debug("🔍 Şifre değiştirme isteği alındı", { user_id: req.user?.id });
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn("❌ Doğrulama hatası", { errors: errors.array(), user_id: req.user?.id });
            return res.status(400).json({ hatalar: errors.array() });
        }

        const userId = req.user.id;
        const { mevcut_sifre, yeni_sifre } = req.body;

        try {
            const userQuery = await pool.query("SELECT sifre FROM kullanicilar WHERE id = $1", [userId]);
            if (userQuery.rows.length === 0) {
                logger.warn("❌ Kullanıcı bulunamadı", { user_id: userId });
                return res.status(401).json({ mesaj: "Kullanıcı bulunamadı (yetkilendirme sorunu)." });
            }
            const storedPasswordHash = userQuery.rows[0].sifre;

            const isMatch = await bcrypt.compare(mevcut_sifre, storedPasswordHash);
            if (!isMatch) {
                logger.warn("❌ Mevcut şifre yanlış", { user_id: userId });
                return res.status(401).json({ mesaj: "Mevcut şifre yanlış." });
            }

            const newHashedPassword = await bcrypt.hash(yeni_sifre, 10);

            await pool.query(
                "UPDATE kullanicilar SET sifre = $1, son_sifre_degisikligi = CURRENT_TIMESTAMP WHERE id = $2",
                [newHashedPassword, userId]
            );

            logger.info("✅ Şifre başarıyla değiştirildi", { user_id: userId });
            res.status(200).json({ mesaj: "Şifreniz başarıyla değiştirildi." });
        } catch (err) {
            logger.error("❌ Şifre değiştirme hatası", { error: err.message, stack: err.stack, user_id: userId });
            next(err);
        }
    }
);

/**
 * @swagger
 * /api/users/me/profile:
 *   get:
 *     summary: Oturum açmış kullanıcının profil bilgilerini getirir.
 *     tags: [Auth, Kullanıcı]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kullanıcı profili başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 universite_kodu:
 *                   type: string
 *                 ad:
 *                   type: string
 *                 soyad:
 *                   type: string
 *                 eposta:
 *                   type: string
 *                 rol:
 *                   type: string
 *                 bolum:
 *                   type: string
 *                 fakulte:
 *                   type: string
 *       401:
 *         description: Yetkisiz erişim (token gerekli).
 *       404:
 *         description: Kullanıcı bulunamadı.
 *       500:
 *         description: Sunucu hatası.
 */
router.get(
    "/me/profile",
    verifyToken,
    async (req, res, next) => {
        logger.debug("🔍 Profil bilgisi alma isteği alındı", { user_id: req.user?.id });
        try {
            const userId = req.user.id;
            const result = await pool.query(
                "SELECT id, universite_kodu, ad, soyad, eposta, rol, telefon, hesap_durumu, aktif_mi FROM kullanicilar WHERE id = $1",
                [userId]
            );
            if (result.rows.length === 0) {
                logger.warn("❌ Kullanıcı bulunamadı", { user_id: userId });
                return res.status(404).json({ mesaj: "Kullanıcı bulunamadı" });
            }
            logger.info("✅ Profil bilgileri getirildi", { user_id: userId });
            res.json(result.rows[0]);
        } catch (err) {
            logger.error("❌ Profil bilgisi alma hatası", { error: err.message, stack: err.stack, user_id: req.user?.id });
            next(err);
        }
    }
);

/**
 * @swagger
 * /api/kullanici:
 *   get:
 *     summary: Tüm kullanıcıları listeler (sadece admin).
 *     tags: [Kullanıcı]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kullanıcı listesi başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Kullanici'
 *       403:
 *         description: Yetkisiz erişim
 *       500:
 *         description: Sunucu hatası
 */
router.get(
    "/",
    verifyToken,
    sadeceAdmin,
    async (req, res, next) => {
        logger.debug("🔍 Tüm kullanıcıları listeleme isteği alındı", { user_id: req.user?.id });
        try {
            const { rows } = await pool.query(
                "SELECT id, universite_kodu, ad, soyad, eposta, rol, hesap_durumu, olusturma_tarihi, son_giris FROM kullanicilar ORDER BY id ASC"
            );
            logger.info(`✅ ${rows.length} kullanıcı listelendi`, { user_id: req.user?.id });
            res.status(200).json(rows);
        } catch (err) {
            logger.error("❌ Kullanıcı listeleme hatası", { error: err.message, stack: err.stack, user_id: req.user?.id });
            next(err);
        }
    }
);

/**
 * @swagger
 * /api/kullanici/{id}:
 *   get:
 *     summary: Belirli bir kullanıcıyı getirir (sadece admin).
 *     tags: [Kullanıcı]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Kullanıcı ID'si
 *     responses:
 *       200:
 *         description: Kullanıcı başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 universite_kodu:
 *                   type: string
 *                 ad:
 *                   type: string
 *                 soyad:
 *                   type: string
 *                 eposta:
 *                   type: string
 *                 rol:
 *                   type: string
 *                 hesap_durumu:
 *                   type: string
 *                 bolum_id:
 *                   type: string
 *                 fakulte_id:
 *                   type: string
 *       401:
 *         description: Yetkisiz erişim (token gerekli).
 *       403:
 *         description: Sadece admin erişebilir.
 *       404:
 *         description: Kullanıcı bulunamadı.
 *       500:
 *         description: Sunucu hatası.
 */
router.get(
    "/:id",
    verifyToken,
    sadeceAdmin,
    async (req, res, next) => {
        logger.debug("🔍 Kullanıcı detayları isteği alındı", { kullanici_id: req.params.id, user_id: req.user?.id });
        try {
            const { id } = req.params;
            const result = await pool.query(
                "SELECT id, universite_kodu, ad, soyad, eposta, rol, hesap_durumu, bolum_id, fakulte_id FROM kullanicilar WHERE id = $1",
                [id]
            );

            if (result.rows.length === 0) {
                logger.warn("❌ Kullanıcı bulunamadı", { kullanici_id: id, user_id: req.user?.id });
                return res.status(404).json({ mesaj: "Kullanıcı bulunamadı" });
            }

            logger.info("✅ Kullanıcı detayları getirildi", { kullanici_id: id, user_id: req.user?.id });
            res.json(result.rows[0]);
        } catch (err) {
            logger.error("❌ Kullanıcı detayları getirme hatası", { error: err.message, stack: err.stack, kullanici_id: req.params.id, user_id: req.user?.id });
            next(err);
        }
    }
);
/**
 * @swagger
 * /api/kullanicilar/list-by-ids:
 *   post:
 *     summary: "Belirtilen ID listesindeki kullanıcıları (öğrencileri) getirir"
 *     tags: [Kullanıcı, Rapor]
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
 *                 description: "Detayları getirilecek kullanıcıların ID listesi"
 *     responses:
 *       200:
 *         description: "Kullanıcı listesi başarıyla getirildi"
 *       400:
 *         description: "Geçersiz istek verisi"
 */
router.post(
  "/list-by-ids",
  verifyToken, // 👈 تأكد من أن المستخدم مسجل دخوله
  sadeceAdmin,   // 👈 تأكد من أن المستخدم هو مدير (يمكن تغييرها إلى sadeceOgretmenVeAdmin إذا لزم الأمر)
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
      logger.warn("❌ /kullanicilar/list-by-ids doğrulama hatası", { errors: errors.array(), user_id: req.user?.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { ids } = req.body;
    logger.debug("🔍 ID listesine göre kullanıcı listeleme isteği alındı", { user_id: req.user?.id, count: ids.length });

    try {
      const query = `
        SELECT 
          id,
          ad,
          soyad,
          eposta,
          universite_kodu,
          rol,
          olusturma_tarihi
        FROM kullanicilar
        WHERE id = ANY($1::int[])
        ORDER BY soyad, ad;
      `;

      const { rows } = await pool.query(query, [ids]);

      logger.info(`✅ ID listesine göre ${rows.length} kullanıcı bulundu`, { user_id: req.user?.id });
      res.status(200).json(rows);

    } catch (err) {
      logger.error("❌ ID listesine göre kullanıcı listeleme hatası", { error: err.message, stack: err.stack, user_id: req.user?.id });
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/kullanici/{id}:
 *   delete:
 *     summary: Belirli bir kullanıcıyı siler (sadece admin).
 *     tags: [Kullanıcı]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Silinecek kullanıcının ID'si
 *     responses:
 *       200:
 *         description: Kullanıcı başarıyla silindi.
 *       401:
 *         description: Yetkisiz erişim (token gerekli).
 *       403:
 *         description: Sadece admin erişebilir.
 *       404:
 *         description: Kullanıcı bulunamadı.
 *       500:
 *         description: Sunucu hatası.
 */
router.delete(
    "/:id",
    verifyToken,
    sadeceAdmin,
    async (req, res, next) => {
        logger.debug("🔍 Kullanıcı silme isteği alındı", { kullanici_id: req.params.id, user_id: req.user?.id });
        try {
            const { id } = req.params;

            const checkUser = await pool.query(
                "SELECT id FROM kullanicilar WHERE id = $1",
                [id]
            );

            if (checkUser.rows.length === 0) {
                logger.warn("❌ Kullanıcı bulunamadı", { kullanici_id: id, user_id: req.user?.id });
                return res.status(404).json({ mesaj: "Kullanıcı bulunamadı" });
            }

            await pool.query(
                "DELETE FROM kullanicilar WHERE id = $1",
                [id]
            );

            logger.info("✅ Kullanıcı başarıyla silindi", { kullanici_id: id, user_id: req.user?.id });
            res.json({ mesaj: "Kullanıcı başarıyla silindi" });
        } catch (err) {
            logger.error("❌ Kullanıcı silme hatası", { error: err.message, stack: err.stack, kullanici_id: req.params.id, user_id: req.user?.id });
            next(err);
        }
    }
);

/**
 * @swagger
 * /api/kullanici/{id}:
 *   put:
 *     summary: Belirli bir kullanıcıyı günceller (sadece admin).
 *     tags: [Kullanıcı]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Güncellenecek kullanıcının ID'si
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ad:
 *                 type: string
 *               soyad:
 *                 type: string
 *               eposta:
 *                 type: string
 *               universite_kodu:
 *                 type: string
 *               rol:
 *                 type: string
 *               hesap_durumu:
 *                 type: string
 *               bolum_id:
 *                 type: string
 *               fakulte_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Kullanıcı başarıyla güncellendi.
 *       400:
 *         description: Geçersiz istek.
 *       401:
 *         description: Yetkisiz erişim.
 *       403:
 *         description: Sadece admin erişebilir.
 *       404:
 *         description: Kullanıcı bulunamadı.
 *       500:
 *         description: Sunucu hatası.
 */
router.put(
    "/:id",
    verifyToken,
    sadeceAdmin,
    async (req, res, next) => {
        logger.debug("🔍 Kullanıcı güncelleme isteği alındı", { kullanici_id: req.params.id, user_id: req.user?.id });
        const { id } = req.params;
        const { ad, soyad, eposta, universite_kodu, rol, hesap_durumu, bolum_id, fakulte_id } = req.body;
        try {
            const result = await pool.query(
                `UPDATE kullanicilar SET ad=$1, soyad=$2, eposta=$3, universite_kodu=$4, rol=$5, hesap_durumu=$6, bolum_id=$7, fakulte_id=$8 WHERE id=$9 RETURNING *`,
                [ad, soyad, eposta, universite_kodu, rol, hesap_durumu, bolum_id, fakulte_id, id]
            );
            if (result.rows.length === 0) {
                logger.warn("❌ Kullanıcı bulunamadı", { kullanici_id: id, user_id: req.user?.id });
                return res.status(404).json({ mesaj: "Kullanıcı bulunamadı" });
            }
            logger.info("✅ Kullanıcı başarıyla güncellendi", { kullanici_id: id, user_id: req.user?.id });
            res.json(result.rows[0]);
        } catch (err) {
            logger.error("❌ Kullanıcı güncelleme hatası", { error: err.message, stack: err.stack, kullanici_id: id, user_id: req.user?.id });
            next(err);
        }
    }
);

/**
 * @swagger
 * /api/kullanici/ekle:
 *   post:
 *     summary: Yeni kullanıcı (admin, öğretmen veya öğrenci) ekler. Sadece admin yapabilir.
 *     tags: [Kullanıcı]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - universite_kodu
 *               - ad
 *               - soyad
 *               - sifre
 *               - rol
 *             properties:
 *               universite_kodu:
 *                 type: string
 *               ad:
 *                 type: string
 *               soyad:
 *                 type: string
 *               eposta:
 *                 type: string
 *               sifre:
 *                 type: string
 *               rol:
 *                 type: string
 *               hesap_durumu:
 *                 type: string
 */
router.post(
    "/ekle",
    verifyToken,
    sadeceAdmin,
    [
        body("universite_kodu").notEmpty().withMessage("Üniversite kodu gerekli."),
        body("ad").notEmpty().withMessage("Ad gerekli."),
        body("soyad").notEmpty().withMessage("Soyad gerekli."),
        body("sifre").isLength({ min: 6 }).withMessage("Şifre en az 6 karakter olmalı."),
        body("eposta").optional().isEmail().withMessage("Geçerli e-posta giriniz."),
        body("rol").isIn(["admin", "ogretmen", "ogrenci"]).withMessage("Geçerli bir rol giriniz."),
        body("hesap_durumu").optional().isIn(["aktif", "pasif", "askida"])
    ],
    async (req, res, next) => {
        logger.debug("🔍 Yeni kullanıcı ekleme isteği alındı", { universite_kodu: req.body.universite_kodu, user_id: req.user?.id });
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn("❌ Doğrulama hatası", { errors: errors.array(), user_id: req.user?.id });
            return res.status(400).json({ hatalar: errors.array() });
        }

        const { universite_kodu, ad, soyad, eposta, sifre, rol, hesap_durumu = 'aktif', bolum_id, fakulte_id } = req.body;

        try {
            const exists = await pool.query("SELECT id FROM kullanicilar WHERE universite_kodu = $1", [universite_kodu]);
            if (exists.rows.length > 0) {
                logger.warn("❌ Üniversite kodu zaten kayıtlı", { universite_kodu, user_id: req.user?.id });
                return res.status(409).json({ mesaj: "Bu üniversite kodu zaten kayıtlı." });
            }

            const hashedPassword = await bcrypt.hash(sifre, 10);
            const { rows } = await pool.query(
                `INSERT INTO kullanicilar (universite_kodu, ad, soyad, eposta, sifre, rol, hesap_durumu, bolum_id, fakulte_id, olusturma_tarihi)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
                 RETURNING id, universite_kodu, ad, soyad, eposta, rol, hesap_durumu, bolum_id, fakulte_id, olusturma_tarihi`,
                [universite_kodu, ad, soyad, eposta, hashedPassword, rol, hesap_durumu, bolum_id || null, fakulte_id || null]
            );

            logger.info("✅ Kullanıcı başarıyla eklendi", { universite_kodu, kullanici_id: rows[0].id, user_id: req.user?.id });
            res.status(201).json(rows[0]);
        } catch (err) {
            logger.error("❌ Kullanıcı ekleme hatası", { error: err.message, stack: err.stack, universite_kodu, user_id: req.user?.id });
            next(err);
        }
    }
);

/**
 * @swagger
 * /api/kullanici/import-excel:
 *   post:
 *     summary: Excel'den kullanıcıları toplu olarak içe aktarır.
 *     tags: [Kullanıcı]
 *     security:
 *       - bearerAuth: []
 */
router.post('/import-excel', verifyToken, sadeceAdmin, async (req, res) => {
    logger.debug("🔍 Kullanıcıları Excel'den içe aktarma isteği alındı", { user_id: req.user?.id });
    const users = req.body;
    try {
        let addedCount = 0;
        let skippedCount = 0;
        for (const user of users) {
            const exists = await pool.query(
                'SELECT id FROM kullanicilar WHERE universite_kodu = $1',
                [user.universite_kodu]
            );
            if (exists.rows.length > 0) {
                logger.warn("⚠️ Üniversite kodu zaten mevcut, atlanıyor", { universite_kodu: user.universite_kodu, user_id: req.user?.id });
                skippedCount++;
                continue;
            }

            await pool.query(
                `INSERT INTO kullanicilar (universite_kodu, ad, soyad, eposta, sifre, rol, bolum_id, fakulte_id, hesap_durumu, olusturma_tarihi)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'aktif', CURRENT_TIMESTAMP)`,
                [
                    user.universite_kodu,
                    user.ad,
                    user.soyad,
                    user.eposta,
                    await bcrypt.hash(user.sifre, 10),
                    user.rol,
                    user.bolum_id,
                    user.fakulte_id
                ]
            );
            logger.info("✅ Kullanıcı eklendi", { universite_kodu: user.universite_kodu, user_id: req.user?.id });
            addedCount++;
        }
        logger.info(`✅ Toplu kullanıcı ekleme tamamlandı: ${addedCount} eklendi, ${skippedCount} atlandı`, { user_id: req.user?.id });
        res.json({ success: true, addedCount, skippedCount });
    } catch (err) {
        logger.error("❌ Kullanıcı içe aktarma hatası", { error: err.message, stack: err.stack, user_id: req.user?.id });
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @swagger
 * /api/kullanici/bulk-delete:
 *   post:
 *     summary: Seçilen kullanıcıları toplu olarak siler
 *     tags: [Kullanıcı]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Silinecek kullanıcı ID'leri
 *     responses:
 *       200:
 *         description: Kullanıcılar başarıyla silindi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 deletedCount:
 *                   type: integer
 *       400:
 *         description: Geçersiz istek veya kullanıcı ID'leri
 *       403:
 *         description: Yetkisiz erişim
 *       500:
 *         description: Sunucu hatası
 */
router.post('/bulk-delete', verifyToken, sadeceAdmin, async (req, res) => {
    logger.debug("🔍 Toplu kullanıcı silme isteği alındı", { user_ids: req.body.userIds, user_id: req.user?.id });
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        logger.warn("❌ Geçersiz kullanıcı ID'leri", { user_id: req.user?.id });
        return res.status(400).json({
            success: false,
            message: 'Kullanıcı ID\'leri gerekli ve dizi formatında olmalıdır'
        });
    }

    const currentUserId = req.user.id;
    if (userIds.includes(currentUserId.toString())) {
        logger.warn("❌ Kullanıcı kendi hesabını silmeye çalıştı", { user_id: currentUserId });
        return res.status(400).json({
            success: false,
            message: 'Kendi hesabınızı silemezsiniz'
        });
    }

    const userIdInts = userIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    if (userIdInts.length === 0) {
        logger.warn("❌ Geçerli kullanıcı ID'si bulunamadı", { user_id: req.user?.id });
        return res.status(400).json({
            success: false,
            message: 'Geçerli kullanıcı ID\'si bulunamadı'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query('DELETE FROM yoklamalar WHERE ogrenci_id = ANY($1::int[])', [userIdInts]);
        await client.query('DELETE FROM ders_kayitlari WHERE ogrenci_id = ANY($1::int[])', [userIdInts]);
        await client.query('UPDATE dersler SET ogretmen_id = NULL WHERE ogretmen_id = ANY($1::int[])', [userIdInts]);
        await client.query('DELETE FROM bildirimler WHERE kullanici_id = ANY($1::int[])', [userIdInts]);
        await client.query('DELETE FROM senkron_log WHERE kullanici_id = ANY($1::int[])', [userIdInts]);

        const deleteResult = await client.query(
            'DELETE FROM kullanicilar WHERE id = ANY($1::int[])',
            [userIdInts]
        );

        await client.query('COMMIT');

        const deletedCount = deleteResult.rowCount;
        logger.info(`✅ ${deletedCount} kullanıcı başarıyla silindi`, { user_ids: userIdInts, user_id: req.user?.id });

        res.json({
            success: true,
            message: `${deletedCount} kullanıcı başarıyla silindi`,
            deletedCount: deletedCount
        });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error("❌ Toplu kullanıcı silme hatası", { error: error.message, stack: error.stack, user_ids: userIdInts, user_id: req.user?.id });
        res.status(500).json({
            success: false,
            message: 'Kullanıcılar silinirken bir veritabanı hatası oluştu.',
            errorDetails: {
                message: error.message,
                code: error.code,
                constraint: error.constraint,
            }
        });
    } finally {
        client.release();
    }
});

/**
 * @swagger
 * /api/kullanici/import-users-from-json:
 *   post:
 *     summary: Excel'den JSON formatında kullanıcı listesi alır ve sisteme ekler.
 *     tags: [Kullanıcı]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 universite_kodu:
 *                   type: string
 *                 sifre:
 *                   type: string
 *                 ad:
 *                   type: string
 *                 soyad:
 *                   type: string
 *                 eposta:
 *                   type: string
 *                 rol:
 *                   type: string
 *                 fakulte_ad:
 *                   type: string
 *                 bolum_ad:
 *                   type: string
 *     responses:
 *       200:
 *         description: Kullanıcılar başarıyla içe aktarıldı.
 *       400:
 *         description: Geçersiz veri.
 *       500:
 *         description: Sunucu hatası.
 */
router.post('/import-users-from-json', verifyToken, sadeceAdmin, async (req, res) => {
    logger.debug("🔍 Kullanıcıları JSON'dan içe aktarma isteği alındı", { user_id: req.user?.id });
    const usersToImport = req.body;

    if (!Array.isArray(usersToImport) || usersToImport.length === 0) {
        logger.warn("❌ Boş kullanıcı listesi", { user_id: req.user?.id });
        return res.status(400).json({ success: false, error: 'İçe aktarılacak kullanıcı listesi boş.' });
    }

    let addedCount = 0;
    let errorCount = 0;
    const detailedErrors = [];

    for (const [index, user] of usersToImport.entries()) {
        const rowNum = index + 2;
        logger.debug(`🔍 Kullanıcı işleniyor - Satır ${rowNum}`, { universite_kodu: user.universite_kodu, user_id: req.user?.id });
        try {
            if (!user.universite_kodu || !user.ad || !user.soyad || !user.rol || !user.fakulte_ad || !user.bolum_ad) {
                errorCount++;
                detailedErrors.push(`Satır ${rowNum}: Temel verilerden biri (kod, ad, soyad, rol, fakülte, bölüm) eksik.`);
                logger.warn(`❌ Satır ${rowNum}: Eksik veri`, { universite_kodu: user.universite_kodu, user_id: req.user?.id });
                continue;
            }

            if (!user.sifre) {
                errorCount++;
                detailedErrors.push(`Satır ${rowNum} (${user.universite_kodu}): Şifre alanı boş.`);
                logger.warn(`❌ Satır ${rowNum}: Şifre eksik`, { universite_kodu: user.universite_kodu, user_id: req.user?.id });
                continue;
            }

            const universiteKoduAsString = user.universite_kodu.toString();
            const sifreAsString = user.sifre.toString();

            const existingUser = await prisma.kullanicilar.findUnique({
                where: { universite_kodu: universiteKoduAsString },
            });

            if (existingUser) {
                errorCount++;
                detailedErrors.push(`Satır ${rowNum} (${universiteKoduAsString}): Bu üniversite kodu zaten kayıtlı.`);
                logger.warn(`❌ Satır ${rowNum}: Üniversite kodu zaten mevcut`, { universite_kodu: universiteKoduAsString, user_id: req.user?.id });
                continue;
            }

            const fakulte = await prisma.fakulteler.findFirst({
                where: { ad: { equals: user.fakulte_ad.trim(), mode: 'insensitive' } },
            });

            if (!fakulte) {
                errorCount++;
                detailedErrors.push(`Satır ${rowNum} (${universiteKoduAsString}): Fakülte bulunamadı -> "${user.fakulte_ad}"`);
                logger.warn(`❌ Satır ${rowNum}: Fakülte bulunamadı`, { universite_kodu: universiteKoduAsString, fakulte_ad: user.fakulte_ad, user_id: req.user?.id });
                continue;
            }

            const bolum = await prisma.bolumler.findFirst({
                where: { ad: { equals: user.bolum_ad.trim(), mode: 'insensitive' } },
            });

            if (!bolum) {
                errorCount++;
                detailedErrors.push(`Satır ${rowNum} (${universiteKoduAsString}): Bölüm bulunamadı -> "${user.bolum_ad}"`);
                logger.warn(`❌ Satır ${rowNum}: Bölüm bulunamadı`, { universite_kodu: universiteKoduAsString, bolum_ad: user.bolum_ad, user_id: req.user?.id });
                continue;
            }

            if (bolum.fakulte_id !== fakulte.id) {
                errorCount++;
                detailedErrors.push(`Satır ${rowNum} (${universiteKoduAsString}): Bölüm "${user.bolum_ad}", "${user.fakulte_ad}" fakültesine ait değil.`);
                logger.warn(`❌ Satır ${rowNum}: Bölüm fakülteye ait değil`, { universite_kodu: universiteKoduAsString, bolum_ad: user.bolum_ad, fakulte_ad: user.fakulte_ad, user_id: req.user?.id });
                continue;
            }

            const hashedPassword = await bcrypt.hash(sifreAsString, 10);

            await prisma.kullanicilar.create({
                data: {
                    universite_kodu: universiteKoduAsString,
                    ad: user.ad,
                    soyad: user.soyad,
                    eposta: user.eposta,
                    sifre: hashedPassword,
                    rol: user.rol,
                    hesap_durumu: 'aktif',
                    fakulte_id: fakulte.id,
                    bolum_id: bolum.id,
                },
            });

            logger.info(`✅ Kullanıcı eklendi - Satır ${rowNum}`, { universite_kodu: universiteKoduAsString, user_id: req.user?.id });
            addedCount++;
        } catch (err) {
            errorCount++;
            detailedErrors.push(`Satır ${rowNum} (${user.universite_kodu || 'Bilinmeyen'}): Beklenmedik sunucu hatası - ${err.message}`);
            logger.error(`❌ Kullanıcı içe aktarma hatası - Satır ${rowNum}`, { error: err.message, stack: err.stack, universite_kodu: user.universite_kodu, user_id: req.user?.id });
        }
    }

    logger.info(`✅ JSON kullanıcı içe aktarma tamamlandı: ${addedCount} eklendi, ${errorCount} hata`, { user_id: req.user?.id });
    if (addedCount === 0 && errorCount > 0) {
        return res.status(400).json({
            success: false,
            message: 'Hiçbir kullanıcı eklenemedi. Lütfen hataları kontrol edin.',
            addedCount,
            errorCount,
            errors: detailedErrors,
        });
    }

    res.status(207).json({
        success: true,
        message: `${addedCount} kullanıcı başarıyla eklendi, ${errorCount} işlemde hata oluştu.`,
        addedCount,
        errorCount,
        errors: detailedErrors,
    });
});

module.exports = router;
