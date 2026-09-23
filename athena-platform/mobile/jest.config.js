// Unit tests for the Expo app. jest-expo wires Babel, the React Native
// preset and the platform mocks; the async-storage and localization modules
// are mocked per test where a screen or utility reads them.
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.[jt]s?(x)', '<rootDir>/src/**/*.test.[jt]s?(x)'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // src/constants/__tests__/shared.test.ts reads the shared package
    // directly, to prove the copy in src/constants/shared.ts has not drifted
    // from it. Babel compiles those files here (they are TypeScript) and the
    // helpers it injects are resolved from the file's own directory, where
    // there is no node_modules — shared/ has nothing but typescript in its
    // own. This points them back at the app's copy. It only affects tests:
    // nothing outside mobile/ is reachable from a bundle any more, which is
    // the whole reason that copy exists.
    '^@babel/runtime/(.*)$': '<rootDir>/node_modules/@babel/runtime/$1',
    // jest-expo turns tsconfig's `paths` into module mappings, and one of
    // those entries points "react" at @types/react — which is right for tsc,
    // where it stops two copies of the React types being resolved, and wrong
    // here, where a test that reaches any module importing React would load a
    // package of type declarations with nothing to run. No test needed React
    // until now, so it had never come up.
    '^react$': '<rootDir>/node_modules/react',
  },
};
