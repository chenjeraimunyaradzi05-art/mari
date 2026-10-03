import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

/**
 * The unlock page. Like the lock page it does nothing on load, so a mail
 * scanner opening the link cannot unlock an account its owner locked on
 * purpose, and unlocking is not signing in: the next step is the sign-in page.
 */

let mockToken: string | null = 'b'.repeat(64);
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockToken ? `token=${mockToken}` : ''),
}));

const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({ api: { post: (...args: unknown[]) => mockPost(...args) } }));

import UnlockAccountPage from './page';

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = 'b'.repeat(64);
});

describe('the unlock-my-account page', () => {
  it('asks, and sends nothing, on load', () => {
    render(<UnlockAccountPage />);

    expect(screen.getByRole('heading', { name: 'Unlock your account?' })).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
    expect(document.body.textContent).toMatch(/does not sign you in/i);
  });

  it('unlocks with the token from the link, then sends her to sign in, and to a new password if she wants one', async () => {
    mockPost.mockResolvedValue({ data: { success: true, message: 'Your account is unlocked. Sign in again to continue.' } });
    render(<UnlockAccountPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unlock my account' }));
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/auth/unlock', { token: 'b'.repeat(64) });
    expect(screen.getByRole('heading', { name: 'Your account is unlocked' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Choose a new password' })).toHaveAttribute('href', '/forgot-password');
  });

  it('says it did not work in the server’s words, and points at the sign-in page for a new link', async () => {
    mockPost.mockRejectedValue({
      response: { data: { message: 'This link is not valid, has expired, or has already been used.' } },
    });
    render(<UnlockAccountPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unlock my account' }));
    });

    expect(screen.getByRole('heading', { name: 'We could not unlock it' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('has already been used');
    expect(screen.getByRole('link', { name: 'Go to sign in for a new link' })).toHaveAttribute('href', '/login');
  });

  it('says the link is incomplete when the address carries no token', () => {
    mockToken = null;
    render(<UnlockAccountPage />);

    expect(screen.getByRole('heading', { name: 'This link is not complete' })).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('does not send twice for two presses', async () => {
    let finish: (value: unknown) => void = () => undefined;
    mockPost.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<UnlockAccountPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Unlock my account' }));
    fireEvent.click(screen.getByRole('button', { name: /Unlocking/ }));
    await act(async () => finish({ data: {} }));

    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});
