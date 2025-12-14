TurboTax Integration — Integration Gateway POC (Standalone Repo)

This repository is a standalone proof-of-concept for ATHENA's Integration Gateway to talk to Intuit/TurboTax sandbox endpoints.

Quick start
-----------
1. Create the repo on GitHub (or your provider)
2. Set repository secrets:
   - TURBOTAX_MASTER_KEY — strong random secret to encrypt tokens/PII
   - INTUIT_CLIENT_ID, INTUIT_CLIENT_SECRET (optional for sandbox)
   - GHCR_PAT or use GitHub Actions preconfigured GITHUB_TOKEN for GHCR publishing
3. Push this repo and let CI build the Docker image and publish to GHCR.

Run locally
-----------
export TURBOTAX_MASTER_KEY="replace-with-a-long-secret"
export TURBOTAX_DATA_DIR="./data"
npm install
npm run dev

Endpoints
---------
- GET /health
- GET /oauth/connect?user_id={id}
- GET /oauth/callback?code={code}&user_id={id}
- POST /projection — accepts { tax_context: {...} }
- POST /pii/store — accepts { user_id, pii: { ssn } }

CI / Publishing
----------------
The GitHub Actions workflow (\.github/workflows/ci-publish.yml) will:
- Run tests
- Build a Docker image
- Push to GitHub Container Registry (GHCR) on push to main (requires repo secrets)

Security
--------
This POC encrypts tokens and PII at rest using the TURBOTAX_MASTER_KEY (AES-256-GCM). Provide a strong secret in production and follow best-practice secret management.
