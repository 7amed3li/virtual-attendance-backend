// test_current_state.js - Mevcut yoklama durumunu kontrol et
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkCurrentState() {
  console.log('🔍 Mevcut yoklama durumu kontrol ediliyor...\n');
  
  const client = await pool.connect();
  try {
    
    // Oturum 29, öğrenci 5 için detaylar
    console.log('🎯 Oturum 29, Öğrenci 5 için mevcut durum:');
    const currentState = await client.query(`
      SELECT id, oturum_id, ogrenci_id, count, durum, tur_no, zaman
      FROM yoklamalar 
      WHERE oturum_id = 29 AND ogrenci_id = 5
      ORDER BY id
    `);
    
    console.log(`Bu kombinasyon için kayıt sayısı: ${currentState.rows.length}`);
    currentState.rows.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id}, Count: ${row.count}, Durum: ${row.durum}, Tur_no: ${row.tur_no}, Zaman: ${row.zaman}`);
    });
    
    // Oturum 29 için max_count kontrol et
    console.log('\n📊 Oturum 29 için max_count:');
    const oturumInfo = await client.query(`
      SELECT id, max_count, tarih, saat
      FROM oturumlar 
      WHERE id = 29
    `);
    
    if (oturumInfo.rows.length > 0) {
      const oturum = oturumInfo.rows[0];
      console.log(`Oturum 29: max_count = ${oturum.max_count}, tarih = ${oturum.tarih}, saat = ${oturum.saat}`);
    } else {
      console.log('Oturum 29 bulunamadı');
    }
    
    // Tüm duplicate kontrol
    console.log('\n🔍 Tüm duplicate kayıtlar:');
    const allDuplicates = await client.query(`
      SELECT oturum_id, ogrenci_id, COUNT(*) as kayit_sayisi, 
             array_agg(id ORDER BY id) as id_listesi,
             array_agg(count ORDER BY id) as count_listesi,
             array_agg(tur_no ORDER BY id) as tur_no_listesi
      FROM yoklamalar 
      GROUP BY oturum_id, ogrenci_id 
      HAVING COUNT(*) > 1
      ORDER BY oturum_id, ogrenci_id
    `);
    
    console.log(`Toplam duplicate grup sayısı: ${allDuplicates.rows.length}`);
    allDuplicates.rows.forEach((row, index) => {
      console.log(`${index + 1}. Oturum: ${row.oturum_id}, Öğrenci: ${row.ogrenci_id}`);
      console.log(`   ID'ler: [${row.id_listesi.join(', ')}]`);
      console.log(`   Count: [${row.count_listesi.join(', ')}]`);
      console.log(`   Tur_no: [${row.tur_no_listesi.join(', ')}]`);
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
  checkCurrentState();
}

module.exports = { checkCurrentState }; 