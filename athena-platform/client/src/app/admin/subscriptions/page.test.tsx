import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Staff used to end a membership by choosing CANCELED in a dropdown, which
 * edited ATHENA's row and nothing at Stripe: the member went on being billed and
 * the next update from Stripe wrote her plan back. The dropdown is gone. A
 * membership Stripe is billing is cancelled, or its latest payment refunded,
 * with buttons that act at Stripe and ask for a reason; one staff granted, which
 * has no Stripe billing, is ended by an edit.
 */

jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
jest.mock('@/lib/admin-invoice-api', () => ({ adminInvoiceApi: { issueForSubscription: jest.fn(), issueForPayment: jest.fn() } }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: any) => <a href={href}>{children}</a> }));

import toast from 'react-hot-toast';
import AdminSubscriptionsPage from './page';
import { api } from '@/lib/api';

const http = api as unknown as { get: jest.Mock; post: jest.Mock; patch: jest.Mock };

const member = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  userId: `user-${id}`,
  tier: 'PREMIUM_CAREER',
  status: 'ACTIVE',
  stripeSubscriptionId: `sub_stripe_${id}`,
  cancelAtPeriodEnd: false,
  currentPeriodStart: '2026-10-01T00:00:00.000Z',
  currentPeriodEnd: '2026-11-01T00:00:00.000Z',
  createdAt: '2026-09-01T00:00:00.000Z',
  user: { id: `user-${id}`, email: `${id}@example.com`, firstName: 'Mei', lastName: 'Chen' },
  ...over,
});

function renderPage(rows: unknown[]) {
  http.get.mockResolvedValue({ data: { subscriptions: rows, pagination: { page: 1, limit: 20, total: rows.length, totalPages: 1 } } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminSubscriptionsPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  http.post.mockResolvedValue({ data: { success: true, data: { status: 'refunded', amount: 29, currency: 'AUD' } } });
  http.patch.mockResolvedValue({ data: {} });
});

describe('The status of a membership', () => {
  it('is shown, and cannot be edited into something Stripe does not know', async () => {
    renderPage([member('a')]);

    expect(await screen.findByText('ACTIVE')).toBeInTheDocument();
    // The status dropdown is gone; only the tier is still a select in the row.
    expect(screen.queryByDisplayValue('ACTIVE')).not.toBeInTheDocument();
  });

  it('says when a cancelled membership ends', async () => {
    renderPage([member('a', { cancelAtPeriodEnd: true })]);

    expect(await screen.findByText(/Ends 0?1\/11\/2026/)).toBeInTheDocument();
  });
});

describe('Cancelling a membership Stripe is billing', () => {
  it('offers the Stripe actions, not an edit', async () => {
    renderPage([member('a')]);

    expect(await screen.findByRole('button', { name: 'Cancel at Stripe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refund latest payment' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End membership' })).not.toBeInTheDocument();
  });

  it('cancels at the end of the period by default, with an optional reason', async () => {
    renderPage([member('a')]);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel at Stripe' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'She asked by email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel at period end' }));

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith('/admin/subscriptions/a/cancel', { mode: 'period_end', reason: 'She asked by email' })
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('end of the period they have paid for')));
    expect(http.patch).not.toHaveBeenCalled();
  });

  it('will not end a membership now without a reason', async () => {
    renderPage([member('a')]);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel at Stripe' }));
    fireEvent.click(screen.getByLabelText(/Now\. She loses it straight away/));

    const endNow = screen.getByRole('button', { name: 'End it now' });
    expect(endNow).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Refunded under the guarantee' } });
    expect(endNow).toBeEnabled();
    fireEvent.click(endNow);

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith('/admin/subscriptions/a/cancel', { mode: 'now', reason: 'Refunded under the guarantee' })
    );
  });

  it('can be backed out of, and does nothing', async () => {
    renderPage([member('a')]);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel at Stripe' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it as it is' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(http.post).not.toHaveBeenCalled();
  });

  it('says what went wrong, and that nothing changed, when Stripe refuses', async () => {
    http.post.mockRejectedValue({ response: { data: { message: 'Stripe would not cancel this membership, so nothing was changed.' } } });
    renderPage([member('a')]);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel at Stripe' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel at period end' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Stripe would not cancel this membership, so nothing was changed.'));
    // The dialog stays, so the press can be tried again.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('offers no cancel for a membership that is already cancelled', async () => {
    renderPage([member('a', { status: 'CANCELED' })]);

    await screen.findByText('CANCELED');
    expect(screen.queryByRole('button', { name: 'Cancel at Stripe' })).not.toBeInTheDocument();
  });
});

describe('Refunding the latest payment', () => {
  it('needs a reason, then refunds through Stripe and says how much', async () => {
    renderPage([member('a')]);

    fireEvent.click(await screen.findByRole('button', { name: 'Refund latest payment' }));
    const refund = screen.getByRole('button', { name: 'Refund the payment' });
    expect(refund).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Inside the 30 days' } });
    fireEvent.click(refund);

    await waitFor(() => expect(http.post).toHaveBeenCalledWith('/admin/subscriptions/a/refund', { reason: 'Inside the 30 days' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Refunded AUD 29 to a@example.com.'));
  });

  it('says so when the payment had already been refunded', async () => {
    http.post.mockResolvedValue({ data: { success: true, data: { status: 'already_refunded', amount: 29, currency: 'AUD' } } });
    renderPage([member('a')]);

    fireEvent.click(await screen.findByRole('button', { name: 'Refund latest payment' }));
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Retry' } });
    fireEvent.click(screen.getByRole('button', { name: 'Refund the payment' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('already refunded')));
  });

  it('says plainly that it does not end the membership', async () => {
    renderPage([member('a')]);

    fireEvent.click(await screen.findByRole('button', { name: 'Refund latest payment' }));

    expect(screen.getByText(/It does not end the membership/)).toBeInTheDocument();
  });
});

describe('A membership staff granted', () => {
  it('has no Stripe actions, and is ended by an edit', async () => {
    renderPage([member('g', { stripeSubscriptionId: null })]);

    expect(screen.queryByRole('button', { name: 'Cancel at Stripe' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'End membership' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refund latest payment' })).not.toBeInTheDocument();
  });

  it('is ended with a status edit, which is allowed for a row Stripe is not billing', async () => {
    renderPage([member('g', { stripeSubscriptionId: null })]);

    fireEvent.click(await screen.findByRole('button', { name: 'End membership' }));
    const buttons = screen.getAllByRole('button', { name: 'End membership' });
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => expect(http.patch).toHaveBeenCalledWith('/admin/subscriptions/g', { status: 'CANCELED' }));
    expect(http.post).not.toHaveBeenCalled();
  });
});
