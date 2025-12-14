const express = require('express');
const bodyParser = require('body-parser');
const projection = require('./projection');

const app = express();
app.use(bodyParser.json());

app.get('/health', (req, res) => res.json({ok: true, status: 'ok'}));

const oauth = require('./lib/oauth');
const tokenStore = require('./lib/tokenStore');

// Redirect to the Intuit/TurboTax authorize URL for user consent. Example:
// /oauth/connect?user_id=123
app.get('/oauth/connect', (req, res) => {
  const userId = req.query.user_id || 'unknown';
  const url = oauth.buildAuthorizeUrl({ state: userId });
  return res.redirect(url);
});

// OAuth callback: exchange code for tokens and save them encrypted.
app.get('/oauth/callback', async (req, res) => {
  try {
    const code = req.query.code || 'mock-code';
    const userId = req.query.user_id || req.query.state || 'unknown';
    // In POC we'll call the token exchange and save
    let tokens = null;
    try {
      tokens = await oauth.exchangeCodeForTokens(code);
    } catch (e) {
      // If the token exchange fails (e.g., running offline), store a mocked token
      tokens = { access_token: 'mock-token', refresh_token: 'mock-refresh', expires_in: 3600 };
    }

    await tokenStore.saveTokens(userId, tokens).catch(() => {});

    return res.json({ ok: true, user_id: userId, tokens: { masked: Boolean(tokens.access_token) } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post('/projection', (req, res) => {
  const taxContext = req.body.tax_context || {};
  const payload = projection.buildPayloadFromTaxContext(taxContext);
  const summary = projection.sendProjection(payload);

  res.json({ok: true, projection: summary});
});

// Store sensitive PII securely (encrypted) for a user — POC only. Accepts { user_id, pii: { ssn } }
app.post('/pii/store', async (req, res) => {
  const userId = req.body.user_id || 'unknown';
  const pii = req.body.pii || {};
  try {
    await tokenStore.savePII(userId, pii);
    // Respond with masked ssn if present
    const masked = pii.ssn ? `***-**-${String(pii.ssn).slice(-4)}` : null;
    return res.json({ ok: true, masked });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`TurboTax POC listening on ${port}`));

module.exports = app;
