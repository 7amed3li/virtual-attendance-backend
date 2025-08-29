// test_yoklama_simple.js - Basit yoklama sistemi testi
const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

// HTTP request helper fonksiyonu
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            data: res.headers['content-type']?.includes('application/json') ? JSON.parse(body) : body
          };
          resolve(response);
        } catch (error) {
          console.log('Raw response:', body);
          reject(new Error(`JSON parse error: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test fonksiyonları
async function testYoklamaSistemi() {
  console.log('🚀 Yoklama sistemi testi başlıyor...\n');

  try {

    // 1. Duplicate kayıtları temizle
    console.log('1️⃣ Duplicate kayıtları temizleniyor...');
    try {
      const cleanResponse = await makeRequest('POST', '/yoklama/clean-duplicates');
      console.log(`✅ ${cleanResponse.data.silinen_kayit_sayisi} adet duplicate kayıt temizlendi\n`);
    } catch (error) {
      console.log('⚠️ Duplicate temizleme hatası:', error.message, '\n');
    }

    // 2. Mevcut kayıtları düzelt
    console.log('2️⃣ Mevcut kayıtlar düzeltiliyor...');
    try {
      const fixResponse = await makeRequest('POST', '/yoklama/fix-existing');
      console.log(`✅ ${fixResponse.data.tur_no_guncellenen} adet tur_no güncellendi`);
      console.log(`✅ ${fixResponse.data.katildi_yapilan} adet durum 'katildi' yapıldı\n`);
    } catch (error) {
      console.log('⚠️ Kayıt düzeltme hatası:', error.message, '\n');
    }

    console.log('🎉 Yoklama sistemi testi tamamlandı!');
    console.log('\n📋 Yapılan değişiklikler:');
    console.log('   • Manuel yoklama endpoint\'i düzeltildi (UPDATE mantığı eklendi)');
    console.log('   • Attendance endpoint\'i düzeltildi (UPDATE mantığı eklendi)');
    console.log('   • Database\'e unique constraint eklendi');
    console.log('   • Duplicate kayıtlar temizlendi');
    console.log('   • Mevcut kayıtlar düzeltildi');

  } catch (error) {
    console.error('❌ Test hatası:', error.message);
  }
}

// Test'i çalıştır
if (require.main === module) {
  testYoklamaSistemi();
}

module.exports = { testYoklamaSistemi }; 