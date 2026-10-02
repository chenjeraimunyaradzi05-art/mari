import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

/**
 * A creator from before the Creator Terms Addendum existed is asked to accept
 * it at her next withdrawal, not silently treated as having agreed. The server
 * refuses the payout with CREATOR_TERMS_REQUIRED and says where to go; the
 * wallet shows that, with the link, instead of a toast that disappears.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/lib/hooks', () => ({ useAuth: () => ({ user: { id: 'creator-1' } }) }));

import toast from 'react-hot-toast';
import CreatorDashboardPage from './page';
import { api } from '@/lib/api';
import { MINIMUM_PAYOUT_AUD } from '@/lib/pricing';

const apiMock = api as unknown as { get: jest.Mock; post: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/creator/analytics') {
      return { data: { data: { summary: {}, profile: { totalEarnings: MINIMUM_PAYOUT_AUD * 100, pendingPayout: MINIMUM_PAYOUT_AUD * 100 }, topPosts: [] } } };
    }
    if (url === '/creator/profile') return { data: { data: { followerCount: 3, payoutHold: false } } };
    return { data: { data: [] } };
  });
});

describe('a payout refused until the addendum is accepted', () => {
  it('shows the server’s words and the link to accept it, beside the button, and keeps her balance as it was', async () => {
    apiMock.post.mockRejectedValue({
      response: {
        status: 403,
        data: {
          error: 'Please read and accept the Creator Terms Addendum before you are paid. It takes a minute, and your earnings are safe while you do.',
          code: 'CREATOR_TERMS_REQUIRED',
          version: '2026-10-01',
          setup: '/creator-terms',
        },
      },
    });
    render(<CreatorDashboardPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Request payout/ }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Please read and accept the Creator Terms Addendum before you are paid');
    expect(screen.getByRole('link', { name: 'Read and accept it' })).toHaveAttribute('href', '/creator-terms');
    expect(toast.error).not.toHaveBeenCalled();
    // Nothing was paid, so nothing is subtracted from what she can withdraw.
    expect(screen.getAllByText(`$${MINIMUM_PAYOUT_AUD}.00`).length).toBeGreaterThan(0);
  });

  it('still reports any other refusal as a toast, in the server’s words', async () => {
    apiMock.post.mockRejectedValue({ response: { status: 409, data: { message: 'Withdrawals are paused while a card payment is looked at.' } } });
    render(<CreatorDashboardPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Request payout/ }));

    await screen.findByRole('button', { name: /Request payout/ });
    expect(toast.error).toHaveBeenCalledWith('Withdrawals are paused while a card payment is looked at.');
    expect(screen.queryByRole('link', { name: 'Read and accept it' })).not.toBeInTheDocument();
  });
});
