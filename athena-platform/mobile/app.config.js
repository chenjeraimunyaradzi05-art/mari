/**
 * Expo config layer over app.json.
 *
 * app.json keeps the static manifest (name, icons, permissions, deep-link
 * hosts). This file adds the values that depend on which build is being made,
 * so the `env` block of each eas.json profile actually takes effect:
 *
 *   API_URL   the API origin. Required: there is no default, and a build with
 *             it unset fails here rather than producing an app. Every server
 *             mount is under /api, so the prefix is appended here once and
 *             services/api.ts never has to guess.
 *   WEB_URL   the web app, for the "opens on the web" links. Defaults to the
 *             API origin without its "api." label, which is how the web's own
 *             runtime-config derives it.
 *
 * There used to be a default of https://api.athena.app here, and the same
 * default in eas.json and the web's runtime-config. ATHENA does not own that
 * domain — it resolves to third-party infrastructure — so any build made
 * without API_URL set shipped an app that sent its users' credentials to a
 * stranger. A missing API origin is a broken build, not a build with a guess
 * in it, so this throws and names the variable to set.
 *
 * Expo passes app.json's contents in as `config`; anything returned here wins.
 */
function apiUrlFrom(origin) {
  const trimmed = String(origin || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error(
      'API_URL is not set, so this build has no API to talk to. Set API_URL to ' +
        'the origin of the deployed ATHENA API (for example https://athena-api.onrender.com) ' +
        'in the env block of the eas.json profile you are building, or in the shell ' +
        'for a local build.'
    );
  }
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
