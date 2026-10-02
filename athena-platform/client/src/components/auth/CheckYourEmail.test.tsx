import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

/**
 * The panel a new member sees after the sign-up form is accepted. It has to be
 * true for a taken address as well as a free one, because the server answers
 * both the same way: it may say an email is on its way, never that an account
 * was made. Resend goes through the same route as the expired-link form.
 */

const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({ api: { post: (...args: unknown[]) => mockPost(...args) } }));

import { CheckYourEmail, RESEND_COOLDOWN_SECONDS } from './CheckYourEmail';

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('CheckYourEmail', () => {
  it('asks her to check her email without saying whether an account was created', () => {
    render(<CheckYourEmail email="her@example.com" onStartAgain={jest.fn()} />);

    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    expect(text).toContain('her@example.com');
    expect(text).toMatch(/if .*can be used for a new account/i);
    expect(text).not.toMatch(/account (has been|was) created|welcome/i);
  });

  it('puts focus on the heading so a screen reader hears the news', () => {
    render(<CheckYourEmail email="her@example.com" onStartAgain={jest.fn()} />);

    expect(screen.getByRole('heading', { name: 'Check your email' })).toHaveFocus();
  });

  it('resends to the address she gave, says only that a link may be on its way, and holds the button for a while', async () => {
    jest.useFakeTimers();
    mockPost.mockResolvedValue({ data: { success: true } });
    render(<CheckYourEmail email="her@example.com" onStartAgain={jest.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send it again' }));
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/resend-verification', { email: 'her@example.com' });
    expect(screen.getByRole('status')).toHaveTextContent(/if this address can be used, a new link is on its way/i);
    expect(screen.getByRole('button', { name: `Send it again in ${RESEND_COOLDOWN_SECONDS}s` })).toBeDisabled();

    for (let second = 0; second < RESEND_COOLDOWN_SECONDS; second += 1) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(screen.getByRole('button', { name: 'Send it again' })).toBeEnabled();
  });

  it('says so, and lets her try again, when nothing could be sent', async () => {
    mockPost.mockRejectedValue({ response: { status: 429 } });
    render(<CheckYourEmail email="her@example.com" onStartAgain={jest.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send it again' }));
    });

    expect(screen.getByRole('status')).toHaveTextContent(/could not send another/i);
    expect(screen.getByRole('button', { name: 'Send it again' })).toBeEnabled();
  });

  it('goes to sign in where she was heading, and back to the form for a wrong address', () => {
    const onStartAgain = jest.fn();
    render(<CheckYourEmail email="her@example.com" signInHref="/login?redirect=%2Fjobs" onStartAgain={onStartAgain} />);

    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login?redirect=%2Fjobs');
    fireEvent.click(screen.getByRole('button', { name: /start again/i }));
    expect(onStartAgain).toHaveBeenCalledTimes(1);
  });
});
