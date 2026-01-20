import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from '../../public/locales/en/common.json';
import esCommon from '../../public/locales/es/common.json';
import { defaultLocale } from './locale-registry';

const resources = {
  en: { common: enCommon },
  es: { common: esCommon },
};

export function initializeI18n(initialLocale = defaultLocale) {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources,
      lng: initialLocale,
      fallbackLng: 'en',
      defaultNS: 'common',
      ns: ['common'],
      interpolation: { escapeValue: false },
    });
  }

  return i18n;
}

export function setI18nLocale(locale: string) {
  const normalized = locale.split('-')[0] || 'en';
  if (!i18n.isInitialized) {
    initializeI18n(normalized);
    return;
  }
  if (i18n.language !== normalized) {
    void i18n.changeLanguage(normalized);
  }
}
