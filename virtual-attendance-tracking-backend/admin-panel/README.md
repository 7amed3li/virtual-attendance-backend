# QR Kod Tabanlı Yoklama Sistemi - Admin Panel

Bu proje, Tokat Gaziosmanpaşa Üniversitesi için geliştirilen QR Kod Tabanlı Yoklama Sistemi'nin yönetici panelini içermektedir.

## Teknolojiler

- React 19.1.0
- TypeScript 5.8.3
- Vite 6.3.5
- TailwindCSS 4.1.8
- React Router DOM 7.6.2
- Axios 1.9.0
- React-i18next 15.5.2

## Özellikler

- Kullanıcı kimlik doğrulama ve yetkilendirme
- Çoklu dil desteği (Türkçe)
- Responsive tasarım (mobil ve masaüstü uyumlu)
- Kullanıcı yönetimi (listeleme, ekleme, düzenleme, silme)
- Ders yönetimi (listeleme, ekleme, düzenleme, silme)
- Yoklama raporları ve istatistikler
- Ayarlar ve şifre değiştirme

## Kurulum

```bash
# Bağımlılıkları yükleyin
pnpm install

# Geliştirme sunucusunu başlatın
pnpm run dev
```

## Yapı

Proje aşağıdaki klasör yapısına sahiptir:

```
admin-panel/
├── public/
│   └── logos/
│       ├── university_logo.png
│       ├── group_logo.png
│       └── default.jpg
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── ui/
│   │   └── layout/
│   ├── contexts/
│   ├── hooks/
│   ├── pages/
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── courses/
│   │   ├── reports/
│   │   └── settings/
│   ├── router/
│   ├── services/
│   ├── translations/
│   │   └── tr.json
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── README.md
```

## API Entegrasyonu

API bağlantısı aşağıdaki adrese yapılmaktadır:
- Base URL: `https://virtual-attendance-backend.onrender.com/api`
- Swagger Docs: `https://virtual-attendance-backend.onrender.com/api-docs`

## Derleme

```bash
# Projeyi derleyin
pnpm run build

# Derlenen dosyalar dist/ klasöründe oluşturulacaktır
```

## Test

Tüm sayfalar ve bileşenler manuel olarak test edilmiştir:
- Login işlemi ve yetkilendirme
- Kullanıcı yönetimi
- Ders yönetimi
- Yoklama raporları
- Ayarlar ve şifre değiştirme
- Responsive tasarım

## Lisans

Bu proje Tokat Gaziosmanpaşa Üniversitesi için özel olarak geliştirilmiştir.
