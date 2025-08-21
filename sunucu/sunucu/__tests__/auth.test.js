const request = require("supertest");
const app     = require("../sunucu");
const pool    = require("../config/veritabani");

describe("POST /api/giris", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("should return 400 if required fields are missing", async () => {
    const res = await request(app)
      .post("/api/giris")
      .send({ universite_kodu: "" });
    expect(res.statusCode).toBe(400);
    expect(res.body.hatalar).toBeDefined();
  });

  it("should return 401 for invalid credentials", async () => {
    // 
    const res = await request(app)
      .post("/api/giris")
      .send({ universite_kodu: "nonexistent", sifre: "wrongpw" });
    expect(res.statusCode).toBe(401);
    expect(res.body.mesaj).toMatch(/Kullanıcı bulunamadı|Şifre yanlış/);
  });
});
