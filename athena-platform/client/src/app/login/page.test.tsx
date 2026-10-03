import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * What the sign-in page does with the three refusals that leave a member
 * stuck rather than wrong.
 *
 * Registration opens no session, so the first thing a new member can meet is
 * "Please verify your email before signing in." when the email did not arrive
 * or its link expired. That used to be a sentence and nowhere to go. A member
 * who locked her own account is refused with the right password, and needs a
 * new unlock email. A suspended member is offered an appeal. Each gets its own
 * panel, none gets another's, and a wrong password gets none.
 */

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(''),
}));

let mockLoginOutcome: { message?: string } | 'ok' = 'ok';
const mockLogin = jest.fn((_vars: unknown, options?: { onSuccess?: () => void; onError?: (error: unknown) => void }) => {
  if (mockLoginOutcome === 'ok') options?.onSuccess?.();
  else options?.onError?.({ response: { data: { message: mockLoginOutcome.message } } });
});
jest.mock('@/lib/hooks', () => ({
  useAuth: () => ({ login: mockLogin, isLoginPending: false, isAuthenticated: false, isLoading: false }),
}));

const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({ api: { post: (...args: unknown[]) => mockPost(...args) }, authApi: {} }));
let mockGoogleError: ((message: string) => void) | undefined;
jest.mock('@/components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: ({ onError }: { onError?: (message: string) => void }) => {
    mockGoogleError = onError;
    return null;
  },
}));
jest.mock('@/components/auth/FacebookSignInButton', () => ({ FacebookSignInButton: () => null }));

import LoginPage from './page';

const UNCONFIRMED = 'Please verify your email before signing in.';
const LOCKED =
  'This account is locked. You locked it to keep it safe, and the email we sent you has the link to unlock it. If you cannot find it, ask for a new one from the sign-in page.';
const SUSPENDED = 'This account has been suspended. If you believe this is a mistake, you can appeal from the sign-in page.';

async function signInWith(message: string) {
  mockLoginOutcome = { message };
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'her@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'her-own-password' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
  });
  await waitFor(() => expect(mockLogin).toHaveBeenCalled());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoginOutcome = 'ok';
});

describe('the sign-in page', () => {
  it('offers a new confirmation link, for the address she typed, when the address has not been confirmed', async () => {
    mockPost.mockResolvedValue({ data: { success: true } });
    await signInWith(UNCONFIRMED);

    // The refusal is still shown in the server's words.
    expect(screen.getByText(UNCONFIRMED)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Send me a new link' });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/resend-verification', { email: 'her@example.com' });
    expect(document.body.textContent).toMatch(/new link is on its way/i);
  });

  it('keeps the resend button out of the sign-in form’s own submit, so pressing it does not sign her in again', async () => {
    mockPost.mockResolvedValue({ data: {} });
    await signInWith(UNCONFIRMED);
    mockLogin.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send me a new link' }));
    });

    expect(mockLogin).not.toHaveBeenCalled();
    // And there is one form on the page, not a form inside a form.
    expect(document.querySelectorAll('form').length).toBe(1);
  });

  it('offers a new unlock email, and not a confirmation link, when she locked the account herself', async () => {
    mockPost.mockResolvedValue({ data: { success: true } });
    await signInWith(LOCKED);

    expect(screen.getByText(LOCKED)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send me a new link' })).not.toBeInTheDocument();
    expect(screen.queryByText('Your account is suspended')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Email me a new unlock link' }));
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/request-unlock', { email: 'her@example.com' });
  });

  it('offers the unlock email, asking for the address, when Google refuses a locked account', async () => {
    mockPost.mockResolvedValue({ data: { success: true } });
    render(<LoginPage />);

    // No address was typed: she signed in with Google.
    await act(async () => {
      mockGoogleError?.(LOCKED);
    });

    expect(screen.getByText(LOCKED)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email address of the locked account'), { target: { value: 'her@example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Email me a new unlock link' }));
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/request-unlock', { email: 'her@example.com' });
  });

  it('uses the address she typed when Google refuses a locked account', async () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'typed@example.com' } });

    await act(async () => {
      mockGoogleError?.(LOCKED);
    });

    // It does not ask again for what it already has.
    expect(screen.queryByLabelText('Email address of the locked account')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Email me a new unlock link' })).toBeEnabled();
  });

  it('shows no unlock panel for another Google refusal', async () => {
    render(<LoginPage />);

    await act(async () => {
      mockGoogleError?.('Invalid Google credential');
    });

    expect(screen.getByText('Invalid Google credential')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Email me a new unlock link' })).not.toBeInTheDocument();
  });

  it('still opens the appeal, and nothing else, for a suspended account', async () => {
    await signInWith(SUSPENDED);

    expect(screen.getByText(SUSPENDED)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send me a new link' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Email me a new unlock link' })).not.toBeInTheDocument();
    expect(document.body.textContent).toMatch(/appeal/i);
  });

  it('shows nothing extra for a wrong password', async () => {
    await signInWith('Invalid email or password');

    expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send me a new link' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Email me a new unlock link' })).not.toBeInTheDocument();
  });

  it('clears the panel when she tries again', async () => {
    await signInWith(UNCONFIRMED);
    expect(screen.getByRole('button', { name: 'Send me a new link' })).toBeInTheDocument();

    mockLoginOutcome = { message: 'Invalid email or password' };
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    });

    expect(screen.queryByRole('button', { name: 'Send me a new link' })).not.toBeInTheDocument();
  });
});
