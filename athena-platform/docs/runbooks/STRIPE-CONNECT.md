# Stripe Connect Runbook

How money gets to a mentor or a creator, how to check it end to end, and what
must have been seen working before payouts are announced.

**Status, said plainly.** The onboarding, hold, capture, refund and payout code
is written, hardened and covered by mocked tests. It has not been run against
real Stripe, in test mode or live. Nothing in this repository can make that
true: it takes a Stripe account in ATHENA's name, and a person walking the steps
below. Keep payouts switched off (no live keys on the host) until every step
here has passed, in test mode and then once live.

## How it fits together

1. **A member connects.** "Connect payouts" on the earnings page, or turning on
   mentoring or creator mode, creates one Express account for her (country AU,
   the `card_payments` and `transfers` capabilities) through
   `server/src/services/stripe-connect.service.ts`, keyed on her member id so a
   double tap makes one account, and sends her to Stripe's own onboarding.
2. **Stripe verifies her.** Her status on ATHENA is `PENDING` until she has
   submitted her details, `ACTIVE` only when Stripe also says payouts are enabled
   *and* the `transfers` capability is active, and `RESTRICTED` after that if
   Stripe pauses her. It moves on the `account.updated` event, and a screen that
   asks (the earnings page, a withdrawal) reads Stripe once if the stored status
   is behind.
3. **A buyer pays.** A booking, an order, a car purchase or a mentoring session is
   a manual-capture destination charge with ATHENA's fee taken. The seller must be
   `ACTIVE` or the hold is refused up front. Nothing is taken until the work is
   done and the buyer (or the flow) releases it.
4. **The money reaches her balance.** Capture transfers the seller's share to
   her connected account.
5. **She withdraws.** "Withdraw" creates a payout on her connected account for the
   amount she asked, once, keyed so a double tap cannot send it twice. Creators
   withdraw gift earnings the same way (`POST /api/creator/payouts/request`).
6. **Stripe says what happened.** `payout.paid` and `payout.failed` reach the
   member as a notice; a failed payout puts the money back in her balance.

Two Stripe webhook endpoints feed this: the platform endpoint
(`STRIPE_WEBHOOK_SECRET`) and a second one with "Listen to events on Connected
accounts" ticked (`STRIPE_CONNECT_WEBHOOK_SECRET`). Both can point at
`/api/webhooks/stripe`; each event is checked against whichever secret signed it.
Without the second, `account.updated`, `payout.paid` and `payout.failed` are
refused and nobody hears about a bounced withdrawal.

## Before you start

- [ ] A Stripe account in ATHENA's name, Australian, with business verification
      done (ABN and bank account): https://dashboard.stripe.com/register
- [ ] Connect switched on as a platform/marketplace with **Express** accounts, the
      platform profile filled in and the Connect terms accepted:
      https://dashboard.stripe.com/connect
- [ ] Test-mode keys only for the first pass. `sk_test_…` on a **non-production**
      API. Never put a live key where a rehearsal runs.
- [ ] `ALLOW_STRIPE_SIMULATION` is `false` (it is, in every deploy file). A
      production process with it on will not start.

Environment for the rehearsal API:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...           # the platform endpoint
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...   # the Connect endpoint
CLIENT_URL=http://localhost:3000           # where Stripe sends her back to
```

Locally, the Stripe CLI stands in for both endpoints. It signs everything it
forwards with one secret, so put that same `whsec_…` in both variables:

```bash
stripe listen \
  --forward-to localhost:5000/api/webhooks/stripe \
  --forward-connect-to localhost:5000/api/webhooks/stripe
```

`GET /health/launch-readiness` (with the diagnostics token) should show
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET`
configured and `STRIPE_MODE` as test.

## Test-mode walk

Use two test members: a **seller** (a mentor) and a **buyer**. Tick each step
only when you have seen the result, not when the request returned.

1. **Onboard the seller.** She presses "Connect payouts". Expect one Express
   account in the Stripe dashboard (test mode), and her status `PENDING`. Press
   it twice quickly: still one account.
2. **Finish Stripe's test onboarding** (https://docs.stripe.com/connect/testing:
   the test bank is BSB `110000`, account `000123456`, and the page lists the
   test identity values). `account.updated` arrives; her status becomes `ACTIVE`
   and the mentor page offers her for booking. Before this, she must not be
   bookable and "Withdraw" must say her account is not ready.
3. **A hold.** The buyer books a paid session with card `4242 4242 4242 4242`.
   The payment shows `AUTHORIZED` in the dashboard, the mentor is told of the
   request only now, and she can accept. A request the buyer never pays for is
   cancelled within a few hours and nothing is charged.
