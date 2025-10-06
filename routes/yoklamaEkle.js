
const express = require("express");
const router = express.Router();
const pool = require("../config/veritabani");
const { body, param, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middleware/verifyToken");
const logger = require('../utils/logger'); // إضافة استيراد logger

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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
    logger.debug('🔍 Yoklama kaydı düzenleme yetkisi kontrol ediliyor', { yoklama_id: req.params.yoklamaId, user_id: req.user?.id, rol: req.user?.rol });
    const { yoklamaId } = req.params;
    const { id: userId, rol } = req.user;

    if (rol === 'admin') {
        logger.debug('Kullanıcı admin, erişim izni verildi', { user_id: userId });
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
                logger.debug('Öğretmen yetkili, erişim izni verildi', { yoklama_id: yoklamaId, ogretmen_id: userId });
                return next();
            }
        } catch (err) {
            console.error("Error in canManageYoklamaRecord middleware:", err);
            logger.error('❌ canManageYoklamaRecord middleware hatası', { error: err.message, stack: err.stack, yoklama_id: yoklamaId, user_id: userId });
            return res.status(500).json({ mesaj: "Yetki kontrolü sırasında sunucu hatası" });
        }
    }
    logger.warn('❌ Yetkisiz erişim: Yoklama kaydını düzenleme yetkisi yok', { yoklama_id: yoklamaId, user_id: userId, rol });
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
        logger.debug('🔍 Yoklama ekleme isteği alındı', { oturum_id: req.body.oturum_id, user_id: req.user?.id, universite_kodu: req.body.universite_kodu });
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('❌ Doğrulama hatası', { errors: errors.array(), oturum_id: req.body.oturum_id, user_id: req.user?.id });
            return res.status(400).json({ hatalar: errors.array() });
        }

        const { oturum_id: requested_oturum_id, qr_token, konum, cihaz_id, universite_kodu, count } = req.body;
        let ogrenci_id = req.user.id;
        const ogrenci_rol = req.user.rol;

        // Eğer universite_kodu gönderildiyse, id'yi bul
        if (universite_kodu) {
            logger.debug('Öğrenci üniversite kodu ile kontrol ediliyor', { universite_kodu, user_id: req.user?.id });
            const ogrenciRes = await pool.query("SELECT id FROM kullanicilar WHERE universite_kodu = $1", [universite_kodu]);
            if (ogrenciRes.rows.length === 0) {
                logger.warn('❌ Öğrenci bulunamadı', { universite_kodu, user_id: req.user?.id });
                return res.status(404).json({ mesaj: "Bu universite_kodu ile öğrenci bulunamadı." });
            }
            ogrenci_id = ogrenciRes.rows[0].id;
            logger.debug('Öğrenci bulundu', { ogrenci_id, universite_kodu, user_id: req.user?.id });
        }

        const durum = "katildi";

        if (ogrenci_rol !== 'ogrenci') {
            logger.warn('❌ Yetkisiz erişim: Sadece öğrenciler yoklama yapabilir', { user_id: req.user?.id, rol: ogrenci_rol });
            return res.status(403).json({ mesaj: "Sadece öğrenciler yoklama yapabilir." });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            logger.debug('Transaksiyon başlatıldı', { oturum_id: requested_oturum_id, ogrenci_id, user_id: req.user?.id });

            // 1. QR Token'ı doğrula ve çöz
            logger.debug('QR token doğrulanıyor', { oturum_id: requested_oturum_id, user_id: req.user?.id });
            let decodedQrPayload;
            try {
                decodedQrPayload = jwt.verify(qr_token, process.env.JWT_SECRET || "gizliAnahtar");
                logger.debug('QR token başarıyla doğrulandı', { oturum_id: decodedQrPayload.oturumId, user_id: req.user?.id });
            } catch (jwtError) {
                await client.query('ROLLBACK');
                client.release();
                if (jwtError.name === 'TokenExpiredError') {
                    logger.warn('❌ QR kodu süresi dolmuş', { oturum_id: requested_oturum_id, user_id: req.user?.id });
                    return res.status(401).json({ mesaj: "QR kodunun süresi dolmuş." });
                }
                logger.error('❌ Geçersiz QR kodu', { error: jwtError.message, oturum_id: requested_oturum_id, user_id: req.user?.id });
                return res.status(401).json({ mesaj: "Geçersiz QR kodu.", detay: jwtError.message });
            }

            const { oturumId: qr_oturum_id, latitude: qr_lat, longitude: qr_lng } = decodedQrPayload;

            // 2. Konum doğrulaması (öğrenci ile QR konumu karşılaştırılır)
            if (qr_lat !== undefined && qr_lng !== undefined && konum) {
                logger.debug('Konum doğrulama yapılıyor', { qr_lat, qr_lng, konum, user_id: req.user?.id });
                try {
                    const ogrenciKonum = JSON.parse(konum);
                    const ogr_lat = ogrenciKonum.latitude;
                    const ogr_lng = ogrenciKonum.longitude;
                    // Haversine formülü ile mesafe hesapla (metre cinsinden)
                    function toRad(x) { return x * Math.PI / 180; }
                    const R = 6371000; // Dünya yarıçapı (metre)
                    const dLat = toRad(ogr_lat - qr_lat);
                    const dLon = toRad(ogr_lng - qr_lng);
                    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(qr_lat)) * Math.cos(toRad(ogr_lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    const distance = R * c;
                    logger.debug('Konum mesafesi hesaplandı', { distance, qr_lat, qr_lng, ogr_lat, ogr_lng, user_id: req.user?.id });
                    if (distance > 50) {
                        await client.query('ROLLBACK');
                        client.release();
                        logger.warn('❌ Konum doğrulaması başarısız', { distance, oturum_id: requested_oturum_id, user_id: req.user?.id });
                        return res.status(403).json({ mesaj: 'Konum doğrulaması başarısız, lütfen doğru konumda olduğunuzdan emin olun.' });
                    }
                } catch (e) {
                    await client.query('ROLLBACK');
                    client.release();
                    logger.error('❌ Konum verisi hatalı', { error: e.message, oturum_id: requested_oturum_id, user_id: req.user?.id });
                    return res.status(400).json({ mesaj: 'Konum verisi hatalı veya eksik.' });
                }
            }

            // 3. QR token ve istek oturum_id eşleşiyor mu?
            if (parseInt(qr_oturum_id) !== parseInt(requested_oturum_id)) {
                await client.query('ROLLBACK');
                client.release();
                logger.warn('❌ QR kod oturum ID eşleşmiyor', { qr_oturum_id, requested_oturum_id, user_id: req.user?.id });
                return res.status(403).json({ mesaj: "QR kod oturum ID eşleşmiyor." });
            }

            // 4. Oturum var mı?
            logger.debug('Oturum varlığı kontrol ediliyor', { oturum_id: qr_oturum_id, user_id: req.user?.id });
            const oturumRes = await client.query(
                "SELECT ders_id, saat, tarih FROM oturumlar WHERE id = $1 FOR UPDATE",
                [qr_oturum_id]
            );
            if (oturumRes.rows.length === 0) {
                await client.query('ROLLBACK');
                client.release();
                logger.warn('❌ Oturum bulunamadı', { oturum_id: qr_oturum_id, user_id: req.user?.id });
                return res.status(404).json({ mesaj: "Oturum bulunamadı." });
            }
            const { ders_id, saat, tarih } = oturumRes.rows[0];
            logger.debug('Oturum bulundu', { oturum_id: qr_oturum_id, ders_id, user_id: req.user?.id });

            // 5. Öğrenci derse kayıtlı mı?
            logger.debug('Öğrenci ders kaydı kontrol ediliyor', { ders_id, ogrenci_id, user_id: req.user?.id });
            const ogrenciKayitRes = await client.query(
                "SELECT id FROM ders_kayitlari WHERE ders_id = $1 AND ogrenci_id = $2",
                [ders_id, ogrenci_id]
            );
            if (ogrenciKayitRes.rows.length === 0) {
                await client.query('ROLLBACK');
                client.release();
                logger.warn('❌ Öğrenci derse kayıtlı değil', { ders_id, ogrenci_id, user_id: req.user?.id });
                return res.status(403).json({ mesaj: "Öğrenci bu derse kayıtlı değil." });
            }

            // 6. Oturumun max_count'unu önce çek
            logger.debug('Oturum max_count değeri çekiliyor', { oturum_id: qr_oturum_id, user_id: req.user?.id });
            const maxCountRes = await client.query(
                "SELECT max_count FROM oturumlar WHERE id = $1",
                [qr_oturum_id]
            );
            const max_count = maxCountRes.rows[0]?.max_count || 1;
            logger.debug('Max count alındı', { max_count, oturum_id: qr_oturum_id, user_id: req.user?.id });

            // 7. Aynı oturum ve öğrenci için kayıt var mı?
            logger.debug('Mevcut yoklama kaydı kontrol ediliyor', { oturum_id: qr_oturum_id, ogrenci_id, user_id: req.user?.id });
            const exist = await client.query(
                "SELECT id, count FROM yoklamalar WHERE oturum_id = $1 AND ogrenci_id = $2 FOR UPDATE",
                [qr_oturum_id, ogrenci_id]
            );

            if (exist.rows.length > 0) {
                // Mevcut kayıt var - UPDATE yap
                const kayit = exist.rows[0];
                const mevcutCount = kayit.count || 1;
                const yeniCount = mevcutCount + 1;

                // Eğer yeni count, max_count'a eşitse durum 'katildi' olmalı
                const yeniDurum = yeniCount >= max_count ? 'katildi' : 'katilmadi';
                logger.debug('Mevcut yoklama kaydı güncelleniyor', { yoklama_id: kayit.id, eski_count: mevcutCount, yeni_count: yeniCount, durum: yeniDurum, max_count, user_id: req.user?.id });

                await client.query(
                    "UPDATE yoklamalar SET count = $1, durum = $2, zaman = CURRENT_TIMESTAMP WHERE id = $3",
                    [yeniCount, yeniDurum, kayit.id]
                );

                logger.info('✅ Yoklama güncellendi', { yoklama_id: kayit.id, oturum_id: qr_oturum_id, ogrenci_id, yeni_count: yeniCount, durum: yeniDurum, user_id: req.user?.id });
                await client.query('COMMIT');
                client.release();
                return res.status(200).json({
                    mesaj: `Yoklama güncellendi. ${yeniCount}/${max_count} QR tarama tamamlandı.`,
                    yoklama: { ...kayit, count: yeniCount, durum: yeniDurum }
                });
            } else {
                // Mevcut kayıt yok - YENİ KAYIT oluştur
                const ilkDurum = max_count === 1 ? "katildi" : "katilmadi";
                logger.debug('Yeni yoklama kaydı ekleniyor', { oturum_id: qr_oturum_id, ogrenci_id, durum: ilkDurum, count: 1, max_count, user_id: req.user?.id });

                const result = await client.query(
                    `INSERT INTO yoklamalar (oturum_id, ogrenci_id, ders_id, zaman, durum, count, konum, aciklama, tur_no)
                     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, NULL) RETURNING *`,
                    [qr_oturum_id, ogrenci_id, ders_id, ilkDurum, 1, konum, `QR ile ${ilkDurum}`]
                );

                logger.info('✅ Yeni yoklama kaydedildi', { yoklama_id: result.rows[0].id, oturum_id: qr_oturum_id, ogrenci_id, durum: ilkDurum, user_id: req.user?.id });
                await client.query('COMMIT');
                client.release();
                res.status(201).json({
                    mesaj: `İlk yoklama kaydedildi. 1/${max_count} QR tarama tamamlandı.`,
                    yoklama: result.rows[0]
                });
            }
        } catch (err) {
            await client.query('ROLLBACK');
            client.release();
            console.error("Yoklama ekleme hatası:", err);
            logger.error('❌ Yoklama ekleme hatası', { error: err.message, stack: err.stack, oturum_id: requested_oturum_id, ogrenci_id, user_id: req.user?.id });
            next(err);
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
        body("aciklama").optional({ nullable: true, checkFalsy: true }).isString().withMessage("Açıklama metin olmalıdır.")
    ],
    async (req, res, next) => {
        logger.debug('🔍 Yoklama güncelleme isteği alındı', { yoklama_id: req.params.yoklamaId, user_id: req.user?.id });
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('❌ Doğrulama hatası', { errors: errors.array(), yoklama_id: req.params.yoklamaId, user_id: req.user?.id });
            return res.status(400).json({ hatalar: errors.array() });
        }

        const { yoklamaId } = req.params;
        const { durum, aciklama } = req.body;
        const { id: editorUserId, rol: editorRol } = req.user;

        try {
            logger.debug('Yoklama kaydı varlığı kontrol ediliyor', { yoklama_id: yoklamaId, user_id: editorUserId });
            const currentYoklama = await pool.query("SELECT * FROM yoklamalar WHERE id = $1", [yoklamaId]);
            if (currentYoklama.rows.length === 0) {
                logger.warn('❌ Yoklama kaydı bulunamadı', { yoklama_id: yoklamaId, user_id: editorUserId });
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
                logger.warn('❌ Güncellenecek alan belirtilmedi', { yoklama_id: yoklamaId, user_id: editorUserId });
                return res.status(400).json({ mesaj: "Güncellenecek alan belirtilmedi (durum veya aciklama)." });
            }

            updateValues.push(yoklamaId);

            logger.debug('Yoklama kaydı güncelleniyor', { yoklama_id: yoklamaId, durum, aciklama, user_id: editorUserId });
            const { rows } = await pool.query(
                `UPDATE yoklamalar SET ${updateFields.join(', ')} WHERE id = $${queryIndex} RETURNING *`,
                updateValues
            );

            logger.info('✅ Yoklama kaydı başarıyla güncellendi', { yoklama_id: yoklamaId, durum: rows[0].durum, user_id: editorUserId });
            res.status(200).json({
                mesaj: "Yoklama kaydı başarıyla güncellendi.",
                yoklama: rows[0]
            });
        } catch (err) {
            console.error("Yoklama güncelleme hatası:", err);
            logger.error('❌ Yoklama güncelleme hatası', { error: err.message, stack: err.stack, yoklama_id: yoklamaId, user_id: editorUserId });
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
    async (req, res, next) => {
        logger.debug('🔍 Manuel yoklama ekleme isteği alındı', { oturum_id: req.body.oturum_id, universite_kodu: req.body.universite_kodu, user_id: req.user?.id });
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('❌ Doğrulama hatası', { errors: errors.array(), oturum_id: req.body.oturum_id, user_id: req.user?.id });
            return res.status(400).json({ hatalar: errors.array() });
        }
        const { oturum_id, universite_kodu, durum } = req.body;
        const user = req.user;
        if (user.rol !== 'ogretmen' && user.rol !== 'admin') {
            logger.warn('❌ Yetkisiz erişim: Sadece öğretmen veya admin manuel yoklama ekleyebilir', { user_id: user.id, rol: user.rol });
            return res.status(403).json({ mesaj: "Sadece öğretmen veya admin manuel yoklama ekleyebilir." });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            logger.debug('Transaksiyon başlatıldı', { oturum_id, user_id: user.id });

            // 4. Oturum var mı ve ders_id'yi al
            logger.debug('Oturum varlığı kontrol ediliyor', { oturum_id, user_id: user.id });
            const oturumRes = await client.query(
                "SELECT ders_id FROM oturumlar WHERE id = $1",
                [oturum_id]
            );
            if (oturumRes.rows.length === 0) {
                await client.query('ROLLBACK');
                client.release();
                logger.warn('❌ Oturum bulunamadı', { oturum_id, user_id: user.id });
                return res.status(404).json({ mesaj: "Oturum bulunamadı." });
            }
            const { ders_id } = oturumRes.rows[0];
            logger.debug('Oturum bulundu', { oturum_id, ders_id, user_id: user.id });

            // 5. Öğrenciyi universite_kodu ile bul
            logger.debug('Öğrenci üniversite kodu ile kontrol ediliyor', { universite_kodu, user_id: user.id });
            const ogrenciRes = await client.query(
                "SELECT id FROM kullanicilar WHERE universite_kodu = $1",
                [universite_kodu]
            );
            if (ogrenciRes.rows.length === 0) {
                await client.query('ROLLBACK');
                client.release();
                logger.warn('❌ Öğrenci bulunamadı', { universite_kodu, user_id: user.id });
                return res.status(404).json({ mesaj: "Öğrenci bulunamadı." });
            }
            const { id: ogrenci_id } = ogrenciRes.rows[0];
            logger.debug('Öğrenci bulundu', { ogrenci_id, universite_kodu, user_id: user.id });

            // 6. Öğrenci derse kayıtlı mı?
            logger.debug('Öğrenci ders kaydı kontrol ediliyor', { ders_id, ogrenci_id, user_id: user.id });
            const ogrenciKayitRes = await client.query(
                "SELECT id FROM ders_kayitlari WHERE ders_id = $1 AND ogrenci_id = $2",
                [ders_id, ogrenci_id]
            );
            if (ogrenciKayitRes.rows.length === 0) {
                await client.query('ROLLBACK');
                client.release();
                logger.warn('❌ Öğrenci derse kayıtlı değil', { ders_id, ogrenci_id, user_id: user.id });
                return res.status(403).json({ mesaj: "Öğrenci bu derse kayıtlı değil." });
            }

            // 7. Aynı oturum ve öğrenci için kayıt var mı?
            logger.debug('Mevcut manuel yoklama kaydı kontrol ediliyor', { oturum_id, ogrenci_id, user_id: user.id });
            const exist = await client.query(
                "SELECT id FROM yoklamalar WHERE oturum_id = $1 AND ogrenci_id = $2",
                [oturum_id, ogrenci_id]
            );
            if (exist.rows.length > 0) {
                await client.query('ROLLBACK');
                client.release();
                logger.warn('❌ Bu öğrenci için zaten yoklama kaydı var', { oturum_id, ogrenci_id, user_id: user.id });
                return res.status(409).json({ mesaj: "Bu öğrenci için zaten yoklama kaydı var." });
            }

            // 8. Manuel yoklama kaydı ekle
            const yoklamaDurum = durum || "katildi"; // Varsayılan olarak "katildi"
            const aciklama = `Manuel olarak eklendi.`;
            logger.debug('Manuel yoklama kaydı ekleniyor', { oturum_id, ogrenci_id, durum: yoklamaDurum, user_id: user.id });

            const result = await client.query(
                `INSERT INTO yoklamalar (oturum_id, ogrenci_id, ders_id, zaman, durum, count, konum, aciklama, tur_no)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, NULL) RETURNING *`,
                [oturum_id, ogrenci_id, ders_id, yoklamaDurum, 1, null, aciklama]
            );

            logger.info('✅ Manuel yoklama başarıyla kaydedildi', { yoklama_id: result.rows[0].id, oturum_id, ogrenci_id, durum: yoklamaDurum, user_id: user.id });
            await client.query('COMMIT');
            client.release();

            res.status(201).json({
                mesaj: `Yoklama başarıyla kaydedildi.`,
                yoklama: result.rows[0]
            });
        } catch (err) {
            if (client) {
                await client.query('ROLLBACK');
                client.release();
            }
            console.error("Yoklama ekleme hatası:", err);
            logger.error('❌ Manuel yoklama ekleme hatası', { error: err.message, stack: err.stack, oturum_id, universite_kodu, user_id: user.id });
            next(err);
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
        logger.debug('🔍 Güvenli yoklama isteği alındı', { session_id: req.body.sessionId, student_id: req.body.studentId, tur_no: req.body.turNo, user_id: req.user?.id });
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('❌ Doğrulama hatası', { errors: errors.array(), session_id: req.body.sessionId, user_id: req.user?.id });
            return res.status(400).json({ hatalar: errors.array() });
        }
        const { sessionId, studentId, deviceId, turNo } = req.body;
        const timestamp = new Date();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            logger.debug('Transaksiyon başlatıldı', { session_id: sessionId, student_id: studentId, user_id: req.user?.id });

            // 0. Öğrenci bu derse kayıtlı mı?
            logger.debug('Öğrenci ders kaydı kontrol ediliyor', { session_id: sessionId, student_id: studentId, user_id: req.user?.id });
            const oturumMeta = await client.query(
                "SELECT ders_id FROM oturumlar WHERE id = $1",
                [sessionId]
            );
            if (oturumMeta.rows.length === 0) {
                await client.query('ROLLBACK');
                client.release();
                logger.warn('❌ Oturum bulunamadı', { session_id: sessionId, user_id: req.user?.id });
                return res.status(404).json({ mesaj: "Oturum bulunamadı." });
            }
            const dersIdForSession = oturumMeta.rows[0].ders_id;
            const kayitKontrol = await client.query(
                "SELECT id FROM ders_kayitlari WHERE ders_id = $1 AND ogrenci_id = $2",
                [dersIdForSession, studentId]
            );
            if (kayitKontrol.rows.length === 0) {
                await client.query('ROLLBACK');
                client.release();
                logger.warn('❌ Öğrenci derse kayıtlı değil', { ders_id: dersIdForSession, student_id: studentId, user_id: req.user?.id });
                return res.status(403).json({ mesaj: "Bu derse kayıtlı değilsiniz. Yoklama alınamadı." });
            }

            // 1. Oturumun max_count'unu önce çek
            logger.debug('Oturum max_count değeri çekiliyor', { session_id: sessionId, user_id: req.user?.id });
            const maxCountRes = await client.query(
                "SELECT max_count FROM oturumlar WHERE id = $1",
                [sessionId]
            );
            const max_count = maxCountRes.rows[0]?.max_count || 1;
            logger.debug('Max count alındı', { max_count, session_id: sessionId, user_id: req.user?.id });

            // 2. Cihaz bazlı tekilleştirme: Aynı cihaz aynı oturumda tekrar kayıt oluşturamaz
            logger.debug('Cihaz bazlı tekilleştirme kontrol ediliyor', { session_id: sessionId, device_id: deviceId, tur_no: turNo, user_id: req.user?.id });
            const deviceCheck = await client.query(
                "SELECT id FROM yoklamalar WHERE oturum_id = $1 AND cihaz_id = $2 AND tur_no = $3",
                [sessionId, deviceId, turNo]
            );
            if (deviceCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                client.release();
                logger.warn('❌ Cihaz zaten bu tur için yoklama almış', { session_id: sessionId, device_id: deviceId, tur_no: turNo, user_id: req.user?.id });
                return res.status(409).json({ mesaj: "Bu cihaz bu yoklama turu için zaten yoklama almış." });
            }

            // 3. INSERT-ONLY: Her taramada yeni kayıt ekle
            const ilkDurum = (typeof turNo === 'number' && turNo >= max_count) ? 'katildi' : 'katilmadi';
            logger.debug('Yeni yoklama kaydı ekleniyor', { session_id: sessionId, student_id: studentId, tur_no: turNo, durum: ilkDurum, user_id: req.user?.id });
            const result = await client.query(
                `INSERT INTO yoklamalar (oturum_id, ogrenci_id, zaman, cihaz_id, tur_no, count, durum) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [sessionId, studentId, timestamp, deviceId, turNo, 1, ilkDurum]
            );

            logger.info('✅ Güvenli yoklama kaydedildi', { yoklama_id: result.rows[0].id, session_id: sessionId, student_id: studentId, tur_no: turNo, durum: ilkDurum, user_id: req.user?.id });
            await client.query('COMMIT');
            client.release();
            res.status(201).json({
                mesaj: `Yoklama kaydedildi.`,
                yoklama: result.rows[0]
            });
        } catch (err) {
            await client.query('ROLLBACK');
            client.release();
            console.error("Yoklama ekleme hatası:", err);
            logger.error('❌ Güvenli yoklama ekleme hatası', { error: err.message, stack: err.stack, session_id: sessionId, student_id: studentId, tur_no: turNo, user_id: req.user?.id });
            res.status(500).json({ mesaj: "Sunucu hatası", detay: err.message });
        }
    }
);

// Mevcut yoklama kayıtlarını düzeltme endpoint'i (geçici)
router.post("/fix-existing", async (req, res) => {
    logger.debug('🔍 Mevcut yoklama kayıtlarını düzeltme isteği alındı', { user_id: req.user?.id });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        logger.debug('Transaksiyon başlatıldı', { user_id: req.user?.id });

        // tur_no olmayan kayıtları NULL yap (QR ile alınan yoklamalar için)
        logger.debug('tur_no NULL yapılıyor', { user_id: req.user?.id });
        const turNoKayitlari = await client.query(
            "UPDATE yoklamalar SET tur_no = NULL WHERE tur_no IS NOT NULL AND cihaz_id IS NULL RETURNING id"
        );
        logger.info('✅ tur_no NULL yapılan kayıt sayısı', { count: turNoKayitlari.rows.length, user_id: req.user?.id });

        // count >= max_count olanları 'katildi' yap
        logger.debug('count >= max_count olanlar katildi yapılıyor', { user_id: req.user?.id });
        const katildiKayitlari = await client.query(
            `UPDATE yoklamalar SET durum = 'katildi' 
             FROM oturumlar 
             WHERE yoklamalar.oturum_id = oturumlar.id 
             AND yoklamalar.count >= oturumlar.max_count 
             AND yoklamalar.durum != 'katildi'
             RETURNING yoklamalar.id`
        );
        logger.info('✅ katildi yapılan kayıt sayısı', { count: katildiKayitlari.rows.length, user_id: req.user?.id });

        await client.query('COMMIT');
        client.release();
        logger.info('✅ Yoklama kayıtları düzeltildi', { tur_no_guncellenen: turNoKayitlari.rows.length, katildi_yapilan: katildiKayitlari.rows.length, user_id: req.user?.id });
        res.json({
            mesaj: "Yoklama kayıtları düzeltildi",
            tur_no_guncellenen: turNoKayitlari.rows.length,
            katildi_yapilan: katildiKayitlari.rows.length
        });
    } catch (err) {
        await client.query('ROLLBACK');
        client.release();
        console.error("Yoklama düzeltme hatası:", err);
        logger.error('❌ Yoklama düzeltme hatası', { error: err.message, stack: err.stack, user_id: req.user?.id });
        res.status(500).json({ mesaj: "Sunucu hatası", detay: err.message });
    }
});

// Duplicate kayıtları temizleme endpoint'i
router.post("/clean-duplicates", async (req, res) => {
    logger.debug('🔍 Duplicate yoklama kayıtlarını temizleme isteği alındı', { user_id: req.user?.id });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        logger.debug('Transaksiyon başlatıldı', { user_id: req.user?.id });

        // Aynı oturum ve öğrenci için birden fazla kayıt varsa, en son olanı tut
        logger.debug('Duplicate kayıtlar siliniyor', { user_id: req.user?.id });
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
        logger.info('✅ Duplicate kayıtlar silindi', { silinen_kayit_sayisi: duplicateKayitlar.rows.length, user_id: req.user?.id });

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
        logger.error('❌ Duplicate temizleme hatası', { error: err.message, stack: err.stack, user_id: req.user?.id });
        res.status(500).json({ mesaj: "Sunucu hatası" });
    }
});

/**
 * @swagger
 * /api/yoklama/son-tur-no/{oturumId}:
 *   get:
 *     summary: Belirtilen oturum için kullanılan en yüksek tur (count) numarasını döndürür.
 *     tags: [Yoklama]
 *     parameters:
 *       - in: path
 *         name: oturumId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Başarılı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 son_tur_no:
 *                   type: integer
 */
router.get("/son-tur-no/:oturumId", verifyToken, async (req, res) => {
    logger.debug('🔍 Son tur no isteği alındı', { oturum_id: req.params.oturumId, user_id: req.user?.id });
    const { oturumId } = req.params;
    try {
        const result = await pool.query(
            "SELECT COALESCE(MAX(tur_no), 0) as son_tur_no FROM yoklamalar WHERE oturum_id = $1",
            [oturumId]
        );
        logger.info('✅ Son tur no alındı', { oturum_id: oturumId, son_tur_no: result.rows[0].son_tur_no, user_id: req.user?.id });
        res.json({ son_tur_no: parseInt(result.rows[0].son_tur_no, 10) });
    } catch (err) {
        console.error("Son tur no alınırken hata:", err);
        logger.error('❌ Son tur no alınırken hata', { error: err.message, stack: err.stack, oturum_id: oturumId, user_id: req.user?.id });
        res.status(500).json({ mesaj: "Sunucu hatası" });
    }
});

module.exports = router;
