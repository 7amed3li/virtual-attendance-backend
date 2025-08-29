const express = require("express");
const router = express.Router();
const pool = require("../config/veritabani");
const { body, param, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");

const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient(); // Prisma Client'ı oluştur -ÖZGÜRCAN

/**
 * @swagger
 * tags:
 *   name: Yoklama
 *   description: Öğrencinin yoklama işlemleri ve yoklama durumu güncelleme
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     YoklamaKaydiInput:
 *       type: object
 *       required:
 *         - oturum_id
 *         - qr_token
 *       properties:
 *         oturum_id:
 *           type: integer
 *           description: Yoklamanın yapılacağı ders oturumunun IDsi (QR token içindeki ile eşleşmeli).
 *         qr_token:
 *           type: string
 *           description: Öğrenci tarafından taranan ve QR koddan elde edilen JWT.
 *         konum:
 *           type: string
 *           description: Öğrencinin konumu (opsiyonel, ileride kullanılabilir).
 *     YoklamaKaydi:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         oturum_id:
 *           type: integer
 *         ogrenci_id:
 *           type: integer
 *         ders_id:
 *           type: integer
 *         giris_zamani:
 *           type: string
 *           format: date-time
 *         durum:
 *           type: string
 *           enum: [katildi, katilmadi, izinli, gec_geldi]
 *         konum:
 *           type: string
 *         aciklama:
 *           type: string
 *     YoklamaKaydiGuncelleInput:
 *       type: object
 *       required:
 *         - durum
 *       properties:
 *         durum:
 *           type: string
 *           enum: [katildi, katilmadi, izinli, gec_geldi]
 *           description: Yeni yoklama durumu.
 *         aciklama:
 *           type: string
 *           description: Güncelleme için açıklama (opsiyonel).
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

// Middleware to check if the user can manage this specific attendance record
const canManageYoklamaRecord = async (req, res, next) => {
    const { yoklamaId } = req.params;
    const { id: userId, rol } = req.user;

    if (rol === 'admin') {
        return next();
    }

    if (rol === 'ogretmen' && yoklamaId) {
        try {
            const yoklamaQuery = await pool.query(
                `SELECT d.ogretmen_id 
                 FROM yoklamalar y
                 JOIN oturumlar o ON y.oturum_id = o.id
                 JOIN dersler d ON o.ders_id = d.id
                 WHERE y.id = $1`,
                [yoklamaId]
            );
            if (yoklamaQuery.rows.length > 0 && yoklamaQuery.rows[0].ogretmen_id === userId) {
                return next();
            }
        } catch (err) {
            console.error("Error in canManageYoklamaRecord middleware:", err);
            return res.status(500).json({ mesaj: "Yetki kontrolü sırasında sunucu hatası" });
        }
    }
    res.status(403).json({ mesaj: "Bu yoklama kaydını düzenleme yetkiniz yok." });
};

/**
 * @swagger
 * /api/yoklama/ekle:
 *   post:
 *     summary: QR kod taraması sonrası yoklama kaydeder. Öğrenci kendi adına yapar.
 *     tags: [Yoklama]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/YoklamaKaydiInput'
 *     responses:
 *       201:
 *         description: Yoklama başarıyla kaydedildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mesaj:
 *                   type: string
 *                 yoklama:
 *                   $ref: '#/components/schemas/YoklamaKaydi'
 *       400:
 *         description: "Geçersiz istek veya doğrulama hatası (örn: QR token eksik)."
 *       401:
 *         description: "Geçersiz QR token (süresi dolmuş, imza hatası, vb.)."
 *       403:
 *         description: Öğrenci derse kayıtlı değil veya QR token içindeki oturum ID eşleşmiyor.
 *       404:
 *         description: Oturum bulunamadı.
 *       409: 
 *         description: Bu oturum için zaten yoklama yapılmış.
 *       500:
 *         description: Sunucu hatası.
 */
router.post(
  "/ekle",
  [
    body("oturum_id").isInt().withMessage("oturum_id bir tamsayı olmalı"),
    body("qr_token").notEmpty().withMessage("qr_token gerekli"),
    body("konum").optional().isString().withMessage("konum metin olmalı"),
    body("cihaz_id").optional().isString().withMessage("cihaz_id metin olmalı"),
    body("universite_kodu").optional().isString().withMessage("universite_kodu metin olmalı"),
    body("count").optional().isInt().withMessage("count bir tamsayı olmalı")
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ hatalar: errors.array() });
    }

    const { oturum_id: requested_oturum_id, qr_token, konum, cihaz_id, universite_kodu, count } = req.body;
    let ogrenci_id = req.user.id;
    const ogrenci_rol = req.user.rol;

    // Eğer universite_kodu gönderildiyse, id'yi bul
    if (universite_kodu) {
      const ogrenciRes = await pool.query("SELECT id FROM kullanicilar WHERE universite_kodu = $1", [universite_kodu]);
      if (ogrenciRes.rows.length === 0) {
        return res.status(404).json({ mesaj: "Bu universite_kodu ile öğrenci bulunamadı." });
      }
      ogrenci_id = ogrenciRes.rows[0].id;
    }

    const durum = "katildi";

    if (ogrenci_rol !== 'ogrenci') {
        return res.status(403).json({ mesaj: "Sadece öğrenciler yoklama yapabilir." });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. QR Token'ı doğrula ve çöz
      let decodedQrPayload;
      try {
        decodedQrPayload = jwt.verify(qr_token, process.env.JWT_SECRET || "gizliAnahtar");
      } catch (jwtError) {
        await client.query('ROLLBACK');
        client.release();
        if (jwtError.name === 'TokenExpiredError') {
            return res.status(401).json({ mesaj: "QR kodunun süresi dolmuş." });
        }
        return res.status(401).json({ mesaj: "Geçersiz QR kodu.", detay: jwtError.message });
      }

      const { oturumId: qr_oturum_id, latitude: qr_lat, longitude: qr_lng } = decodedQrPayload;

      // 2. Konum doğrulaması (öğrenci ile QR konumu karşılaştırılır)
      if (qr_lat !== undefined && qr_lng !== undefined && konum) {
        try {
          const ogrenciKonum = JSON.parse(konum);
          const ogr_lat = ogrenciKonum.latitude;
          const ogr_lng = ogrenciKonum.longitude;
          // Haversine formülü ile mesafe hesapla (metre cinsinden)
          function toRad(x) { return x * Math.PI / 180; }
          const R = 6371000; // Dünya yarıçapı (metre)
          const dLat = toRad(ogr_lat - qr_lat);
          const dLon = toRad(ogr_lng - qr_lng);
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(qr_lat)) * Math.cos(toRad(ogr_lat)) * Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;
          console.log('QR konumu:', qr_lat, qr_lng, 'Öğrenci konumu:', ogr_lat, ogr_lng, 'Mesafe:', distance);
          if (distance > 50) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(403).json({ mesaj: 'Konum doğrulaması başarısız, lütfen doğru konumda olduğunuzdan emin olun.' });
          }
        } catch (e) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(400).json({ mesaj: 'Konum verisi hatalı veya eksik.' });
        }
      }

      // 3. QR token ve istek oturum_id eşleşiyor mu?
      if (parseInt(qr_oturum_id) !== parseInt(requested_oturum_id)) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(403).json({ mesaj: "QR kod oturum ID eşleşmiyor." });
      }
      
      // 4. Oturum var mı?
      const oturumRes = await client.query(
        "SELECT ders_id, saat, tarih FROM oturumlar WHERE id = $1 FOR UPDATE",
        [qr_oturum_id]
      );
      if (oturumRes.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json({ mesaj: "Oturum bulunamadı." });
      }
      const { ders_id, saat, tarih } = oturumRes.rows[0];

      // 5. Öğrenci derse kayıtlı mı?
      const ogrenciKayitRes = await client.query(
        "SELECT id FROM ders_kayitlari WHERE ders_id = $1 AND ogrenci_id = $2",
        [ders_id, ogrenci_id]
      );
      if (ogrenciKayitRes.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(403).json({ mesaj: "Öğrenci bu derse kayıtlı değil." });
      }

      // 6. Oturumun max_count'unu önce çek
      const maxCountRes = await client.query(
        "SELECT max_count FROM oturumlar WHERE id = $1",
        [qr_oturum_id]
      );
      const max_count = maxCountRes.rows[0]?.max_count || 1;
      
      // 7. Aynı oturum ve öğrenci için kayıt var mı?
      console.log(`[DEBUG] Aranan: oturum_id=${qr_oturum_id}, ogrenci_id=${ogrenci_id}`);
      const exist = await client.query(
        "SELECT id, count FROM yoklamalar WHERE oturum_id = $1 AND ogrenci_id = $2 AND tur_no IS NULL",
        [qr_oturum_id, ogrenci_id]
      );
      console.log(`[DEBUG] Bulunan kayıt sayısı: ${exist.rows.length}`);
      
      if (exist.rows.length > 0) {
        // Mevcut kayıt var - UPDATE yap
        const kayit = exist.rows[0];
        const mevcutCount = kayit.count || 1;
        const yeniCount = mevcutCount + 1;
        
        // Eğer yeni count, max_count'a eşitse durum 'katildi' olmalı
        const yeniDurum = yeniCount >= max_count ? 'katildi' : 'katilmadi';
        
        console.log(`[YOKLAMA] Mevcut kayıt güncelleniyor: id=${kayit.id}, eskiCount=${mevcutCount}, yeniCount=${yeniCount}, durum=${yeniDurum}, max_count=${max_count}`);
        
        await client.query(
          "UPDATE yoklamalar SET count = $1, durum = $2, zaman = CURRENT_TIMESTAMP WHERE id = $3",
          [yeniCount, yeniDurum, kayit.id]
        );
        
        console.log(`[YOKLAMA] UPDATE tamamlandı: id=${kayit.id}`);
        await client.query('COMMIT');
        client.release();
        return res.status(200).json({ 
          mesaj: `Yoklama güncellendi. ${yeniCount}/${max_count} QR tarama tamamlandı.`,
          yoklama: { ...kayit, count: yeniCount, durum: yeniDurum }
        });
      } else {
        // Mevcut kayıt yok - YENİ KAYIT oluştur
        const ilkDurum = max_count === 1 ? "katildi" : "katilmadi";
        console.log(`[YOKLAMA] Yeni kayıt ekleniyor: oturum_id=${qr_oturum_id}, ogrenci_id=${ogrenci_id}, durum=${ilkDurum}, count=1, max_count=${max_count}`);
        
        const result = await client.query(
          `INSERT INTO yoklamalar (oturum_id, ogrenci_id, ders_id, zaman, durum, count, konum, aciklama, tur_no)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, NULL) RETURNING *`,
          [qr_oturum_id, ogrenci_id, ders_id, ilkDurum, 1, konum, `QR ile ${ilkDurum}`]
        );
        
        console.log(`[YOKLAMA] INSERT tamamlandı: id=${result.rows[0].id}`);
        await client.query('COMMIT');
        client.release();
        res.status(201).json({
          mesaj: `İlk yoklama kaydedildi. 1/${max_count} QR tarama tamamlandı.`,
          yoklama: result.rows[0]
        });
      }
    } catch (err) {
      await client.query('ROLLBACK');
      console.error("Yoklama ekleme hatası:", err);
      next(err);
    } finally {
      client.release();
    }
  }
);

