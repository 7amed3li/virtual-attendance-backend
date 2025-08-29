const { Pool } = require('pg');

// Veritabanı bağlantısı
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'qr_db',
  user: 'postgres',
  password: '123456'
});

async function addDersSaatColumn() {
  try {
    console.log('🔄 Dersler tablosuna ders_saat sütunu ekleniyor...');
    
    // Sütunun var olup olmadığını kontrol et
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'dersler' AND column_name = 'ders_saat'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('✅ ders_saat sütunu zaten mevcut!');
      return;
    }
    
    // Sütunu ekle
    await pool.query(`
      ALTER TABLE dersler 
      ADD COLUMN ders_saat INTEGER
    `);
    
    console.log('✅ ders_saat sütunu başarıyla eklendi!');
    console.log('📝 Kullanım örnekleri:');
    console.log('   - 540 = 09:00 (9 * 60)');
    console.log('   - 630 = 10:30 (10 * 60 + 30)');
    console.log('   - 720 = 12:00 (12 * 60)');
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await pool.end();
  }
}

addDersSaatColumn();
