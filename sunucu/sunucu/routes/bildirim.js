const express = require("express");
const router = express.Router();
const pool = require("../config/veritabani");
const verifyToken = require("../middleware/verifyToken");
const { sadeceAdmin } = require("../middleware/yetkiKontrol");
const { body, param, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");

const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient(); // Prisma Client'ı oluştur -ÖZGÜRCAN

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
  } catch (error) {
    console.log('Kategori veya genel_mi kolonu zaten mevcut veya eklenemedi:', error.message);
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
    console.log('🔍 Admin duyuru listesi isteği alındı');
    
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

    console.log(`✅ ${result.rows.length} duyuru bulundu`);

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
    console.error('❌ Admin duyuru listesi hatası:', err);
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
    const result = await pool.query(
      "SELECT * FROM bildirimler WHERE kullanici_id = $1 ORDER BY olusturma_tarihi DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Bildirim getirme hatası:", err);
    res.status(500).json({ mesaj: "Sunucu hatası" });
  }
});

// Bu route'u /derslerim'den sonra taşıyacağız

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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { kullanici_id, baslik, icerik, kategori = 'Genel', genel_mi = false, ders_id } = req.body;
    const yazar_id = kullanici_id || req.user.id; // Admin kullanıcı_id belirtebilir, yoksa kendi id'si

    try {
      await pool.query(
        "INSERT INTO bildirimler (kullanici_id, baslik, icerik, kategori, genel_mi, ders_id) VALUES ($1, $2, $3, $4, $5, $6)",
        [yazar_id, baslik, icerik, kategori, genel_mi, ders_id]
      );
      res.status(201).json({ mesaj: "Bildirim oluşturuldu" });
    } catch (err) {
      console.error("Bildirim oluşturma hatası:", err);
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
    const result = await pool.query(
      "UPDATE bildirimler SET goruldu_mu = TRUE WHERE id = $1 AND kullanici_id = $2",
      [id, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ mesaj: "Bildirim bulunamadı" });
    }
    res.json({ mesaj: "Bildirim okundu olarak işaretlendi" });
  } catch (err) {
    console.error("Bildirim güncelleme hatası:", err);
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
    
    res.json(bildirimResult.rows);

  } catch (err) {
    console.error("Ders bildirimlerini getirme hatası:", err);
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


// Bildirim silme işlemi (öğretmen kendi oluşturduğu bildirimi silebilir)

// Bu route'u /derslerim'den sonra taşıyacağız

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
// Bildirim silme işlemi (öğretmen kendi oluşturduğu bildirimi silebilir)
router.delete("/sil/:bildirim_id", async (req, res) => {
  const bildirimId = req.params.bildirim_id;
  const authHeader = req.headers["authorization"];
  const ogretmenId = req.params.kullanici_id;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ mesaj: "Yetkisiz: Token eksik." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Bildirim öğretmene mi ait kontrolü
    const kontrol = await pool.query(
      "SELECT * FROM bildirimler WHERE id = $1 AND kullanici_id = $2",
      [bildirimId, ogretmenId]
    );

    if (kontrol.rows.length === 0) {
      return res.status(403).json({ mesaj: "Bu bildirimi silme yetkiniz yok." });
    }
    // Silme işlemi
    await pool.query("DELETE FROM bildirimler WHERE id = $1", [bildirimId]);
    res.json({ mesaj: "Bildirim başarıyla silindi." });
  } catch (err) {
    console.error("Silme hatası:", err);
    res.status(500).json({ mesaj: "Sunucu hatası." });
  }
});

// Belirli bir kullanıcının bildirimlerini getir (admin panel için)
router.get("/:userId", verifyToken, async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM bildirimler WHERE kullanici_id = $1 ORDER BY olusturma_tarihi DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Bildirim getirme hatası:", err);
    res.status(500).json({ mesaj: "Sunucu hatası" });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const result = await pool.query(
      'DELETE FROM bildirimler WHERE id = $1 AND kullanici_id = $2',
      [id, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ mesaj: 'Bildirim bulunamadı veya silme yetkiniz yok.' });
    }
    res.json({ mesaj: 'Bildirim silindi.' });
  } catch (err) {
    console.error('Bildirim silme hatası:', err);
    res.status(500).json({ mesaj: 'Sunucu hatası' });
  }
});

module.exports = router;
