import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * The public Safety page is the one a woman lands on from a search for help, signed
 * out, with nobody to tell her it is safe to be reading. It had no way off it. It
 * carries the quick exit now, and the button works for a visitor with no account.
 */

jest.mock('@/lib/hooks', () => ({ useAuthStore: () => ({ isAuthenticated: false, isLoading: false }) }));
jest.mock('@/lib/api', () => ({ dvSafeApi: { getSettings: jest.fn() } }));

import SafetyPage from './page';
import { resetFloatingExitClaims } from '../dashboard/safety/QuickExit';

function inQueryClient(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  act(() => resetFloatingExitClaims());
});

describe('the public safety page', () => {
  it('has a quick exit, for a visitor who is not signed in', () => {
    render(inQueryClient(<SafetyPage />));

    expect(screen.getByRole('button', { name: /quick exit/i })).toBeInTheDocument();
  });

  it('still tells her who to ring', () => {
    render(inQueryClient(<SafetyPage />));

    expect(screen.getByText(/Australia: 000/)).toBeInTheDocument();
  });
});
