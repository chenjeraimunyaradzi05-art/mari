const querystring = require('querystring');
const fetch = global.fetch || require('node-fetch');
const tokenStore = require('./tokenStore');

const CLIENT_ID = process.env.INTUIT_CLIENT_ID || process.env.TURBOTAX_CLIENT_ID || 'FAKE_CLIENT_ID';
const CLIENT_SECRET = process.env.INTUIT_CLIENT_SECRET || process.env.TURBOTAX_CLIENT_SECRET || 'FAKE';
const REDIRECT_URI = process.env.INTUIT_REDIRECT_URI || process.env.TURBOTAX_REDIRECT_URI || 'http://localhost:3000/oauth/callback';
const AUTH_URL = process.env.INTUIT_AUTH_URL || 'https://mock.intuit.com/connect/oauth2';
const TOKEN_URL = process.env.INTUIT_TOKEN_URL || 'https://mock.intuit.com/oauth2/v1/tokens/bearer';

function buildAuthorizeUrl({ state = '' } = {}) {
  const qs = querystring.stringify({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: REDIRECT_URI,
    state,
  });
  return `${AUTH_URL}?${qs}`;
}

async function exchangeCodeForTokens(code) {
  // Exchange authorization code for tokens — real implementation would POST to TOKEN_URL
  const body = querystring.stringify({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI });
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
      Accept: 'application/json',
    },
    body,
  });

  const json = await res.json();
  return json;
}

async function handleCallback(reqQuery) {
  const code = reqQuery.code;
  const state = reqQuery.state || '';
  const userId = reqQuery.user_id || state || 'unknown';

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code);
  // Persist tokens encrypted
  await tokenStore.saveTokens(userId, tokens);
  return { userId, tokens };
}

module.exports = { buildAuthorizeUrl, exchangeCodeForTokens, handleCallback };
