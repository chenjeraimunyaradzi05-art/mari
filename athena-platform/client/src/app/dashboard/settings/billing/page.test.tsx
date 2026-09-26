import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The billing page used to render a hardcoded Free / Pro A$29 / Enterprise
 * A$99 list. Pro checked out at its real Stripe price under a card promising
 * A$29, and Enterprise sent a tier checkout does not sell, so it failed with a
 * 400 every time. A paying member was also shown a A$29 fallback price, "No
 * saved payment method" and "No billing history available", none of which the
 * page had any way of knowing.
 */

jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));

let searchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({ useSearchParams: () => searchParams }));

const checkout = { mutate: jest.fn(), isPending: false, isSuccess: false };
let authUser: Record<string, unknown> = { region: 'ANZ', subscriptionTier: 'FREE' };
let subscriptionRow: Record<string, unknown> | undefined;
jest.mock('@/lib/hooks', () => ({
  useAuth: () => ({ user: authUser }),
  useSubscription: () => ({ data: subscriptionRow }),
  useCancelSubscription: () => ({ mutate: jest.fn(), isPending: false }),
  useManageBilling: () => ({ mutate: jest.fn(), isPending: false }),
  useCreateCheckout: () => checkout,
  usePaymentMethods: () => ({ data: [], isLoading: false, isError: false }),
}));

import BillingSettingsPage from './page';
import { api } from '@/lib/api';

const http = api as unknown as { get: jest.Mock };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BillingSettingsPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  searchParams = new URLSearchParams();
  authUser = { region: 'ANZ', subscriptionTier: 'FREE' };
  subscriptionRow = undefined;
  http.get.mockResolvedValue({
    data: {
      data: {
        currency: 'AUD',
        trialDays: 14,
        plans: [
          { tier: 'PREMIUM_CAREER', available: true, currency: 'AUD', unitAmount: 999, amount: 9.99, interval: 'month', intervalCount: 1 },
        ],
      },
    },
  });
});

it('prices Pro from Stripe and upgrades to the tier checkout sells', async () => {
  renderPage();

  expect(await screen.findByText(/9\.99/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Upgrade' }));
  expect(checkout.mutate).toHaveBeenCalledWith('PREMIUM_CAREER');

  const text = document.body.textContent ?? '';
  expect(text).not.toMatch(/29/);
  expect(text).not.toMatch(/\$99/);
});

it('offers no Enterprise checkout, only a conversation', async () => {
  renderPage();
  await screen.findByText(/9\.99/);

  // One Upgrade button, for Pro. Enterprise is a link to talk to someone.
  expect(screen.getAllByRole('button', { name: 'Upgrade' })).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Talk to us' })).toHaveAttribute('href', '/contact-sales');
});

it('shows a paying member what Stripe reported, not an invented A$29', async () => {
  authUser = { region: 'ANZ', subscriptionTier: 'PREMIUM_CAREER' };
  subscriptionRow = { tier: 'PREMIUM_CAREER', status: 'ACTIVE', amount: '9.99', currency: 'AUD', interval: 'month', currentPeriodEnd: null };

  renderPage();

  expect(await screen.findByText(/9\.99\/month/)).toBeInTheDocument();
  expect(screen.queryByText('No saved payment method')).not.toBeInTheDocument();
  expect(screen.queryByText('No billing history available')).not.toBeInTheDocument();
  expect(document.body.textContent ?? '').not.toMatch(/29/);
});

it('says nothing was charged when she comes back from a cancelled checkout', async () => {
  searchParams = new URLSearchParams('checkout=cancelled');

  renderPage();

  expect(await screen.findByText('Checkout was cancelled. Nothing was charged.')).toBeInTheDocument();
});
