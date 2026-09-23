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
 *   EAS_PROJECT_ID
 *             the UUID of the Expo project this app belongs to, which is what
 *             expo-notifications mints a push token against. It is created by
 *             `eas init` on the account that owns the app and cannot be
 *             written here in advance; until it is set, the app registers no
 *             push token and says so in the log rather than throwing. See
 *             mobile/EAS-SETUP.md.
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

/**
 * A missing project id is not a broken build — the app runs, it simply has no
 * push notifications — so unlike API_URL this does not throw. It is validated
 * rather than passed through: an empty variable or a leftover placeholder
 * would otherwise reach getExpoPushTokenAsync and fail there, at launch, in
 * front of a member.
 */
const EAS_PROJECT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function easProjectIdFrom(config) {
  const candidate = String(process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId || '').trim();
  if (!candidate) return null;
  if (!EAS_PROJECT_ID_PATTERN.test(candidate)) {
    console.warn(
      `[app.config] EAS_PROJECT_ID is "${candidate}", which is not the UUID EAS issues, so this build is treated as having no ` +
        'Expo project: push notifications will not register. Run `eas init` in mobile/ and use the id it prints.'
    );
    return null;
  }
  return candidate;
}

module.exports = ({ config }) => {
  const apiUrl = apiUrlFrom(process.env.API_URL);
  const webUrl = webUrlFrom(apiUrl, process.env.WEB_URL);
  const easProjectId = easProjectIdFrom(config);

  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      apiUrl,
      webUrl,
      appVariant: process.env.APP_VARIANT || 'development',
      // Only present when there is a real one. Expo reads the push project
      // from extra.eas.projectId, and an `eas: { projectId: undefined }` here
      // would read as a configured project with no id.
      ...(easProjectId ? { eas: { ...(config.extra?.eas || {}), projectId: easProjectId } } : {}),
    },
  };
};
