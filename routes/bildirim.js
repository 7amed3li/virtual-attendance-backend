const express = require("express");
const router = express.Router();
const pool = require("../config/veritabani");
const verifyToken = require("../middleware/verifyToken");
const { sadeceAdmin, sadeceOgretmenVeAdmin } = require("../middleware/yetkiKontrol");
const { body, param, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger"); // استيراد logger

const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient(); 

// Kategori ve genel_mi alanlarını ekle (eğer yoksa)
async function ensureCategoryColumn() {
  try {
    await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'bildirimler' AND column_name = 'kategori'
        ) THEN
          ALTER TABLE bildirimler ADD COLUMN kategori VARCHAR(50) DEFAULT 'Genel';
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'bildirimler' AND column_name = 'genel_mi'
        ) THEN
          ALTER TABLE bildirimler ADD COLUMN genel_mi BOOLEAN DEFAULT FALSE;
        END IF;
      END 
      $$;
    `);
    logger.info("✅ Kategori ve genel_mi kolonları kontrol edildi ve eklendi (gerekirse)");
  } catch (error) {
    logger.error("❌ Kategori veya genel_mi kolonu eklenirken hata", { error: error.message, stack: error.stack });
  }
}

// Uygulama başlangıcında kategori kolonunu kontrol et
ensureCategoryColumn();

/**
 * @swagger
 * tags:
 *   name: Bildirimler
 *   description: Kullanıcılara ait bildirim işlemleri
 */

/**
 * @swagger
 * /api/bildirimler/admin:
 *   get:
 *     summary: Admin için tüm duyuruları sayfalama ve filtreleme ile getirir
 *     tags: [Bildirimler]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Sayfa numarası
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Sayfa başına öğe sayısı
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Başlık veya içerikte arama
 *       - in: query
 *         name: yazar
 *         schema:
 *           type: string
 *         description: Yazar adında arama
 *     responses:
 *       200:
 *         description: Duyurular başarıyla getirildi
 *       401:
 *         description: Yetkisiz erişim
 *       403:
 *         description: Admin yetkisi gerekli
 *       500:
 *         description: Sunucu hatası
 */
router.get('/admin', verifyToken, sadeceAdmin, async (req, res) => {
  try {
    logger.debug("🔍 Admin duyuru listesi isteği alındı", { user_id: req.user.id });

    // Basit sorgu ile başlayalım
    const result = await pool.query(`
      SELECT 
        b.id,
        b.baslik,
        b.icerik,
        b.olusturma_tarihi,
        b.kullanici_id,
        k.ad as yazar_ad,
        k.soyad as yazar_soyad
      FROM bildirimler b
      LEFT JOIN kullanicilar k ON b.kullanici_id = k.id
      ORDER BY b.olusturma_tarihi DESC
      LIMIT 10
    `);

    logger.info(`✅ ${result.rows.length} duyuru bulundu`, { user_id: req.user.id });

    const announcements = result.rows.map(row => ({
      id: row.id,
      baslik: row.baslik,
      icerik: row.icerik,
      olusturma_tarihi: row.olusturma_tarihi,
      kullanici_id: row.kullanici_id,
      yazar: {
        id: row.kullanici_id,
        ad: row.yazar_ad,
        soyad: row.yazar_soyad
      }
    }));

    res.json({
      announcements,
      total: result.rows.length,
      page: 1,
      limit: 10,
      totalPages: 1
    });

  } catch (err) {
    logger.error("❌ Admin duyuru listesi hatası", { error: err.message, stack: err.stack, user_id: req.user.id });
    res.status(500).json({ mesaj: 'Sunucu hatası', detay: err.message });
  }
});

/**
 * @swagger
 * /api/bildirimler/me:
 *   get:
 *     summary: Oturum açmış kullanıcının bildirimlerini getirir.
 *     tags: [Bildirimler]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bildirimler başarıyla getirildi.
 *       401:
 *         description: Yetkisiz erişim.
 *       500:
 *         description: Sunucu hatası.
 */
router.get("/me", verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    logger.debug("🔍 Kullanıcı bildirimleri isteği alındı", { user_id: userId });

    const result = await pool.query(
      "SELECT * FROM bildirimler WHERE kullanici_id = $1 ORDER BY olusturma_tarihi DESC",
      [userId]
    );

    logger.info(`✅ ${result.rows.length} bildirim bulundu`, { user_id: userId });
    res.json(result.rows);
  } catch (err) {
    logger.error("❌ Bildirim getirme hatası", { error: err.message, stack: err.stack, user_id: userId });
    res.status(500).json({ mesaj: "Sunucu hatası" });
  }
});

/**
 * @swagger
 * /api/bildirimler:
 *   post:
 *     summary: Yeni bildirim oluşturur (sadece admin).
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
 *               - kullanici_id
 *               - baslik
 *               - icerik
 *             properties:
 *               kullanici_id:
 *                 type: integer
 *               baslik:
 *                 type: string
 *               icerik:
 *                 type: string
 *     responses:
 *       201:
 *         description: Bildirim oluşturuldu.
 *       400:
 *         description: Geçersiz veri.
 *       401:
 *         description: Yetkisiz erişim.
 *       500:
 *         description: Sunucu hatası.
 */
router.post(
  "/",
  verifyToken,
  sadeceAdmin,
  [
    body("kullanici_id").optional().isInt().withMessage("kullanici_id geçerli bir sayı olmalıdır."),
    body("baslik").notEmpty().withMessage("Başlık boş olamaz."),
    body("icerik").notEmpty().withMessage("İçerik boş olamaz."),
    body("kategori").optional().isString().withMessage("Kategori geçerli bir string olmalıdır."),
    body("genel_mi").optional().isBoolean().withMessage("genel_mi geçerli bir boolean olmalıdır."),
    body("ders_id").optional().isInt().withMessage("ders_id geçerli bir sayı olmalıdır.")
  ],
  async (req, res) => {
    logger.debug("🔍 Yeni bildirim oluşturma isteği alındı", { user_id: req.user.id });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("❌ Doğrulama hatası", { errors: errors.array(), user_id: req.user.id });
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { kullanici_id, baslik, icerik, kategori = 'Genel', genel_mi = false, ders_id } = req.body;
    const yazar_id = kullanici_id || req.user.id; // Admin kullanıcı_id belirtebilir, yoksa kendi id'si

    try {
      await pool.query(
        "INSERT INTO bildirimler (kullanici_id, baslik, icerik, kategori, genel_mi, ders_id) VALUES ($1, $2, $3, $4, $5, $6)",
        [yazar_id, baslik, icerik, kategori, genel_mi, ders_id]
      );
      logger.info("✅ Bildirim oluşturuldu", { yazar_id, baslik });
      res.status(201).json({ mesaj: "Bildirim oluşturuldu" });
    } catch (err) {
      logger.error("❌ Bildirim oluşturma hatası", { error: err.message, stack: err.stack, yazar_id });
      res.status(500).json({ mesaj: "Sunucu hatası" });
    }
  }
);

/**
 * @swagger
 * /api/bildirimler/{id}/goruldu:
 *   put:
 *     summary: Belirli bir bildirimi okundu olarak işaretler.
 *     tags: [Bildirimler]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Bildirim ID
 *     responses:
 *       200:
 *         description: Bildirim okundu olarak işaretlendi.
 *       401:
 *         description: Yetkisiz erişim.
 *       404:
 *         description: Bildirim bulunamadı.
 *       500:
 *         description: Sunucu hatası.
 */
router.put("/:id/goruldu", verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    logger.debug("🔍 Bildirim okundu işaretleme isteği alındı", { bildirim_id: id, user_id: userId });

    const result = await pool.query(
      "UPDATE bildirimler SET goruldu_mu = TRUE WHERE id = $1 AND kullanici_id = $2",
      [id, userId]
    );
    if (result.rowCount === 0) {
      logger.warn("❌ Bildirim bulunamadı veya yetki yok", { bildirim_id: id, user_id: userId });
      return res.status(404).json({ mesaj: "Bildirim bulunamadı" });
    }
    logger.info("✅ Bildirim okundu olarak işaretlendi", { bildirim_id: id, user_id: userId });
    res.json({ mesaj: "Bildirim okundu olarak işaretlendi" });
  } catch (err) {
    logger.error("❌ Bildirim güncelleme hatası", { error: err.message, stack: err.stack, bildirim_id: id, user_id: userId });
    res.status(500).json({ mesaj: "Sunucu hatası" });
  }
});

/**
 * @swagger
 * /api/bildirimler/derslerim:
 *   get:
 *     summary: Öğrencinin aldığı derslerle ilgili bildirimleri getirir.
 *     tags: [Bildirimler]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ders bildirimleri başarıyla getirildi.
 *       401:
 *         description: Yetkisiz erişim.
 *       500:
 *         description: Sunucu hatası.
 */
router.get("/derslerim", verifyToken, async (req, res) => {
  const ogrenciId = req.user.id;
  try {
    logger.debug("🔍 Öğrenci ders bildirimleri isteği alındı", { ogrenci_id: ogrenciId });

    // 1. Öğrencinin aldığı ders_id'leri çek
    const dersResult = await pool.query(
      "SELECT ders_id FROM ders_kayitlari WHERE ogrenci_id = $1",
      [ogrenciId]
    );

    const dersIdListesi = dersResult.rows.map(row => row.ders_id);

    // 2. Ders duyurularını ve genel duyuruları getir
    let bildirimResult;
    if (dersIdListesi.length === 0) {
      // Öğrenci hiç derse kayıtlı değilse sadece genel duyuruları getir
      logger.info("⚠️ Öğrenci derse kayıtlı değil, sadece genel duyurular getiriliyor", { ogrenci_id: ogrenciId });
      bildirimResult = await pool.query(
        `
        SELECT b.*, d.ad AS ders_adi, k.ad as yazar_ad, k.soyad as yazar_soyad, k.rol as yazar_rol
        FROM bildirimler b
        LEFT JOIN dersler d ON b.ders_id = d.id
        LEFT JOIN kullanicilar k ON b.kullanici_id = k.id
        WHERE b.genel_mi = TRUE
        ORDER BY b.olusturma_tarihi DESC
        `
      );
    } else {
      // Hem ders duyurularını hem genel duyuruları getir
      logger.info(`✅ ${dersIdListesi.length} ders bulundu, bildirimler getiriliyor`, { ogrenci_id: ogrenciId });
      bildirimResult = await pool.query(
        `
        SELECT b.*, d.ad AS ders_adi, k.ad as yazar_ad, k.soyad as yazar_soyad, k.rol as yazar_rol
        FROM bildirimler b
        LEFT JOIN dersler d ON b.ders_id = d.id
        LEFT JOIN kullanicilar k ON b.kullanici_id = k.id
        WHERE (b.ders_id = ANY($1) OR b.genel_mi = TRUE)
        ORDER BY b.olusturma_tarihi DESC
        `,
        [dersIdListesi]
      );
    }
    
    logger.info(`✅ ${bildirimResult.rows.length} bildirim getirildi`, { ogrenci_id: ogrenciId });
    res.json(bildirimResult.rows);

  } catch (err) {
    logger.error("❌ Ders bildirimlerini getirme hatası", { error: err.message, stack: err.stack, ogrenci_id: ogrenciId });
    res.status(500).json({ mesaj: "Sunucu hatası" });
  }
});

/**
 * @swagger
 * /api/bildirim/sil/{bildirim_id}:
 *   delete:
 *     summary: Öğretmenin kendi oluşturduğu bildirimi silmesi
 *     tags:
 *       - Bildirimler
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bildirim_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Silinecek bildirimin ID'si
 *     responses:
 *       200:
 *         description: Bildirim başarıyla silindi
 *       401:
 *         description: Token eksik veya geçersiz
 *       403:
 *         description: Yetkisiz erişim (bildirim size ait değil)
 *       404:
 *         description: Bildirim bulunamadı
 *       500:
 *         description: Sunucu hatası
 */
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    logger.debug("🔍 Bildirim silme isteği alındı", { bildirim_id: id, user_id: userId });

    const result = await pool.query(
      'DELETE FROM bildirimler WHERE id = $1 AND kullanici_id = $2',
      [id, userId]
    );
    if (result.rowCount === 0) {
      logger.warn("❌ Bildirim bulunamadı veya silme yetkisi yok", { bildirim_id: id, user_id: userId });
      return res.status(404).json({ mesaj: 'Bildirim bulunamadı veya silme yetkiniz yok.' });
    }
    logger.info("✅ Bildirim başarıyla silindi", { bildirim_id: id, user_id: userId });
    res.json({ mesaj: 'Bildirim silindi.' });
  } catch (err) {
    logger.error("❌ Bildirim silme hatası", { error: err.message, stack: err.stack, bildirim_id: id, user_id: userId });
    res.status(500).json({ mesaj: 'Sunucu hatası' });
  }
});

/**
 * @swagger
 * /api/bildirimler/:id:
 *   delete:
 *     summary: Oturum açmış kullanıcının kendi bildirimini siler.
 *     tags: [Bildirimler]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Bildirim ID
 *     responses:
 *       200:
 *         description: Bildirim silindi.
 *       401:
 *         description: Yetkisiz erişim.
 *       404:
 *         description: Bildirim bulunamadı.
 *       500:
 *         description: Sunucu hatası.
 */
// Bu route zaten yukarıda tanımlı, tekrar tanımlamaya gerek yok

// Belirli bir kullanıcının bildirimlerini getir (admin panel için)
router.get("/:userId", verifyToken, async (req, res) => {
  const { userId } = req.params;
  try {
    logger.debug("🔍 Kullanıcıya özel bildirimler isteği alındı", { target_user_id: userId, requesting_user_id: req.user.id });

    const result = await pool.query(
      "SELECT * FROM bildirimler WHERE kullanici_id = $1 ORDER BY olusturma_tarihi DESC",
      [userId]
    );
    
    logger.info(`✅ ${result.rows.length} bildirim bulundu`, { target_user_id: userId });
    res.json(result.rows);
  } catch (err) {
    logger.error("❌ Bildirim getirme hatası", { error: err.message, stack: err.stack, target_user_id: userId });
    res.status(500).json({ mesaj: "Sunucu hatası" });
  }
});
/**
 * @swagger
 * /api/bildirimler/private-message:
 *   post:
 *     summary: "Belirli bir kullanıcıya özel bir bildirim (mesaj) gönderir"
 *     description: "Bu endpoint, oturum açmış bir öğretmen veya adminin, ID'si belirtilen bir kullanıcıya (genellikle öğrenciye) özel bir bildirim göndermesini sağlar. Bu bildirim sadece o kullanıcı tarafından görülebilir."
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
 *               - kullanici_id
 *               - baslik
 *               - icerik
 *             properties:
 *               kullanici_id:
 *                 type: integer
 *                 description: "Mesajın gönderileceği kullanıcının (öğrencinin) ID'si"
 *                 example: 105
 *               baslik:
 *                 type: string
 *                 description: "Mesajın başlığı"
 *                 example: "Devamsızlık Uyarısı"
 *               icerik:
 *                 type: string
 *                 description: "Mesajın içeriği"
 *                 example: "Sayın Ali Veli, ABC101 kodlu derste devamsızlık sınırını aştığınız tespit edilmiştir. Lütfen durumu inceleyiniz."
 *     responses:
 *       201:
 *         description: "Mesaj başarıyla oluşturuldu ve gönderildi."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bildirim' # افترض أن لديك تعريفًا لـ Bildirim
 *       400:
 *         description: "Geçersiz veya eksik veri (örn: kullanici_id, baslik veya icerik eksik)."
 *       401:
 *         description: "Yetkisiz erişim (Token eksik veya geçersiz)."
 *       403:
 *         description: "Erişim reddedildi (Bu işlemi yapmak için öğretmen veya admin yetkisi gerekli)."
 *       500:
 *         description: "Sunucu hatası."
 */
router.post('/private-message', verifyToken, sadeceOgretmenVeAdmin, async (req, res) => {
  const { kullanici_id, baslik, icerik } = req.body;
  const gonderen_id = req.user.id;

  if (!kullanici_id || !baslik || !icerik) {
    logger.warn("❌ Özel mesaj gönderme hatası: Eksik bilgi", { body: req.body, user_id: req.user.id });
    return res.status(400).json({ mesaj: 'Eksik bilgi: Kullanıcı ID, başlık ve içerik gereklidir.' });
  }

  try {
    logger.debug("🔍 Özel mesaj gönderme isteği alındı", { target_user_id: kullanici_id, sender_id: gonderen_id });
    const { rows } = await pool.query(
      'INSERT INTO bildirimler (kullanici_id, baslik, icerik, gonderen_id, kategori) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [kullanici_id, baslik, icerik, gonderen_id, 'private']
    );
    logger.info("✅ Özel mesaj başarıyla gönderildi", { bildirim_id: rows[0].id, target_user_id: kullanici_id });
    res.status(201).json(rows[0]);
  } catch (error) {
    logger.error("❌ Özel mesaj gönderme sunucu hatası", { error: error.message, stack: error.stack, user_id: req.user.id });
    res.status(500).json({ mesaj: 'Mesaj gönderilirken bir hata oluştu.' });
  }
});

module.exports = router;