// logger.js
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, errors } = format;

// تنسيق مخصص للطباعة في الطرفية
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const logger = createLogger({
  level: 'info', // سجل كل شيء من مستوى 'info' وأعلى
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // أضف الطابع الزمني بالتنسيق الذي تريده
    errors({ stack: true }), // تأكد من طباعة stack trace للأخطاء
    logFormat
  ),
  transports: [
    new transports.Console() // الطباعة في الطرفية
    // يمكنك إضافة transports أخرى هنا لحفظ السجلات في ملف
    // new transports.File({ filename: 'error.log', level: 'error' }),
    // new transports.File({ filename: 'combined.log' }),
  ],
});

module.exports = logger;
