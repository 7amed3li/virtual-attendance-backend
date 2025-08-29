// check_duplicates.js - Duplicate yoklama kayıtlarını kontrol et
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkDuplicates() {
  console.log('🔍 Yoklama kayıtları analiz ediliyor...\n');
  
  const client = await pool.connect();
  try {
    
    // 1. Tüm yoklama kayıtlarını incele
    console.log('📊 Genel yoklama istatistikleri:');
    const totalStats = await client.query(`
      SELECT 
        COUNT(*) as toplam_kayit,
        COUNT(CASE WHEN tur_no IS NULL THEN 1 END) as tur_no_null,
        COUNT(CASE WHEN tur_no IS NOT NULL THEN 1 END) as tur_no_dolu
      FROM yoklamalar
    `);
    
    console.log(`Toplam kayıt: ${totalStats.rows[0].toplam_kayit}`);
    console.log(`tur_no NULL olanlar: ${totalStats.rows[0].tur_no_null}`);
    console.log(`tur_no dolu olanlar: ${totalStats.rows[0].tur_no_dolu}\n`);
    
    // 2. tur_no NULL olanlar için duplicate kontrol
    console.log('🔍 tur_no NULL olanlar için duplicate kontrol:');
    const duplicatesNull = await client.query(`
      SELECT oturum_id, ogrenci_id, COUNT(*) as kayit_sayisi, 
             array_agg(id ORDER BY id) as id_listesi,
             array_agg(count ORDER BY id) as count_listesi,
             array_agg(durum ORDER BY id) as durum_listesi
      FROM yoklamalar 
      WHERE tur_no IS NULL 
      GROUP BY oturum_id, ogrenci_id 
      HAVING COUNT(*) > 1
      ORDER BY oturum_id, ogrenci_id
    `);
    
    console.log(`tur_no NULL duplicate grupları: ${duplicatesNull.rows.length}`);
    duplicatesNull.rows.forEach((row, index) => {
      console.log(`${index + 1}. Oturum: ${row.oturum_id}, Öğrenci: ${row.ogrenci_id}, Kayıt: ${row.kayit_sayisi}`);
      console.log(`   ID'ler: [${row.id_listesi.join(', ')}], Count: [${row.count_listesi.join(', ')}], Durum: [${row.durum_listesi.join(', ')}]`);
    });
    
    // 3. Tüm kayıtlar için duplicate kontrol (tur_no göz ardı edilecek)
    console.log('\n🔍 Tüm kayıtlar için duplicate kontrol:');
    const duplicatesAll = await client.query(`
      SELECT oturum_id, ogrenci_id, COUNT(*) as kayit_sayisi, 
             array_agg(id ORDER BY id) as id_listesi,
             array_agg(count ORDER BY id) as count_listesi,
             array_agg(durum ORDER BY id) as durum_listesi,
             array_agg(tur_no ORDER BY id) as tur_no_listesi
      FROM yoklamalar 
      GROUP BY oturum_id, ogrenci_id 
      HAVING COUNT(*) > 1
      ORDER BY oturum_id, ogrenci_id
    `);
    
    console.log(`Tüm duplicate grupları: ${duplicatesAll.rows.length}`);
    duplicatesAll.rows.forEach((row, index) => {
      console.log(`${index + 1}. Oturum: ${row.oturum_id}, Öğrenci: ${row.ogrenci_id}, Kayıt: ${row.kayit_sayisi}`);
      console.log(`   ID'ler: [${row.id_listesi.join(', ')}]`);
      console.log(`   Count: [${row.count_listesi.join(', ')}]`);
      console.log(`   Durum: [${row.durum_listesi.join(', ')}]`);
      console.log(`   Tur_no: [${row.tur_no_listesi.join(', ')}]`);
    });
    
    // 4. Özellikle oturum 29, öğrenci 5 için detaylar
    console.log('\n🎯 Oturum 29, Öğrenci 5 için detaylar:');
    const specificCase = await client.query(`
      SELECT id, oturum_id, ogrenci_id, count, durum, tur_no, zaman
      FROM yoklamalar 
      WHERE oturum_id = 29 AND ogrenci_id = 5
      ORDER BY id
    `);
    
    console.log(`Bu kombinasyon için kayıt sayısı: ${specificCase.rows.length}`);
    specificCase.rows.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id}, Count: ${row.count}, Durum: ${row.durum}, Tur_no: ${row.tur_no}, Zaman: ${row.zaman}`);
    });
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Script'i çalıştır
if (require.main === module) {
  checkDuplicates();
}

module.exports = { checkDuplicates }; 