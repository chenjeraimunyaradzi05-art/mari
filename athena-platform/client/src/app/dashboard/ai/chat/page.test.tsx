import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import AIChatPage from './page';

/**
 * What a woman in crisis sees on this page.
 *
 * The chat used to carry no disclaimer anywhere and no route to help: a member
 * who typed about self-harm into the box the homepage advertises as "Ask ATHENA
 * AI" got an ordinary career answer. The server now answers that message itself
 * with the crisis lines; these are the guards on the page rendering them as
 * something she can press, and on the disclaimer being on screen before she
 * types a word rather than in a footer she will never reach.
 */

jest.mock('@/lib/hooks', () => ({
  useAIChat: jest.fn(),
  useAIChatUsage: jest.fn(),
}));

import { useAIChat, useAIChatUsage } from '@/lib/hooks';

const mockedChat = useAIChat as unknown as jest.Mock;
const mockedUsage = useAIChatUsage as unknown as jest.Mock;

const mutateAsync = jest.fn();

/** The crisis payload POST /ai/chat returns, lines and all. */
const CRISIS_REPLY = {
  response: 'Thank you for telling me this. I am an AI assistant, not a counsellor.',
  crisis: {
    flagged: true,
    kind: 'self_harm',
    lines: [
      { key: 'lifeline', name: 'Lifeline', phone: '13 11 14', url: 'https://www.lifeline.org.au', when: '24/7', who: 'Anyone in crisis' },
      { key: 'emergency', name: 'Emergency', phone: '000', url: 'https://www.triplezero.gov.au', when: '24/7', who: 'Immediate danger' },
      { key: '1800respect', name: '1800RESPECT', phone: '1800 737 732', url: 'https://www.1800respect.org.au', when: '24/7', who: 'Family violence' },
    ],
  },
  disclaimer: 'ATHENA AI is an automated assistant, not a counsellor, doctor, lawyer or financial adviser.',
};

describe('AI chat safety on the page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedChat.mockReturnValue({ mutateAsync, isPending: false });
    mockedUsage.mockReturnValue({ data: { tier: 'PREMIUM', unlimited: true, usage: null } });
  });

  it('never offers "unlimited" chat, and offers a paying member no upgrade at all', () => {
    // Premium has a daily window now; it was never unlimited, because the
    // per-minute limiter always applied.
    mockedUsage.mockReturnValue({
      data: {
        tier: 'FREE',
        premium: false,
        premiumLimit: 200,
        unlimited: false,
        usage: { limit: 20, remaining: 0, resetIn: 3600, windowSeconds: 86400 },
      },
    });
    const { unmount } = render(<AIChatPage />);
    expect(screen.queryByText(/unlimited/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ATHENA Pro raises the limit to 200/ })).toBeInTheDocument();
    unmount();

    mockedUsage.mockReturnValue({
      data: {
        tier: 'PREMIUM_CAREER',
        premium: true,
        premiumLimit: null,
        unlimited: false,
        usage: { limit: 200, remaining: 0, resetIn: 3600, windowSeconds: 86400 },
      },
    });
    render(<AIChatPage />);
    expect(screen.getByText(/That is all 200 messages today/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ATHENA Pro/ })).not.toBeInTheDocument();
  });

  it('shows the disclaimer and the numbers before she has typed anything', () => {
    render(<AIChatPage />);

    expect(
      screen.getByText(/not a counsellor, doctor, lawyer or financial adviser/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Emergency 000/ })).toHaveAttribute('href', 'tel:000');
    expect(screen.getByRole('link', { name: /Lifeline 13 11 14/ })).toHaveAttribute('href', 'tel:131114');
    expect(screen.getByRole('link', { name: /1800RESPECT 1800 737 732/ })).toHaveAttribute(
      'href',
      'tel:1800737732'
    );
  });

  it('renders a crisis reply as numbers she can press', async () => {
    mutateAsync.mockResolvedValue(CRISIS_REPLY);
    render(<AIChatPage />);

    fireEvent.change(screen.getByLabelText('Your message'), {
      target: { value: 'I cannot go on' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText(/not a counsellor/i)).toBeInTheDocument();
    // Three call links in the reply itself, on top of the three standing ones
    // under the composer.
    expect(screen.getAllByRole('link', { name: /Lifeline/ }).length).toBeGreaterThan(1);
    const inReply = screen.getAllByRole('link', { name: /1800RESPECT/ });
    expect(inReply.some((link) => link.getAttribute('href') === 'tel:1800737732')).toBe(true);
  });

  it('leaves an ordinary answer as an ordinary answer', async () => {
    mutateAsync.mockResolvedValue({
      response: 'Open with the outcome, then the numbers behind it.',
      crisis: { flagged: false },
      disclaimer: 'ATHENA AI is an automated assistant.',
    });
    render(<AIChatPage />);

    fireEvent.change(screen.getByLabelText('Your message'), {
      target: { value: 'How do I open a cover letter?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(
      await screen.findByText('Open with the outcome, then the numbers behind it.')
    ).toBeInTheDocument();
    // Only the standing three under the composer: no crisis card was drawn.
    expect(screen.getAllByRole('link', { name: /Lifeline/ })).toHaveLength(1);
  });
});
