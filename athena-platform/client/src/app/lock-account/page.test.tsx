import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

/**
 * The "this was not me" page. The one thing that must hold: opening it does
 * nothing. Mail scanners open every link in a message, and a page that locked
 * on load would lock a member out of her own account because her inbox was
 * checked for viruses. Only the button sends the request, with the token from
 * the address and nothing else.
 */

let mockToken: string | null = 'a'.repeat(64);
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockToken ? `token=${mockToken}` : ''),
}));

const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({ api: { post: (...args: unknown[]) => mockPost(...args) } }));

const mockLogout = jest.fn();
jest.mock('@/lib/store', () => ({ useAuthStore: { getState: () => ({ logout: mockLogout }) } }));

import LockAccountPage from './page';

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = 'a'.repeat(64);
});

describe('the lock-my-account page', () => {
  it('asks, and sends nothing, on load', () => {
    render(<LockAccountPage />);

    expect(screen.getByRole('heading', { name: 'Lock your account?' })).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
    // What it does is said before she presses.
    expect(document.body.textContent).toMatch(/signs every device out/i);
    expect(document.body.textContent).toMatch(/email you a link to unlock/i);
  });

  it('offers a way out for the member whose sign-in was her own', () => {
    render(<LockAccountPage />);
    expect(screen.getByRole('link', { name: 'No, that was me' })).toHaveAttribute('href', '/login');
  });

  it('locks with the token from the link when she presses the button, and clears what this browser holds', async () => {
    mockPost.mockResolvedValue({ data: { success: true, message: 'Your account is locked and every device is signed out.' } });
    render(<LockAccountPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, lock my account' }));
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/auth/lock-by-token', { token: 'a'.repeat(64) });
    expect(mockLogout).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Your account is locked' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose a new password' })).toHaveAttribute('href', '/forgot-password');
  });

  it('says what went wrong in the server’s words, and offers another way, when the link is no good', async () => {
    mockPost.mockRejectedValue({
      response: { data: { message: 'This link is not valid, has expired, or has already been used.' } },
    });
    render(<LockAccountPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, lock my account' }));
    });

    expect(screen.getByRole('heading', { name: 'We could not lock it' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('This link is not valid, has expired, or has already been used.');
    expect(mockLogout).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Sign in and lock it from Settings' })).toHaveAttribute('href', '/login');
  });

  it('does not send the request twice when the button is pressed twice', async () => {
    let finish: (value: unknown) => void = () => undefined;
    mockPost.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<LockAccountPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Yes, lock my account' }));
    fireEvent.click(screen.getByRole('button', { name: /Locking/ }));
    await act(async () => finish({ data: {} }));

    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('says the link is incomplete, and sends nothing, when the address carries no token', () => {
    mockToken = null;
    render(<LockAccountPage />);

    expect(screen.getByRole('heading', { name: 'This link is not complete' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yes, lock my account' })).not.toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('has tap targets a thumb can hit', () => {
    render(<LockAccountPage />);
    expect(screen.getByRole('button', { name: 'Yes, lock my account' }).className).toMatch(/min-h-\[44px\]/);
    expect(screen.getByRole('link', { name: 'No, that was me' }).className).toMatch(/min-h-\[44px\]/);
  });
});
