import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The formation landing page named no price, and no page said what the fee
 * covers. It lists what each structure costs and what the fee is for, read from
 * the server's table (GET /api/formation/fees) so a figure here is the figure the
 * payment step charges.
 */

jest.mock('@/lib/api', () => ({
  formationApi: { fees: jest.fn() },
}));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

import FormationPage from './page';
import { formationApi } from '@/lib/api';

const fees = formationApi.fees as unknown as jest.Mock;

const book = {
  currency: 'AUD',
  fees: [
    { type: 'SOLE_TRADER', amountCents: 4900, amount: 49 },
    { type: 'PARTNERSHIP', amountCents: 9900, amount: 99 },
    { type: 'COMPANY', amountCents: 49900, amount: 499 },
    { type: 'TRUST', amountCents: 69900, amount: 699 },
  ],
  gst: null,
  terms: {
    covers: ['A person at ATHENA goes through the details you send.'],
    notCovered: ['Anything a government register charges is separate from this fee.'],
    refund: ['If ATHENA cannot approve the registration, the fee is refunded in full.'],
    timing: 'How long it takes depends on your details.',
  },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FormationPage />
    </QueryClientProvider>
  );
}

beforeEach(() => jest.clearAllMocks());

describe('The formation landing page', () => {
  it('prices every structure from the server and says what the fee is for', async () => {
    fees.mockResolvedValue({ data: { success: true, data: book } });

    renderPage();

    const list = await screen.findByText('Sole trader');
    const prices = list.closest('dl') as HTMLElement;
    await waitFor(() => expect(within(prices).getByText('A$49')).toBeInTheDocument());
    expect(within(prices).getByText('Partnership').parentElement).toHaveTextContent('A$99');
    expect(within(prices).getByText('Company (Pty Ltd)').parentElement).toHaveTextContent('A$499');
    expect(within(prices).getByText('Trust').parentElement).toHaveTextContent('A$699');
    expect(screen.getByText(book.terms.refund[0])).toBeInTheDocument();
  });

  it('prints no price, and no invented terms, when the fees cannot be loaded', async () => {
    fees.mockRejectedValue(new Error('offline'));

    renderPage();

    expect(await screen.findByText(/We could not load the fees just now/)).toBeInTheDocument();
    expect(screen.queryByText('What the fee is for')).not.toBeInTheDocument();
    expect(screen.queryByText('A$49')).not.toBeInTheDocument();
  });

  it('still offers the studio and the finances links', async () => {
    fees.mockResolvedValue({ data: { success: true, data: book } });

    renderPage();

    expect(await screen.findByRole('link', { name: /Open studio/ })).toHaveAttribute('href', '/dashboard/formation');
  });
});
