/**
 * The copy of the price book that the static pages print.
 *
 * Every figure about what ATHENA charges, keeps and promises is held once, on
 * the server, in server/src/config/price-book.ts, and the code that moves money
 * reads it there. The web app cannot import from the server package, so
 * lib/pricing.ts carries the few figures its static pages need (the Terms, the
 * mentor agreement, the creator dashboard and the pricing FAQ). This test reads
 * the server's file and fails when the two differ, which is what stops the
 * pricing page promising a refund the Terms do not offer. The server has the
 * same test from the other side.
 *
 * @jest-environment node
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  CREATOR_SHARE_PERCENT,
  CREATOR_SHARE_RANGE_PERCENT,
  GIFT_POINT_VALUE_AUD,
  MENTOR_PLATFORM_FEE_PERCENT,
  MINIMUM_PAYOUT_AUD,
  REFUND_DAYS,
  TRIAL_DAYS,
} from '../pricing';
import { renderLegalTokens } from '../contact';

const serverBook = fs.readFileSync(
  path.resolve(__dirname, '..', '..', '..', '..', 'server', 'src', 'config', 'price-book.ts'),
  'utf8'
);
// Line endings normalised: the file is checked out with CRLF on Windows.
const terms = fs
  .readFileSync(path.resolve(__dirname, '..', '..', 'content', 'legal', 'terms.md'), 'utf8')
  .replace(/\r\n/g, '\n');

function bookNumber(name: string): number {
  const match = new RegExp(`export const ${name} = ([0-9.]+);`).exec(serverBook);
  if (!match) throw new Error(`${name} is not exported as a plain number from the price book`);
  return Number(match[1]);
}

describe('lib/pricing equals the server price book', () => {
  it('has the same trial and refund window', () => {
    expect(TRIAL_DAYS).toBe(bookNumber('TRIAL_DAYS'));
    expect(REFUND_DAYS).toBe(bookNumber('REFUND_DAYS'));
  });

  it('has the same mentoring fee, as a percentage', () => {
    expect(MENTOR_PLATFORM_FEE_PERCENT).toBe(Math.round(bookNumber('MENTOR_PLATFORM_FEE_RATE') * 100));
  });

  it('has the same gift point value and payout minimum', () => {
    expect(GIFT_POINT_VALUE_AUD).toBe(bookNumber('GIFT_POINT_CENTS') / 100);
    expect(MINIMUM_PAYOUT_AUD).toBe(bookNumber('MINIMUM_PAYOUT_AUD'));
  });

  it('has the same creator share for every tier', () => {
    const block = /export const CREATOR_REVENUE_SHARE_PERCENT = \{([^}]*)\}/.exec(serverBook);
    expect(block).not.toBeNull();
    const shares: Record<string, number> = {};
    for (const [, name, value] of block![1].matchAll(/(\w+):\s*([0-9]+)/g)) shares[name] = Number(value);
    expect({ ...CREATOR_SHARE_PERCENT }).toEqual(shares);
  });

  it('quotes the range from the tiers it holds', () => {
    expect(CREATOR_SHARE_RANGE_PERCENT.min).toBe(Math.min(...Object.values(CREATOR_SHARE_PERCENT)));
    expect(CREATOR_SHARE_RANGE_PERCENT.max).toBe(Math.max(...Object.values(CREATOR_SHARE_PERCENT)));
  });
});

/**
 * The Terms are contractual. The numbers in them come from the book through
 * renderLegalTokens, so the Terms, the pricing page and the code cannot say three
 * different things.
 */
