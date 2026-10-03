import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The type picker used to show no price. The fee appeared only on the payment
 * form, at the very last step, after the applicant had chosen a structure, named
 * the business and filled in the details; nothing said what the fee covered or
 * what became of it if the registration was refused. The picker now shows each
 * structure's fee, read from the server's table, and the wording about what it is
 * for.
 */

jest.mock('@/lib/api', () => ({
  formationApi: { fees: jest.fn() },
}));
jest.mock('@/lib/hooks', () => ({
  useCreateFormation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

import NewFormationPage from './page';
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
  gst: { registered: false, statement: 'Prices are in Australian dollars (AUD). ATHENA is not registered for GST, so none is added.' },
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
      <NewFormationPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('The formation type picker', () => {
  it('shows each structure with the fee the server charges for it', async () => {
    fees.mockResolvedValue({ data: { success: true, data: book } });

    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: /Sole Trader/ })).toHaveTextContent('Fee: A$49'));
    expect(screen.getByRole('button', { name: /Partnership/ })).toHaveTextContent('Fee: A$99');
    expect(screen.getByRole('button', { name: /Company/ })).toHaveTextContent('Fee: A$499');
    expect(screen.getByRole('button', { name: /Trust/ })).toHaveTextContent('Fee: A$699');
  });

  it('says what the fee covers, what it does not and how a refusal is refunded, in the server\'s words', async () => {
    fees.mockResolvedValue({ data: { success: true, data: book } });

    renderPage();

    expect(await screen.findByText(book.terms.covers[0])).toBeInTheDocument();
    expect(screen.getByText(book.terms.notCovered[0])).toBeInTheDocument();
    expect(screen.getByText(book.terms.refund[0])).toBeInTheDocument();
    expect(screen.getByText(book.terms.timing)).toBeInTheDocument();
    expect(screen.getByText(book.gst.statement)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ask support/ })).toHaveAttribute('href', '/help');
  });

  it('guesses no price when the fees cannot be loaded, and says the fee is shown before payment', async () => {
    fees.mockRejectedValue(new Error('offline'));

    renderPage();

    await waitFor(() => expect(fees).toHaveBeenCalled());
    const cards = screen.getAllByText('The fee is shown before you pay.');
    expect(cards).toHaveLength(4);
    expect(screen.queryByText(/Fee: /)).not.toBeInTheDocument();
    // And no wording is made up in its place.
    expect(screen.queryByText('What the fee is for')).not.toBeInTheDocument();
  });

  it('repeats the chosen structure\'s fee on the next step, and says when it is paid', async () => {
    fees.mockResolvedValue({ data: { success: true, data: book } });

    renderPage();
    const company = await screen.findByRole('button', { name: /Company/ });
    await waitFor(() => expect(company).toHaveTextContent('A$499'));
    fireEvent.click(company);

    expect(await screen.findByText(/The fee for this structure is A\$499\./)).toBeInTheDocument();
    expect(screen.getByText(/You pay it after you have filled in your details/)).toBeInTheDocument();
  });
});
