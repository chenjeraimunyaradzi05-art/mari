import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * The ledger used to have a "Paid" button that set a status and nothing else,
 * so what the page called received was a count of clicks. These guard the
 * replacement: no way to mark a fee paid by hand, a payment recorded with
 * what the bank or Stripe shows, a reversal that needs a reason, and totals
 * that say plainly when a fee was marked paid with no payment behind it.
 */

const mockPost = jest.fn();
const mockPatch = jest.fn();
jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: (...a: unknown[]) => mockPost(...a), patch: (...a: unknown[]) => mockPatch(...a) }, mediaApi: {} }));
jest.mock('@/lib/stripe', () => ({ stripeConfigured: false }));
jest.mock('@/components/payments/PaymentIntentForm', () => ({ PaymentIntentForm: () => null }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }) }));

import { ReferralLedgerItem, brisbaneToday, ledgerIntro } from './ReferralLedger';
import type { AdminReferralCard, PaymentMethodWords, ReferralTotals } from '@/lib/automotive-api';

const METHODS: PaymentMethodWords = {
  BANK_TRANSFER: { label: 'Bank transfer', reference: 'The reference on the bank statement line' },
  STRIPE: { label: 'Stripe', reference: 'The Stripe id' },
  CHEQUE: { label: 'Cheque', reference: 'The cheque number' },
  OTHER: { label: 'Other', reference: 'Whatever identifies it' },
};

function card(over: Partial<AdminReferralCard> = {}, ledger: Partial<AdminReferralCard['ledger']> = {}): AdminReferralCard {
  return {
    id: 'ref-1', kind: 'DEALER_SALE', kindLabel: 'Dealership sale', status: 'CONFIRMED', partner: 'Sunny Motors', dealership: null, member: { name: 'Mei Lin', email: 'mei@athena.test' }, referenceId: null, basisAmount: 42000, feePercent: 1, fee: 420, note: null, confirmedAt: '2026-09-02T00:00:00Z', paidAt: null, createdAt: '2026-09-01T00:00:00Z',
    ledger: {
      feeCents: 42_000, receivedCents: 10_050, outstandingCents: 31_950, overpaidCents: 0, reconciledCents: 0, state: 'PART_PAID', paidOn: null, confirmedBy: { at: '2026-09-02T00:00:00Z', by: 'Priya Shah', how: 'ADMIN' },
      payments: [{ paymentId: 'pay-1', amountCents: 10_050, receivedOn: '2026-09-10', method: 'BANK_TRANSFER', methodLabel: 'Bank transfer', reference: 'SUNNY INV-1001', note: null, recordedAt: '2026-09-10T03:00:00Z', recordedBy: 'Priya Shah', stripe: null, reversal: null, reconciliation: null, reconciled: false }],
      ...ledger,
    },
    attention: [],
    ...over,
  };
}

beforeEach(() => {
  mockPost.mockReset().mockResolvedValue({ data: { data: {} } });
  mockPatch.mockReset().mockResolvedValue({ data: { data: {} } });
});