/**
 * @swagger
 * /api/yoklama/{yoklamaId}:
 *   put:
 *     summary: Mevcut bir yoklama kaydının durumunu ve açıklamasını günceller (Admin veya dersin öğretmeni).
 *     tags: [Yoklama]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: yoklamaId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Güncellenecek yoklama kaydının IDsi
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/YoklamaKaydiGuncelleInput'
 *     responses:
 *       200:
 *         description: Yoklama kaydı başarıyla güncellendi.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/YoklamaKaydi'
 *       400:
 *         description: "Geçersiz istek veya doğrulama hatası (örn. durum geçerli değil)."
 *       403:
 *         description: Bu yoklama kaydını düzenleme yetkiniz yok.
 *       404:
 *         description: Yoklama kaydı bulunamadı.
 *       500:
 *         description: Sunucu hatası.
 */
router.put(
    "/:yoklamaId",
    canManageYoklamaRecord,
    [
        param("yoklamaId").isInt({ gt: 0 }).withMessage("Geçerli bir yoklama ID girilmelidir."),
        body("durum").notEmpty().isIn(['katildi', 'katilmadi', 'izinli', 'gec_geldi']).withMessage("Geçersiz durum değeri. Kabul edilenler: katildi, katilmadi, izinli, gec_geldi."),
        body("aciklama").optional({nullable: true, checkFalsy: true}).isString().withMessage("Açıklama metin olmalıdır.")
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ hatalar: errors.array() });
        }

        const { yoklamaId } = req.params;
        const { durum, aciklama } = req.body;
        const { id: editorUserId, rol: editorRol } = req.user;

        try {
            const currentYoklama = await pool.query("SELECT * FROM yoklamalar WHERE id = $1", [yoklamaId]);
            if (currentYoklama.rows.length === 0) {
                return res.status(404).json({ mesaj: "Yoklama kaydı bulunamadı." });
            }

            const updateFields = [];
            const updateValues = [];
            let queryIndex = 1;

            if (durum) { 
                updateFields.push(`durum = $${queryIndex++}`); 
                updateValues.push(durum); 
            }
            updateFields.push(`aciklama = $${queryIndex++}`); 
            updateValues.push(aciklama !== undefined ? aciklama : currentYoklama.rows[0].aciklama);

            if (updateFields.length === 0 && aciklama === undefined) {
                return res.status(400).json({ mesaj: "Güncellenecek alan belirtilmedi (durum veya aciklama)." });
            }

            updateValues.push(yoklamaId);

            const { rows } = await pool.query(
                `UPDATE yoklamalar SET ${updateFields.join(', ')} WHERE id = $${queryIndex} RETURNING *`,
                updateValues
            );
            
            res.status(200).json({
                mesaj: "Yoklama kaydı başarıyla güncellendi.",
                yoklama: rows[0]
            });
        } catch (err) {
            console.error("Yoklama güncelleme hatası:", err);
            next(err);
        }
    }
);

