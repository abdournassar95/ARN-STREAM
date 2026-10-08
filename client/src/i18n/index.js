import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ar from './ar.json';

const saved = localStorage.getItem('ps-lang') || 'ar';

i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, ar: { translation: ar } },
    lng: saved,
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  });

// RTL and Font handling
export function applyDir(lng) {
  if (typeof document !== 'undefined') {
    if (document.documentElement) {
      document.documentElement.lang = lng;
      document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
    }
    if (document.body) {
      document.body.style.fontFamily = lng === 'ar'
        ? "'Alexandria', 'Cairo', sans-serif"
        : "'Inter', 'Alexandria', 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    }
  }
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyDir(saved));
  } else {
    applyDir(saved);
  }
}

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('ps-lang', lng);
  applyDir(lng);
});

export default i18n;
