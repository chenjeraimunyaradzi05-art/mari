#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Drives the Stripe side of the Connect money loop in test mode.
 *
 * Why this exists: ATHENA's onboarding, hold, capture, refund and payout code has
 * never been run against real Stripe, and a manual walk through the app cannot tell
 * "Stripe is not set up the way the code assumes" from "the code has a bug". This
 * script makes the same calls the platform makes, straight at Stripe, so the first
 * answers that Stripe gives are seen before anything else is blamed. It is the
 * companion to docs/runbooks/STRIPE-CONNECT.md, which says what to do with the
 * output and what only a person in the app can check.
 *
 * What it never does: it opens no database connection and calls no ATHENA API. It
 * reads STRIPE_SECRET_KEY from the environment and refuses anything that is not a
 * test key (sk_test_ or rk_test_), so it cannot move real money by accident. The key
 * is never printed; ids and statuses are.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-connect-smoke.js
 *       Creates an Express test account (AU, the capabilities the platform asks
 *       for) and prints Stripe's onboarding link. Finish it in a browser, with the
 *       test values at https://docs.stripe.com/connect/testing.
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-connect-smoke.js --account acct_...
 *       Runs the money loop against that account: a manual-capture destination
 *       charge with an application fee (hold, capture), a second one refunded with
 *       the transfer and the fee reversed, a third one cancelled, the account's
 *       balance, and a manual payout.
 *
 * Set STRIPE_CONNECT_PAYOUT_SCHEDULE=manual to create the account on a manual payout
 * schedule, the way the platform will when the same variable is set on the API.
 *
 * Exits 0 when every step Stripe was asked for answered as the platform assumes, 1
 * when one did not, and 2 when it was not run (a bad key or arguments).
 */

const Stripe = require('stripe');

// The version utils/stripe.ts pins, so the answers seen here are the answers the
// platform will get.
const API_VERSION = '2023-10-16';

function stop(message) {
  console.error(`\n  stripe-connect-smoke: ${message}\n`);
  process.exit(2);
}

function argument(name) {
  const args = process.argv.slice(2);
  const at = args.indexOf(name);
  return at === -1 ? null : (args[at + 1] ?? null);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-connect-smoke.js [--account acct_...]');
  console.log('See the header of this file, and docs/runbooks/STRIPE-CONNECT.md.');
  process.exit(0);
}

const key = (process.env.STRIPE_SECRET_KEY || '').trim();
if (!key) stop('STRIPE_SECRET_KEY is not set. Use a test key (sk_test_...).');
if (!/^(sk|rk)_test_/.test(key)) {
  // Refused for any key that is not provably a test key, live or unrecognisable.
  stop('STRIPE_SECRET_KEY is not a test key. This script only runs against Stripe test mode, so it never moves real money.');
}

const stripe = new Stripe(key, { apiVersion: API_VERSION });
const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');

const results = [];
function record(ok, label, detail) {
  results.push({ ok, label });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`);
}

/** Runs one step, recording what Stripe said. Returns the value, or null when Stripe refused. */
async function step(label, work) {
  try {
    return await work();
  } catch (error) {
    record(false, label, `${error.type || 'error'}: ${error.message}`);
    return null;
  }
}

/** The platform's own account parameters (services/stripe-connect.service.ts createConnectedAccount). */
function accountParams() {
  const schedule = (process.env.STRIPE_CONNECT_PAYOUT_SCHEDULE || '').trim().toLowerCase();
  return {
    type: 'express',
    country: 'AU',
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    business_type: 'individual',
    ...(schedule === 'manual' ? { settings: { payouts: { schedule: { interval: 'manual' } } } } : {}),
    metadata: { smoke: 'true' },
  };
}

async function createAccount() {
  console.log('\nCreating an Express test account\n');
  const account = await step('create the account', () => stripe.accounts.create(accountParams()));
  if (!account) return 1;
  record(true, 'create the account', account.id);

  const link = await step('create the onboarding link', () =>
    stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${clientUrl}/dashboard/payments/refresh`,
      return_url: `${clientUrl}/dashboard/payments/success`,
      type: 'account_onboarding',
    })
  );
  if (!link) return 1;
  record(true, 'create the onboarding link');

  console.log(`\n  Open this in a browser and finish Stripe's test onboarding:\n    ${link.url}`);
  console.log(`\n  Then run the money loop:\n    node scripts/stripe-connect-smoke.js --account ${account.id}\n`);
  return 0;
}

/** A destination charge held for capture, the way createEscrowPayment makes one. */
function holdParams(accountId, label) {
  return {
    amount: 5000,
    currency: 'aud',
    capture_method: 'manual',
    // pm_card_bypassPending is the 4000 0000 0000 0077 test card: the funds are
    // available at once, which is what lets the payout step below run in test mode.
    payment_method: 'pm_card_bypassPending',
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    application_fee_amount: 1000,
    transfer_data: { destination: accountId },
    description: `ATHENA smoke test: ${label}`,
    metadata: { smoke: 'true', step: label },
  };
}

