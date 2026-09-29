import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The holds screen a buyer releases a generic hold from. There was no such
 * screen: nobody could ask her to release a hold made through the generic
 * payment route, and nothing but an admin could move it. What is held here is
 * that she sees where each hold is released from, that release asks her first,
 * and that a failed read is a failure rather than "nothing is held".
 */

jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));

import HoldsPage from './page';
import { api } from '@/lib/api';

const http = api as unknown as { get: jest.Mock; post: jest.Mock };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HoldsPage />
    </QueryClientProvider>
  );
}

const genericHold = {
  id: 'escrow-g',
  paymentIntentId: 'pi_g',
  description: 'Pottery course',
  kind: 'Course',
  amount: 5000,
  currency: 'AUD',
  status: 'AUTHORIZED',
  createdAt: '2026-09-15T00:00:00.000Z',
  lapsesAt: '2026-09-22T00:00:00.000Z',
  payee: 'Rosa N.',
  owner: { kind: 'generic' },
  canRelease: true,
  canCancel: true,
};

const orderHold = {
  ...genericHold,
  id: 'escrow-o',
  paymentIntentId: 'pi_o',
  description: 'Logo design',
  kind: 'Marketplace order',
  payee: 'Studio June',
  owner: { kind: 'flow', flow: 'service_order', href: '/skills-marketplace/orders/order-7', label: 'Open the order' },
  canRelease: false,
  canCancel: false,
};

beforeEach(() => {
  http.get.mockReset();
  http.post.mockReset();
});

it('shows each hold with where it is released from', async () => {
  http.get.mockResolvedValue({ data: { data: [genericHold, orderHold] } });

  renderPage();

  expect(await screen.findByText('Pottery course')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'I received it, release the payment' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Open the order to release or cancel it/ })).toHaveAttribute(
    'href',
    '/skills-marketplace/orders/order-7'
  );
  // Only the generic hold can be moved from here.
  expect(screen.getAllByRole('button', { name: 'Cancel the payment' })).toHaveLength(1);
});

it('asks before releasing, then releases through the capture route', async () => {
  http.get.mockResolvedValue({ data: { data: [genericHold] } });
  http.post.mockResolvedValue({ data: { success: true } });

  renderPage();

  fireEvent.click(await screen.findByRole('button', { name: 'I received it, release the payment' }));
  expect(http.post).not.toHaveBeenCalled();
  expect(screen.getByText(/Only do this if you have received what you paid for/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Yes, release it' }));

  await waitFor(() => expect(http.post).toHaveBeenCalledWith('/connect/escrow/pi_g/capture'));
});

it('says a failed read is a failure, not that nothing is held', async () => {
  http.get.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500 } }));

  renderPage();

  expect(await screen.findByText('Your payments could not be loaded just now.')).toBeInTheDocument();
  expect(screen.queryByText('Nothing is held on your card')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});
