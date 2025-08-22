module.exports = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "QR Kod Yoklama Sistemi API",
      version: "1.0.0",
      description: "Üniversite QR kod yoklama sistemi için API dokümantasyonu"
    },
    servers: [
      { url: "https://yzdd.gop.edu.tr:9090", description: "Local server" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Kullanici: {
          type: "object",
          properties: {
            id: { type: "integer" },
            universite_kodu: { type: "string" },
            ad: { type: "string" },
            soyad: { type: "string" },
            eposta: { type: "string" },
            rol: { type: "string" }
          }
        },
        Ders: {
          type: "object",
          properties: {
            id: { type: "integer" },
            ad: { type: "string" },
            bolum_id: { type: "integer" },
            ogretmen_id: { type: "integer" },
            donem: { type: "string" },
            akademik_yil: { type: "string" }
          }
        },
        Oturum: {
          type: "object",
          properties: {
            id: { type: "integer" },
            ders_id: { type: "integer" },
            tarih: { type: "string", format: "date" },
            saat: { type: "string" },
            konu: { type: "string" },
            qr_anahtari: { type: "string" },
            derslik: { type: "string" },
            olusturma_tarihi: { type: "string", format: "date-time" },
            qr_yayin_suresi: { type: "integer" }
          }
        },
        Yoklama: {
          type: "object",
          properties: {
            id: { type: "integer" },
            oturum_id: { type: "integer" },
            ogrenci_id: { type: "integer" },
            zaman: { type: "string", format: "date-time" },
            durum: { type: "string" },
            konum: { type: "string" }
          }
        },
        Fakulte: {
          type: "object",
          properties: {
            id: { type: "integer" },
            ad: { type: "string" },
            enlem: { type: "number" },
            boylam: { type: "number" }
          }
        },
        Bolum: {
          type: "object",
          properties: {
            id: { type: "integer" },
            ad: { type: "string" },
            fakulte_id: { type: "integer" }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ["./routes/*.js"]
};
