/* eslint-disable no-console */

const autocannon = require('autocannon');

function getArg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const value = process.argv[idx + 1];
  return value ?? fallback;
}

async function main() {
  const url = getArg('url', process.env.LOADTEST_URL || 'http://localhost:4000/health');
  const connections = Number(getArg('connections', '1000'));
  const duration = Number(getArg('duration', '30'));

  console.log(`Load test target: ${url}`);
  console.log(`Connections: ${connections}`);
  console.log(`Duration: ${duration}s`);

  const instance = autocannon(
    {
      url,
      connections,
      duration,
      pipelining: 1,
      timeout: 30,
    },
    (err) => {
      if (err) {
        console.error(err);
        process.exitCode = 1;
      }
    }
  );

  autocannon.track(instance, { renderProgressBar: true });

  await new Promise((resolve) => instance.on('done', resolve));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
