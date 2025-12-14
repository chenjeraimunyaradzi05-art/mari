const express = require('express');
const bodyParser = require('body-parser');
const projection = require('./lib/projection');

const app = express();
app.use(bodyParser.json());

app.get('/health', (req, res) => res.json({ok: true, status: 'ok'}));

app.get('/oauth/authorize', (req, res) => {
  res.json({ok: true, authorize_url: 'https://mock.intuit.com/oauth/authorize?client_id=FAKE'});
});

app.get('/oauth/callback', (req, res) => {
  res.json({ok: true, tokens: {access_token: 'mock-token', refresh_token: 'mock-refresh'}});
});

app.post('/projection', (req, res) => {
  const taxContext = req.body.tax_context || {};
  const payload = projection.buildPayloadFromTaxContext(taxContext);
  const summary = projection.sendProjection(payload);

  res.json({ok: true, projection: summary});
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`TurboTax POC listening on ${port}`));

module.exports = app;
