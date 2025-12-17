# Payments API Contract (MVP)

POST /api/subscribe
- Request: { user_id: number, plan: string }
- Response: { ok: true, subscription: { id, plan, created_at } }

Notes:

- Use Stripe for production — this mock endpoint records subscriptions in `mock-api/db.json` for local dev.
- Plan names: `starter`, `pro`, `premium`.

Dev flow:

1. Frontend calls `POST /api/stripe/create-session` with `{ plan, user_id }`.
2. Mock API returns `{ id, url }` where `url` redirects to the success page in dev.
3. Run `npm run simulate-webhook <sessionId> <plan>` to simulate the `checkout.session.completed` webhook and finalize subscription in `mock-api/db.json`.
