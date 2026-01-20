/* eslint-disable no-console */
/**
 * Authenticated Load Test Script
 *
 * This script logs in as a test user and then hammers an authenticated endpoint
 * (e.g., GET /api/users/me) to simulate realistic DB + auth pressure.
 *
 * Usage:
 *   node scripts/loadtest-auth.js --email test@example.com --password secret123
 *   node scripts/loadtest-auth.js --connections 500 --duration 30
 *
 * Environment variables (optional):
 *   LOADTEST_BASE_URL   Base URL (default: http://localhost:5000)
 *   LOADTEST_EMAIL      Test user email
 *   LOADTEST_PASSWORD   Test user password
 */

const autocannon = require('autocannon');
const http = require('http');
const https = require('https');

function getArg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const value = process.argv[idx + 1];
  return value ?? fallback;
}

async function login(baseUrl, email, password) {
  const url = new URL('/api/auth/login', baseUrl);
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email, password });
    const req = lib.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Login failed: ${res.statusCode} ${data}`));
          }
          try {
            const json = JSON.parse(data);
            // Expected server shape:
            // { success: true, message: 'Login successful', data: { accessToken, refreshToken, user } }
            const token = json?.data?.accessToken || json?.accessToken || json?.token;
            const userId = json?.data?.user?.id || json?.data?.userId || json?.userId;
            if (!token || !userId) {
              return reject(new Error(`Login succeeded but no access token found in response: ${data}`));
            }
            resolve({ token, userId });
          } catch (e) {
            reject(new Error(`Failed to parse login response: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const baseUrl = getArg('baseUrl', process.env.LOADTEST_BASE_URL || 'http://localhost:5000');
  const email = getArg('email', process.env.LOADTEST_EMAIL || 'test@example.com');
  const password = getArg('password', process.env.LOADTEST_PASSWORD || 'Test123!');
  const connections = Number(getArg('connections', '100'));
  const duration = Number(getArg('duration', '30'));
  // Default to a real GET endpoint in this codebase.
  // Supports placeholder substitution: /api/users/{userId}
  const endpoint = getArg('endpoint', '/api/users/{userId}');

  console.log('=== Authenticated Load Test ===');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Connections: ${connections}`);
  console.log(`Duration: ${duration}s`);
  console.log(`Login as: ${email}`);
  console.log('');

  // Step 1: Login to get token
  console.log('Logging in...');
  let auth;
  try {
    auth = await login(baseUrl, email, password);
    console.log('Login successful. Token acquired.');
  } catch (err) {
    console.error('Login failed:', err.message);
    console.error('Make sure the test user exists and the server is running.');
    process.exit(1);
  }

  const resolvedEndpoint = endpoint.replace('{userId}', auth.userId);

  // Step 2: Run load test with auth header
  const targetUrl = new URL(resolvedEndpoint, baseUrl).href;
  console.log(`\nStarting load test against ${targetUrl}...\n`);

  const instance = autocannon(
    {
      url: targetUrl,
      connections,
      duration,
      pipelining: 1,
      timeout: 30,
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
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
