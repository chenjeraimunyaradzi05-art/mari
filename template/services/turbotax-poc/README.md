TurboTax Integration — Integration Gateway POC

Purpose
-------
This small microservice is a standalone proof-of-concept for ATHENA's Integration Gateway to talk to Intuit/TurboTax sandbox endpoints.

Goals
- Provide a simple `/projection` endpoint that accepts `tax_context` payloads and returns a projection summary (POC logic).
- Provide mocked OAuth endpoints for local testing: `/oauth/authorize` and `/oauth/callback`.
- Provide a health endpoint `/health`.

Quick start (local)
-------------------
# install
npm install

# run in development
npm run dev

# run tests
npm test

Docker
------
# build
docker build -t athena/turbotax-poc:latest .

# run
docker run -p 3000:3000 athena/turbotax-poc:latest

Notes
-----
This POC is minimal and intentionally contains deterministic mocked calculation logic. In a real POC we'll: connect to Intuit's sandbox OAuth flow, implement secure token storage, add webhooks for status updates and add strict PII handling.

Security & env vars
-------------------
- TURBOTAX_MASTER_KEY (required): a secret used to encrypt tokens/PII at rest. Example: `export TURBOTAX_MASTER_KEY="replace-with-strong-secret"`.
- INTUIT_CLIENT_ID, INTUIT_CLIENT_SECRET, INTUIT_REDIRECT_URI: credentials for the Intuit sandbox (optional; POC supports mocked offline mode if missing).
- TURBOTAX_DATA_DIR: directory path for storing encrypted files (default ./data)

Endpoints (POC)
--------------
- GET /health — health check
- GET /oauth/connect?user_id={id} — redirect to Intuit authorize (or mocked URL)
- GET /oauth/callback?code={code}&user_id={id} — exchange code and persist encrypted tokens
- POST /projection — run projection (accepts { tax_context: {...} })
- POST /pii/store — securely store user PII (accepts { user_id, pii: { ssn } })

Moving this POC into a dedicated repo
-------------------------------------
If you'd like to extract this service into a standalone repository, copy this folder to a new repo and add container registry settings. I can help scaffold that repo and configure a demo environment on your chosen cloud provider.
