
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './locales/en.json';
import thTranslations from './locales/th.json';
import { logger } from '@/lib/logger';

// Safe localStorage access
const getStoredLanguage = () => {
  try {
    return localStorage.getItem('i18nextLng') || 'th';
  } catch (error) {
    logger.warn('Failed to access localStorage for i18n:', error);
    return 'th';
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      th: {
        translation: thTranslations
      },
      en: {
        translation: enTranslations
      }
    },
    lng: getStoredLanguage(), // default language is Thai or last selected
    fallbackLng: 'th', // fallback is Thai
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false, // Disable suspense to prevent loading issues
    },
    debug: false, // Disable debug mode in production
  });

export default i18n;
