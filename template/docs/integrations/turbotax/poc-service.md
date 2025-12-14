# TurboTax Integration — POC Service (scaffold)

This document describes how to turn the existing IntegrationGateway proof-of-concept inside the ATHENA app into a small, standalone microservice for the TurboTax integration.

Goals
- Provide a minimal Projection API for tax simulation (POST /projection) which accepts `tax_context` payloads and returns a projection summary.
- Support OAuth2 token exchange endpoints to connect user accounts (mocked during early POC).
- Provide basic audit logging and testing harness.

Suggested stack
- Node.js (Express) or a lightweight PHP/Lumen/Laravel worker — choose based on team skills. The in-repo POC uses PHP so it's easy to extract into a dedicated service later.

Essential endpoints
- POST /projection — Accepts tax_context JSON and returns a projection summary.
- GET /health — basic health check
- GET /oauth/authorize — redirect to Intuit authorization URL
- GET /oauth/callback — exchange code for tokens (store in secure token store)

Environment variables (example)
- INTUIT_CLIENT_ID
- INTUIT_CLIENT_SECRET
- INTUIT_OAUTH_REDIRECT_URI
- JWT_SIGNING_KEY (if issuing service-side tokens)

Running this as a container
1. Dockerfile: build a small container with PHP-FPM + nginx (for PHP) or node
2. Compose: include a small Redis or DB for token storage and an internal queue for webhooks

Testing
- Include unit tests for payload mapping and projection logic
- Add an e2e test that uses a mocked Intuit sandbox to exercise the OAuth flow and projection endpoint

Notes
- Start with read-only projections (low risk) before enabling e-file payments.
- Keep all security and PII guidance in mind: field-level encryption for SSNs/TINs and secure audit trails for data passed to Intuit.
