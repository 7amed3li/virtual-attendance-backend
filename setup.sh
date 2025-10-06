#!/bin/bash

set -euo pipefail

echo "===== QR Yoklama Backend Ubuntu Kurulum Scripti ====="
echo ""

# Root kontrolü
if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Bu script root haklariyla calistirilmalidir. Lutfen 'sudo' ile calistirin."
  exit 1
fi

# Degiskenler (ihtiyaca gore override edilebilir)
APP_NAME=${APP_NAME:-"qr-backend"}
APP_DIR=${APP_DIR:-"/opt/qr/sunucu"}
PORT_ENV=${PORT:-"9090"}
BASE_PATH_ENV=${BASE_PATH:-"/qr"}

# Veritabani degiskenleri
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}
DB_NAME=${DB_NAME:-"qr"}
DB_USER=${DB_USER:-"qr-postgres-user"}
DB_PASSWORD=${DB_PASSWORD:-"pass"}

# Diger ortam degiskenleri
JWT_SECRET_ENV=${JWT_SECRET:-"uz25sdfn-bi24asdfr-ranas4fdasd2fom"}

# Opsiyonlar
SEED=${SEED:-"0"}          # SEED=1 verilirse ornek veriler yuklenir
SKIP_MIGRATE=${SKIP_MIGRATE:-"0"} # SKIP_MIGRATE=1 verilirse migrate atlanir

# DATABASE_URL oluştur
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

echo "APP_NAME     : $APP_NAME"
echo "APP_DIR      : $APP_DIR"
echo "PORT         : $PORT_ENV"
echo "BASE_PATH    : $BASE_PATH_ENV"
echo "DB_HOST      : $DB_HOST"
echo "DB_PORT      : $DB_PORT"
echo "DB_NAME      : $DB_NAME"
echo "DB_USER      : $DB_USER"
echo "DB_PASSWORD  : ${DB_PASSWORD//?/*}" 
echo "DATABASE_URL : postgresql://${DB_USER}:*****@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "SEED         : $SEED"
echo "SKIP_MIGRATE : $SKIP_MIGRATE"
echo ""

# PM2 kurulumu
echo "PM2 kurulum kontrolu yapiliyor..."
if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 kurulu degil. Kurulum yapiliyor..."
  npm install -g pm2
  echo "PM2 kuruldu."
else
  echo "PM2 zaten kurulu."
fi

# Uygulama dizini olusturma
echo "Uygulama dizini olusturuluyor: $APP_DIR"
mkdir -p "$APP_DIR"

# Proje dosyalarini kopyalama (node_modules, .git vs. hariç)
echo "Proje dosyalari kopyalaniyor..."
SRC_DIR=$(pwd)
rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude ".env" \
  --exclude "uploads" \
  "$SRC_DIR"/ "$APP_DIR"/

cd "$APP_DIR"

# Bagimliliklarin yuklenmesi
echo "Bagimliliklar yukleniyor..."
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

# .env dosyasi olusturma/gncllme
if [ ! -f .env ]; then
  echo "\.env dosyasi olusturuluyor..."
  
  # DATABASE_URL oluştur
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
  
  {
    echo "# Otomatik olusturuldu: $(date)"
    echo "DB_HOST=${DB_HOST:-localhost}"
    echo "DB_PORT=${DB_PORT:-5432}"
    echo "DB_NAME=${DB_NAME:-qr}"
    echo "DB_USER=${DB_USER:-qr-postgres-user}"
    echo "DB_PASSWORD=${DB_PASSWORD:-passs}"
    echo "DATABASE_URL=\"$DATABASE_URL\""
    echo "JWT_SECRET=\"${JWT_SECRET_ENV:-uz25sdfn-bi24asdfr-ranas4fdasd2fom}\""
    echo "PORT=$PORT_ENV"
    echo "BASE_PATH=$BASE_PATH_ENV"
    echo "NODE_ENV=production"
  } > .env
else
  echo "\.env zaten mevcut, atlanıyor."
fi

# Prisma migrate
if [ "$SKIP_MIGRATE" != "1" ]; then
  echo "Prisma migrate calistiriliyor..."
  npm run prisma:migrate
else
  echo "Prisma migrate atlandi (SKIP_MIGRATE=1)."
fi

# Opsiyonel seed
if [ "$SEED" = "1" ]; then
  echo "Prisma seed calistiriliyor..."
  npm run prisma:seed || { echo "Seed hata verdi"; exit 1; }
else
  echo "Seed atlandi (SEED=0)."
fi

# PM2 ile uygulamayi baslatma
echo "Uygulama PM2 ile baslatiliyor..."
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
pm2 start npm --name "$APP_NAME" -- run start:prod
pm2 save

# PM2 startup (systemd)
echo "PM2 startup ayarlaniyor..."
pm2 startup systemd -u root --hp /root >/dev/null || true

# Izinler
echo "Dizin izinleri ayarlaniyor..."
chmod -R 755 "$APP_DIR"

echo ""
echo "===== Kurulum Tamamlandi ====="
echo "PM2 ile '$APP_NAME' baslatildi ve reboot sonrasi otomatik acilmasi icin kaydedildi."
echo "Saglik kontrolu: http://SUNUCU_IP:${PORT_ENV}${BASE_PATH_ENV}"
echo "Swagger UI:      http://SUNUCU_IP:${PORT_ENV}${BASE_PATH_ENV}api-docs"
echo ""
echo "Onemli Notlar:"
echo "1) .env dosyasini gozden gecirin: $APP_DIR/.env"
echo "2) Veritabani baglantisi icin DB_* degiskenlerini dogru ayarlayin."
echo "3) PM2 loglarini izlemek icin: pm2 logs $APP_NAME"
echo "4) Servisi durdur/baslat: pm2 stop $APP_NAME | pm2 restart $APP_NAME"
echo ""



#sudo bash setup.sh \
# APP_NAME=qr-backend \
# APP_DIR=/opt/qr/sunucu \
# DB_HOST=localhost \
# DB_PORT=5432 \
# DB_NAME=qrdb \
# DB_USER=postgres \
# DB_PASSWORD=sifre \
# JWT_SECRET=uzun-bir-random \
# SEED=1 