import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import AIChatPage from '@/app/dashboard/ai/chat/page';

/**
 * A free member is told how many messages she has left before she types, the
 * line follows each reply, and the upgrade is offered only once there are
 * none left. Paid tiers have no cap and see no line.
 */

jest.mock('@/lib/hooks', () => ({
  useAIChat: jest.fn(),
  useAIChatUsage: jest.fn(),
}));

import { useAIChat, useAIChatUsage } from '@/lib/hooks';

const mockedChat = useAIChat as unknown as jest.Mock;
const mockedUsage = useAIChatUsage as unknown as jest.Mock;

const mutateAsync = jest.fn();

const free = (remaining: number) => ({
  data: {
    tier: 'FREE',
    unlimited: false,
    usage: { limit: 20, remaining, resetIn: 3 * 3600 + 20 * 60, windowSeconds: 86400 },
  },
});

describe('AI chat usage line', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedChat.mockReturnValue({ mutateAsync, isPending: false });
    mockedUsage.mockReturnValue(free(12));
  });

  it('tells a free member how many messages are left before she types', () => {
    render(<AIChatPage />);

    expect(screen.getByText(/12 of 20 messages left today, resets in 3h 20m/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /upgrade/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('follows each reply rather than the page load', async () => {
    mutateAsync.mockResolvedValue({
      response: 'Start with the role you want, then work back.',
      usage: { limit: 20, remaining: 11, resetIn: 12000, windowSeconds: 86400 },
    });
    render(<AIChatPage />);

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Where do I start?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Start with the role you want, then work back.')).toBeInTheDocument();
    expect(screen.getByText(/11 of 20 messages left today/)).toBeInTheDocument();
  });

  it('offers the upgrade only once none are left, and stops the composer', () => {
    mockedUsage.mockReturnValue(free(0));
    render(<AIChatPage />);

    expect(screen.getByText(/That is all 20 messages today/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'upgrade for unlimited chat' })).toHaveAttribute('href', '/dashboard/settings/billing');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('shows no line at all for a paid tier', () => {
    mockedUsage.mockReturnValue({ data: { tier: 'PREMIUM', unlimited: true, usage: null } });
    render(<AIChatPage />);

    expect(screen.queryByText(/messages left/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /upgrade/ })).not.toBeInTheDocument();
  });
});