describe('the Terms read their figures from the price book', () => {
  const rendered = renderLegalTokens(terms);

  it('leaves no price token unresolved', () => {
    expect(rendered).not.toMatch(/\{\{\s*price\./);
  });

  it('states the trial: a card is needed, when it is charged, the reminder and how to cancel', () => {
    const section = /### 6\.4 Free Trials\n([\s\S]*?)\n---/.exec(rendered);
    expect(section).not.toBeNull();
    const text = section![1];
    expect(text).toContain(`free trial of ${TRIAL_DAYS} days`);
    expect(text).toMatch(/A card is needed to start it/);
    expect(text).toMatch(/Nothing is charged while the trial runs/);
    expect(text).toMatch(/On the day the trial ends, the card is charged/);
    expect(text).toMatch(/unless you cancel before that day/);
    expect(text).toMatch(/We email you a few days before the first charge/);
    expect(text).toMatch(/cancel at any time from Settings, then Billing/);
    expect(text).toMatch(/you pay nothing/);
  });

  it('offers the same refund window as the pricing page promises', () => {
    const section = /### 6\.3 Cancellation\n([\s\S]*?)### 6\.4/.exec(rendered);
    expect(section).not.toBeNull();
    expect(section![1]).toContain(`within ${REFUND_DAYS} days of it being charged`);
    // The consumer-law remedy is not lost to it.
    expect(section![1]).toMatch(/Australian Consumer Law/);
  });

  // Section 5.4 pointed at "our Refund Policy", which has never existed. It now
  // points at the section that says what is refunded, so the Terms, the pricing
  // page and the help page describe one rule.
  it('points the refund section at a section that exists, not at a policy that does not', () => {
    const section = /### 5\.4 Refunds\n([\s\S]*?)---/.exec(rendered);
    expect(section).not.toBeNull();
    expect(section![1]).not.toMatch(/Refund Policy/);
    expect(section![1]).toMatch(/section 6\.3/);
    expect(section![1]).toMatch(/Australian Consumer Law \(section 9\.4\)/);
    expect(rendered).toMatch(/### 6\.3 Cancellation/);
    expect(rendered).toMatch(/### 9\.4 Consumer Rights/);
    expect(rendered).not.toMatch(/Refund Policy/);
  });

  it('quotes the creator share and the platform fee as the range the tiers pay', () => {
    const section = /### 5\.2 Revenue Share\n([\s\S]*?)### 5\.3/.exec(rendered);
    expect(section).not.toBeNull();
    expect(section![1]).toContain(`${CREATOR_SHARE_RANGE_PERCENT.min}% to ${CREATOR_SHARE_RANGE_PERCENT.max}%`);
    expect(section![1]).toContain(
      `${100 - CREATOR_SHARE_RANGE_PERCENT.max}% to ${100 - CREATOR_SHARE_RANGE_PERCENT.min}%`
    );
    // The public fee schedule (GET /api/fees, from the price book's
    // PROCESSING_FEE_STATEMENT) says card processing is covered by ATHENA's share
    // and nothing is deducted from what a creator keeps; the code pays out every
    // point at a cent. The Terms said processing fees "may apply". One statement.
    expect(section![1]).toMatch(/no separate processing fee/i);
    expect(section![1]).not.toMatch(/processing fees may apply/i);
  });

  it('states the payout minimum in Australian dollars only', () => {
    const section = /### 5\.3 Payouts\n([\s\S]*?)### 5\.4/.exec(rendered);
    expect(section).not.toBeNull();
    expect(section![1]).toContain(`A$${MINIMUM_PAYOUT_AUD}`);
    expect(section![1]).not.toMatch(/or equivalent/);
  });

  // The Terms once promised "monthly or upon reaching threshold" while the code paid
  // a creator only when she pressed the button. They say what happens: she asks,
  // once her balance has reached the minimum, and nothing is paid automatically.
  // If automatic monthly payouts are ever switched on (CREATOR_AUTO_PAYOUTS on the
  // server), this section is the thing that has to change with it.
  it('says how a payout is made: on request, to a verified Stripe account, with no other threshold', () => {
    const section = /### 5\.3 Payouts\n([\s\S]*?)### 5\.4/.exec(rendered);
    expect(section).not.toBeNull();
    const text = section![1];
    expect(text).toContain(`**Minimum payout:** A$${MINIMUM_PAYOUT_AUD}`);
    expect(text).toMatch(/There is no other threshold/);
    expect(text).toMatch(/you ask for a payout from your creator dashboard/);
    expect(text).toMatch(/Nothing is paid out automatically/);
    expect(text).toMatch(/carries over/);
    expect(text).toMatch(/Stripe Connect to your own Stripe account, and only once Stripe has verified it/);
    expect(text).toMatch(/ATHENA takes no fee when you withdraw/);
    // The old line promised a cadence the platform did not keep.
    expect(text).not.toMatch(/Monthly or upon reaching threshold/);
  });

  it('tells mentors and sellers, in the same section, that the minimum is not theirs', () => {
    const section = /### 5\.3 Payouts\n([\s\S]*?)### 5\.4/.exec(rendered);
    expect(section![1]).toMatch(/Mentors and sellers:.*ATHENA sets no minimum on them/);
  });

  it('says prices are in Australian dollars and where GST is shown', () => {
    const section = /### 6\.2 Billing\n([\s\S]*?)### 6\.3/.exec(rendered);
    expect(section).not.toBeNull();
    expect(section![1]).toMatch(/All prices are in Australian dollars \(AUD\)/);
    expect(section![1]).toMatch(/say whether GST is included/);
  });
});
