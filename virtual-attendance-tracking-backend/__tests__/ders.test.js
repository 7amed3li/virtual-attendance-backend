const request = require("supertest");
const app     = require("../sunucu");
const pool    = require("../config/veritabani");

let token;

beforeAll(async () => {
  const res = await request(app)
    .post("/api/giris")
    .send({ universite_kodu: "213908688", sifre: "123456" });

  token = `Bearer ${res.body.token}`; // ✅ نضيف Bearer هنا
});

afterAll(async () => {
  await pool.end();
});

describe("POST /api/ders/ekle", () => {
  it("should reject without token", async () => {
    const res = await request(app)
      .post("/api/ders/ekle")
      .send({ ad: "Test Ders", bolum_id: 1, ogretmen_id: 1 });

    expect(res.statusCode).toBe(403);
  });

  it("should reject invalid payload", async () => {
    const res = await request(app)
      .post("/api/ders/ekle")
      .set("Authorization", token) // ✅ نستخدم التوكن مع Bearer
      .send({ ad: "" });

    expect(res.statusCode).toBe(400);
    expect(res.body.hatalar).toBeDefined();
  });

  it("should create a ders with valid data", async () => {
    const res = await request(app)
      .post("/api/ders/ekle")
      .set("Authorization", token)
      .send({
        ad: "UnitTest Ders",
        bolum_id: 1,
        ogretmen_id: 1,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.ders).toHaveProperty("id");
  });
});
