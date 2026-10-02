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
   - Compromised account: `sessionService.revokeAllUserSessions(userId)`; force password reset. If the member can still be reached, she can lock the account herself (Settings, Security, or the "this was not me" link in the new-device sign-in email): it ends every session and refuses every way of signing in until she unlocks it from an emailed link, which `revokeAllUserSessions` alone does not do (the person holding her password signs straight back in). A member's own lock is recorded as `ACCOUNT_LOCKED` in the audit log; staff do not lift it.
   - Platform-wide token risk: rotate `JWT_SECRET` (invalidates all sessions), redeploy.
   - Bad deploy: roll back in Netlify / redeploy previous server image.
   - Payment risk: pause new payments with the `payments_paused` flag. Open the admin console, Platform settings, Payments, and press Pause payments (or `POST /api/admin/payments-pause` with `{ "enabled": true, "message": "..." }`); it takes effect within about five seconds with no deploy, and the change is written to the audit log as `PAYMENTS_PAUSE_CHANGED`. It stops every new charge, hold, capture, payout and transfer, and the scheduled sweeps that collect or pay out wait instead of failing. Refunds, handing a hold back to a buyer and the Stripe webhooks stay open on purpose, and a payment already started on a card form or a Stripe page can still be completed there. Members see the message you write (or the standard one) on the pricing and billing pages. Resume the same way. This is narrower than maintenance mode, which takes every route offline; use it first. Then notify Stripe if keys were exposed.
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

What the platform does, and what is left to people:

1. **Raise the alarm to the operators.** `node scripts/send-incident-notification.js --safety-critical --message "..."` (from `athena-platform/server`) makes the alert critical, tags it `[SAFETY-CRITICAL]`, and carries these rules. It reaches the operators only (webhook and `INCIDENT_NOTIFY_EMAILS`); it never contacts a member.
2. **Get counsel first.** Privacy counsel approves the wording in the template `safety-breach-notice.md`, kept with `pir-template.md` in the security templates folder, and says whether any email may go to these members at all. Until counsel is appointed (the contacts table above), do not send these members anything beyond the in-app notice below, and ask the founder to find counsel the same day.
3. **Tell members from the breach register,** not by hand: admin → Data breach register → *Tell the people affected* (`POST /api/admin/breaches/:id/notify-users`). Paste the member ids the investigation found. The page asks the server how the list divides before anything is sent and says how many will be told in the app only.
   - Members who use Safe Mode (a Safe Mode profile with Safe Mode or private notifications on) **or** who have filed a safety report get an in-app notice titled *Account security update* and **no email**. It goes straight to their notifications, ignoring notification preferences, and is not pushed.
   - Everyone else gets the usual email.
   - Emailing the first group as well needs three things in the request, and the server refuses without them: `emailSafetyMembers`, `counselConsulted: true` (counsel has approved the wording and the send; write down who and when) and `neutralSubject` (the subject counsel approved, which must not name the breach or anything about safety).
   - The wording for the first group goes in `safetyNotificationContent`. If it is left out they read the same words as everyone else, and the server refuses to send if those words mention Safe Mode, safety reports or violence.
4. **Check what happened.** The page and the response say how many were emailed and how many told in the app, and list by id any member no notice reached, so the send can be repeated for them alone. The breach record's notification method reads `EMAIL`, `IN_APP` or `EMAIL+IN_APP`, and the privacy log records the count by route and whether counsel's approval was given, never which members were in the first group.
5. **Do not improvise another channel.** A text, a call, a letter or a banner can be seen by whoever shares her phone or her post. If a member cannot be reached in the app, whether and how to try another way is counsel's decision.

The OAIC notice (Privacy Act 1988 s 26WK) is a separate step in the same register and is not affected by any of this.

## Preparedness checklist

- [ ] **[FOUNDER]** Off-platform contact list (phone numbers) stored outside this repo
- [ ] **[FOUNDER]** Verify Netlify/Neon/Stripe break-glass access + 2FA on all provider accounts
- [ ] Quarterly: tabletop one scenario from threat-model.md
- [ ] Sentry alerting wired to a monitored channel (currently unchecked in launch checklist)
