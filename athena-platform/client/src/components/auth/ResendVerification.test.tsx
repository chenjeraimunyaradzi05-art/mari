import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

/**
 * A new confirmation link, from the places a member can be stuck without one.
 * With the address she already typed (the sign-in page) it is a button, and
 * not a form, because it sits inside the sign-in form. Without one (the
 * expired-link page) it asks for the address. Both go to the route that answers
 * the same for every address, say a failure as a failure, and hold the button
 * for a while after a send.
 */

const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({ api: { post: (...args: unknown[]) => mockPost(...args) } }));

import { ResendVerification, isUnverifiedEmailRefusal } from './ResendVerification';
import { RESEND_COOLDOWN_SECONDS } from './CheckYourEmail';

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('isUnverifiedEmailRefusal', () => {
  it('matches the sentence the server sends at sign-in, and nothing else', () => {
    // Pinned on the server by tests/integration/auth-recovery.test.ts and src/routes/__tests__/auth.account-lock.test.ts.
    expect(isUnverifiedEmailRefusal('Please verify your email before signing in.')).toBe(true);
    expect(isUnverifiedEmailRefusal('Invalid email or password')).toBe(false);
    expect(
      isUnverifiedEmailRefusal('This account has been suspended. If you believe this is a mistake, you can appeal from the sign-in page.')
    ).toBe(false);
    expect(isUnverifiedEmailRefusal('This account is locked. You locked it to keep it safe.')).toBe(false);
    expect(isUnverifiedEmailRefusal(undefined)).toBe(false);
  });
});

describe('ResendVerification with the address she typed', () => {
  it('is a button and not a form, so it can sit inside the sign-in form', () => {
    const { container } = render(<ResendVerification email="her@example.com" />);

    expect(container.querySelector('form')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send me a new link' })).toHaveAttribute('type', 'button');
    // The address is not asked for again.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('sends to that address, says only that a link may be on its way, and holds the button for a while', async () => {
    jest.useFakeTimers();
    mockPost.mockResolvedValue({ data: { success: true } });
    render(<ResendVerification email="her@example.com" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send me a new link' }));
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/resend-verification', { email: 'her@example.com' });
    expect(screen.getByRole('status')).toHaveTextContent(/if that address has an account waiting to be confirmed, a new link is on its way/i);
    expect(screen.getByRole('button', { name: `Send it again in ${RESEND_COOLDOWN_SECONDS}s` })).toBeDisabled();

    for (let second = 0; second < RESEND_COOLDOWN_SECONDS; second += 1) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(screen.getByRole('button', { name: 'Send me a new link' })).toBeEnabled();
  });

  it('does not send twice while the first is on its way', async () => {
    let finish: (value: unknown) => void = () => undefined;
    mockPost.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<ResendVerification email="her@example.com" />);

    fireEvent.click(screen.getByRole('button', { name: 'Send me a new link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sending...' }));
    await act(async () => finish({ data: {} }));

    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('says so when it could not send, instead of claiming a link is on its way', async () => {
    mockPost.mockRejectedValue(new Error('network'));
    render(<ResendVerification email="her@example.com" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send me a new link' }));
    });

    expect(screen.getByRole('status')).toHaveTextContent(/could not send another just now/i);
    expect(screen.getByRole('status')).not.toHaveTextContent(/on its way/i);
    // And she can try again at once: nothing was sent, so nothing is held.
    expect(screen.getByRole('button', { name: 'Send me a new link' })).toBeEnabled();
  });

  it('forgets what it said about one address when she is shown another', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const { rerender } = render(<ResendVerification email="her@example.com" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send me a new link' }));
    });
    expect(screen.getByRole('status')).toHaveTextContent(/on its way/i);

    rerender(<ResendVerification email="someone.else@example.com" />);

    expect(screen.getByRole('status')).toHaveTextContent('');
    expect(screen.getByRole('button', { name: 'Send me a new link' })).toBeEnabled();
  });

  it('has a tap target a thumb can hit', () => {
    render(<ResendVerification email="her@example.com" />);
    expect(screen.getByRole('button', { name: 'Send me a new link' }).className).toMatch(/min-h-\[44px\]/);
  });
});

describe('ResendVerification without an address (the expired-link page)', () => {
  it('asks for the address and sends to what she types', async () => {
    mockPost.mockResolvedValue({ data: {} });
    render(<ResendVerification />);

    expect(screen.getByRole('button', { name: 'Resend' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: '  her@example.com ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resend' }));
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/resend-verification', { email: 'her@example.com' });
    expect(screen.getByRole('status')).toHaveTextContent(/on its way/i);
  });
});
