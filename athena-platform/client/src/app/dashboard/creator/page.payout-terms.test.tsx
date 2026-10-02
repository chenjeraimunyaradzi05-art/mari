import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * What the wallet says about being paid. It used to promise "3-5 business days",
 * a figure nothing in the platform produces (the money goes to the creator's
 * Stripe account at once and Stripe pays her bank on its own schedule), and it
 * said only that gifts keep "most" of their value. Beside the button that moves
 * the money it now says what she keeps, that ATHENA takes nothing more when she
 * withdraws, and the rules, with the figures the server and the Terms use.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/lib/hooks', () => ({ useAuth: () => ({ user: { id: 'creator-1' } }) }));

import toast from 'react-hot-toast';
import CreatorDashboardPage from './page';
import { api } from '@/lib/api';
import { CREATOR_SHARE_RANGE_PERCENT, MINIMUM_PAYOUT_AUD } from '@/lib/pricing';

const apiMock = api as unknown as { get: jest.Mock; post: jest.Mock };

/** `points` are gift points, a cent each. */
function answer(points: number, profile: Record<string, unknown> = {}) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/creator/analytics') {
      return { data: { data: { summary: {}, profile: { totalEarnings: points, pendingPayout: points }, topPosts: [] } } };
    }
    if (url === '/creator/profile') return { data: { data: { followerCount: 3, payoutHold: false, ...profile } } };
    return { data: { data: [] } };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('the wallet, beside the payout button', () => {
  it('says what she keeps of each gift at her tier, that ATHENA takes nothing more at withdrawal, and when she is paid', async () => {
    answer(MINIMUM_PAYOUT_AUD * 100, { tier: { name: 'Rising', revShare: 75 } });
    render(<CreatorDashboardPage />);

    const note = await screen.findByText(/You keep 75% of each gift at Rising tier/);
    expect(note.textContent).toMatch(/ATHENA takes no fee when you withdraw/);
    expect(note.textContent).toMatch(/Australian dollars/);
    expect(note.textContent).toMatch(/only made when you ask/);
    expect(note.textContent).toMatch(/There is no other minimum or waiting period/);
  });

  it('gives the range the tiers pay, not a share it was not told, when the server did not name her tier', async () => {
    answer(MINIMUM_PAYOUT_AUD * 100);
    render(<CreatorDashboardPage />);

    const note = await screen.findByText(/of each gift, by creator tier/);
    expect(note.textContent).toContain(`${CREATOR_SHARE_RANGE_PERCENT.min}% to ${CREATOR_SHARE_RANGE_PERCENT.max}%`);
    expect(note.textContent).not.toMatch(/at .* tier\./);
  });

  it('turns the button off below the minimum and says what the minimum is and that the balance carries over', async () => {
    answer(MINIMUM_PAYOUT_AUD * 100 - 100);
    render(<CreatorDashboardPage />);

    expect(await screen.findByRole('button', { name: /Request payout/ })).toBeDisabled();
    expect(screen.getByText(new RegExp(`once your balance reaches A\\$${MINIMUM_PAYOUT_AUD}\\. Until then it carries over`))).toBeInTheDocument();
  });

  it('offers the button at the minimum, and says Stripe pays the bank on its own schedule rather than naming days', async () => {
    answer(MINIMUM_PAYOUT_AUD * 100);
    render(<CreatorDashboardPage />);

    expect(await screen.findByRole('button', { name: /Request payout/ })).toBeEnabled();
    expect(screen.getByText('Stripe pays it into your bank on its own schedule.')).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(/business days/);
  });

  it('does not promise a number of days when the payout has been requested', async () => {
    answer(MINIMUM_PAYOUT_AUD * 100);
    apiMock.post.mockResolvedValue({ data: { data: { amount: MINIMUM_PAYOUT_AUD } } });
    render(<CreatorDashboardPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Request payout/ }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    const message = (toast.success as jest.Mock).mock.calls[0][0] as string;
    expect(message).toMatch(/Stripe then pays your bank on its own schedule/);
    expect(message).not.toMatch(/business days/);
  });
});
