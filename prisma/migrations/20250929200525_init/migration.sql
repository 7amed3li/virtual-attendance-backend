-- CreateTable
CREATE TABLE "bildirimler" (
    "id" SERIAL NOT NULL,
    "kullanici_id" INTEGER,
    "baslik" VARCHAR(255) NOT NULL,
    "icerik" TEXT NOT NULL,
    "goruldu_mu" BOOLEAN DEFAULT false,
    "olusturma_tarihi" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "ders_id" INTEGER,
    "gonderen_id" INTEGER,

    CONSTRAINT "bildirimler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bolumler" (
    "id" SERIAL NOT NULL,
    "ad" VARCHAR(100) NOT NULL,
    "fakulte_id" INTEGER NOT NULL,

    CONSTRAINT "bolumler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ders_kayitlari" (
    "id" SERIAL NOT NULL,
    "ders_id" INTEGER NOT NULL,
    "ogrenci_id" INTEGER NOT NULL,
    "alinma_tipi" VARCHAR(20) NOT NULL,
    "devamsizlik_durum" VARCHAR[],
    "universite_kodu" VARCHAR(50),

    CONSTRAINT "ders_kayitlari_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dersler" (
    "id" SERIAL NOT NULL,
    "ad" VARCHAR(100) NOT NULL,
    "bolum_id" INTEGER NOT NULL,
    "ogretmen_id" INTEGER NOT NULL,
    "donem" VARCHAR(50),
    "akademik_yil" VARCHAR(20),
    "devamsizlik_limiti" INTEGER DEFAULT 30,
    "kod" VARCHAR(50),
    "sube" VARCHAR(20) NOT NULL DEFAULT '1',
    "sinif" VARCHAR(10),
    "ders_saat" INTEGER,
    "min_yoklama_yuzdesi" INTEGER DEFAULT 0,

    CONSTRAINT "dersler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fakulteler" (
    "id" SERIAL NOT NULL,
    "ad" VARCHAR(100) NOT NULL,
    "enlem" DOUBLE PRECISION,
    "boylam" DOUBLE PRECISION,

    CONSTRAINT "fakulteler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "reset_password_token_expires_at" TIMESTAMP(6),
    "reset_password_token" TEXT,
    "telefon" TEXT,
    "son_sifre_degisikligi" TIMESTAMP(6),
    "aktif_mi" BOOLEAN DEFAULT true,
    "guncelleme_tarihi" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "bolum_id" INTEGER,
    "fakulte_id" INTEGER,

    CONSTRAINT "kullanicilar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

    CONSTRAINT "oturumlar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "senkron_log" (
    "id" SERIAL NOT NULL,
    "kullanici_id" INTEGER NOT NULL,
    "cihaz_id" TEXT,
    "senkron_zamani" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "senkron_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yoklamalar" (
    "id" SERIAL NOT NULL,
    "oturum_id" INTEGER NOT NULL,
    "ogrenci_id" INTEGER NOT NULL,
    "zaman" TIMESTAMP(6) NOT NULL,
    "durum" VARCHAR(20),
    "mazeretli" BOOLEAN DEFAULT false,
    "konum" TEXT,
    "cihaz_id" TEXT,
    "ip_adresi" TEXT,
    "tarama_tipi" VARCHAR(20) DEFAULT 'kamera',
    "ders_id" INTEGER,
    "aciklama" TEXT,
    "tur_no" INTEGER DEFAULT 1,
    "count" INTEGER DEFAULT 1,

    CONSTRAINT "yoklamalar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ders_kayitlari_ders_id_ogrenci_id_alinma_tipi_key" ON "ders_kayitlari"("ders_id", "ogrenci_id", "alinma_tipi");

-- CreateIndex
CREATE UNIQUE INDEX "unique_kod" ON "dersler"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "kullanicilar_universite_kodu_key" ON "kullanicilar"("universite_kodu");

-- CreateIndex
CREATE INDEX "idx_oturumlar_ders" ON "oturumlar"("ders_id");

-- CreateIndex
CREATE INDEX "idx_yoklama_oturum_ogrenci" ON "yoklamalar"("oturum_id", "ogrenci_id");

-- CreateIndex
CREATE UNIQUE INDEX "yoklamalar_oturum_id_ogrenci_id_tur_no_key" ON "yoklamalar"("oturum_id", "ogrenci_id", "tur_no");

-- CreateIndex
CREATE UNIQUE INDEX "yoklamalar_oturum_id_cihaz_id_tur_no_key" ON "yoklamalar"("oturum_id", "cihaz_id", "tur_no");

-- CreateIndex
CREATE UNIQUE INDEX "unique_oturum_ogrenci" ON "yoklamalar"("oturum_id", "ogrenci_id");

-- AddForeignKey
ALTER TABLE "bildirimler" ADD CONSTRAINT "bildirimler_kullanici_id_fkey" FOREIGN KEY ("kullanici_id") REFERENCES "kullanicilar"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bildirimler" ADD CONSTRAINT "fk_bildirimler_ders" FOREIGN KEY ("ders_id") REFERENCES "dersler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bildirimler" ADD CONSTRAINT "bildirimler_gonderen_id_fkey" FOREIGN KEY ("gonderen_id") REFERENCES "kullanicilar"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bolumler" ADD CONSTRAINT "bolumler_fakulte_id_fkey" FOREIGN KEY ("fakulte_id") REFERENCES "fakulteler"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ders_kayitlari" ADD CONSTRAINT "ders_kayitlari_ders_id_fkey" FOREIGN KEY ("ders_id") REFERENCES "dersler"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ders_kayitlari" ADD CONSTRAINT "ders_kayitlari_ogrenci_id_fkey" FOREIGN KEY ("ogrenci_id") REFERENCES "kullanicilar"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dersler" ADD CONSTRAINT "dersler_bolum_id_fkey" FOREIGN KEY ("bolum_id") REFERENCES "bolumler"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dersler" ADD CONSTRAINT "dersler_ogretmen_id_fkey" FOREIGN KEY ("ogretmen_id") REFERENCES "kullanicilar"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oturumlar" ADD CONSTRAINT "oturumlar_ders_id_fkey" FOREIGN KEY ("ders_id") REFERENCES "dersler"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "senkron_log" ADD CONSTRAINT "senkron_log_kullanici_id_fkey" FOREIGN KEY ("kullanici_id") REFERENCES "kullanicilar"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "yoklamalar" ADD CONSTRAINT "yoklamalar_ogrenci_id_fkey" FOREIGN KEY ("ogrenci_id") REFERENCES "kullanicilar"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "yoklamalar" ADD CONSTRAINT "yoklamalar_oturum_id_fkey" FOREIGN KEY ("oturum_id") REFERENCES "oturumlar"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
