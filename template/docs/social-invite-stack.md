# Social Invite & Contact Sync Stack

This document summarizes the Social Platform v2 invite + friend-sync implementation.

## API Surface

- `POST /api/v1/social/invites` – Authenticated persona owners dispatch batched invites (email/SMS/deeplink) with contextual metadata (org slug, tags, notes). Returns invite tokens and summary counts.
- `POST /api/v1/social/invites/{token}/accept` – Authenticated members accept an invite. Updates audit fields, notifies senders, and records analytics.
- `POST /api/v1/social/contacts/sync` – Begins an OAuth-backed contact sync session for Google or Outlook. Returns state token + auth URL.
- `POST /api/v1/social/contacts/sync/{session}/callback` – Provider callback endpoint that accepts a normalized contact payload. Triggers `ContactSyncIngestJob` to hash contacts, match existing users, and persist metadata.
- `GET /api/v1/social/contacts/suggestions` – Returns matched contacts (respecting persona privacy) for in-product friend suggestions.

## Data Model

- `invites` table extended with persona linkage, invite channel, JSON payload, referral code, decision timestamps, and acceptance actor.
- New tables `contact_sync_sessions` and `contact_sync_contacts` capture OAuth sessions, hashed identifiers, match status, TTLs, and metadata for privacy-compliant storage.

## Services & Jobs

- `InviteDispatchService` enforces throttles, handles storage + email dispatch, emits analytics, and raises In-App notifications for senders and acceptance events.
- `ContactSyncService` manages session lifecycle and suggestion querying. `ContactSyncIngestJob` performs hashing, deduplication, match lookups, TTL assignment, and analytics instrumentation.

## Configuration

Customizable via `config/social_invites.php` (per-day/month throttles, provider scopes, hash salt, TTL windows).

## Testing

Feature coverage lives in `tests/Feature/Api/SocialInviteAndContactSyncTest.php` (invite send/accept flows, contact sync ingestion, suggestion payloads).
