import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import trTranslations from '../translations/tr.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      tr: {
        translation: trTranslations
      }
    },
    lng: 'tr',
    fallbackLng: 'tr',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n; 