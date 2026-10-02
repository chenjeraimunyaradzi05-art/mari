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

  it('sends her to choose a password when the server says the address had its password withdrawn', async () => {
    // An address registered twice before anyone confirmed it: neither typed
    // password is kept, and whoever proved the inbox chooses one from the
    // one-time link the server hands back.
    const handed = 'd'.repeat(64);
    mockGet.mockResolvedValue({
      data: {
        message: 'Your email is confirmed. Choose the password you will sign in with to finish.',
        data: { passwordSetupRequired: true, setPasswordToken: handed },
      },
    });
    render(<VerifyEmailPage />);

    await waitFor(() => expect(screen.getByText('Email confirmed')).toBeInTheDocument());

    expect(screen.getByRole('link', { name: 'Choose your password' })).toHaveAttribute(
      'href',
      `/reset-password?token=${handed}&setup=1`
    );
    // Not the ordinary success, which would send her to sign in with a password she does not have.
    expect(screen.queryByRole('link', { name: 'Continue to Login' })).not.toBeInTheDocument();
    expect(document.body.textContent).toMatch(/no password yet/i);
  });

  it('ignores a reply that says the password must be chosen but hands no link to do it with', async () => {
    mockGet.mockResolvedValue({ data: { message: 'Email verified successfully!', data: { passwordSetupRequired: true } } });
    render(<VerifyEmailPage />);

    await waitFor(() => expect(screen.getByText(/Email Verified/)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Continue to Login' })).toBeInTheDocument();
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
