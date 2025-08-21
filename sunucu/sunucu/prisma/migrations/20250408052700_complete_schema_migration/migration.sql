-- Complete Schema Migration - Tüm Mevcut Tabloları Yeniden Oluştur
-- Created: 2025-04-08 05:27:00

-- =====================================================
-- MEVCUT TABLOLARI YEDEKLE (İsteğe bağlı)
-- =====================================================

-- Gerekirse yedek tablolar oluştur
-- CREATE TABLE backup_kullanicilar AS SELECT * FROM kullanicilar;
-- CREATE TABLE backup_fakulteler AS SELECT * FROM fakulteler;
-- ... diğer tablolar

-- =====================================================
-- TABLOLARI YENİDEN OLUŞTUR (DROP/CREATE)
-- =====================================================

-- Drop existing tables (Foreign key sırasına dikkat et)
DROP TABLE IF EXISTS "yoklamalar" CASCADE;
DROP TABLE IF EXISTS "senkron_log" CASCADE;
DROP TABLE IF EXISTS "oturumlar" CASCADE;
DROP TABLE IF EXISTS "ders_kayitlari" CASCADE;
DROP TABLE IF EXISTS "bildirimler" CASCADE;
DROP TABLE IF EXISTS "dersler" CASCADE;
DROP TABLE IF EXISTS "bolumler" CASCADE;
DROP TABLE IF EXISTS "kullanicilar" CASCADE;
DROP TABLE IF EXISTS "fakulteler" CASCADE;

