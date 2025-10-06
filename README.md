# QR Yoklama Sunucu Kurulumu

Bu sunucu projesini başka bir bilgisayara taşıdığınızda, veritabanı tablolarının otomatik olarak oluşturulması ve örnek verilerin yüklenmesi için aşağıdaki adımları izleyin:

## Gereksinimler
- Node.js (18+ önerilir)
- PostgreSQL (veya .env dosyanızda tanımlı veritabanı)

## Kurulum Adımları

1. **Bağımlılıkları yükleyin:**

   ```bash
   cd sunucu
   npm install
   ```

2. **.env dosyasını oluşturun:**

   `DATABASE_URL` ve `JWT_SECRET` gibi ortam değişkenlerini içeren bir `.env` dosyası oluşturun. Örnek:

   ```env
   DATABASE_URL="postgresql://kullanici:sifre@localhost:5432/veritabaniadi"
   JWT_SECRET="gizliAnahtar"
   ```

3. **Veritabanı tablolarını oluşturun:**

   ```bash
   npm run prisma:migrate
   ```
   Bu komut, `prisma/schema.prisma` dosyasındaki modele göre veritabanı tablolarını otomatik olarak oluşturur.

4. **Örnek verileri yükleyin (isteğe bağlı):**

   ```bash
   npm run prisma:seed
   ```
   Bu komut, örnek admin, öğretmen, öğrenci ve örnek ders verilerini ekler.

5. **Sunucuyu başlatın:**

   ```bash
   # Ubuntu/Prod (9090 + /qr)
   export PORT=9090 BASE_PATH=/qr NODE_ENV=production
   npm run prisma:migrate
   npm run start:prod
   ```

Artık sunucu yeni ortamda çalışmaya hazırdır. Tablolar eksikse otomatik olarak oluşturulur, örnek verilerle başlatmak için seed komutunu kullanabilirsiniz.

### systemd ile çalıştırma (opsiyonel)
`/etc/systemd/system/qr-backend.service` örneği:

```
[Unit]
Description=QR Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/qr/sunucu
Environment=PORT=9090
Environment=BASE_PATH=/qr
Environment=JWT_SECRET=uzun-bir-random
Environment=DATABASE_URL=postgresql://appuser:appPass@localhost:5432/qrdb
ExecStart=/usr/bin/node sunucu.js
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

```
sudo systemctl daemon-reload
sudo systemctl enable qr-backend
sudo systemctl start qr-backend
```