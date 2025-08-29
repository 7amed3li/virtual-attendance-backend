const express = require("express");
const router = express.Router();
const pool = require("../config/veritabani");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, param, validationResult } = require("express-validator");
const verifyToken = require("../middleware/verifyToken");
const { sadeceAdmin } = require("../middleware/yetkiKontrol");
const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient(); // Prisma Client'ı oluştur -ÖZGÜRCAN
// JWT verification middleware (already defined in sunucu.js, but good to have here if routes are separated)
// For this project, sunucu.js applies verifyToken to routes that need it.
// So, we assume req.user is populated for protected routes.

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Kullanıcı kimlik doğrulama, profil ve şifre yönetimi işlemleri
 */

// ... (existing /api/giris, /api/auth/request-password-reset, /api/auth/reset-password routes) ...



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
    "/me/profile", // This route will be prefixed with /api by sunucu.js and protected by verifyToken
    verifyToken,
    [
        body("ad").optional().isString().trim().notEmpty().withMessage("Ad boş olamaz."),
        body("soyad").optional().isString().trim().notEmpty().withMessage("Soyad boş olamaz."),
        body("eposta").optional().isEmail().withMessage("Geçerli bir e-posta adresi giriniz."),
        body("telefon").optional().isString().trim()
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ hatalar: errors.array() });
        }

        const userId = req.user.id; // From verifyToken middleware
        const { ad, soyad, eposta, telefon } = req.body;

        const updateFields = {};
        if (ad) updateFields.ad = ad;
        if (soyad) updateFields.soyad = soyad;
        if (eposta) updateFields.eposta = eposta;
        if (telefon !== undefined) updateFields.telefon = telefon; // Allow empty string for phone

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ mesaj: "Güncellenecek alan belirtilmedi." });
        }

        try {
            // If email is being changed, check if it's already in use by another user
            if (eposta) {
                const emailCheck = await pool.query("SELECT id FROM kullanicilar WHERE eposta = $1 AND id != $2", [eposta, userId]);
                if (emailCheck.rows.length > 0) {
                    return res.status(409).json({ mesaj: "Bu e-posta adresi zaten başka bir kullanıcı tarafından kullanılıyor." });
                }
            }

            const setClauses = Object.keys(updateFields).map((key, index) => `${key} = $${index + 1}`);
            const values = Object.values(updateFields);
            values.push(userId); // For WHERE id = $N

            const queryText = `UPDATE kullanicilar SET ${setClauses.join(", ")}, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING id, universite_kodu, ad, soyad, eposta, rol, telefon, aktif_mi, olusturma_tarihi, guncelleme_tarihi`;
            
            const { rows } = await pool.query(queryText, values);

            if (rows.length === 0) {
                // Should not happen if token is valid and user exists
                return res.status(404).json({ mesaj: "Kullanıcı bulunamadı (güncelleme sırasında)." });
            }

            res.status(200).json(rows[0]);
        } catch (err) {
            console.error("Profil güncelleme hatası:", err);
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
    "/me/change-password", // This route will be prefixed with /api by sunucu.js and protected by verifyToken
    verifyToken,
    [
        body("mevcut_sifre").notEmpty().withMessage("Mevcut şifre gerekli."),
        body("yeni_sifre").isLength({ min: 6 }).withMessage("Yeni şifre en az 6 karakter olmalı.")
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ hatalar: errors.array() });
        }

        const userId = req.user.id;
        const { mevcut_sifre, yeni_sifre } = req.body;

        try {
            const userQuery = await pool.query("SELECT sifre FROM kullanicilar WHERE id = $1", [userId]);
            if (userQuery.rows.length === 0) {
                return res.status(401).json({ mesaj: "Kullanıcı bulunamadı (yetkilendirme sorunu)." });
            }
            const storedPasswordHash = userQuery.rows[0].sifre;

            const isMatch = await bcrypt.compare(mevcut_sifre, storedPasswordHash);
            if (!isMatch) {
                return res.status(401).json({ mesaj: "Mevcut şifre yanlış." });
            }

            const newHashedPassword = await bcrypt.hash(yeni_sifre, 10);

            await pool.query(
                "UPDATE kullanicilar SET sifre = $1, son_sifre_degisikligi = CURRENT_TIMESTAMP WHERE id = $2",
                [newHashedPassword, userId]
            );

            res.status(200).json({ mesaj: "Şifreniz başarıyla değiştirildi." });

        } catch (err) {
            console.error("Şifre değiştirme hatası:", err);
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
    try {
       const userId = req.user.id;
       const result = await pool.query(
        "SELECT id, universite_kodu, ad, soyad, eposta, rol, telefon, hesap_durumu, aktif_mi FROM kullanicilar WHERE id = $1",
        [userId]
    );
      if (result.rows.length === 0) {
        return res.status(404).json({ mesaj: "Kullanıcı bulunamadı" });
      }
      res.json(result.rows[0]);
    } catch (err) {
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
    try {
      const { rows } = await pool.query(
        "SELECT id, universite_kodu, ad, soyad, eposta, rol, hesap_durumu, olusturma_tarihi, son_giris FROM kullanicilar ORDER BY id ASC"
      );
      res.status(200).json(rows);
    } catch (err) {
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
    try {
      const { id } = req.params;
      const result = await pool.query(
        "SELECT id, universite_kodu, ad, soyad, eposta, rol, hesap_durumu, bolum_id, fakulte_id FROM kullanicilar WHERE id = $1",
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ mesaj: "Kullanıcı bulunamadı" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);
// ... existing code ...

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
    try {
      const { id } = req.params;

      // First check if user exists
      const checkUser = await pool.query(
        "SELECT id FROM kullanicilar WHERE id = $1",
        [id]
      );

      if (checkUser.rows.length === 0) {
        return res.status(404).json({ mesaj: "Kullanıcı bulunamadı" });
      }

      // Delete the user
      await pool.query(
        "DELETE FROM kullanicilar WHERE id = $1",
        [id]
      );

      res.json({ mesaj: "Kullanıcı başarıyla silindi" });
    } catch (err) {
      console.error("Kullanıcı silme hatası:", err);
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
    const { id } = req.params;
    const { ad, soyad, eposta, universite_kodu, rol, hesap_durumu, bolum_id, fakulte_id } = req.body;
    try {
      const result = await pool.query(
        `UPDATE kullanicilar SET ad=$1, soyad=$2, eposta=$3, universite_kodu=$4, rol=$5, hesap_durumu=$6, bolum_id=$7, fakulte_id=$8 WHERE id=$9 RETURNING *`,
        [ad, soyad, eposta, universite_kodu, rol, hesap_durumu, bolum_id, fakulte_id, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ mesaj: "Kullanıcı bulunamadı" });
      res.json(result.rows[0]);
    } catch (err) {
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ hatalar: errors.array() });

    const { universite_kodu, ad, soyad, eposta, sifre, rol, hesap_durumu = 'aktif', bolum_id, fakulte_id } = req.body;

    try {
      const exists = await pool.query("SELECT id FROM kullanicilar WHERE universite_kodu = $1", [universite_kodu]);
      if (exists.rows.length > 0) {
        return res.status(409).json({ mesaj: "Bu üniversite kodu zaten kayıtlı." });
      }

      const hashedPassword = await bcrypt.hash(sifre, 10);
      const { rows } = await pool.query(
        `INSERT INTO kullanicilar (universite_kodu, ad, soyad, eposta, sifre, rol, hesap_durumu, bolum_id, fakulte_id, olusturma_tarihi)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
         RETURNING id, universite_kodu, ad, soyad, eposta, rol, hesap_durumu, bolum_id, fakulte_id, olusturma_tarihi`,
        [universite_kodu, ad, soyad, eposta, hashedPassword, rol, hesap_durumu, bolum_id || null, fakulte_id || null]
      );

      res.status(201).json(rows[0]);
    } catch (err) {
      console.error("Kullanıcı ekleme hatası:", err);
      next(err);
    }
  }
);

router.post('/import-excel', async (req, res) => {
  const users = req.body;
  try {
    for (const user of users) {
      // Aynı universite_kodu varsa ekleme
      const exists = await pool.query(
        'SELECT id FROM kullanicilar WHERE universite_kodu = $1',
        [user.universite_kodu]
      );
      if (exists.rows.length === 0) {
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
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
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
  try {
    const { userIds } = req.body;

    // Validasyon
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı ID\'leri gerekli ve dizi formatında olmalıdır'
      });
    }

    // Maximum limit kontrolü (güvenlik için)
    if (userIds.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Tek seferde en fazla 100 kullanıcı silinebilir'
      });
    }

    // Mevcut isteyen kullanıcının ID'si - kendini silmeyi engelle
    const currentUserId = req.user.id;
    if (userIds.includes(currentUserId.toString())) {
      return res.status(400).json({
        success: false,
        message: 'Kendi hesabınızı silemezsiniz'
      });
    }

    // Integer array'e çevir
    const userIdInts = userIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    
    if (userIdInts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Geçerli kullanıcı ID\'si bulunamadı'
      });
    }

    // Silinecek kullanıcıları kontrol et
    const usersToDelete = await pool.query(
      'SELECT id, universite_kodu, ad, soyad, rol FROM kullanicilar WHERE id = ANY($1)',
      [userIdInts]
    );

    if (usersToDelete.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Silinecek kullanıcı bulunamadı'
      });
    }

    // Super admin hesabını silmeyi engelle (ADMIN001)
    const hasProtectedUser = usersToDelete.rows.some(user => 
      user.rol === 'admin' && user.universite_kodu === 'ADMIN001'
    );

    if (hasProtectedUser) {
      return res.status(403).json({
        success: false,
        message: 'Sistem yöneticisi hesabı (ADMIN001) silinemez'
      });
    }

    // İlgili tablo verilerini sil (foreign key constraints)
    await pool.query('DELETE FROM ders_kayitlari WHERE ogrenci_id = ANY($1)', [userIdInts]);
    await pool.query('DELETE FROM yoklamalar WHERE kullanici_id = ANY($1)', [userIdInts]);
    await pool.query('DELETE FROM bildirimler WHERE kullanici_id = ANY($1)', [userIdInts]);
    await pool.query('DELETE FROM senkron_log WHERE kullanici_id = ANY($1)', [userIdInts]);

    // Kullanıcıları sil
    const deleteResult = await pool.query(
      'DELETE FROM kullanicilar WHERE id = ANY($1)',
      [userIdInts]
    );

    const deletedCount = deleteResult.rowCount;

    res.json({
      success: true,
      message: `${deletedCount} kullanıcı başarıyla silindi`,
      deletedCount: deletedCount
    });

    // Log işlemi (isteğe bağlı)
    console.log(`🗑️ Toplu silme: ${deletedCount} kullanıcı silindi - İşlemi yapan: ${req.user.id}`);

  } catch (error) {
    console.error('Toplu kullanıcı silme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcılar silinirken bir hata oluştu'
    });
  }
});

module.exports = router;


