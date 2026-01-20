import { DICTIONARIES, Dictionary } from './dictionary';

const RTL_LOCALES = ['ar', 'ar-ae', 'ar-sa', 'ar-eg', 'he', 'fa', 'ur'];

function isRTL(locale: string): boolean {
  const normalized = locale.toLowerCase();
  if (RTL_LOCALES.includes(normalized)) return true;
  const base = normalized.split('-')[0];
  return RTL_LOCALES.includes(base);
}

function getDictionary(locale: string): Dictionary | null {
  const normalized = locale.toLowerCase();
  if (DICTIONARIES[normalized]) return DICTIONARIES[normalized];
  const base = normalized.split('-')[0];
  return DICTIONARIES[base] || null;
}

function shouldSkipNode(node: Node) {
  const parent = node.parentElement;
  if (!parent) return true;
  const tag = parent.tagName;
  if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE', 'PRE'].includes(tag)) {
    return true;
  }
  if (parent.closest('[data-i18n-ignore]')) return true;
  return false;
}

function translateTextNode(node: Text, dictionary: Dictionary) {
  const raw = node.nodeValue;
  if (!raw) return;
  const trimmed = raw.trim();
  if (!trimmed) return;
  const translated = dictionary[trimmed];
  if (!translated) return;
  const leading = raw.match(/^\s*/)?.[0] || '';
  const trailing = raw.match(/\s*$/)?.[0] || '';
  node.nodeValue = `${leading}${translated}${trailing}`;
}

export function setDocumentDirection(locale: string) {
  const rtl = isRTL(locale);
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  document.documentElement.lang = locale;
}

export function translateDocument(locale: string) {
  setDocumentDirection(locale);
  
  const dictionary = getDictionary(locale);
  if (!dictionary) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current: Text | null = walker.nextNode() as Text | null;
  while (current) {
    translateTextNode(current, dictionary);
    current = walker.nextNode() as Text | null;
  }
}

export function observeTranslations(locale: string) {
  setDocumentDirection(locale);
  
  const dictionary = getDictionary(locale);
  if (!dictionary) return () => undefined;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          translateTextNode(node as Text, dictionary);
          return;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
            acceptNode(textNode) {
              if (shouldSkipNode(textNode)) return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            },
          });

          let current: Text | null = walker.nextNode() as Text | null;
          while (current) {
            translateTextNode(current, dictionary);
            current = walker.nextNode() as Text | null;
          }
        }
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  return () => observer.disconnect();
}
