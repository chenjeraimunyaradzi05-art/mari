/**
 * Expo config layer over app.json.
 *
 * app.json keeps the static manifest (name, icons, permissions, deep-link
 * hosts). This file adds the values that depend on which build is being made,
 * so the `env` block of each eas.json profile actually takes effect:
 *
 *   API_URL   the API origin, e.g. https://api.athena.app. Every server mount
 *             is under /api, so it is appended here once and services/api.ts
 *             never has to guess. Without it the app would have sent
 *             /auth/login to https://api.athena.com/auth/login: wrong host,
 *             missing prefix.
 *   WEB_URL   the web app, for the "opens on the web" links. Defaults to the
 *             API origin without its "api." label, which is how the web's own
 *             runtime-config derives it.
 *
 * Expo passes app.json's contents in as `config`; anything returned here wins.
 */
const DEFAULT_API_ORIGIN = 'https://api.athena.app';

function apiUrlFrom(origin) {
  const trimmed = String(origin || DEFAULT_API_ORIGIN).trim().replace(/\/+$/, '');
  return /\/api$/.test(trimmed) ? trimmed : `${trimmed}/api`;
}

function webUrlFrom(apiUrl, explicit) {
  if (explicit && String(explicit).trim()) return String(explicit).trim().replace(/\/+$/, '');
  return apiUrl.replace(/\/api$/, '').replace('://api.', '://').replace('://staging-api.', '://staging.');
}

module.exports = ({ config }) => {
  const apiUrl = apiUrlFrom(process.env.API_URL);
  const webUrl = webUrlFrom(apiUrl, process.env.WEB_URL);

  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      apiUrl,
      webUrl,
      appVariant: process.env.APP_VARIANT || 'development',
    },
  };
};