async function moneyLoop(accountId) {
  console.log(`\nRunning the money loop against ${accountId}\n`);

  const account = await step('read the account', () => stripe.accounts.retrieve(accountId));
  if (!account) return finish();
  record(
    true,
    'read the account',
    `details_submitted=${account.details_submitted} charges_enabled=${account.charges_enabled} payouts_enabled=${account.payouts_enabled} transfers=${account.capabilities?.transfers ?? 'not requested'}`
  );
  // The platform's ACTIVE: submitted, payouts on, transfers active.
  const ready = account.details_submitted && account.payouts_enabled && account.capabilities?.transfers === 'active';
  record(ready, 'the account is ready to be paid (what ATHENA calls ACTIVE)');
  if (!ready) {
    console.log('\n  The account has not finished onboarding. Finish it in the browser and run this again.\n');
    return finish();
  }

  // Hold, then capture.
  const held = await step('make a hold', () => stripe.paymentIntents.create(holdParams(accountId, 'hold and capture')));
  if (held) {
    record(held.status === 'requires_capture', 'make a hold', `${held.id} is ${held.status}`);
    const captured = await step('capture the hold', () => stripe.paymentIntents.capture(held.id));
    if (captured) {
      record(captured.status === 'succeeded', 'capture the hold', `${captured.status}, ${captured.amount_received} received`);
      const charge = await step('read the charge', () => stripe.charges.retrieve(captured.latest_charge));
      if (charge) {
        const transfer = await step('read the transfer to the account', () => stripe.transfers.retrieve(charge.transfer));
        if (transfer) {
          // 5000 charged, 1000 kept as ATHENA's fee, 4000 sent to the seller.
          record(
            transfer.amount === 4000 && transfer.destination === accountId,
            'the seller received the amount less the fee',
            `${transfer.amount} to ${transfer.destination}`
          );
        }
      }
    }
  }

  // Refund with the transfer and the fee reversed, the way cancelEscrowPayment does.
  const toRefund = await step('make a second hold to refund', () => stripe.paymentIntents.create(holdParams(accountId, 'refund')));
  if (toRefund) {
    const captured = await step('capture it', () => stripe.paymentIntents.capture(toRefund.id));
    if (captured) {
      const refund = await step('refund it, reversing the transfer and the fee', () =>
        stripe.refunds.create({ payment_intent: toRefund.id, reverse_transfer: true, refund_application_fee: true })
      );
      if (refund) record(refund.status === 'succeeded', 'refund it, reversing the transfer and the fee', `${refund.id} is ${refund.status}`);
    }
  }

  // Cancel a hold that was never captured.
  const toCancel = await step('make a third hold to cancel', () => stripe.paymentIntents.create(holdParams(accountId, 'cancel')));
  if (toCancel) {
    const cancelled = await step('cancel it', () => stripe.paymentIntents.cancel(toCancel.id));
    if (cancelled) record(cancelled.status === 'canceled', 'cancel it', `${cancelled.id} is ${cancelled.status}`);
  }

  // The balance, and a manual payout: the Withdraw button's call. Whether this works
  // beside Stripe's automatic schedule is the decision the runbook asks for.
  const balance = await step("read the account's balance", () => stripe.balance.retrieve({ stripeAccount: accountId }));
  if (balance) {
    const aud = (rows) => (rows || []).filter((row) => row.currency === 'aud').reduce((sum, row) => sum + row.amount, 0);
    record(true, "read the account's balance", `available ${aud(balance.available)}, pending ${aud(balance.pending)} (AUD, in cents)`);
  }

  const payout = await step('create a manual payout (the Withdraw button)', () =>
    stripe.payouts.create({ amount: 1000, currency: 'aud', description: 'ATHENA smoke test' }, { stripeAccount: accountId })
  );
  if (payout) {
    record(true, 'create a manual payout (the Withdraw button)', `${payout.id} is ${payout.status}`);
  } else {
    console.log(
      '\n  A refused payout here is the payout-schedule question in the runbook: if the message says the schedule is\n' +
        '  automatic, or the balance is empty because Stripe already swept it, decide whether new accounts should be\n' +
        '  created with STRIPE_CONNECT_PAYOUT_SCHEDULE=manual.'
    );
  }

  return finish();
}

function finish() {
  const failed = results.filter((result) => !result.ok);
  console.log(`\n  ${results.length - failed.length} of ${results.length} steps answered as the platform assumes.\n`);
  return failed.length === 0 ? 0 : 1;
}

async function main() {
  const accountId = argument('--account');
  if (process.argv.includes('--account') && !/^acct_\w+$/.test(accountId || '')) {
    stop('--account needs an account id, such as acct_1ABC...');
  }
  const code = accountId ? await moneyLoop(accountId) : await createAccount();
  process.exit(code);
}

main().catch((error) => {
  console.error(`\n  stripe-connect-smoke: ${error.message}\n`);
  process.exit(1);
});
