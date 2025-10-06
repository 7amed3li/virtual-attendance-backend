// fix_duplicates_simple.js - Mevcut duplicate kayıtları temizle
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixDuplicates() {
  console.log('🔧 Duplicate yoklama kayıtları düzeltiliyor...\n');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Özellikle oturum 29, öğrenci 5 için duplicate kayıtları kontrol et
    const duplicateCheck = await client.query(`
      SELECT id, count, durum, tur_no 
      FROM yoklamalar 
      WHERE oturum_id = 29 AND ogrenci_id = 5
      ORDER BY id
    `);
    
    console.log(`Oturum 29, Öğrenci 5 için bulunan kayıtlar: ${duplicateCheck.rows.length}`);
    duplicateCheck.rows.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id}, Count: ${row.count}, Durum: ${row.durum}, Tur_no: ${row.tur_no}`);
    });
    
    if (duplicateCheck.rows.length > 1) {
      console.log('\n🧹 Duplicate kayıtları temizleniyor...');
      
      // En yüksek count'a sahip kaydı bul ve tut
      let maxCount = Math.max(...duplicateCheck.rows.map(r => r.count || 1));
      let keepRecord = duplicateCheck.rows.find(r => (r.count || 1) === maxCount);
      let deleteIds = duplicateCheck.rows.filter(r => r.id !== keepRecord.id).map(r => r.id);
      
      console.log(`Tutulan kayıt: ID ${keepRecord.id} (count: ${keepRecord.count})`);
      console.log(`Silinen kayıtlar: [${deleteIds.join(', ')}]`);
      
      // Fazla kayıtları sil
      if (deleteIds.length > 0) {
        const deleteResult = await client.query(
          'DELETE FROM yoklamalar WHERE id = ANY($1) RETURNING id',
          [deleteIds]
        );
        console.log(`✅ ${deleteResult.rows.length} adet duplicate kayıt silindi`);
      }
    } else {
      console.log('✅ Bu kombinasyon için duplicate kayıt bulunamadı');
    }
    
    // Tüm duplicate kayıtları kontrol et ve temizle
    console.log('\n🔍 Tüm duplicate kayıtları kontrol ediliyor...');
    
    const allDuplicates = await client.query(`
      SELECT oturum_id, ogrenci_id, COUNT(*) as kayit_sayisi, 
             array_agg(id ORDER BY count DESC, id DESC) as id_listesi,
             array_agg(count ORDER BY count DESC, id DESC) as count_listesi
      FROM yoklamalar 
      WHERE tur_no IS NULL
      GROUP BY oturum_id, ogrenci_id 
      HAVING COUNT(*) > 1
    `);
    
    console.log(`Toplam ${allDuplicates.rows.length} duplicate grup bulundu`);
    
    let totalDeleted = 0;
    for (const row of allDuplicates.rows) {
      const ids = row.id_listesi;
      const keepId = ids[0]; // En yüksek count'a sahip olan
      const deleteIds = ids.slice(1); // Geri kalanlar
      
      console.log(`Oturum ${row.oturum_id}, Öğrenci ${row.ogrenci_id}: Tutulan ID ${keepId}, Silinen [${deleteIds.join(', ')}]`);
      
      if (deleteIds.length > 0) {
        const deleteResult = await client.query(
          'DELETE FROM yoklamalar WHERE id = ANY($1)',
          [deleteIds]
        );
        totalDeleted += deleteResult.rowCount;
      }
    }
    
    console.log(`\n✅ Toplam ${totalDeleted} adet duplicate kayıt silindi`);
    
    await client.query('COMMIT');
    console.log('💾 Değişiklikler kaydedildi');
    
    // Son kontrol
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
  fixDuplicates();
}

module.exports = { fixDuplicates }; 