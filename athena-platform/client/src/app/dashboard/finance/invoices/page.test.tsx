import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The invoices page when ATHENA cannot yet put its name to a document.
 *
 * The invoice rows are kept as each payment goes through, but the PDF names
 * ATHENA, and the server refuses to print a company, address or mailbox nobody
 * has confirmed. The list says so (documentsReady), and the page says it in
 * words and holds the downloads instead of letting each one fail.
 */

jest.mock('@/lib/api', () => ({
  invoiceApi: { list: jest.fn(), pdf: jest.fn() },
}));
jest.mock('@/lib/strategy-api', () => ({ apiMessage: (_e: unknown, fallback: string) => fallback }));
jest.mock('@/lib/download', () => ({ downloadBlob: jest.fn() }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: jest.fn() } }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

import InvoicesPage from './page';
import { invoiceApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

const api = invoiceApi as unknown as { list: jest.Mock; pdf: jest.Mock };

const row = {
  id: 'inv-1',
  invoiceNumber: 'INV-202609-00001',
  amount: '29',
  currency: 'AUD',
  status: 'PAID',
  issuedAt: '2026-09-01T00:00:00.000Z',
  paidAt: '2026-09-01T00:00:00.000Z',
  createdAt: '2026-09-01T00:00:00.000Z',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InvoicesPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('InvoicesPage', () => {
  it('downloads normally when the server can produce the document', async () => {
    api.list.mockResolvedValue({ data: { success: true, data: [row], documentsReady: true } });
    api.pdf.mockResolvedValue({ data: new Blob(['%PDF']) });

    renderPage();
    const button = await screen.findByRole('button', { name: /Download INV-202609-00001/ });

    expect(button).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(button);
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith('INV-202609-00001.pdf', expect.anything()));
  });

  it('says the invoices are safe and holds the downloads when the server cannot produce a document yet', async () => {
    api.list.mockResolvedValue({ data: { success: true, data: [row], documentsReady: false } });

    renderPage();
    const button = await screen.findByRole('button', { name: /Download INV-202609-00001/ });

    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/invoices are safe and listed here/i);
    expect(screen.getByRole('status')).toHaveTextContent(/downloads are paused for now/i);
    // The invoice itself is still there to see.
    expect(screen.getByText('INV-202609-00001')).toBeInTheDocument();
    fireEvent.click(button);
    expect(api.pdf).not.toHaveBeenCalled();
  });

  it('treats a server that does not say as one that never refused the download', async () => {
    api.list.mockResolvedValue({ data: { success: true, data: [row] } });

    renderPage();

    expect(await screen.findByRole('button', { name: /Download INV-202609-00001/ })).toBeEnabled();
  });
});
