// Metro used to watch ../shared and map an `@shared` module name onto it.
// That directory is outside the EAS project root (mobile/ holds app.json and
// eas.json) and the repository root declares no npm workspaces, so there was
// nothing to guarantee the build container ever received it: the bundle
// resolved a path that exists on every developer's laptop and may not exist
// where the binary is actually built. The app no longer imports anything from
// outside its own root — see src/constants/shared.ts — so the default config
// is now the whole of it, and everything Metro resolves is in the archive EAS
// uploads.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
