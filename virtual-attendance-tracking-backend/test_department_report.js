// test_department_report.js - Department report endpoint'ini test et
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testDepartmentReport() {
  console.log('🔍 Department report endpoint test ediliyor...\n');
  
  const client = await pool.connect();
  try {
    
    // 1. Mevcut bölümleri listele
    console.log('📊 Mevcut bölümler:');
    const bolumler = await client.query(`
      SELECT id, ad, fakulte_id
      FROM bolumler 
      ORDER BY id
    `);
    
    console.log(`Toplam ${bolumler.rows.length} adet bölüm:`);
    bolumler.rows.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id}, Ad: ${row.ad}, Fakulte: ${row.fakulte_id}`);
    });
    
    // 2. Her bölüm için ders sayısını kontrol et
    console.log('\n🔍 Bölüm başına ders sayıları:');
    for (const bolum of bolumler.rows) {
      const dersler = await client.query(`
        SELECT COUNT(*) as ders_sayisi
        FROM dersler 
        WHERE bolum_id = $1
      `, [bolum.id]);
      
      console.log(`Bölüm "${bolum.ad}" (ID: ${bolum.id}): ${dersler.rows[0].ders_sayisi} ders`);
    }
    
    // 3. Bilgisayar Mühendisliği bölümünü özel olarak kontrol et
    console.log('\n🎯 Bilgisayar Mühendisliği için özel kontrol:');
    const bilgisayarMuh = await client.query(`
      SELECT id, ad
      FROM bolumler 
      WHERE ad ILIKE '%bilgisayar%' OR ad ILIKE '%computer%' OR ad ILIKE '%bilgi%'
    `);
    
    if (bilgisayarMuh.rows.length > 0) {
      for (const bolum of bilgisayarMuh.rows) {
        console.log(`\nBölüm bulundu: "${bolum.ad}" (ID: ${bolum.id})`);
        
        // Bu bölümün derslerini listele
        const dersler = await client.query(`
          SELECT id, ad, ogretmen_id
          FROM dersler 
          WHERE bolum_id = $1
        `, [bolum.id]);
        
        console.log(`  Ders sayısı: ${dersler.rows.length}`);
        dersler.rows.forEach((ders, index) => {
          console.log(`  ${index + 1}. ${ders.ad} (ID: ${ders.id})`);
        });
        
        // Bu bölüm için department report query'sini test et
        console.log(`\n  Department report query testi:`);
        const testQuery = `
          SELECT 
            d.id AS ders_id,
            d.ad AS ders_adi,
            COUNT(DISTINCT dk.ogrenci_id) AS toplam_ogrenci,
            COUNT(y.id) AS toplam_yoklama,
            COALESCE(
                CAST(SUM(CASE WHEN y.durum = 'katildi' OR y.durum = 'gec_geldi' THEN 1 ELSE 0 END) AS FLOAT) * 100.0 /
                NULLIF(COUNT(y.id), 0), 0
            ) AS katilim_orani
          FROM dersler d
          LEFT JOIN oturumlar o ON o.ders_id = d.id
          LEFT JOIN yoklamalar y ON y.oturum_id = o.id
          LEFT JOIN ders_kayitlari dk ON dk.ders_id = d.id
          WHERE d.bolum_id = $1
          GROUP BY d.id, d.ad
          ORDER BY d.ad
        `;
        
        const result = await client.query(testQuery, [bolum.id]);
        console.log(`  Query sonucu: ${result.rows.length} adet ders raporu`);
        
        if (result.rows.length === 0) {
          console.log(`  ❌ Bu bölüm için hiç ders raporu bulunamadı!`);
          console.log(`  Neden: Dersler var ama oturum/yoklama kayıtları yok olabilir`);
        } else {
          result.rows.forEach((row, index) => {
            console.log(`  ${index + 1}. ${row.ders_adi}: ${row.toplam_ogrenci} öğrenci, ${row.toplam_yoklama} yoklama, %${row.katilim_orani} katılım`);
          });
        }
      }
    } else {
      console.log('❌ Bilgisayar Mühendisliği bölümü bulunamadı!');
    }
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Script'i çalıştır
if (require.main === module) {
  testDepartmentReport();
}

module.exports = { testDepartmentReport }; 