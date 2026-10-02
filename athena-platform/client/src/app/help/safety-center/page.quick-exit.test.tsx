import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * The help centre's Safety Center page is public, and reads as the page for a woman
 * who is afraid of someone. It had no way off it. It carries the quick exit now,
 * and says plainly what a block and a report do and do not tell the other person.
 */

jest.mock('@/lib/hooks', () => ({ useAuthStore: () => ({ isAuthenticated: false, isLoading: false }) }));
jest.mock('@/lib/api', () => ({ dvSafeApi: { getSettings: jest.fn() } }));

import SafetyCenterPage from './page';
import { resetFloatingExitClaims } from '../../dashboard/safety/QuickExit';

function inQueryClient(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  act(() => resetFloatingExitClaims());
});

describe('the help centre Safety Center', () => {
  it('has a quick exit, for a visitor who is not signed in', () => {
    render(inQueryClient(<SafetyCenterPage />));

    expect(screen.getByRole('button', { name: /quick exit/i })).toBeInTheDocument();
  });

  it('says that a report is never traced to her and a block is never announced, and that the account-standing measure is staff-only', () => {
    render(inQueryClient(<SafetyCenterPage />));

    expect(screen.getByText(/never tell the person you reported that it was you/i)).toBeInTheDocument();
    expect(screen.getByText(/only our staff see/i)).toBeInTheDocument();
    expect(screen.getByText(/never restricts anyone by itself/i)).toBeInTheDocument();
  });
});
