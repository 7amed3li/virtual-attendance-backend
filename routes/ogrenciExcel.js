
const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger'); // إضافة استيراد logger

const prisma = new PrismaClient();
const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// --- دالة مساعدة لتحويل نوع التسجيل ---
const getAlinmaTipi = (value) => {
  if (!value) return 'zorunlu';
  const lowerCaseValue = String(value).toLowerCase();
  if (lowerCaseValue.includes('alttan')) return 'alttan';
  if (lowerCaseValue.includes('üsten')) return 'üsten';
  return 'zorunlu';
};

/**
 * @swagger
 * /api/ders/{dersId}/import-students:
 *   post:
 *     summary: Excel dosyasından öğrenci listesini içe aktarır ve derse kaydeder.
 *     tags: [Ders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dersId
 *         required: true
 *         schema:
 *           type: string
 *         description: Derse ait ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               excelFile:
 *                 type: string
 *                 format: binary
 *                 description: Öğrenci listesini içeren Excel dosyası
 *     responses:
 *       200:
 *         description: İçe aktarma tamamlandı.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mesaj:
 *                   type: string
 *                 total_rows_in_excel:
 *                   type: integer
 *                 successfully_registered:
 *                   type: integer
 *                 already_registered_in_course:
 *                   type: integer
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       ogrenci_no:
 *                         type: string
 *                       hata:
 *                         type: string
 *       400:
 *         description: Excel dosyası eksik veya geçersiz.
 *       500:
 *         description: Sunucu hatası.
 */
