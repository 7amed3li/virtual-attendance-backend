const pool = require("./config/veritabani");

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("❌ Bağlantı hatası:", err);
  } else {
    console.log("✅ PostgreSQL bağlantısı başarılı:", res.rows[0]);
  }
  pool.end();
});
