import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * Like the report form, the appeal form can be open on a screen someone else
 * can see, and it had no way off the page. It carries the same quick exit as the
 * safety pages now. What the form sends and shows is covered with the form.
 */

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
jest.mock('@/lib/hooks', () => ({ useAuthStore: () => ({ isAuthenticated: false, isLoading: false }) }));
jest.mock('@/lib/api', () => ({ api: { post: jest.fn() }, dvSafeApi: { getSettings: jest.fn() } }));
// Reads the online-safety regimes over the network; not what this is about.
jest.mock('@/components/compliance/OnlineSafetyNotice', () => ({ __esModule: true, default: () => null }));

import AppealPage from './page';
import { resetFloatingExitClaims } from '../../dashboard/safety/QuickExit';

function inQueryClient(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  act(() => resetFloatingExitClaims());
});

describe('the appeal page', () => {
  it('has a quick exit beside the form', () => {
    render(inQueryClient(<AppealPage />));

    expect(screen.getByRole('button', { name: /quick exit/i })).toBeInTheDocument();
  });

  // A member whose account is closed cannot sign in, so this page is where she
  // may be when she needs a number to ring, and the button is not for members only.
  it('has Emergency help beside it, for someone who is not signed in', () => {
    render(inQueryClient(<AppealPage />));

    expect(screen.getByRole('button', { name: /emergency help/i })).toBeInTheDocument();
  });
});
