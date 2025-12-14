# Runbook: High admin.login rate / SIEM ingestion checks

When the `HighAdminLoginRate` alert fires (increase of `admin.login` events over a short window), follow these steps to quickly triage and remediate.

1) Quick facts
   - Alert name: HighAdminLoginRate
   - PromQL: increase(app_events_total{event="admin.login"}[5m]) > 30
   - Severity: warning (adjust to critical if sustained or accompanied by failures)

2) Triage steps
   - Check the Grafana dashboard panel for the last 1h/24h to see whether this is a spike or sustained trend.
   - Determine whether the spike originates from a small set of IPs (possible credential stuffing) or many IPs (possible scheduled script activity).
   - Check for concurrent increase in `admin.login` failures (separate metric) — if failures are rising, prioritise account lock / MFA checks.

3) Immediate mitigation
   - Temporarily increase authentication rate limits or enforce stricter throttling on admin login endpoints.
   - If a small number of accounts are targeted, block offending IP(s) at the firewall and require password reset + MFA validation for the affected accounts.
   - If you have an SSO provider (Auth0), enable conditional rules to step up MFA for suspicious logins.

4) SIEM verification
   - Search your SIEM for `admin.login` events around the time window — these will contain `admin_id`, `email`, `roles`, `ip_address` and `user_agent` (if configured).
   - Look for patterns: same IP across many accounts, low entropy passwords used, or automated user-agent strings.
   - Export a list of affected admin accounts for review.

5) Post-mortem follow-up
   - Rotate any compromised credentials and require MFA re-enrollment.
   - Tune alert thresholds (95th percentile baseline) to avoid noisy alerts.
   - Create a dashboard card tracking admin login anomalies over 30/60/90 day windows.

6) Troubleshooting notes
   - If SIEM shows missing events, ensure `ANALYTICS_SIEM_ENDPOINT` is set and reachable and check the ingestion job logs for `siem.stream_failed` entries.
   - Verify that requests are authenticated correctly: if using an API key, ensure `ANALYTICS_SIEM_API_KEY` is set; if HMAC is required, set `ANALYTICS_SIEM_HMAC_SECRET`.

7) Playbook contact list
   - Ops/SE on-call, Security lead, Senior admin team

8) Links
   - Grafana dashboard: docs/observability/grafana/admin-login-rate-dashboard.json
   - Alert rule: docs/observability/prometheus/admin-login-rate-rule.yml
