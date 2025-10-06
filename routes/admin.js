const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { sadeceAdmin } = require("../middleware/yetkiKontrol");

const { PrismaClient } = require("@prisma/client"); // Prisma Client'ı import et
const prisma = new PrismaClient(); 

// أي route هنا محمي للأدمن فقط
router.get("/dashboard", verifyToken, sadeceAdmin, (req, res) => {
  res.json({ mesaj: "Hoşgeldin Admin! Bu sayfa sadece admin için." });
});

module.exports = router;