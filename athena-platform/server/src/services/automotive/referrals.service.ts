/**
 * What ATHENA is paid by a partner when an introduction made here becomes
 * a sale, a loan or a policy: the fee for each kind, worked out from the
 * blueprint's figures. What has actually been paid against each fee is kept
 * by referral-ledger.service, and a fee is PAID only when the payments
 * recorded there cover it. The member never pays these, and the figures are
 * published on the public pages so the introduction is never a secret.
 */

import { REFERRAL_FEES } from './automotive-library';

export type ReferralKind = 'DEALER_SALE' | 'FINANCE' | 'INSURANCE' | 'WARRANTY' | 'PARTS' | 'FLEET';
export type ReferralStatus = 'PENDING' | 'CONFIRMED' | 'PAID' | 'VOID';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A dealership pays between the floor and the ceiling, at the percentage, for a sale that began with a test drive here. */
export function dealerSaleFee(salePrice: number): number {
  if (salePrice <= 0) return 0;
  const f = REFERRAL_FEES.dealerSale;
  return Math.round(clamp((salePrice * f.percent) / 100, f.min, f.max));
}

export function referralFee(kind: ReferralKind, basisAmount: number): { fee: number; percent: number } {
  const basis = Math.max(0, basisAmount);
  const share = (percent: number) => ({ fee: Math.round((basis * percent) / 100), percent });
  switch (kind) {
    case 'DEALER_SALE': return { fee: dealerSaleFee(basis), percent: REFERRAL_FEES.dealerSale.percent };
    case 'FINANCE': return share(REFERRAL_FEES.finance.percent);
    case 'INSURANCE': return share(REFERRAL_FEES.insurance.percent);
    case 'WARRANTY': return share(REFERRAL_FEES.warranty.percent);
    case 'PARTS': return share(REFERRAL_FEES.parts.percent);
    default: return { fee: 0, percent: 0 };
  }
}

export const REFERRAL_KIND_WORDS: Record<ReferralKind, string> = { DEALER_SALE: 'Dealership sale', FINANCE: 'Loan settled', INSURANCE: 'Policy taken', WARRANTY: 'Extended warranty', PARTS: 'Parts supplied', FLEET: 'Fleet programme' };

// The ledger's totals used to be worked out here from the status column
// alone, so "paid" was the sum of the fees an admin had marked PAID in a
// dropdown. They are now sums of the payments actually recorded against each
// fee: see summariseLedger in referral-ledger.service.
