/**
 * Runs before every suite in the unit project, ahead of any module it imports.
 *
 * The unit suite must not reach a paid, external moderation provider. It did:
 * the server loads server/.env when a suite imports src/index, and a developer
 * machine with an OpenAI key in that file sent every message, post and caption
 * those suites wrote to the live API, on every run. Nobody noticed because a
 * provider that did not answer used to let content through, so a failed call
 * looked exactly like a passing one.
 *
 * It surfaced when a provider outage started holding direct messages rather
 * than delivering them unscreened (see moderateMessage): every messaging suite
 * began answering 503, because from inside a test an unreachable provider is an
 * outage.
 *
 * Clearing the keys here makes moderation "not configured" for the whole unit
 * project, which outside production publishes and counts the gap — the path
 * these suites are written against. dotenv never overwrites a variable that
 * already exists, even an empty one, so the key in .env cannot come back. A
 * suite that tests the provider path mocks the client and, where it needs a key,
 * sets one itself.
 *
 * The integration project (jest.integration.config.cjs) has its own setup.
 */
for (const name of ['AI_OPENAI_API_KEY', 'OPENAI_API_KEY']) {
  process.env[name] = '';
}
