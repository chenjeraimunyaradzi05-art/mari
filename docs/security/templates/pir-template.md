# Post-incident review

_Copy this file into `docs/security/incidents/` as `YYYY-MM-DD-short-name.md` within seven days of the incident closing. Write it for the person who will read it in a year with no memory of the week._

## Summary

- **Incident:** one line, in plain words.
- **Severity:** LOW / MEDIUM / HIGH / CRITICAL (as recorded in the breach register at `/admin/breaches`, if personal data was involved).
- **Detected:** date and time (AEST), and by whom or what.
- **Contained:** date and time.
- **Resolved:** date and time.
- **Personal data involved:** yes / no. If yes, the breach register id and whether the OAIC (30-day assessment, Notifiable Data Breaches scheme) and any UK or EU regulator (72 hours) were notified, and when.

## Timeline

| When (AEST) | What happened | Who |
|---|---|---|
| | | |

Include the first signal, every decision, every notification sent, and the moment service was restored.

## Impact

- Members affected, and how (locked out, data exposed, money delayed, content lost).
- Duration of user-visible impact.
- What members were told, where (in-app notice, email, the status page, the changelog), and when.

## Root cause

What actually failed, in one paragraph, followed by why the safeguards that should have caught it did not. Name the conditions, not the people.

## What went well

Things that shortened the incident: monitoring that fired, a runbook that was followed, a rollback that worked.

## What did not go well

Things that lengthened it: missing alerts, unclear ownership, a step that had to be worked out live.

## Actions

| Action | Owner | Due | Done |
|---|---|---|---|
| | | | |

Every action has one owner and a date. Prevention comes first, detection second, response third. Actions that change a control are reflected in `docs/security/threat-model.md` and, where a claim to members changes, in `docs/security/trust-claims-register.md`.
