// The `@shared` alias that used to sit beside `@` pointed at ../shared, one
// directory above the EAS project root. Nothing in the repository guarantees
// that directory reaches an EAS build container — the root declares no npm
// workspaces — so the app no longer imports through it; the constants it
// needed live in src/constants/shared.ts, with a test that keeps them in step.
// Everything this bundle resolves is now inside mobile/.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
          },
        },
      ],
    ],
  };
};
