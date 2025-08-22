// sunucu/middleware/yetkiKontrol.js
const jwt = require("jsonwebtoken");
// ↓ BU SATIRI EKLEYİN
const pool = require("../config/veritabani");

/**
 * Genel yetki kontrol middleware'ı.
 * Belirtilen rollerden biri eşleşirse erişime izin verir.
 * Aksi halde 403 döner.
 */
function yetkiGerekli(roller = []) {
  return (req, res, next) => {
    if (!req.user || !req.user.rol) {
      console.warn("⛔ Kullanıcı girişi yok");
      return res.status(401).json({ mesaj: "Yetkilendirme gerekli" });
    }

    if (!roller.includes(req.user.rol)) {
      console.warn(`🚫 Erişim reddedildi: rol = ${req.user.rol}, gerekli = ${roller}`);
      return res.status(403).json({ mesaj: "Bu işlemi gerçekleştirme yetkiniz yok" });
    }

    console.log(`✅ Yetki onaylandı: ${req.user.rol}`);
    next();
  };
}

/**
 * Ders yönetimi için özel middleware.
 * Admin veya dersin öğretmeni erişebilir. Ders ekleme için öğretmene izin verir.
 */
function dersYonetimiGerekli() {
  return async (req, res, next) => {
    const dersId = req.params.id || req.params.dersId || req.body.ders_id;
    const { id: userId, rol } = req.user;

    if (!userId || !rol) {
      return res.status(401).json({ mesaj: "Yetkilendirme gerekli" });
    }

    if (rol === "admin") {
      return next();
    }

    if (rol === "ogretmen" && dersId) {
      try {
        const course = await pool.query("SELECT ogretmen_id FROM dersler WHERE id = $1", [dersId]);
        if (course.rows.length > 0 && course.rows[0].ogretmen_id === userId) {
          return next();
        }
      } catch (err) {
        return next(err);
      }
    }

    if (req.method === "POST" && req.path.includes("/ekle") && rol === "ogretmen") {
      return next();
    }

    return res.status(403).json({ mesaj: "Bu işlem için yetkiniz yok." });
  };
}



// Hazır roller için middleware'lar
module.exports = {
  sadeceAdmin: yetkiGerekli(["admin"]),
  sadeceOgretmen: yetkiGerekli(["ogretmen"]),
  sadeceOgrenci: yetkiGerekli(["ogrenci"]),
  sadeceOgretmenVeAdmin: yetkiGerekli(["ogretmen", "admin"]),
  dersYonetimiGerekli,
  yetkiGerekli
};