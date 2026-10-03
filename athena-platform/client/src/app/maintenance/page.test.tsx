import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * The maintenance page is where someone who is not safe lands while ATHENA is
 * closed. It must carry the numbers as plain call links and a way off the
 * page without asking the (closed) server for either.
 */

jest.mock('@/lib/hooks', () => ({
  useAuthStore: () => ({ isAuthenticated: false, isLoading: false }),
}));

const getSettings = jest.fn();
jest.mock('@/lib/api', () => ({ dvSafeApi: { getSettings: () => getSettings() } }));

import MaintenancePage from './page';
import { resetFloatingExitClaims } from '../dashboard/safety/QuickExit';

function withQueries(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  getSettings.mockReset();
  act(() => resetFloatingExitClaims());
});

describe('the maintenance page', () => {
  it('offers 000, 1800RESPECT and Lifeline as call links', () => {
    render(withQueries(<MaintenancePage />));

    expect(screen.getByRole('link', { name: /police, fire and ambulance/i })).toHaveAttribute('href', 'tel:000');
    expect(screen.getByRole('link', { name: /1800respect/i })).toHaveAttribute('href', 'tel:1800737732');
    expect(screen.getByRole('link', { name: /lifeline/i })).toHaveAttribute('href', 'tel:131114');
  });

  it('has a quick exit and does not need the server to draw it', () => {
    render(withQueries(<MaintenancePage />));

    expect(screen.getByRole('button', { name: /quick exit/i })).toBeInTheDocument();
    // Signed out, so the exit address comes from the built-in default and the
    // settings call is never made.
    expect(getSettings).not.toHaveBeenCalled();
  });

  it('points to the Safety Centre, which stays open during maintenance', () => {
    render(withQueries(<MaintenancePage />));

    expect(screen.getByRole('link', { name: /safety centre/i })).toHaveAttribute('href', '/help/safety-center');
  });
});
