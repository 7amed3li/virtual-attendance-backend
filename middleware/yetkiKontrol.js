const jwt = require("jsonwebtoken");
const pool = require("../config/veritabani");
const logger = require('../utils/logger'); // إضافة استيراد logger

/**
 * Genel yetki kontrol middleware'ı.
 * Belirtilen rollerden biri eşleşirse erişime izin verir.
 * Aksi halde 403 döner.
 */
function yetkiGerekli(roller = []) {
  return (req, res, next) => {
    logger.debug('🔍 Yetki kontrolü başlatıldı', { roller, user_id: req.user?.id, rol: req.user?.rol, url: req.originalUrl, method: req.method });

    if (!req.user || !req.user.rol) {
      console.warn("⛔ Kullanıcı girişi yok");
      logger.warn('❌ Kullanıcı girişi yok', { url: req.originalUrl, method: req.method });
      return res.status(401).json({ mesaj: "Yetkilendirme gerekli" });
    }

    if (!roller.includes(req.user.rol)) {
      console.warn(`🚫 Erişim reddedildi: rol = ${req.user.rol}, gerekli = ${roller}`);
      logger.warn('❌ Erişim reddedildi: Rol eşleşmiyor', { user_id: req.user.id, rol: req.user.rol, gerekli_roller: roller, url: req.originalUrl, method: req.method });
      return res.status(403).json({ mesaj: "Bu işlemi gerçekleştirme yetkiniz yok" });
    }

    console.log(`✅ Yetki onaylandı: ${req.user.rol}`);
    logger.info('✅ Yetki onaylandı', { user_id: req.user.id, rol: req.user.rol, url: req.originalUrl, method: req.method });
    next();
  };
}

/**
 * Ders yönetimi için özel middleware.
 * Admin veya dersin öğretmeni erişebilir. Ders ekleme için öğretmene izin verir.
 */
function dersYonetimiGerekli() {
  return async (req, res, next) => {
    logger.debug('🔍 Ders yönetimi yetki kontrolü başlatıldı', { ders_id: req.params.id || req.params.dersId || req.body.ders_id, user_id: req.user?.id, rol: req.user?.rol, url: req.originalUrl, method: req.method });
    const dersId = req.params.id || req.params.dersId || req.body.ders_id;
    const { id: userId, rol } = req.user;

    if (!userId || !rol) {
      logger.warn('❌ Yetkilendirme gerekli: Kullanıcı bilgisi eksik', { url: req.originalUrl, method: req.method });
      return res.status(401).json({ mesaj: "Yetkilendirme gerekli" });
    }

    if (rol === "admin") {
      logger.info('✅ Admin erişim izni verildi', { user_id: userId, rol, url: req.originalUrl, method: req.method });
      return next();
    }

    if (rol === "ogretmen" && dersId) {
      try {
        logger.debug('Ders öğretmeni kontrol ediliyor', { ders_id: dersId, ogretmen_id: userId, url: req.originalUrl });
        const course = await pool.query("SELECT ogretmen_id FROM dersler WHERE id = $1", [dersId]);
        if (course.rows.length > 0 && course.rows[0].ogretmen_id === userId) {
          logger.info('✅ Öğretmen yetkili: Ders erişim izni verildi', { ders_id: dersId, ogretmen_id: userId, url: req.originalUrl, method: req.method });
          return next();
        }
      } catch (err) {
        logger.error('❌ Ders öğretmeni kontrolü sırasında hata', { error: err.message, stack: err.stack, ders_id: dersId, user_id: userId, url: req.originalUrl });
        return next(err);
      }
    }

    if (req.method === "POST" && req.path.includes("/ekle") && rol === "ogretmen") {
      logger.info('✅ Öğretmen ders ekleme izni verildi', { user_id: userId, rol, url: req.originalUrl, method: req.method });
      return next();
    }

    logger.warn('❌ Erişim reddedildi: Ders yönetimi için yetki yok', { user_id: userId, rol, ders_id: dersId, url: req.originalUrl, method: req.method });
    return res.status(403).json({ mesaj: "Bu işlem için yetkiniz yok." });
  };
}
// ✅ دالة جديدة تسمح لأي مستخدم مسجل بالدخول
const tumKayitliKullanicilar = (req, res, next) => {
  logger.debug('🔍 Tüm kayıtlı kullanıcılar için yetki kontrolü', { user_id: req.user?.id, url: req.originalUrl });
  // إذا كان req.user موجودًا، فهذا يعني أن الـ token صالح والمستخدم مسجل دخوله
  if (req.user && req.user.id) {
    logger.info('✅ Yetki onaylandı: Kullanıcı giriş yapmış', { user_id: req.user.id, rol: req.user.rol, url: req.originalUrl });
    return next(); // اسمح للمستخدم بالمرور
  }
  // إذا لم يكن موجودًا، أرسل خطأ
  logger.warn('❌ Yetkilendirme gerekli: Kullanıcı giriş yapmamış', { url: req.originalUrl });
  return res.status(401).json({ mesaj: 'Bu işlem için giriş yapmalısınız.' });
};

// Hazır roller için middleware'lar
module.exports = {
  sadeceAdmin: yetkiGerekli(["admin"]),
  sadeceOgretmen: yetkiGerekli(["ogretmen"]),
  sadeceOgrenci: yetkiGerekli(["ogrenci"]),
  sadeceOgretmenVeAdmin: yetkiGerekli(["ogretmen", "admin"]),
  dersYonetimiGerekli,
  yetkiGerekli,
  tumKayitliKullanicilar 
};
