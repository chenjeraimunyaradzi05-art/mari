import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The fees page prints what the server charges and nothing else. The figures
 * come from GET /api/fees, which the price book builds, so a change to a fee
 * reaches this page without a copy to update; and when the call fails the page
 * shows no number at all rather than one it made up.
 */

jest.mock('@/lib/api', () => ({ feesApi: { schedule: jest.fn() } }));

import FeesPage from './page';
import { feesApi } from '@/lib/api';

const api = feesApi as unknown as { schedule: jest.Mock };

const schedule = {
  currency: 'AUD',
  gst: { registered: false, statement: 'Prices are in Australian dollars (AUD). ATHENA is not registered for GST, so none is added.' },
  mentoring: { platformPercent: 20 },
  marketplace: { platformPercent: 15 },
  creatorGifts: {
    giftPointValueAud: 0.01,
    minimumPayoutAud: 50,
    tiers: [
      { name: 'Emerging', minFollowers: 0, creatorSharePercent: 70, platformSharePercent: 30 },
      { name: 'Partner', minFollowers: 50000, creatorSharePercent: 85, platformSharePercent: 15 },
    ],
  },
  automotive: { privateSale: 6, dealerSale: 4, workshopJob: 12, inspection: 15 },
  processing: 'Card processing is covered by ATHENA’s share.',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FeesPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('The fees page', () => {
  it('prints each fee the server charges, by flow and by creator tier', async () => {
    api.schedule.mockResolvedValue({ data: { success: true, data: schedule } });
    renderPage();

    expect(await screen.findByText('20%')).toBeInTheDocument();
    expect(screen.getByText(/The mentor is paid the other 80%/)).toBeInTheDocument();
    expect(screen.getByText(/The provider receives the other 85%/)).toBeInTheDocument();

    const partner = screen.getByText('Partner').closest('tr') as HTMLElement;
    expect(partner).toHaveTextContent('from 50,000 followers');
    expect(partner).toHaveTextContent('85%');
    expect(partner).toHaveTextContent('15%');
    expect(screen.getByText('Emerging').closest('tr')).toHaveTextContent('from the first follower');

    expect(screen.getByText(/One gift point is worth \$0\.01/)).toBeInTheDocument();
    expect(screen.getByText(/The minimum payout is \$50/)).toBeInTheDocument();
    expect(screen.getByText(/Private sale:/)).toHaveTextContent('6%');
    expect(screen.getByText(schedule.processing)).toBeInTheDocument();
    expect(screen.getByText(schedule.gst.statement)).toBeInTheDocument();
  });

  it('shows no figure, and says so, when the schedule could not be read', async () => {
    api.schedule.mockRejectedValue(new Error('offline'));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The fee schedule could not be loaded just now');
    expect(document.body.textContent ?? '').not.toMatch(/\d%/);

    api.schedule.mockResolvedValue({ data: { success: true, data: schedule } });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(api.schedule).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('20%')).toBeInTheDocument();
  });
});
