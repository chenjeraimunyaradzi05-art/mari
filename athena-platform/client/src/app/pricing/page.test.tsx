import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The public pricing page used to print its own prices: Pro at A$29 a month,
 * or A$290 "billed annually" with the toggle defaulting to yearly and a "Save
 * 16%" badge, and Enterprise at A$99. Checkout charged none of those — Pro
 * starts a monthly PREMIUM_CAREER checkout at its real Stripe price, and no
 * yearly price exists. The page now shows the price the server reads from
 * Stripe, or says it does not know it.
 */

jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/store', () => ({ useAuthStore: () => ({ user: null }) }));

import PricingPage from './page';
import { api } from '@/lib/api';

const http = api as unknown as { get: jest.Mock };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PricingPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  http.get.mockReset();
});

it('shows Pro at the price Stripe will charge, monthly, and nothing yearly', async () => {
  http.get.mockResolvedValue({
    data: {
      data: {
        currency: 'AUD',
        trialDays: 14,
        plans: [
          {
            tier: 'PREMIUM_CAREER',
            available: true,
            currency: 'AUD',
            unitAmount: 999,
            amount: 9.99,
            interval: 'month',
            intervalCount: 1,
          },
        ],
      },
    },
  });

  renderPage();

  expect(await screen.findByText(/9\.99/)).toBeInTheDocument();
  expect(screen.getByText('/month')).toBeInTheDocument();
  expect(http.get).toHaveBeenCalledWith('/subscriptions/plans');

  const text = document.body.textContent ?? '';
  expect(text).not.toMatch(/29/);
  expect(text).not.toMatch(/billed annually/i);
  expect(text).not.toMatch(/Save \d+%/);
  expect(text).not.toMatch(/\$99/);
});

it('says it could not load the price rather than printing one', async () => {
  http.get.mockRejectedValue(new Error('network down'));

  renderPage();

  expect(await screen.findByText(/could not load the price just now/i)).toBeInTheDocument();
  expect(document.body.textContent ?? '').not.toMatch(/\$\d/);
});

it('shows no price for a Pro tier that is not set up on this deployment', async () => {
  http.get.mockResolvedValue({
    data: { data: { currency: 'AUD', trialDays: 14, plans: [{ tier: 'PREMIUM_CAREER', available: false }] } },
  });

  renderPage();

  expect(await screen.findByText(/price is not available right now/i)).toBeInTheDocument();
});
