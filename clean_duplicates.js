// clean_duplicates.js - Duplicate yoklama kayıtlarını temizle
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function cleanDuplicates() {
  console.log('🧹 Duplicate yoklama kayıtları temizleniyor...\n');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Önce mevcut duplicate kayıtları listele
    console.log('📋 Mevcut duplicate kayıtlar:');
    const duplicates = await client.query(`
      SELECT oturum_id, ogrenci_id, COUNT(*) as kayit_sayisi, 
             array_agg(id ORDER BY id) as id_listesi,
             array_agg(count ORDER BY id) as count_listesi
      FROM yoklamalar 
      WHERE tur_no IS NULL 
      GROUP BY oturum_id, ogrenci_id 
      HAVING COUNT(*) > 1
      ORDER BY oturum_id, ogrenci_id
    `);
    
    console.log(`Toplam ${duplicates.rows.length} adet duplicate grup bulundu:`);
    duplicates.rows.forEach((row, index) => {
      console.log(`${index + 1}. Oturum: ${row.oturum_id}, Öğrenci: ${row.ogrenci_id}, Kayıt Sayısı: ${row.kayit_sayisi}`);
      console.log(`   ID'ler: [${row.id_listesi.join(', ')}], Count'lar: [${row.count_listesi.join(', ')}]`);
    });
    
    // 2. Her duplicate grup için, en yüksek count'a sahip kaydı tut, diğerlerini sil
    let totalDeleted = 0;
    
    for (const row of duplicates.rows) {
      const ids = row.id_listesi;
      const counts = row.count_listesi;
      
      // En yüksek count'a sahip kaydı bul
      let maxCount = Math.max(...counts);
      let maxCountIndex = counts.indexOf(maxCount);
      let keepId = ids[maxCountIndex];
      
      // Silinecek ID'leri bul (tutulacak kayıt hariç)
      const deleteIds = ids.filter(id => id !== keepId);
      
      console.log(`\n🔄 Oturum ${row.oturum_id}, Öğrenci ${row.ogrenci_id}:`);
      console.log(`   Tutulan kayıt: ID ${keepId} (count: ${maxCount})`);
      console.log(`   Silinen kayıtlar: [${deleteIds.join(', ')}]`);
      
      // Silinecek kayıtları sil
      if (deleteIds.length > 0) {
        const deleteResult = await client.query(
          'DELETE FROM yoklamalar WHERE id = ANY($1) RETURNING id',
          [deleteIds]
        );
        totalDeleted += deleteResult.rows.length;
        
        // Tutulan kaydın count'ını güncellemek istiyorsanız:
        // await client.query(
        //   'UPDATE yoklamalar SET count = $1 WHERE id = $2',
        //   [maxCount, keepId]
        // );
      }
    }
    
    // 3. Temizlik sonrası kontrol
    console.log(`\n✅ Toplam ${totalDeleted} adet duplicate kayıt silindi`);
    
    const finalCheck = await client.query(`
      SELECT oturum_id, ogrenci_id, COUNT(*) as kayit_sayisi
      FROM yoklamalar 
      WHERE tur_no IS NULL 
      GROUP BY oturum_id, ogrenci_id 
      HAVING COUNT(*) > 1
    `);
    
    if (finalCheck.rows.length === 0) {
      console.log('🎉 Tüm duplicate kayıtlar başarıyla temizlendi!');
    } else {
      console.log(`⚠️ Hala ${finalCheck.rows.length} adet duplicate grup var`);
    }
    
    await client.query('COMMIT');
    console.log('\n💾 Değişiklikler kaydedildi');
    
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
  cleanDuplicates();
}

module.exports = { cleanDuplicates }; 