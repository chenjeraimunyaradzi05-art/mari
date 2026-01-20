const fs = require('fs');
const path = require('path');
const registry = require('../i18n.registry.js');

const localesDir = path.join(__dirname, '..', 'public', 'locales');
const baseLocale = registry.defaultLocale || 'en';

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function getLocaleFile(locale) {
  return path.join(localesDir, locale, 'common.json');
}

function lint() {
  const baseFile = getLocaleFile(baseLocale);
  if (!fs.existsSync(baseFile)) {
    console.error(`Base locale file missing: ${baseFile}`);
    process.exit(1);
  }

  const baseMessages = readJson(baseFile);
  const baseKeys = Object.keys(baseMessages).sort();

  let hasErrors = false;

  registry.locales.forEach((locale) => {
    if (locale === baseLocale) return;
    const filePath = getLocaleFile(locale);

    if (!fs.existsSync(filePath)) {
      console.warn(`Locale file missing: ${filePath}`);
      hasErrors = true;
      return;
    }

    const messages = readJson(filePath);
    const keys = Object.keys(messages).sort();

    const missing = baseKeys.filter((key) => !keys.includes(key));
    const extra = keys.filter((key) => !baseKeys.includes(key));

    if (missing.length || extra.length) {
      hasErrors = true;
      console.error(`\nLocale ${locale} issues:`);
      if (missing.length) {
        console.error(`  Missing keys (${missing.length}):`);
        missing.forEach((key) => console.error(`    - ${key}`));
      }
      if (extra.length) {
        console.error(`  Extra keys (${extra.length}):`);
        extra.forEach((key) => console.error(`    + ${key}`));
      }
    }
  });

  if (hasErrors) {
    console.error('\nI18n lint failed. Fix missing/extra keys.');
    process.exit(1);
  }

  console.log('I18n lint passed.');
}

lint();
