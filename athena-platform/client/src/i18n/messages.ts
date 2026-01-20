export type SupportedLocale =
  | 'en'
  | 'en-AU'
  | 'en-US'
  | 'en-SG'
  | 'en-AE'
  | 'en-SA'
  | 'en-EG'
  | 'en-ZA'
  | 'ar'
  | 'ar-AE'
  | 'ar-SA'
  | 'ar-EG'
  | 'es'
  | 'es-US';

type MessageKey =
  | 'cookie.title'
  | 'cookie.description'
  | 'cookie.acceptAll'
  | 'cookie.rejectOptional'
  | 'cookie.manage'
  | 'cookie.ccpaNotice';

type Messages = Record<MessageKey, string>;

const EN_MESSAGES: Messages = {
  'cookie.title': 'Privacy & Cookies',
  'cookie.description':
    'We use cookies to operate the platform, improve experiences, and measure performance. You can accept all cookies or reject optional ones.',
  'cookie.acceptAll': 'Accept all',
  'cookie.rejectOptional': 'Reject optional',
  'cookie.manage': 'Manage in Settings',
  'cookie.ccpaNotice': 'California residents: You can opt out of certain data sharing at any time.',
};

const ES_MESSAGES: Messages = {
  'cookie.title': 'Privacidad y cookies',
  'cookie.description':
    'Usamos cookies para operar la plataforma, mejorar la experiencia y medir el rendimiento. Puedes aceptar todas o rechazar las opcionales.',
  'cookie.acceptAll': 'Aceptar todo',
  'cookie.rejectOptional': 'Rechazar opcionales',
  'cookie.manage': 'Gestionar en Ajustes',
  'cookie.ccpaNotice': 'Residentes de California: puedes excluirte del intercambio de datos en cualquier momento.',
};

const AR_MESSAGES: Messages = {
  'cookie.title': 'الخصوصية وملفات تعريف الارتباط',
  'cookie.description':
    'نستخدم ملفات تعريف الارتباط لتشغيل المنصة وتحسين التجربة وقياس الأداء. يمكنك قبول الكل أو رفض الاختيارية.',
  'cookie.acceptAll': 'قبول الكل',
  'cookie.rejectOptional': 'رفض الاختيارية',
  'cookie.manage': 'الإدارة من الإعدادات',
  'cookie.ccpaNotice': 'سكان كاليفورنيا: يمكنك إيقاف مشاركة بعض البيانات في أي وقت.',
};

const MESSAGES: Record<string, Messages> = {
  en: EN_MESSAGES,
  'en-AU': EN_MESSAGES,
  'en-US': EN_MESSAGES,
  'en-SG': EN_MESSAGES,
  'en-AE': EN_MESSAGES,
  'en-SA': EN_MESSAGES,
  'en-EG': EN_MESSAGES,
  'en-ZA': EN_MESSAGES,
  ar: AR_MESSAGES,
  'ar-AE': AR_MESSAGES,
  'ar-SA': AR_MESSAGES,
  'ar-EG': AR_MESSAGES,
  es: ES_MESSAGES,
  'es-US': ES_MESSAGES,
};

export function getMessages(locale: string): Messages {
  return MESSAGES[locale] || MESSAGES[locale.split('-')[0]] || EN_MESSAGES;
}
