#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Brings up the disposable Postgres the integration suite runs against, and
 * hands Jest the connection string.
 *
 * Why a script rather than two lines in package.json: the URL has to reach Jest
 * as `TEST_DATABASE_URL`, `docker compose up -d` returns before Postgres is
 * listening, and on Windows there is no portable way to write
 * `TEST_DATABASE_URL=... jest` in an npm script. Getting any one of those wrong
 * produces a run that skips every test and reports success, which is the exact
 * failure this whole harness exists to prevent.
 *
 * Usage:
 *   node scripts/integration-db.js up      start the container and wait for it
 *   node scripts/integration-db.js down    stop it and throw the data away
 *   node scripts/integration-db.js url     print the connection string
 *   node scripts/integration-db.js test    up, then run the integration project
 *
 * `test` leaves the container running, because the next run is usually seconds
 * away and starting Postgres costs more than the disk it holds. `down` when you
 * are finished; there is no volume, so nothing survives it.
 */

const { spawnSync } = require('child_process');
const net = require('net');
const path = require('path');

const SERVER_ROOT = path.join(__dirname, '..');
const COMPOSE_FILE = path.join(SERVER_ROOT, 'docker-compose.test.yml');

// Must match docker-compose.test.yml. The database name contains "test"
// deliberately: tests/integration/setup/database-guards.ts refuses to truncate
// a database whose name does not.
const HOST = '127.0.0.1';
const PORT = 5434;
const TEST_DATABASE_URL = `postgresql://athena_test:athena_test@${HOST}:${PORT}/athena_test`;

function compose(args, options = {}) {
  return spawnSync('docker', ['compose', '-f', COMPOSE_FILE, ...args], {
    cwd: SERVER_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
}

function fail(message) {
  console.error(`[integration-db] ${message}`);
  process.exit(1);
}

/**
 * Waits for something to answer on the port.
 *
 * A TCP probe rather than a query: this runs before Prisma has been pointed
 * anywhere, and "is the port open" is the whole question. `globalSetup` does
 * the real readiness check with a `SELECT 1` once it has a client.
 */
function waitForPort(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ host: HOST, port: PORT });
      socket.setTimeout(2_000);

      const retry = () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Nothing answered on ${HOST}:${PORT} within ${timeoutMs / 1000}s`));
          return;
        }
        setTimeout(attempt, 500);
      };

      socket.once('connect', () => {
        socket.end();
        resolve();
      });
      socket.once('timeout', retry);
      socket.once('error', retry);
    };

    attempt();
  });
}

function assertDockerIsRunning() {
  const probe = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
    stdio: 'pipe',
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  // The exit status is not enough on its own. With the CLI installed but the
  // engine down, `docker info` on Windows exits 0 and prints its complaint
  // about the named pipe where the version should be, so the probe passed and
  // the refusal the user actually saw came out of `docker compose` several
  // seconds later, wrapped in an API-version error nobody can act on. A
  // server version is one token; anything else means no engine answered.
  const version = (probe.stdout || '').trim();
  if (probe.status !== 0 || !version || /\s/.test(version)) {
    fail(
      'Docker is not reachable. Start Docker Desktop (or your engine) and try again.\n' +
        '            Without it, `npm test` still runs the full mocked suite; only the\n' +
        '            integration project needs a database, and it will report itself as skipped.'
    );
  }
}

async function up() {
  assertDockerIsRunning();

  const started = compose(['up', '-d']);
  if (started.status !== 0) fail('`docker compose up -d` failed.');

  await waitForPort();
  console.log(`[integration-db] ready at ${TEST_DATABASE_URL}`);
}

function down() {
  // `-v` as well, although the compose file uses tmpfs rather than a volume:
  // if somebody later gives it a volume for a slow-to-rebuild fixture, "down"
  // should still mean the database is gone.
  compose(['down', '-v']);
}

async function test() {
  await up();

  const jest = spawnSync(
    process.execPath,
    [path.join(SERVER_ROOT, 'node_modules', 'jest', 'bin', 'jest.js'), '-c', 'jest.integration.config.cjs', ...process.argv.slice(3)],
    {
      cwd: SERVER_ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        TEST_DATABASE_URL,
        // Having asked for the database, a run that then fails to use it is a
        // failure rather than a skip. Somebody typing this command wants the
        // tests, not a green summary of nothing.
        INTEGRATION_DB_REQUIRED: '1',
      },
    }
  );

  process.exit(jest.status === null ? 1 : jest.status);
}

async function main() {
  const command = process.argv[2] || 'up';

  switch (command) {
    case 'up':
      await up();
      console.log('\nExport it for your own jest invocation:');
      console.log(`  export TEST_DATABASE_URL='${TEST_DATABASE_URL}'   # bash`);
      console.log(`  $env:TEST_DATABASE_URL='${TEST_DATABASE_URL}'     # powershell`);
      break;
    case 'down':
      down();
      break;
    case 'url':
      console.log(TEST_DATABASE_URL);
      break;
    case 'test':
      await test();
      break;
    default:
      fail(`Unknown command "${command}". Use up, down, url or test.`);
  }
}

main().catch((error) => fail(error.message));
