import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The earnings screen's Payments and Statement tabs. They replace a date-range
 * picker hard-set to thirty days and disabled, an Export button that exported
 * nothing, and a card that said tax documents were not connected. Held here:
 * the range reaches the server as Queensland days, the statement shows the
 * year's figures as the server counted them, and the CSV is the server's file.
 */

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
  connectApi: {
    getEarnings: jest.fn(),
    getPayoutMethods: jest.fn(),
    getAccount: jest.fn(),
    setDefaultPayoutMethod: jest.fn(),
    requestPayout: jest.fn(),
    createAccount: jest.fn(),
  },
  mentorApi: { enable: jest.fn(), onboard: jest.fn(), getStripeLoginLink: jest.fn() },
}));
jest.mock('@/lib/download', () => ({ downloadBlob: jest.fn() }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }) }));

import { EarningsDashboard } from '../EarningsDashboard';
import { api, connectApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

const http = api as unknown as { get: jest.Mock };
const connect = connectApi as unknown as Record<string, jest.Mock>;

const statement = {
  financialYear: 2026,
  label: '1 July 2025 to 30 June 2026',
  generatedAt: '2026-09-26T00:00:00.000Z',
  lines: [
    {
      id: 'escrow-a',
      releasedAt: '2026-06-30T13:00:00.000Z',
      description: 'Logo design',
      kind: 'Marketplace order',
      currency: 'AUD',
      gross: 20000,
      fee: 3000,
      net: 17000,
      status: 'RELEASED',
    },
  ],
  totals: [{ currency: 'AUD', count: 1, gross: 20000, fee: 3000, net: 17000, refundedCount: 0, refundedNet: 0 }],
  availableYears: [2027, 2026],
};

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EarningsDashboard />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  connect.getEarnings.mockResolvedValue({
    data: {
      data: {
        currency: 'AUD',
        totalEarnings: 17000,
        pendingPayouts: 0,
        availableBalance: 17000,
        balanceUnavailable: false,
        byCurrency: [{ currency: 'AUD', totalEarnings: 17000, pendingPayouts: 0, completedCount: 1 }],
        monthly: [],
        recentTransactions: [],
      },
    },
  });
  connect.getPayoutMethods.mockResolvedValue({ data: { data: [] } });
  connect.getAccount.mockResolvedValue({ data: { data: { isOnboarded: true, payoutsEnabled: true, chargesEnabled: true } } });
  http.get.mockImplementation(async (url: string, config?: { params?: Record<string, unknown>; responseType?: string }) => {
    if (url === '/connect/earnings/transactions') return { data: { data: { transactions: [], nextCursor: null } } };
    if (url === '/connect/earnings/statement' && config?.responseType === 'blob') return { data: new Blob(['csv']) };
    if (url === '/connect/earnings/statement') return { data: { data: statement } };
    throw new Error(`unexpected ${url}`);
  });
});

it('asks for the payments in the range she picks, as Queensland days', async () => {
  renderScreen();

  const range = await screen.findByLabelText('Showing');
  fireEvent.change(range, { target: { value: '30d' } });

  await waitFor(() =>
    expect(http.get).toHaveBeenCalledWith(
      '/connect/earnings/transactions',
      expect.objectContaining({
        params: expect.objectContaining({ from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), to: expect.any(String) }),
      })
    )
  );
  expect(await screen.findByText('Nobody has paid you through ATHENA in the last 30 days.')).toBeInTheDocument();
});

it('shows the financial year as the server counted it and downloads the server’s CSV', async () => {
  renderScreen();

  fireEvent.click(await screen.findByRole('button', { name: 'Statement' }));

  expect(await screen.findByText('1 July 2025 to 30 June 2026')).toBeInTheDocument();
  expect(screen.getByText('Logo design')).toBeInTheDocument();
  expect(screen.getByText(/not a tax invoice and\s+not tax advice/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

  await waitFor(() =>
    expect(downloadBlob).toHaveBeenCalledWith('athena-earnings-FY2025-26.csv', expect.any(Blob))
  );
  expect(http.get).toHaveBeenCalledWith('/connect/earnings/statement', {
    params: { fy: 2026, format: 'csv' },
    responseType: 'blob',
  });
});

it('says the statement failed to load rather than showing an empty year', async () => {
  http.get.mockImplementation(async (url: string) => {
    if (url === '/connect/earnings/transactions') return { data: { data: { transactions: [], nextCursor: null } } };
    throw Object.assign(new Error('boom'), { response: { status: 500 } });
  });

  renderScreen();
  fireEvent.click(await screen.findByRole('button', { name: 'Statement' }));

  expect(await screen.findByText('We could not load your statement.')).toBeInTheDocument();
  expect(screen.queryByText(/Nothing was released to you/)).not.toBeInTheDocument();
});
