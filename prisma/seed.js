require('dotenv').config({ path: '../../.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');

async function main() {
  // Şifreleri hashle
  const adminPassword = await bcrypt.hash('admin123', 10);
  const teacherPassword = await bcrypt.hash('teacher123', 10);
  const studentPassword = await bcrypt.hash('student123', 10);

  // Admin kullanıcılar
  let admin1 = await prisma.kullanicilar.findFirst({ where: { universite_kodu: 'ADM001' } });
  if (!admin1) {
    admin1 = await prisma.kullanicilar.create({ data: { universite_kodu: 'ADM001', ad: 'Admin', soyad: 'Kullanıcı', eposta: 'admin@example.com', sifre: adminPassword, rol: 'admin' } });
  }
  let admin2 = await prisma.kullanicilar.findFirst({ where: { universite_kodu: 'ADM002' } });
  if (!admin2) {
    admin2 = await prisma.kullanicilar.create({ data: { universite_kodu: 'ADM002', ad: 'Yönetici', soyad: 'Yetkili', eposta: 'admin2@example.com', sifre: adminPassword, rol: 'admin' } });
  }

  // Fakülteler
  let fakulte1 = await prisma.fakulteler.findFirst({ where: { ad: 'Mühendislik Fakültesi' } });
  if (!fakulte1) {
    fakulte1 = await prisma.fakulteler.create({ data: { ad: 'Mühendislik Fakültesi', enlem: 40.3321, boylam: 36.4840 } });
  }
  let fakulte2 = await prisma.fakulteler.findFirst({ where: { ad: 'İktisadi ve İdari Bilimler Fakültesi' } });
  if (!fakulte2) {
    fakulte2 = await prisma.fakulteler.create({ data: { ad: 'İktisadi ve İdari Bilimler Fakültesi', enlem: 40.3333, boylam: 36.4855 } });
  }

  // Bölümler
  let bolum1 = await prisma.bolumler.findFirst({ where: { ad: 'Bilgisayar Mühendisliği', fakulte_id: fakulte1.id } });
  if (!bolum1) {
    bolum1 = await prisma.bolumler.create({ data: { ad: 'Bilgisayar Mühendisliği', fakulte_id: fakulte1.id } });
  }
  let bolum2 = await prisma.bolumler.findFirst({ where: { ad: 'Elektrik-Elektronik Mühendisliği', fakulte_id: fakulte1.id } });
  if (!bolum2) {
    bolum2 = await prisma.bolumler.create({ data: { ad: 'Elektrik-Elektronik Mühendisliği', fakulte_id: fakulte1.id } });
  }
  let bolum3 = await prisma.bolumler.findFirst({ where: { ad: 'İşletme', fakulte_id: fakulte2.id } });
  if (!bolum3) {
    bolum3 = await prisma.bolumler.create({ data: { ad: 'İşletme', fakulte_id: fakulte2.id } });
  }

  // Öğretmenler
  let teacher1 = await prisma.kullanicilar.findFirst({ where: { universite_kodu: 'TCH001' } });
  if (!teacher1) {
    teacher1 = await prisma.kullanicilar.create({ data: { universite_kodu: 'TCH001', ad: 'Ali', soyad: 'Öğretmen', eposta: 'teacher@example.com', sifre: teacherPassword, rol: 'ogretmen' } });
  }
  let teacher2 = await prisma.kullanicilar.findFirst({ where: { universite_kodu: 'TCH002' } });
  if (!teacher2) {
    teacher2 = await prisma.kullanicilar.create({ data: { universite_kodu: 'TCH002', ad: 'Veli', soyad: 'Eğitmen', eposta: 'teacher2@example.com', sifre: teacherPassword, rol: 'ogretmen' } });
  }

  // Öğrenciler
  let student1 = await prisma.kullanicilar.findFirst({ where: { universite_kodu: 'STD001' } });
  if (!student1) {
    student1 = await prisma.kullanicilar.create({
      data: {
        universite_kodu: 'STD001',
        ad: 'Ayşe',
        soyad: 'Öğrenci',
        eposta: 'student@example.com',
        sifre: studentPassword,
        rol: 'ogrenci',
        bolum_id: bolum1.id,
        fakulte_id: fakulte1.id
      }
    });
  }
  let student2 = await prisma.kullanicilar.findFirst({ where: { universite_kodu: 'STD002' } });
  if (!student2) {
    student2 = await prisma.kullanicilar.create({
      data: {
        universite_kodu: 'STD002',
        ad: 'Mehmet',
        soyad: 'Öğrenci',
        eposta: 'student2@example.com',
        sifre: studentPassword,
        rol: 'ogrenci',
        bolum_id: bolum2.id,
        fakulte_id: fakulte1.id
      }
    });
  }
  let student3 = await prisma.kullanicilar.findFirst({ where: { universite_kodu: 'STD003' } });
  if (!student3) {
    student3 = await prisma.kullanicilar.create({
      data: {
        universite_kodu: 'STD003',
        ad: 'Zeynep',
        soyad: 'Öğrenci',
        eposta: 'student3@example.com',
        sifre: studentPassword,
        rol: 'ogrenci',
        bolum_id: bolum3.id,
        fakulte_id: fakulte2.id
      }
    });
  }

  // Dersler
  let ders1 = await prisma.dersler.findFirst({ where: { ad: 'Yazılım Mühendisliği', bolum_id: bolum1.id } });
  if (!ders1) {
    ders1 = await prisma.dersler.create({ data: { ad: 'Yazılım Mühendisliği', bolum_id: bolum1.id, ogretmen_id: teacher1.id, donem: '2023-2024', akademik_yil: '2023', sube: '1' } });
  }
  let ders2 = await prisma.dersler.findFirst({ where: { ad: 'Elektrik Devreleri', bolum_id: bolum2.id } });
  if (!ders2) {
    ders2 = await prisma.dersler.create({ data: { ad: 'Elektrik Devreleri', bolum_id: bolum2.id, ogretmen_id: teacher2.id, donem: '2023-2024', akademik_yil: '2023', sube: '1' } });
  }
  let ders3 = await prisma.dersler.findFirst({ where: { ad: 'İşletme Yönetimi', bolum_id: bolum3.id } });
  if (!ders3) {
    ders3 = await prisma.dersler.create({ data: { ad: 'İşletme Yönetimi', bolum_id: bolum3.id, ogretmen_id: teacher2.id, donem: '2023-2024', akademik_yil: '2023', sube: '1' } });
  }

  // Ders kayıtları
  let kayit1 = await prisma.ders_kayitlari.findFirst({ where: { ders_id: ders1.id, universite_kodu: student1.universite_kodu } });
  if (!kayit1) {
    await prisma.ders_kayitlari.create({ data: { ders_id: ders1.id, universite_kodu: student1.universite_kodu, alinma_tipi: 'normal', devamsizlik_durum: [] } });
  }
  let kayit2 = await prisma.ders_kayitlari.findFirst({ where: { ders_id: ders1.id, universite_kodu: student2.universite_kodu } });
  if (!kayit2) {
    await prisma.ders_kayitlari.create({ data: { ders_id: ders1.id, universite_kodu: student2.universite_kodu, alinma_tipi: 'normal', devamsizlik_durum: [] } });
  }
  let kayit3 = await prisma.ders_kayitlari.findFirst({ where: { ders_id: ders2.id, universite_kodu: student3.universite_kodu } });
  if (!kayit3) {
    await prisma.ders_kayitlari.create({ data: { ders_id: ders2.id, universite_kodu: student3.universite_kodu, alinma_tipi: 'normal', devamsizlik_durum: [] } });
  }

  // Oturumlar
  await prisma.oturumlar.create({ data: { ders_id: ders1.id, tarih: new Date(), saat: new Date(), konu: 'Giriş', qr_anahtari: 'qrkey123', max_count: 1 } });
  await prisma.oturumlar.create({ data: { ders_id: ders2.id, tarih: new Date(), saat: new Date(), konu: 'Tanışma', qr_anahtari: 'qrkey456', max_count: 1 } });
  await prisma.oturumlar.create({ data: { ders_id: ders3.id, tarih: new Date(), saat: new Date(), konu: 'Başlangıç', qr_anahtari: 'qrkey789', max_count: 1 } });

  console.log('Seed tamamlandı!');
  console.log('Admin1:', admin1);
  console.log('Fakulte1:', fakulte1);
  console.log('Ders1:', ders1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 