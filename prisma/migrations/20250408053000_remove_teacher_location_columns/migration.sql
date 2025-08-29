-- Remove Teacher Location Columns from oturumlar table
-- Created: 2025-04-08 05:30:00

-- =====================================================
-- ÖĞRETMEN KONUM SÜTUNLARINI KALDIR
-- =====================================================

-- Önce mevcut verileri yedekle (isteğe bağlı)
-- CREATE TABLE backup_teacher_locations AS 
-- SELECT id, ogretmen_latitude, ogretmen_longitude FROM oturumlar 
-- WHERE ogretmen_latitude IS NOT NULL OR ogretmen_longitude IS NOT NULL;

-- oturumlar tablosundan öğretmen konum sütunlarını kaldır
ALTER TABLE "oturumlar" DROP COLUMN IF EXISTS "ogretmen_latitude";
ALTER TABLE "oturumlar" DROP COLUMN IF EXISTS "ogretmen_longitude";

-- =====================================================
-- Migration tamamlandı
-- =====================================================
-- ogretmen_latitude ve ogretmen_longitude sütunları kaldırıldı
-- oturumlar tablosu temizlendi