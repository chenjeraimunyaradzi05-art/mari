#!/usr/bin/env node
/**
 * netlify-link-neon.mjs
 * ─────────────────────
 * Syncs Neon DB secrets + runtime environment variables to a Netlify site so
 * that every Netlify build (and Netlify Functions) has the correct values.
 *
 * Usage (from repo root):
 *   NETLIFY_AUTH_TOKEN=<tok> NETLIFY_SITE_ID=<id> \
 *   NEON_DATABASE_URL=<pooled-url> NEON_DIRECT_DATABASE_URL=<direct-url> \
 *   node scripts/netlify-link-neon.mjs
 *
 * Required env vars:
 *   NETLIFY_AUTH_TOKEN          – personal access token (never commit this)
 *   NETLIFY_SITE_ID             – site API ID from Netlify dashboard
 *   NEON_DATABASE_URL           – pooled Neon connection string (for Prisma)
 *   NEON_DIRECT_DATABASE_URL    – direct Neon connection string (for migrations)
 *
 * Optional env vars (will be skipped if not provided):
 *   NEXT_PUBLIC_API_URL
 *   NEXT_PUBLIC_APP_URL
 *   NEXT_PUBLIC_SOCKET_URL
 *   NEXT_PUBLIC_GOOGLE_CLIENT_ID
 *   NEXT_PUBLIC_FACEBOOK_APP_ID
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
 *   NEXT_PUBLIC_POSTHOG_KEY
 *   NEXT_PUBLIC_POSTHOG_HOST
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ─── Configuration ─────────────────────────────────────────────────────────────

const NETLIFY_TOKEN  = process.env.NETLIFY_AUTH_TOKEN;
const NETLIFY_SITE   = process.env.NETLIFY_SITE_ID;
const NEON_POOL_URL  = process.env.NEON_DATABASE_URL;
const NEON_DIRECT    = process.env.NEON_DIRECT_DATABASE_URL;

// Validate required vars
const missing = [];
if (!NETLIFY_TOKEN)  missing.push('NETLIFY_AUTH_TOKEN');
if (!NETLIFY_SITE)   missing.push('NETLIFY_SITE_ID');
if (!NEON_POOL_URL)  missing.push('NEON_DATABASE_URL');
if (!NEON_DIRECT)    missing.push('NEON_DIRECT_DATABASE_URL');

if (missing.length > 0) {
  console.error('❌  Missing required environment variables:', missing.join(', '));
  console.error('    Set them before running this script. See header comment for details.');
  process.exit(1);
}

// ─── Variable definitions ──────────────────────────────────────────────────────

/**
 * Each entry: { key, value, scopes }
 *   scopes: array of Netlify build/function/deploy scopes
 *   - 'builds'           → available during `netlify-cli build`
 *   - 'functions'        → available to Netlify Functions at runtime
 *   - 'runtime'          → available to Next.js SSR (via @netlify/plugin-nextjs)
 *   - 'post_processing'  → available during post-processing
 */
const variables = [
  // ── Neon database (server-side only — never exposed to the browser) ──────
  {
    key: 'DATABASE_URL',
    value: NEON_POOL_URL,
    scopes: ['builds', 'functions', 'runtime'],
  },
  {
    key: 'DIRECT_DATABASE_URL',
    value: NEON_DIRECT,
    scopes: ['builds', 'functions', 'runtime'],
  },

  // ── Public frontend runtime ──────────────────────────────────────────────
  ...(process.env.NEXT_PUBLIC_API_URL ? [{
    key: 'NEXT_PUBLIC_API_URL',
    value: process.env.NEXT_PUBLIC_API_URL,
    scopes: ['builds', 'functions', 'runtime'],
  }] : []),
  ...(process.env.NEXT_PUBLIC_APP_URL ? [{
    key: 'NEXT_PUBLIC_APP_URL',
    value: process.env.NEXT_PUBLIC_APP_URL,
    scopes: ['builds', 'functions', 'runtime'],
  }] : []),
  ...(process.env.NEXT_PUBLIC_SOCKET_URL ? [{
    key: 'NEXT_PUBLIC_SOCKET_URL',
    value: process.env.NEXT_PUBLIC_SOCKET_URL,
    scopes: ['builds', 'functions', 'runtime'],
  }] : []),
  ...(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? [{
    key: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
    value: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    scopes: ['builds', 'functions', 'runtime'],
  }] : []),
  ...(process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ? [{
    key: 'NEXT_PUBLIC_FACEBOOK_APP_ID',
    value: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID,
    scopes: ['builds', 'functions', 'runtime'],
  }] : []),
  ...(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? [{
    key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    value: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    scopes: ['builds', 'functions', 'runtime'],
  }] : []),
  ...(process.env.NEXT_PUBLIC_POSTHOG_KEY ? [{
    key: 'NEXT_PUBLIC_POSTHOG_KEY',
    value: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    scopes: ['builds', 'functions', 'runtime'],
  }] : []),
  ...(process.env.NEXT_PUBLIC_POSTHOG_HOST ? [{
    key: 'NEXT_PUBLIC_POSTHOG_HOST',
    value: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    scopes: ['builds', 'functions', 'runtime'],
  }] : []),
];

// ─── Netlify API helpers ───────────────────────────────────────────────────────

const BASE = 'https://api.netlify.com/api/v1';

async function netlifyRequest(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${NETLIFY_TOKEN}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) {
    throw new Error(`Netlify API ${method} ${path} → HTTP ${res.status}: ${text}`);
  }
  return json;
}

async function listExistingKeys() {
  const data = await netlifyRequest('GET', `/sites/${NETLIFY_SITE}/env`);
  // Netlify returns an array of objects: [{ key, values, ... }]
  return new Set((Array.isArray(data) ? data : []).map((v) => v.key));
}

async function setVariable(key, value, scopes) {
  const payload = {
    key,
    values: [{ value, context: 'all' }],
    scopes,
    is_secret: key.includes('SECRET') || key.includes('PRIVATE') || key === 'DATABASE_URL' || key === 'DIRECT_DATABASE_URL',
  };

  try {
    await netlifyRequest('POST', `/sites/${NETLIFY_SITE}/env`, payload);
    console.log(`  ✅  ${key} → set`);
  } catch (err) {
    // Variable might already exist — try PATCH instead
    try {
      await netlifyRequest('PATCH', `/sites/${NETLIFY_SITE}/env/${key}`, payload);
      console.log(`  🔄  ${key} → updated`);
    } catch (patchErr) {
      console.error(`  ❌  ${key} → failed:`, patchErr.message);
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔗  Linking Neon DB + env vars to Netlify site: ${NETLIFY_SITE}\n`);

  let existingKeys;
  try {
    existingKeys = await listExistingKeys();
    console.log(`    Found ${existingKeys.size} existing variable(s)\n`);
  } catch (err) {
    console.warn('    Could not list existing vars — will attempt upsert for all:', err.message, '\n');
    existingKeys = new Set();
  }

  for (const { key, value, scopes } of variables) {
    if (!value) {
      console.log(`  ⏭   ${key} → skipped (empty value)`);
      continue;
    }
    await setVariable(key, value, scopes);
  }

  console.log('\n✅  Done! Trigger a new Netlify build to apply the changes.');
  console.log('    Docs: https://docs.netlify.com/environment-variables/overview/\n');
}

main().catch((err) => {
  console.error('\n💥  Unhandled error:', err.message || err);
  process.exit(1);
});