describe('A fee on the referral ledger', () => {
  it('says what has been received against the fee, and offers no way to mark it paid by hand', () => {
    render(<ReferralLedgerItem referral={card()} methods={METHODS} stripeConfigured={false} onChanged={jest.fn()} />);
    expect(screen.getByText(/Part paid: \$100\.50 received of \$420\.00, \$319\.50 still owed/)).toBeInTheDocument();
    expect(screen.getByText(/Confirmed .* by Priya Shah/)).toBeInTheDocument();
    expect(screen.getByText(/Not yet matched to a bank statement/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Paid$/ })).not.toBeInTheDocument();
    // Money has been recorded, so voiding is not offered until it is reversed.
    expect(screen.queryByRole('button', { name: 'Void' })).not.toBeInTheDocument();
  });

  it('records a payment with what the statement shows, the rest of the fee filled in', async () => {
    const onChanged = jest.fn();
    render(<ReferralLedgerItem referral={card()} methods={METHODS} stripeConfigured={false} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Record a payment' }));
    expect(screen.getByLabelText(/^Amount received/)).toHaveValue(319.5);
    expect(screen.getByRole('button', { name: 'Record it' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Reference/), { target: { value: 'SUNNY INV-1001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record it' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith('/automotive/admin/referrals/ref-1/payments', { amount: 319.5, receivedOn: brisbaneToday(), method: 'BANK_TRANSFER', reference: 'SUNNY INV-1001', note: undefined });
  });

  it('reverses a payment only with a reason', async () => {
    const onChanged = jest.fn();
    render(<ReferralLedgerItem referral={card()} methods={METHODS} stripeConfigured={false} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reverse' }));
    const confirm = screen.getByRole('button', { name: 'Reverse it' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/Why:/), { target: { value: 'Recorded against the wrong fee' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith('/automotive/admin/referrals/ref-1/payments/pay-1/reverse', { reason: 'Recorded against the wrong fee' });
  });

  it('shows a reversed payment struck through, with who reversed it and why', () => {
    const reversed = card({}, { receivedCents: 0, outstandingCents: 42_000, state: 'UNPAID', payments: [{ ...card().ledger.payments[0], reversal: { at: '2026-09-11T00:00:00Z', by: 'Jo Park', reason: 'Recorded twice' } }] });
    render(<ReferralLedgerItem referral={reversed} methods={METHODS} stripeConfigured={false} onChanged={jest.fn()} />);
    expect(screen.getByText(/by Jo Park: Recorded twice/)).toBeInTheDocument();
    expect(screen.getByText('Reversed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Void' })).toBeInTheDocument();
  });

  it('offers a Stripe check only for an unchecked Stripe payment on a server that has a key', async () => {
    const stripe = card({}, { payments: [{ ...card().ledger.payments[0], method: 'STRIPE', methodLabel: 'Stripe', reference: 'pi_3PqRsTuVwXyZ01', stripe: { checked: false, reason: 'No Stripe key is configured on this server' } }] });
    const { rerender } = render(<ReferralLedgerItem referral={stripe} methods={METHODS} stripeConfigured={false} onChanged={jest.fn()} />);
    expect(screen.getByText(/Not checked with Stripe: no stripe key is configured/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check with Stripe' })).not.toBeInTheDocument();
    rerender(<ReferralLedgerItem referral={stripe} methods={METHODS} stripeConfigured onChanged={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check with Stripe' }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/automotive/admin/referrals/ref-1/payments/pay-1/check-stripe'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check with Stripe' })).toBeEnabled());
  });

  it('lets a void fee be restored, and records nothing against it until it is', async () => {
    render(<ReferralLedgerItem referral={card({ status: 'VOID' }, { receivedCents: 0, outstandingCents: 42_000, state: 'UNPAID', payments: [] })} methods={METHODS} stripeConfigured={false} onChanged={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Record a payment' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore: the sale was real' }));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/automotive/admin/referrals/ref-1', { status: 'CONFIRMED' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Restore: the sale was real' })).toBeEnabled());
  });
});

describe('The ledger\'s totals sentence', () => {
  const totals: ReferralTotals = { pending: 180, confirmed: 319.5, paid: 750.5, reconciled: 350, unreconciled: 400.5, overpaid: 0, heldOnVoid: 0, partPaid: 1, markedPaidUnrecorded: { count: 2, fee: 620 }, byKind: {}, unreadable: 0 };

  it('counts only recorded payments as received, and names the fees marked paid without one', () => {
    const words = ledgerIntro(totals);
    expect(words).toMatch(/\$750\.50 received and recorded against a payment/);
    expect(words).toMatch(/\$400\.50 of what was received is not yet matched/);
    expect(words).toMatch(/2 fees were marked paid before payments were recorded \(\$620\) and are not counted as received/);
  });
});
