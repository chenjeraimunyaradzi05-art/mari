Admin Login SIEM integration
===========================

This document explains how to configure the `StreamAdminLoginEvent` job to deliver `admin.login` events to your SIEM or ingestion endpoint.

Environment variables / config

- ANALYTICS_SIEM_ENDPOINT — URL of the HTTP(S) endpoint that will receive stretched admin login events. Example: https://siem.example.com/ingest
- ANALYTICS_SIEM_API_KEY — Optional API key used for authentication. If present and looks like a JWT or long token, the job will use Authorization: Bearer <key>. Otherwise the key will be sent as X-API-Key.
- ANALYTICS_SIEM_HMAC_SECRET — Optional secret used to produce an HMAC SHA‑256 signature of the JSON payload concatenated with a timestamp. When set the job will attach X-Signature and X-Signature-Timestamp headers. The receiver can verify the HMAC to ensure authenticity.
- ANALYTICS_SIEM_TIMEOUT — Timeout for outgoing HTTP requests (seconds), default 5s.

Payload format

The job sends a JSON payload containing at least the following fields:

- audit_id
- admin_id
- email
- roles (array)
- source
- timezone
- offset_minutes
- ip_address
- user_agent
- logged_in_at (ISO8601)
- meta (array)
- environment

Testing and validation

1) Set `ANALYTICS_SIEM_ENDPOINT` to a test endpoint (e.g., httbin or your SIEM test URL).
2) (Optional) Set `ANALYTICS_SIEM_API_KEY` and/or `ANALYTICS_SIEM_HMAC_SECRET`.
3) Trigger an admin login and verify the event is received by your SIEM.
4) If HMAC is enabled, verify `X-Signature` matches `sha256=HMAC_SHA256(payload + timestamp, secret)` and `X-Signature-Timestamp` was included.

Best practices

- Use HMAC or an authorization header — both is safe and gives the SIEM a way to verify and authenticate the request.
- For high-throughput ingestion prefer a queue-based or streaming endpoint (Kafka) and handle retries + DLQ in the job.
- Ensure network security (TLS) and limit access to the ingestion endpoint with IP allowlists.