/**
 * @swagger
 * /api/yoklama/manuel:
 *   post:
 *     summary: Öğretmen manuel yoklama ekleyebilsin.
 *     tags: [Yoklama]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/YoklamaKaydiInput'
 *     responses:
 *       201:
 *         description: Yoklama başarıyla kaydedildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mesaj:
 *                   type: string
 *                 yoklama:
 *                   $ref: '#/components/schemas/YoklamaKaydi'
 *       400:
 *         description: "Geçersiz istek veya doğrulama hatası (örn: oturum_id eksik, durum geçersiz)."
 *       403:
 *         description: Sadece öğretmen veya admin manuel yoklama ekleyebilir.
 *       404:
 *         description: Bu üniversite koduna sahip öğrenci bulunamadı.
 *       409:
 *         description: Bu öğrenci için zaten yoklama kaydı var.
 *       500:
 *         description: Sunucu hatası.
 */
router.post(
  "/manuel",
  [
    body("oturum_id").isInt().withMessage("oturum_id bir tamsayı olmalı"),
    body("universite_kodu").notEmpty().withMessage("universite_kodu gerekli"),
    body("durum").optional().isString().withMessage("durum metin olmalı")
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ hatalar: errors.array() });
    }
    const { oturum_id, universite_kodu, durum } = req.body;
    const user = req.user;
    if (user.rol !== 'ogretmen' && user.rol !== 'admin') {
      return res.status(403).json({ mesaj: "Sadece öğretmen veya admin manuel yoklama ekleyebilir." });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // 1. Öğrenciyi universite_kodu ile bul
      const ogrRes = await client.query(
        "SELECT id FROM kullanicilar WHERE universite_kodu = $1 AND rol = 'ogrenci'",
        [universite_kodu]
      );
      if (ogrRes.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json({ mesaj: "Bu üniversite koduna sahip öğrenci bulunamadı." });
      }
      const ogrenci_id = ogrRes.rows[0].id;
      
      // 2. Aynı oturum ve öğrenci için kayıt var mı?
      const exist = await client.query(
        "SELECT id, durum FROM yoklamalar WHERE oturum_id = $1 AND ogrenci_id = $2",
        [oturum_id, ogrenci_id]
      );
      
      if (exist.rows.length > 0) {
        // Mevcut kaydı güncelle
        const kayit = exist.rows[0];
        await client.query(
          "UPDATE yoklamalar SET durum = $1, zaman = CURRENT_TIMESTAMP WHERE id = $2",
          [durum || 'katildi', kayit.id]
        );
        await client.query('COMMIT');
        client.release();
        return res.status(200).json({ 
          mesaj: "Yoklama güncellendi.", 
          yoklama: { ...kayit, durum: durum || 'katildi' }
        });
      }
      
      // 3. Yeni yoklama kaydını ekle
      const result = await client.query(
        `INSERT INTO yoklamalar (oturum_id, ogrenci_id, durum, count, zaman) 
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING *`,
        [oturum_id, ogrenci_id, durum || 'katildi', 1]
      );
      
      await client.query('COMMIT');
      client.release();
      res.status(201).json({ mesaj: "Yoklama başarıyla eklendi.", yoklama: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      console.error("Manuel yoklama ekleme hatası:", err);
      res.status(500).json({ mesaj: "Sunucu hatası." });
    }
  }
);

