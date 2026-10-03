import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Gift points are bought in Australian dollars, whatever currency a member has
 * chosen to see her own figures in. They used to be charged in that currency, so
 * the amounts on these buttons were in her currency and the charge was too; now
 * the charge is always AUD, so the buttons must say so. A member who has chosen
 * Vietnamese dong would otherwise read "₫5" on a button that charges A$5.
 */

jest.mock('@/lib/api', () => ({
  api: {},
  creatorApi: { purchaseGiftBalance: jest.fn(), confirmGiftPurchase: jest.fn() },
}));

jest.mock('@/lib/strategy-api', () => ({ apiMessage: (_e: unknown, fallback: string) => fallback }));

jest.mock('@/components/payments/PaymentIntentForm', () => ({
  PaymentIntentForm: ({ amountLabel }: { amountLabel: string }) => <div data-testid="card-form">{amountLabel}</div>,
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import { TopUpModal } from './TopUpModal';
import { creatorApi } from '@/lib/api';

const mockedApi = creatorApi as unknown as { purchaseGiftBalance: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.setItem('athena.currency', 'VND');
});

afterEach(() => {
  window.localStorage.removeItem('athena.currency');
});

it('shows every amount in Australian dollars, not in the currency she has chosen elsewhere', () => {
  render(<TopUpModal isOpen onClose={jest.fn()} onTopped={jest.fn()} />);

  const group = screen.getByRole('group', { name: /How much/i });
  const labels = Array.from(group.querySelectorAll('button')).map((button) => button.textContent ?? '');

  expect(labels).toHaveLength(5);
  for (const label of labels) {
    expect(label).toMatch(/\$/);
    expect(label).not.toMatch(/₫|VND/);
  }
  expect(screen.getByRole('button', { name: /Top up .*\$10/ })).toBeInTheDocument();
});

it('says a point costs a cent and is bought in Australian dollars', () => {
  render(<TopUpModal isOpen onClose={jest.fn()} onTopped={jest.fn()} />);

  expect(screen.getByText(/One point costs one cent, and points are bought in Australian dollars/)).toBeInTheDocument();
});

it('asks the server for the amount she chose and shows what it will charge', async () => {
  mockedApi.purchaseGiftBalance.mockResolvedValue({
    data: {
      data: {
        paymentIntentId: 'pi_1',
        clientSecret: 'pi_1_secret',
        amount: 25,
        giftPoints: 2500,
        currency: 'AUD',
      },
    },
  });

  render(<TopUpModal isOpen onClose={jest.fn()} onTopped={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /\$25$/ }));
  fireEvent.click(screen.getByRole('button', { name: /Top up/ }));

  await waitFor(() => expect(mockedApi.purchaseGiftBalance).toHaveBeenCalledWith(25));
  expect(await screen.findByText(/for 2500 points/)).toBeInTheDocument();
  expect(screen.getByTestId('card-form').textContent).toMatch(/\$25/);
  expect(screen.getByTestId('card-form').textContent).not.toMatch(/₫|VND/);
});