-- =====================================================
-- 1. FAKULTELER TABLOSU
-- =====================================================
CREATE TABLE "fakulteler" (
    "id" SERIAL NOT NULL,
    "ad" VARCHAR(100) NOT NULL,
    "enlem" DOUBLE PRECISION,
    "boylam" DOUBLE PRECISION,
    "aciklama" TEXT,
    "olusturma_tarihi" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "aktif_mi" BOOLEAN DEFAULT true,

    CONSTRAINT "fakulteler_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 2. BÖLÜMLER TABLOSU
-- =====================================================
CREATE TABLE "bolumler" (
    "id" SERIAL NOT NULL,
    "ad" VARCHAR(100) NOT NULL,
    "fakulte_id" INTEGER NOT NULL,
    "kod" VARCHAR(20),
    "aciklama" TEXT,
    "olusturma_tarihi" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "aktif_mi" BOOLEAN DEFAULT true,

    CONSTRAINT "bolumler_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 3. KULLANICILAR TABLOSU
-- =====================================================
CREATE TABLE "kullanicilar" (
    "id" SERIAL NOT NULL,
    "universite_kodu" VARCHAR(50) NOT NULL,
    "ad" VARCHAR(100) NOT NULL,
    "soyad" VARCHAR(100) NOT NULL,
    "eposta" VARCHAR(150),
    "sifre" TEXT NOT NULL,
    "rol" VARCHAR(20) NOT NULL,
    "hesap_durumu" VARCHAR(20) DEFAULT 'aktif',
    "giris_sayisi" INTEGER DEFAULT 0,
    "son_giris" TIMESTAMP(6),
    "olusturma_tarihi" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "reset_password_token" TEXT,
    "reset_password_token_expires_at" TIMESTAMP(6),
    "telefon" TEXT,
    "son_sifre_degisikligi" TIMESTAMP(6),
    "aktif_mi" BOOLEAN DEFAULT true,
    "bolum_id" INTEGER,
    "fakulte_id" INTEGER,
    "adres" TEXT,
    "dogum_tarihi" DATE,
    "cinsiyet" VARCHAR(10),
    "profil_resmi" TEXT,
    "notlar" TEXT,

    CONSTRAINT "kullanicilar_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 4. DERSLER TABLOSU
-- =====================================================
CREATE TABLE "dersler" (
    "id" SERIAL NOT NULL,
    "ad" VARCHAR(100) NOT NULL,
    "kod" VARCHAR(50),
    "bolum_id" INTEGER NOT NULL,
    "ogretmen_id" INTEGER NOT NULL,
    "donem" VARCHAR(50),
    "akademik_yil" VARCHAR(20),
    "devamsizlik_limiti" INTEGER DEFAULT 30,
    "sube" VARCHAR(20) NOT NULL DEFAULT '1',
    "sinif" VARCHAR(10),
    "kredi" INTEGER DEFAULT 3,
    "ects" INTEGER DEFAULT 6,
    "teori_saat" INTEGER DEFAULT 3,
    "uygulama_saat" INTEGER DEFAULT 0,
    "laboratuvar_saat" INTEGER DEFAULT 0,
    "aciklama" TEXT,
    "olusturma_tarihi" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "aktif_mi" BOOLEAN DEFAULT true,

    CONSTRAINT "dersler_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 5. DERS KAYITLARI TABLOSU
-- =====================================================
CREATE TABLE "ders_kayitlari" (
    "id" SERIAL NOT NULL,
    "ders_id" INTEGER NOT NULL,
    "ogrenci_id" INTEGER NOT NULL,
    "universite_kodu" VARCHAR(50),
    "alinma_tipi" VARCHAR(20) DEFAULT 'normal',
    "devamsizlik_durum" VARCHAR[],
    "kayit_tarihi" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "durum" VARCHAR(20) DEFAULT 'aktif',
    "not_ortalamasi" DECIMAL(4,2),
    "vize_notu" DECIMAL(4,2),
    "final_notu" DECIMAL(4,2),
    "butunleme_notu" DECIMAL(4,2),
    "harfli_not" VARCHAR(2),
    "aciklama" TEXT,

    CONSTRAINT "ders_kayitlari_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 6. OTURUMLAR TABLOSU
-- =====================================================
CREATE TABLE "oturumlar" (
    "id" SERIAL NOT NULL,
    "ders_id" INTEGER NOT NULL,
    "tarih" DATE NOT NULL,
    "saat" TIME(6) NOT NULL,
    "konu" TEXT,
    "qr_anahtari" TEXT NOT NULL,
    "qr_yayin_suresi" INTEGER DEFAULT 3,
    "derslik" VARCHAR(50),
    "olusturma_tarihi" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "ogretmen_latitude" DOUBLE PRECISION,
    "ogretmen_longitude" DOUBLE PRECISION,
    "max_count" INTEGER DEFAULT 1,
    "oturum_no" INTEGER DEFAULT 1,
    "bitiş_saati" TIME(6),
    "durum" VARCHAR(20) DEFAULT 'planlandi',
    "katilimci_sayisi" INTEGER DEFAULT 0,
    "aciklama" TEXT,
    "qr_aktif_mi" BOOLEAN DEFAULT false,

    CONSTRAINT "oturumlar_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 7. YOKLAMALAR TABLOSU
-- =====================================================
CREATE TABLE "yoklamalar" (
    "id" SERIAL NOT NULL,
    "oturum_id" INTEGER NOT NULL,
    "ogrenci_id" INTEGER NOT NULL,
    "ders_id" INTEGER,
    "zaman" TIMESTAMP(6) NOT NULL,
    "durum" VARCHAR(20) DEFAULT 'present',
    "mazeretli" BOOLEAN DEFAULT false,
    "konum" TEXT,
    "cihaz_id" TEXT,
    "ip_adresi" TEXT,
    "tarama_tipi" VARCHAR(20) DEFAULT 'kamera',
    "aciklama" TEXT,
    "tur_no" INTEGER DEFAULT 1,
    "count" INTEGER DEFAULT 1,
    "mesafe_km" DECIMAL(8,3),
    "dogrulama_durumu" VARCHAR(20) DEFAULT 'onaylandi',
    "geç_kalma_dakikasi" INTEGER DEFAULT 0,

    CONSTRAINT "yoklamalar_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 8. BİLDİRİMLER TABLOSU
-- =====================================================
CREATE TABLE "bildirimler" (
    "id" SERIAL NOT NULL,
    "kullanici_id" INTEGER,
    "ders_id" INTEGER,
    "baslik" VARCHAR(255) NOT NULL,
    "icerik" TEXT NOT NULL,
    "tip" VARCHAR(50) DEFAULT 'bilgi',
    "oncelik" VARCHAR(20) DEFAULT 'normal',
    "goruldu_mu" BOOLEAN DEFAULT false,
    "okunma_tarihi" TIMESTAMP(6),
    "olusturma_tarihi" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "gecerlilik_tarihi" TIMESTAMP(6),
    "hedef_grup" VARCHAR(50),
    "kategori" VARCHAR(50),

    CONSTRAINT "bildirimler_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 9. SENKRON LOG TABLOSU
-- =====================================================
CREATE TABLE "senkron_log" (
    "id" SERIAL NOT NULL,
    "kullanici_id" INTEGER NOT NULL,
    "cihaz_id" TEXT,
    "senkron_zamani" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "senkron_tipi" VARCHAR(50) DEFAULT 'manuel',
    "veri_boyutu" INTEGER,
    "basarili_mi" BOOLEAN DEFAULT true,
    "hata_mesaji" TEXT,
    "ip_adresi" TEXT,
    "kullanici_agent" TEXT,

    CONSTRAINT "senkron_log_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- İNDEXLER OLUŞTUR
-- =====================================================

-- Kullanıcılar indeksleri
CREATE UNIQUE INDEX "kullanicilar_universite_kodu_key" ON "kullanicilar"("universite_kodu");
CREATE INDEX "idx_kullanicilar_rol" ON "kullanicilar"("rol");
CREATE INDEX "idx_kullanicilar_bolum" ON "kullanicilar"("bolum_id");
CREATE INDEX "idx_kullanicilar_fakulte" ON "kullanicilar"("fakulte_id");

-- Dersler indeksleri
CREATE UNIQUE INDEX "unique_kod" ON "dersler"("kod");
CREATE INDEX "idx_dersler_bolum" ON "dersler"("bolum_id");
CREATE INDEX "idx_dersler_ogretmen" ON "dersler"("ogretmen_id");
CREATE INDEX "idx_dersler_akademik_yil" ON "dersler"("akademik_yil");

-- Ders kayıtları indeksleri
CREATE UNIQUE INDEX "ders_kayitlari_ders_id_ogrenci_id_alinma_tipi_key" ON "ders_kayitlari"("ders_id", "ogrenci_id", "alinma_tipi");
CREATE INDEX "idx_ders_kayitlari_ders" ON "ders_kayitlari"("ders_id");
CREATE INDEX "idx_ders_kayitlari_ogrenci" ON "ders_kayitlari"("ogrenci_id");

-- Oturumlar indeksleri
CREATE INDEX "idx_oturumlar_ders" ON "oturumlar"("ders_id");
CREATE INDEX "idx_oturumlar_tarih" ON "oturumlar"("tarih");
CREATE INDEX "idx_oturumlar_qr_anahtari" ON "oturumlar"("qr_anahtari");

-- Yoklamalar indeksleri
CREATE INDEX "idx_yoklama_oturum_ogrenci" ON "yoklamalar"("oturum_id", "ogrenci_id");
CREATE UNIQUE INDEX "yoklamalar_oturum_id_ogrenci_id_tur_no_key" ON "yoklamalar"("oturum_id", "ogrenci_id", "tur_no");
CREATE UNIQUE INDEX "yoklamalar_oturum_id_cihaz_id_tur_no_key" ON "yoklamalar"("oturum_id", "cihaz_id", "tur_no");
CREATE INDEX "idx_yoklamalar_ders" ON "yoklamalar"("ders_id");
CREATE INDEX "idx_yoklamalar_zaman" ON "yoklamalar"("zaman");

-- Bildirimler indeksleri
CREATE INDEX "idx_bildirimler_kullanici" ON "bildirimler"("kullanici_id");
CREATE INDEX "idx_bildirimler_ders" ON "bildirimler"("ders_id");
CREATE INDEX "idx_bildirimler_tip" ON "bildirimler"("tip");
CREATE INDEX "idx_bildirimler_goruldu" ON "bildirimler"("goruldu_mu");

-- Senkron log indeksleri
CREATE INDEX "idx_senkron_log_kullanici" ON "senkron_log"("kullanici_id");
CREATE INDEX "idx_senkron_log_zaman" ON "senkron_log"("senkron_zamani");

-- =====================================================
-- FOREIGN KEY CONSTRAINTS EKLE
-- =====================================================

-- Bölümler
ALTER TABLE "bolumler" ADD CONSTRAINT "bolumler_fakulte_id_fkey" 
    FOREIGN KEY ("fakulte_id") REFERENCES "fakulteler"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Kullanıcılar
ALTER TABLE "kullanicilar" ADD CONSTRAINT "kullanicilar_bolum_id_fkey" 
    FOREIGN KEY ("bolum_id") REFERENCES "bolumler"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "kullanicilar" ADD CONSTRAINT "kullanicilar_fakulte_id_fkey" 
    FOREIGN KEY ("fakulte_id") REFERENCES "fakulteler"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Dersler
ALTER TABLE "dersler" ADD CONSTRAINT "dersler_bolum_id_fkey" 
    FOREIGN KEY ("bolum_id") REFERENCES "bolumler"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "dersler" ADD CONSTRAINT "dersler_ogretmen_id_fkey" 
    FOREIGN KEY ("ogretmen_id") REFERENCES "kullanicilar"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Ders kayıtları
ALTER TABLE "ders_kayitlari" ADD CONSTRAINT "ders_kayitlari_ders_id_fkey" 
    FOREIGN KEY ("ders_id") REFERENCES "dersler"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "ders_kayitlari" ADD CONSTRAINT "ders_kayitlari_ogrenci_id_fkey" 
    FOREIGN KEY ("ogrenci_id") REFERENCES "kullanicilar"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Oturumlar
ALTER TABLE "oturumlar" ADD CONSTRAINT "oturumlar_ders_id_fkey" 
    FOREIGN KEY ("ders_id") REFERENCES "dersler"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Yoklamalar
ALTER TABLE "yoklamalar" ADD CONSTRAINT "yoklamalar_oturum_id_fkey" 
    FOREIGN KEY ("oturum_id") REFERENCES "oturumlar"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "yoklamalar" ADD CONSTRAINT "yoklamalar_ogrenci_id_fkey" 
    FOREIGN KEY ("ogrenci_id") REFERENCES "kullanicilar"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "yoklamalar" ADD CONSTRAINT "yoklamalar_ders_id_fkey" 
    FOREIGN KEY ("ders_id") REFERENCES "dersler"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Bildirimler
ALTER TABLE "bildirimler" ADD CONSTRAINT "bildirimler_kullanici_id_fkey" 
    FOREIGN KEY ("kullanici_id") REFERENCES "kullanicilar"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "bildirimler" ADD CONSTRAINT "bildirimler_ders_id_fkey" 
    FOREIGN KEY ("ders_id") REFERENCES "dersler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Senkron log
ALTER TABLE "senkron_log" ADD CONSTRAINT "senkron_log_kullanici_id_fkey" 
    FOREIGN KEY ("kullanici_id") REFERENCES "kullanicilar"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- =====================================================
-- VARSAYILAN VERİLER (İsteğe bağlı)
-- =====================================================

-- Admin kullanıcısı oluştur
INSERT INTO "kullanicilar" ("universite_kodu", "ad", "soyad", "eposta", "sifre", "rol", "aktif_mi")
VALUES ('ADMIN001', 'Sistem', 'Yöneticisi', 'admin@togu.edu.tr', '$2b$10$defaulthash', 'admin', true)
ON CONFLICT ("universite_kodu") DO NOTHING;

-- Örnek fakülte
INSERT INTO "fakulteler" ("ad", "enlem", "boylam", "aktif_mi")
VALUES ('Bilgisayar ve Tasarım Fakültesi', 40.3167, 36.5500, true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- TETİKLEYİCİLER VE FONKSİYONLAR (İsteğe bağlı)
-- =====================================================

-- Güncelleme tarihi otomatik güncellemesi için trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.guncelleme_tarihi = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Tablolara update trigger'ları ekle
CREATE TRIGGER update_kullanicilar_updated_at BEFORE UPDATE ON "kullanicilar" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fakulteler_updated_at BEFORE UPDATE ON "fakulteler" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bolumler_updated_at BEFORE UPDATE ON "bolumler" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dersler_updated_at BEFORE UPDATE ON "dersler" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- MIGRATION TAMAMLANDI
-- =====================================================

-- Migration başarıyla tamamlandı
-- Tüm tablolar yeniden oluşturuldu
-- Tüm indexler ve foreign key'ler eklendi
-- Otomatik update trigger'ları eklendi