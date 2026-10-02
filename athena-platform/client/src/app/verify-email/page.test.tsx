import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * The page the confirmation link lands on. A link that has expired is the
 * common failure, and registration opens no session, so the page offers a new
 * one through the same control the sign-in page uses.
 */

let mockToken: string | null = 'c'.repeat(64);
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockToken ? `token=${mockToken}` : ''),
}));

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args), post: (...args: unknown[]) => mockPost(...args) },
}));

import VerifyEmailPage from './page';

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = 'c'.repeat(64);
});

describe('the verify-email page', () => {
  it('confirms the address from the token in the link and sends her on to sign in', async () => {
    mockGet.mockResolvedValue({ data: { message: 'Email verified successfully! Welcome to ATHENA.' } });
    render(<VerifyEmailPage />);

    await waitFor(() => expect(screen.getByText(/Email Verified/)).toBeInTheDocument());

    expect(mockGet).toHaveBeenCalledWith(`/auth/verify-email?token=${'c'.repeat(64)}`);
    expect(screen.getByRole('link', { name: 'Continue to Login' })).toHaveAttribute('href', '/login');
  });

  it('offers a new link, for the address she types, when the link has expired', async () => {
    mockGet.mockRejectedValue({ response: { data: { message: 'Invalid or expired verification token' } } });
    mockPost.mockResolvedValue({ data: { success: true } });
    render(<VerifyEmailPage />);

    await waitFor(() => expect(screen.getByText('Invalid or expired verification token')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'her@example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resend' }));
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/resend-verification', { email: 'her@example.com' });
    expect(document.body.textContent).toMatch(/new link is on its way/i);
  });

  it('offers the same when the address carries no token at all', async () => {
    mockToken = null;
    render(<VerifyEmailPage />);

    await waitFor(() => expect(screen.getByText('No verification token provided')).toBeInTheDocument());
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
  });
});
