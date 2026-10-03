import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * Someone filing a report about what is being done to her may be on a screen
 * another person can see. The report page had no way off it; it carries the same
 * quick exit as the safety pages now, beside the form. What the form itself
 * sends and shows is covered with the form.
 */

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
jest.mock('@/lib/hooks', () => ({ useAuthStore: () => ({ isAuthenticated: false, isLoading: false }) }));
jest.mock('@/lib/api', () => ({ api: { post: jest.fn() }, dvSafeApi: { getSettings: jest.fn() } }));
// Reads the online-safety regimes over the network; not what this is about.
jest.mock('@/components/compliance/OnlineSafetyNotice', () => ({ __esModule: true, default: () => null }));

import ReportContentPage from './page';
import { resetFloatingExitClaims } from '../dashboard/safety/QuickExit';

function inQueryClient(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  act(() => resetFloatingExitClaims());
});

describe('the report page', () => {
  it('has a quick exit beside the form', () => {
    render(inQueryClient(<ReportContentPage />));

    expect(screen.getByRole('button', { name: /quick exit/i })).toBeInTheDocument();
  });
});
