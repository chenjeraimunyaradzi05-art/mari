# ATHENA Incident Response Runbook
_Version 1.0 — 2026-08-18. Applies to security, privacy, and availability incidents across all ATHENA services._

## Contacts

| Role | Who | Channel |
|---|---|---|
| Incident lead / founder | Munyaradzi Chenjerai | chenjeraimunyaradzi05@gmail.com **[FOUNDER: add phone]** |
| Security reports (external) | the published security.txt (`athena-platform/client/public/.well-known/security.txt`) | same inbox |
| Legal / privacy counsel | **[FOUNDER: appoint]** | — |
| OAIC (AU privacy regulator) | for eligible data breaches | oaic.gov.au — NDB scheme |

## Severity levels

- **SEV-1** — active breach, safety-data exposure, payment compromise, full outage. Act immediately, all else stops.
- **SEV-2** — vulnerability with plausible exploitation, partial outage, single-account compromise. Same day.
- **SEV-3** — hardening gap, non-sensitive bug, failed attack traces. Within a week.

## Response steps

1. **Triage (first 30 min).** Confirm signal (logs, Sentry, user report). Assign severity. Start a timestamped incident log (private doc) — every action and time goes in it.
2. **Contain.**
   - Compromised account: `sessionService.revokeAllUserSessions(userId)`; force password reset.
   - Platform-wide token risk: rotate `JWT_SECRET` (invalidates all sessions), redeploy.
   - Bad deploy: roll back in Netlify / redeploy previous server image.
   - Payment risk: pause checkout (feature flag), notify Stripe if keys exposed.
   - Leaked secret: rotate at the provider first, then in env/CI.
3. **Assess impact.** What data, which users, what window? Query security_audit_logs / session table / provider dashboards. Preserve evidence before fixing.
4. **Eradicate & recover.** Patch the vulnerability, add a regression test, redeploy, verify with the original reproduction.
5. **Notify.**
   - Affected users: plainly, promptly, with concrete "what you should do".
   - **Australia NDB:** if serious harm is likely and not remediated, notify OAIC and affected individuals as soon as practicable (statutory assessment ≤30 days).
   - GDPR (if EU users): supervisory authority within 72 h of awareness.
   - Post an incident notice on `/changelog` for user-visible incidents.
6. **Post-incident review (within 7 days).** Timeline, root cause, what worked/failed, actions with owners and dates. Store alongside this runbook; template: `docs/security/templates/pir-template.md`.

## Safety-critical addendum

If DV-safe or safety-report data may be exposed: treat as SEV-1 regardless of scale; notification wording must consider that the attacker may share a device with the victim — do **not** rely on email alone; seek counsel before notifications that could tip off an abuser.

## Preparedness checklist

- [ ] **[FOUNDER]** Off-platform contact list (phone numbers) stored outside this repo
- [ ] **[FOUNDER]** Verify Netlify/Neon/Stripe break-glass access + 2FA on all provider accounts
- [ ] Quarterly: tabletop one scenario from threat-model.md
- [ ] Sentry alerting wired to a monitored channel (currently unchecked in launch checklist)
