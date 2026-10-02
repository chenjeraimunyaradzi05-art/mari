import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

/**
 * While ATHENA is looking into a card payment connected to the gifts a creator was
 * sent, withdrawals are paused and the balance is not. The wallet says so in
 * plain words instead of offering a button that can only fail, and says nothing
 * about whose payment it was.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/lib/hooks', () => ({ useAuth: () => ({ user: { id: 'creator-1' } }) }));

import CreatorDashboardPage from './page';
import { api } from '@/lib/api';

const apiMock = api as unknown as { get: jest.Mock };

function answer(profile: Record<string, unknown>) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/creator/analytics') {
      // 500,000 points is well past the minimum payout whatever a point is worth.
      return { data: { data: { summary: {}, profile: { totalEarnings: 500_000, pendingPayout: 500_000 }, topPosts: [] } } };
    }
    if (url === '/creator/profile') return { data: { data: { followerCount: 3, ...profile } } };
    return { data: { data: [] } };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('The creator wallet', () => {
  it('offers a withdrawal when nothing is paused', async () => {
    answer({ payoutHold: false });
    render(<CreatorDashboardPage />);

    const button = await screen.findByRole('button', { name: /Request payout/ });
    expect(button).toBeEnabled();
  });

  it('turns the withdrawal off and says why, in plain words, while it is paused', async () => {
    answer({ payoutHold: true });
    render(<CreatorDashboardPage />);

    const button = await screen.findByRole('button', { name: /Request payout/ });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Withdrawals are paused while ATHENA looks into a card payment connected to some of the gifts you were sent/)).toBeInTheDocument();
    expect(screen.getByText(/Your balance is safe and keeps growing/)).toBeInTheDocument();
  });
});
