// fix_oturum_30.js - Oturum 30 duplicate kayıtlarını temizle
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixOturum30() {
  console.log('🔧 Oturum 30 duplicate kayıtları düzeltiliyor...\n');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Oturum 30, öğrenci 5 için detaylar
    console.log('🎯 Oturum 30, Öğrenci 5 için mevcut durum:');
    const currentState = await client.query(`
      SELECT id, count, durum, tur_no, zaman
      FROM yoklamalar 
      WHERE oturum_id = 30 AND ogrenci_id = 5
      ORDER BY id
    `);
    
    console.log(`Bu kombinasyon için kayıt sayısı: ${currentState.rows.length}`);
    currentState.rows.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id}, Count: ${row.count}, Durum: ${row.durum}, Tur_no: ${row.tur_no}, Zaman: ${row.zaman}`);
    });
    
    if (currentState.rows.length > 1) {
      console.log('\n🧹 İkinci kaydı siliyor ve ilkini güncelliyoruz...');
      
      // İlk kaydı tut, ikincisini sil
      const ilkKayit = currentState.rows[0];
      const ikinciKayit = currentState.rows[1];
      
      console.log(`Silinen kayıt: ID ${ikinciKayit.id}`);
      console.log(`Güncellenen kayıt: ID ${ilkKayit.id} -> count=2, tur_no=2`);
      
      // İkinci kaydı sil
      await client.query(
        'DELETE FROM yoklamalar WHERE id = $1',
        [ikinciKayit.id]
      );
      
      // İlk kaydı güncelle (count=2, tur_no=2 yap)
      await client.query(
        'UPDATE yoklamalar SET count = 2, tur_no = 2 WHERE id = $1',
        [ilkKayit.id]
      );
      
      console.log('✅ Düzeltme tamamlandı');
    } else {
      console.log('✅ Bu kombinasyon için duplicate kayıt bulunamadı');
    }
    
    await client.query('COMMIT');
    console.log('💾 Değişiklikler kaydedildi');
    
    // Son durum kontrol
    console.log('\n📋 Son durum:');
    const finalState = await client.query(`
      SELECT id, count, durum, tur_no, zaman
      FROM yoklamalar 
      WHERE oturum_id = 30 AND ogrenci_id = 5
      ORDER BY id
    `);
    
    finalState.rows.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id}, Count: ${row.count}, Durum: ${row.durum}, Tur_no: ${row.tur_no}`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Hata:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Script'i çalıştır
if (require.main === module) {
  fixOturum30();
}

module.exports = { fixOturum30 }; 