// Güvenli yoklama endpointi (max_count dahil)
router.post(
  "/attendance",
  [
    body("sessionId").isInt().withMessage("sessionId bir tamsayı olmalı"),
    body("studentId").isInt().withMessage("studentId bir tamsayı olmalı"),
    body("deviceId").notEmpty().withMessage("deviceId gerekli"),
    body("turNo").isInt().withMessage("turNo bir tamsayı olmalı")
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ hatalar: errors.array() });
    }
    const { sessionId, studentId, deviceId, turNo } = req.body;
    const timestamp = new Date();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // 1. Oturumun max_count'unu önce çek
      const maxCountRes = await client.query(
        "SELECT max_count FROM oturumlar WHERE id = $1",
        [sessionId]
      );
      const max_count = maxCountRes.rows[0]?.max_count || 1;
      
      // 2. Aynı öğrenci aynı oturum için yoklama almış mı? (tur_no göz ardı et)
      const studentCheck = await client.query(
        "SELECT id, count, durum, tur_no FROM yoklamalar WHERE oturum_id = $1 AND ogrenci_id = $2",
        [sessionId, studentId]
      );
      
      if (studentCheck.rows.length > 0) {
        // Mevcut kayıt var - UPDATE yap (count ve tur_no artır)
        const kayit = studentCheck.rows[0];
        const mevcutCount = kayit.count || 1;
        const yeniCount = mevcutCount + 1;
        const yeniTurNo = turNo; // Gelen yeni tur_no'yu kullan
        
        // Eğer yeni count, max_count'a eşitse durum 'katildi' olmalı
        const yeniDurum = yeniCount >= max_count ? 'katildi' : 'katilmadi';
        
        console.log(`[YOKLAMA] Mevcut kayıt güncelleniyor: id=${kayit.id}, eskiCount=${mevcutCount}, yeniCount=${yeniCount}, eskiTurNo=${kayit.tur_no}, yeniTurNo=${yeniTurNo}, durum=${yeniDurum}`);
        
        await client.query(
          "UPDATE yoklamalar SET count = $1, durum = $2, tur_no = $3, zaman = $4 WHERE id = $5",
          [yeniCount, yeniDurum, yeniTurNo, timestamp, kayit.id]
        );
        
        await client.query('COMMIT');
        client.release();
        return res.status(200).json({ 
          mesaj: `Yoklama güncellendi. ${yeniCount}/${max_count} QR tarama tamamlandı.`, 
          yoklama: { ...kayit, count: yeniCount, durum: yeniDurum, tur_no: yeniTurNo }
        });
      }
      
      // 3. Aynı cihaz aynı oturum için yoklama almış mı? (sadece INSERT için kontrol)
      // Eğer yukarıda UPDATE yapıldıysa bu kontrole gerek yok
      const deviceCheck = await client.query(
        "SELECT id FROM yoklamalar WHERE oturum_id = $1 AND cihaz_id = $2",
        [sessionId, deviceId]
      );
      if (deviceCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(409).json({ mesaj: "Bu cihaz bu oturum için zaten yoklama almış." });
      }
      
      // 4. Yeni kayıt ekle
      const ilkDurum = max_count === 1 ? "katildi" : "katilmadi";
      const result = await client.query(
        `INSERT INTO yoklamalar (oturum_id, ogrenci_id, zaman, cihaz_id, tur_no, count, durum) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [sessionId, studentId, timestamp, deviceId, turNo, 1, ilkDurum]
      );
      
      await client.query('COMMIT');
      client.release();
      res.status(201).json({ 
        mesaj: `İlk yoklama kaydedildi. 1/${max_count} QR tarama tamamlandı.`, 
        yoklama: result.rows[0] 
      });
    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      console.error("Yoklama ekleme hatası:", err);
      res.status(500).json({ mesaj: "Sunucu hatası", detay: err.message });
    }
  }
);

// Mevcut yoklama kayıtlarını düzeltme endpoint'i (geçici)
router.post("/fix-existing", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // tur_no olmayan kayıtları NULL yap (QR ile alınan yoklamalar için)
    const turNoKayitlari = await client.query(
      "UPDATE yoklamalar SET tur_no = NULL WHERE tur_no IS NOT NULL AND cihaz_id IS NULL RETURNING id"
    );
    
    console.log(`[FIX] ${turNoKayitlari.rows.length} adet kayıt tur_no = NULL yapıldı`);
    
    // count >= max_count olanları 'katildi' yap
    const katildiKayitlari = await client.query(
      `UPDATE yoklamalar SET durum = 'katildi' 
       FROM oturumlar 
       WHERE yoklamalar.oturum_id = oturumlar.id 
       AND yoklamalar.count >= oturumlar.max_count 
       AND yoklamalar.durum != 'katildi'
       RETURNING yoklamalar.id`
    );
    
    console.log(`[FIX] ${katildiKayitlari.rows.length} adet kayıt 'katildi' yapıldı`);
    
    await client.query('COMMIT');
    client.release();
    res.json({ 
      mesaj: "Yoklama kayıtları düzeltildi", 
      tur_no_guncellenen: turNoKayitlari.rows.length,
      katildi_yapilan: katildiKayitlari.rows.length
    });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error("Yoklama düzeltme hatası:", err);
    res.status(500).json({ mesaj: "Sunucu hatası", detay: err.message });
  }
});

// Duplicate kayıtları temizleme endpoint'i
router.post("/clean-duplicates", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Aynı oturum ve öğrenci için birden fazla kayıt varsa, en son olanı tut
    const duplicateKayitlar = await client.query(
      `DELETE FROM yoklamalar 
       WHERE id NOT IN (
         SELECT MAX(id) 
         FROM yoklamalar 
         WHERE tur_no IS NULL 
         GROUP BY oturum_id, ogrenci_id
       ) 
       AND tur_no IS NULL
       RETURNING id`
    );
    
    console.log(`[CLEAN] ${duplicateKayitlar.rows.length} adet duplicate kayıt silindi`);
    
    await client.query('COMMIT');
    client.release();
    res.json({ 
      mesaj: "Duplicate kayıtlar temizlendi", 
      silinen_kayit_sayisi: duplicateKayitlar.rows.length
    });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error("Duplicate temizleme hatası:", err);
    res.status(500).json({ mesaj: "Sunucu hatası", detay: err.message });
  }
});

module.exports = router;