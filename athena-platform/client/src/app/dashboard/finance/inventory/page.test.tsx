import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

/**
 * Every load error on this page used to be caught and turned into four empty
 * lists, so a 403, an expired session or a dropped connection looked exactly
 * like a business with no stock. These hold the difference in place.
 */

jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));

import InventoryPage from './page';
import { api } from '@/lib/api';

const http = api as unknown as { get: jest.Mock };

beforeEach(() => {
  http.get.mockReset();
});

function failInventoryWith(status: number) {
  http.get.mockImplementation(async (url: string) => {
    if (url === '/employer/organizations') return { data: { data: [] } };
    throw Object.assign(new Error('request failed'), { response: { status } });
  });
}

it('says she has no access, rather than that she has no stock', async () => {
  failInventoryWith(403);

  render(<InventoryPage />);

  expect(await screen.findByText('You do not have access to this stock.')).toBeInTheDocument();
  expect(screen.queryByText('No items added yet.')).not.toBeInTheDocument();
  expect(screen.queryByText('No stock movements yet.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});

it('says a failed connection is a failure', async () => {
  failInventoryWith(500);

  render(<InventoryPage />);

  expect(await screen.findByText(/could not load your inventory/i)).toBeInTheDocument();
  expect(screen.getAllByText('Not loaded. See the message above.').length).toBeGreaterThan(0);
});

it('still says an empty stockroom is empty when the server says so', async () => {
  http.get.mockResolvedValue({ data: { data: [] } });

  render(<InventoryPage />);

  expect(await screen.findByText('No items added yet.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
});