router.post('/ders/:dersId/import-students', upload.single('excelFile'), async (req, res) => {
  // 1. تسجيل بداية العملية
  console.log('====================================================');
  console.log('Excel import işlemi başladı...');
  logger.debug('🔍 Excel öğrenci içe aktarma isteği alındı', { ders_id: req.params.dersId, user_id: req.user?.id });

  try {
    const { dersId } = req.params; // dersId هو string
    console.log(`Ders ID: ${dersId} (tip: ${typeof dersId})`);
    logger.debug('Ders ID kontrol ediliyor', { ders_id: dersId, type: typeof dersId, user_id: req.user?.id });

    if (!req.file) {
      console.error('HATA: Excel dosyası bulunamadı.');
      logger.warn('❌ Excel dosyası bulunamadı', { ders_id: dersId, user_id: req.user?.id });
      return res.status(400).json({ mesaj: 'Excel dosyası bulunamadı.' });
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const dataWithHeader = xlsx.utils.sheet_to_json(sheet, { header: 1, blankrows: false });

    if (dataWithHeader.length < 2) {
      console.log('HATA: Excel dosyası boş.');
      logger.warn('❌ Excel dosyası boş', { ders_id: dersId, user_id: req.user?.id });
      return res.status(400).json({ mesaj: 'Excel dosyası boş.' });
    }

    const headerRow = dataWithHeader[0];
    const columnIndex = {
      ogrenciNo: headerRow.findIndex(h => String(h).includes('Öğrenci No')),
      adSoyad: headerRow.findIndex(h => String(h).includes('Adı Soyadı')),
      alisNot: headerRow.findIndex(h => String(h).includes('Alış/Ö.Not')),
    };

    // 2. تسجيل الأعمدة التي تم العثور عليها
    console.log('Bulunan Sütun Indexleri:', columnIndex);
    logger.debug('Bulunan sütun indeksleri', { column_index: columnIndex, ders_id: dersId, user_id: req.user?.id });

    if (columnIndex.ogrenciNo === -1) {
      console.error('HATA: "Öğrenci No" sütunu bulunamadı.');
      logger.warn('❌ "Öğrenci No" sütunu bulunamadı', { ders_id: dersId, user_id: req.user?.id });
      return res.status(400).json({ mesaj: '"Öğrenci No" sütunu bulunamadı.' });
    }

    const studentsData = dataWithHeader.slice(1);
    let successfully_registered = 0;
    let already_registered_in_course = 0;
    let errors = [];

    let rowCounter = 0;
    for (const row of studentsData) {
      rowCounter++;
      const universiteKodu = row[columnIndex.ogrenciNo]?.toString().trim();

      // 3. تسجيل الطالب الذي تتم معالجته حاليًا
      console.log(`\n[Satır ${rowCounter}] İşleniyor: Öğrenci No "${universiteKodu}"`);
      logger.debug(`🔍 Satır ${rowCounter} işleniyor`, { universite_kodu: universiteKodu, ders_id: dersId, user_id: req.user?.id });

      if (!universiteKodu) {
        console.log(`-> Atlanıyor: Öğrenci No boş.`);
        logger.warn(`⚠️ Satır ${rowCounter}: Öğrenci No boş`, { ders_id: dersId, user_id: req.user?.id });
        errors.push({ ogrenci_no: 'Bilinmeyen', hata: 'Öğrenci No boş.' });
        continue;
      }

      try {
        const alinmaTipiRaw = (columnIndex.alisNot !== -1) ? row[columnIndex.alisNot] : 'zorunlu';
        const alinmaTipi = getAlinmaTipi(alinmaTipiRaw);

        // 4. تسجيل البيانات التي سيتم استخدامها
        console.log(`-> Alınma Tipi (Ham): "${alinmaTipiRaw}", Çevrilen: "${alinmaTipi}"`);
        logger.debug(`Alınma tipi çevrildi`, { universite_kodu: universiteKodu, alinma_tipi_raw: alinmaTipiRaw, alinma_tipi: alinmaTipi, ders_id: dersId, user_id: req.user?.id });

        const existingRegistration = await prisma.ders_kayitlari.findFirst({
          where: {
            ders_id: dersId,
            universite_kodu: universiteKodu
          },
        });

        if (existingRegistration) {
          console.log('-> Durum: Zaten kayıtlı.');
          logger.warn(`⚠️ Satır ${rowCounter}: Öğrenci zaten derse kayıtlı`, { universite_kodu: universiteKodu, ders_id: dersId, user_id: req.user?.id });
          already_registered_in_course++;
          errors.push({ ogrenci_no: universiteKodu, hata: 'Öğrenci zaten derse kayıtlı.' });
          continue;
        }

        let ogrenci = await prisma.kullanicilar.findUnique({
          where: { universite_kodu: universiteKodu },
        });

        if (!ogrenci) {
          console.log('-> Durum: Yeni öğrenci oluşturuluyor...');
          logger.debug(`Satır ${rowCounter}: Yeni öğrenci oluşturuluyor`, { universite_kodu: universiteKodu, ders_id: dersId, user_id: req.user?.id });
          const adSoyad = (columnIndex.adSoyad !== -1 && row[columnIndex.adSoyad]) ? String(row[columnIndex.adSoyad]).trim() : '';
          const [ad, ...soyadArr] = adSoyad.split(' ').filter(Boolean);

          ogrenci = await prisma.kullanicilar.create({
            data: {
              universite_kodu: universiteKodu,
              ad: ad || 'Bilinmeyen',
              soyad: soyadArr.join(' ') || 'Öğrenci',
              sifre: 'P@ssword123',
              rol: 'ogrenci',
            },
          });
          logger.info(`✅ Satır ${rowCounter}: Yeni öğrenci oluşturuldu`, { universite_kodu: universiteKodu, kullanici_id: ogrenci.id, ders_id: dersId, user_id: req.user?.id });
        } else {
          console.log('-> Durum: Öğrenci sistemde mevcut.');
          logger.debug(`Satır ${rowCounter}: Öğrenci sistemde mevcut`, { universite_kodu: universiteKodu, kullanici_id: ogrenci.id, ders_id: dersId, user_id: req.user?.id });
        }

        console.log('-> Eyleme: Ders kaydı oluşturuluyor...');
        logger.debug(`Satır ${rowCounter}: Ders kaydı oluşturuluyor`, { universite_kodu: universiteKodu, ders_id: dersId, user_id: req.user?.id });
        await prisma.ders_kayitlari.create({
          data: {
            ders_id: dersId,
            universite_kodu: universiteKodu,
            alinma_tipi: alinmaTipi,
          },
        });
        console.log('-> Başarılı: Ders kaydı oluşturuldu.');
        logger.info(`✅ Satır ${rowCounter}: Ders kaydı oluşturuldu`, { universite_kodu: universiteKodu, ders_id: dersId, alinma_tipi: alinmaTipi, user_id: req.user?.id });
        successfully_registered++;

      } catch (error) {
        // 5. تسجيل أي خطأ يحدث بالتفصيل
        console.error(`\n!!!!!! HATA OLUŞTU - Satır ${rowCounter}, Öğrenci No: ${universiteKodu} !!!!!!`);
        console.error('Hata Mesajı:', error.message);
        console.error('Hata Detayları:', error);
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
        logger.error(`❌ Satır ${rowCounter}: Öğrenci işleme hatası`, { universite_kodu: universiteKodu, ders_id: dersId, error: error.message, stack: error.stack, user_id: req.user?.id });
        errors.push({ ogrenci_no: universiteKodu, hata: error.message });
      }
    }

    // 6. تسجيل النتيجة النهائية
    console.log('====================================================');
    console.log('İşlem tamamlandı. Sonuçlar:');
    console.log(`- Başarıyla kaydedildi: ${successfully_registered}`);
    console.log(`- Zaten kayıtlıydı: ${already_registered_in_course}`);
    console.log(`- Hatalar: ${errors.length}`);
    console.log('====================================================');
    logger.info(`✅ Excel içe aktarma tamamlandı`, {
      ders_id: dersId,
      total_rows: studentsData.length,
      successfully_registered,
      already_registered_in_course,
      error_count: errors.length,
      user_id: req.user?.id
    });

    res.status(200).json({
      mesaj: 'İçe aktarma tamamlandı.',
      total_rows_in_excel: studentsData.length,
      successfully_registered,
      already_registered_in_course,
      errors,
    });

  } catch (error) {
    console.error('Genel bir sunucu hatası oluştu:', error);
    logger.error('❌ Genel sunucu hatası', { ders_id: req.params.dersId, error: error.message, stack: error.stack, user_id: req.user?.id });
    res.status(500).json({ mesaj: 'Sunucuda beklenmedik bir hata oluştu: ' + error.message, errors: [] });
  }
});

module.exports = router;
