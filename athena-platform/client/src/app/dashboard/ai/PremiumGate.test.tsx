import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Who sees a premium AI tool.
 *
 * The gate these pages used read `user.subscriptionTier`, which no server
 * response sets, so paying members were shown "Upgrade to Pro" in place of the
 * tool they had paid for. The gate now asks GET /ai/access, and these are the
 * guards on what it does with each answer — including no answer at all, which
 * must never be drawn as "you have not paid".
 */

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

jest.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: { id: 'member-1' }, isAuthenticated: true, isLoading: false }),
}));

import PremiumGate from './PremiumGate';
import { api } from '@/lib/api';

const get = api.get as unknown as jest.Mock;

function renderGate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(
    <PremiumGate featureName="Interview Coach">
      <p>The coach itself</p>
    </PremiumGate>,
    { wrapper }
  );
}

const answer = (data: { premium: boolean; tier: string; status: string | null }) =>
  get.mockResolvedValue({ data: { success: true, data } });

describe('PremiumGate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens the tool for an active ATHENA Pro member', async () => {
    answer({ premium: true, tier: 'PREMIUM_CAREER', status: 'ACTIVE' });
    renderGate();

    expect(await screen.findByText('The coach itself')).toBeInTheDocument();
    expect(screen.queryByText(/part of ATHENA Pro/i)).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/ai/access');
  });

  it('shows a free member what ATHENA Pro opens, and not the tool', async () => {
    answer({ premium: false, tier: 'FREE', status: 'ACTIVE' });
    renderGate();

    expect(await screen.findByText(/Interview Coach is part of ATHENA Pro/)).toBeInTheDocument();
    expect(screen.queryByText('The coach itself')).not.toBeInTheDocument();
  });

  it('tells a member whose subscription has lapsed that it is paused, not that she never paid', async () => {
    answer({ premium: false, tier: 'PREMIUM_CAREER', status: 'PAST_DUE' });
    renderGate();

    expect(await screen.findByText(/Interview Coach is paused/)).toBeInTheDocument();
    expect(screen.getByText(/past due/)).toBeInTheDocument();
    expect(screen.queryByText(/part of ATHENA Pro/i)).not.toBeInTheDocument();
  });

  it('says it could not check, rather than showing an upgrade offer, when the request fails', async () => {
    get.mockRejectedValue(new Error('Network Error'));
    renderGate();

    expect(await screen.findByText(/could not check your plan/i)).toBeInTheDocument();
    expect(screen.queryByText(/part of ATHENA Pro/i)).not.toBeInTheDocument();
    expect(screen.queryByText('The coach itself')).not.toBeInTheDocument();
  });
});