4. **Release.** After the session's hour, the session is completed. Expect the
   charge captured, the seller's share on her connected account's balance
   (dashboard, Connect, her account), and ATHENA's fee on the platform.
5. **Withdraw.** She presses Withdraw for part of the balance. Expect one payout
   for the right amount, and `payout.paid` arriving as her notification. Press it
   twice: still one payout. Try a withdrawal larger than the balance: a plain
   "balance is less" message, not an error page.
6. **A payout that fails.** Repeat with the failing test bank account from the
   same Stripe page. Expect `payout.failed`, her notice saying why, and the money
   back in her balance.
7. **Cancel and refund.** Book a second session and cancel it before completion:
   the hold is released and the buyer is not charged. Refund a captured one from an
   admin: the refund reverses the transfer and ATHENA's fee.
8. **A creator.** Turn on creator mode for the seller (or a third member), send
   her a gift from the buyer, and withdraw the earnings. Same expectations as 4 to 6.
9. **Reconcile.** As an admin, `POST /api/payments/reconciliation/run`. The report
   should list nothing needing attention.
10. **Restriction.** In the dashboard, restrict the seller's test account. Expect
    `RESTRICTED`, her notice, and no new holds or withdrawals for her until it is
    lifted.

## The decision this walk has to make: the payout schedule

An Express account is paid out on Stripe's **automatic** schedule unless told
otherwise, and ATHENA also has a Withdraw button that creates a payout by hand.
The code does not guess which should win. In step 5, watch what happens:

- If Stripe sweeps her balance to her bank on its own before she presses
  Withdraw, the button will say her balance is less than she asked for. That is
  harmless but confusing, and her earnings page will show a balance of nothing.
- If both can coexist and a withdrawal is paid, nothing needs changing.

To make a balance wait until she asks for it, create accounts on a manual
schedule: set `STRIPE_CONNECT_PAYOUT_SCHEDULE=manual` on the API. It only
affects accounts created after it is set; move an existing test account over
with:

```bash
stripe accounts update acct_XXXX -d "settings[payouts][schedule][interval]=manual"
```

Write the decision in the table at the bottom, and keep the same setting for
live.

## The Stripe-side smoke script

`server/scripts/stripe-connect-smoke.js` drives the money loop against Stripe
directly (no ATHENA database, no ATHENA API), which separates "Stripe is set up
right" from "ATHENA has a bug". It refuses any key that is not a test key.

```bash
cd athena-platform/server
STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-connect-smoke.js
# prints a Stripe onboarding link for a new test account: finish it in a browser,
# then run the money loop against that account:
STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-connect-smoke.js --account acct_XXXX
```

The second form creates a manual-capture destination charge with an application
fee on the 4242 test card, captures it, refunds a second one with the transfer
reversed, reads the connected account's balance, and tries a payout. It prints
each Stripe object id and what Stripe said. It cannot tell you whether ATHENA's
own flow behaved: steps 1 to 10 above do that.

## Going live

Only after every step above has passed in test mode:

1. Put the live `sk_live_…` key and the two live webhook secrets on the production
   API (they differ from the test ones: create the two endpoints again in live
   mode). Switch Connect on in live mode and accept its terms.
2. Repeat steps 1 to 6 once with two real people at the smallest amount Stripe
   allows (A$0.50 for a charge), withdrawing to a real bank account.
3. `GET /health/launch-readiness` should show `STRIPE_MODE` as live and every
   payments check ok.
4. Only then announce payouts.

## When something looks wrong

- **A seller cannot be booked, or a hold is refused for her.** Her status is not
  `ACTIVE`: open her account in the Stripe dashboard and see what it is waiting
  for (`requirements.currently_due`). It also needs the `transfers` capability
  active, which is separate from payouts being on.
- **A withdrawal says her account is not ready.** Same cause; the message tells her
  to finish setting up from her earnings page.
- **Payments answer 503.** No `STRIPE_SECRET_KEY` on that deployment. Nothing is
  simulated in its place; set the key.
- **Events are not arriving.** Stripe dashboard, Developers, Webhooks, the
  endpoint's recent deliveries. A 400 is a wrong signing secret (the platform and
  Connect endpoints have different ones); a 500 is a missing one.
- **Money and rows disagree.** `POST /api/payments/reconciliation/run` as an admin
  compares Stripe with the ledger and lists what needs a person.

## Record of the passes

Fill this in as the walk is done; it is the evidence that payouts were ready.

| Pass | Date | Who | Result | Notes (payout schedule chosen, anything surprising) |
| ---- | ---- | --- | ------ | --------------------------------------------------- |
| Test mode, mentor |  |  |  |  |
| Test mode, creator |  |  |  |  |
| Live, smallest amount |  |  |  |  |
