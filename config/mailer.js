const nodemailer = require("nodemailer");
const logger = require('../utils/logger'); // إضافة استيراد logger

logger.debug('🔍 Nodemailer yapılandırması başlatılıyor');

// EMAIL_USER ve EMAIL_PASS çevresel değişkenlerini kontrol et
if (!process.env.EMAIL_USER) {
  logger.warn('⚠️ EMAIL_USER çevresel değişkeni tanımlı değil');
}
if (!process.env.EMAIL_PASS) {
  logger.warn('⚠️ EMAIL_PASS çevresel değişkeni tanımlı değil');
}

const transporter = nodemailer.createTransport({
  service: "gmail", // أو أي خدمة بريد إلكتروني أخرى (SendGrid، Mailgun، إلخ)
  auth: {
    user: process.env.EMAIL_USER, // عنوان البريد الإلكتروني
    pass: process.env.EMAIL_PASS, // كلمة مرور التطبيق (App Password) لـ Gmail
  },
});

logger.info('✅ Nodemailer transporter başarıyla oluşturuldu', {
  service: 'gmail',
  email_user_defined: !!process.env.EMAIL_USER,
  email_pass_defined: !!process.env.EMAIL_PASS,
});

module.exports = transporter;
