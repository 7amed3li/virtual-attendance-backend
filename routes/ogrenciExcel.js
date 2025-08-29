const express = require('express');
const multer  = require('multer');
const xlsx    = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma  = new PrismaClient();
const router  = express.Router();
const upload  = multer({ dest: 'uploads/' });

router.post('/ogrenci/import-excel', upload.single('file'), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];

    // ————— Merge edilmiş hücreleri doldur —————
    (sheet['!merges'] || []).forEach(merge => {
      // örn: "A1:B2" ise startCellRef = "A1"
      const startCellRef = xlsx.utils.encode_range(merge).split(':')[0];
      for (let C = merge.s.c; C <= merge.e.c; ++C) {
        for (let R = merge.s.r; R <= merge.e.r; ++R) {
          const cellRef = xlsx.utils.encode_cell({ r: R, c: C });
          // tüm özellikleri (t, v, w, h, r, ...) kopyala
          sheet[cellRef] = sheet[startCellRef];
        }
      }
    });
    // :contentReference[oaicite:0]{index=0}

    // Hücreleri bozmadan diziye çevir
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1, blankrows: false });

    // … skipIndexes, wantedIndexes vb. eski kodunuz buraya gelecek …

    // Örneğin:
    const skipIndexes = [9,12,13,14,18,19,21,22,23,24,28,32];
    const wantedIndexes = data[0].map((_, i) => skipIndexes.includes(i) ? null : i)
                                .filter(i => i !== null);

    const filteredData = data
      .map((row, idx) => idx < 2 ? row
                                  : wantedIndexes.map(i => row[i]));

    let basarili = 0, hata = 0;
    const dersId = +req.body.ders_id;

    for (let i = 2; i < filteredData.length; i++) {
      const row = filteredData[i];
      const universiteKodu   = row[1]?.toString().trim();
      const adSoyad           = row[3]?.toString().trim()   || 'Adı Soyadı';
      const alinmaTipi        = row[6];
      const devamsizlikDurum  = row[7];

      if (!universiteKodu) { hata++; continue; }

      let ogrenci = await prisma.kullanicilar.findUnique({
        where: { universite_kodu: universiteKodu }
      });

      if (!ogrenci) {
        const [ad, ...soyadArr] = adSoyad.split(' ');
        ogrenci = await prisma.kullanicilar.create({
          data: {
            universite_kodu: universiteKodu,
            ad,
            soyad: soyadArr.join(' '),
            sifre: 'P@ssword123',
            rol: 'ogrenci'
          }
        });
      }

      try {
        await prisma.ders_kayitlari.create({
          data: {
            ders_id: dersId,
            universite_kodu: universiteKodu,
            alinma_tipi: alinmaTipi || 'zorunlu',
            devamsizlik_durum: devamsizlikDurum ? [devamsizlikDurum] : []
          }
        });
        basarili++;
      } catch {
        hata++;
      }
    }

    res.json({ success: true, basarili, hata });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
