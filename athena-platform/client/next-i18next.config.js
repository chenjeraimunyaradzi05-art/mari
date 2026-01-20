const registry = require('./i18n.registry.js');

module.exports = {
  i18n: {
    defaultLocale: registry.defaultLocale,
    locales: registry.locales,
    localeDetection: false,
  },
  reloadOnPrerender: process.env.NODE_ENV === 'development',
};
