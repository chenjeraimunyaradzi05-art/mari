import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

/**
 * Registration answers every address the same way and opens no session, so the
 * page must not walk a new member to the dashboard (the sign-in wall would
 * send her straight back). Once the hook reports an accepted registration the
 * page shows "check your email" in place of the form.
 *
 * Submitting the form is not driven from here: under Jest react-hook-form
 * resolves to its minified CommonJS build, which reads a ticked checkbox as the
 * number 1 rather than true, so the form's own boolean check refuses a sign-up
 * the real bundle accepts. The server's refusal of a missing or false
 * confirmation is tested where it is enforced, in
 * server/src/routes/__tests__/auth.woman-attestation.test.ts.
 */

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams('redirect=%2Fjobs'),
}));

const mockResetRegistration = jest.fn();
let mockRegisteredEmail: string | null = null;
jest.mock('@/lib/hooks', () => ({
  useAuth: () => ({
    register: jest.fn(),
    registeredEmail: mockRegisteredEmail,
    resetRegistration: mockResetRegistration,
    isRegisterPending: false,
    isAuthenticated: false,
    isLoading: false,
  }),
}));

jest.mock('@/lib/api', () => ({ api: { post: jest.fn() }, authApi: {} }));
jest.mock('@/components/auth/GoogleSignInButton', () => ({ GoogleSignInButton: () => null }));
jest.mock('@/components/auth/FacebookSignInButton', () => ({ FacebookSignInButton: () => null }));

import RegisterPage from './page';

beforeEach(() => {
  jest.clearAllMocks();
  mockRegisteredEmail = null;
});

describe('the register page', () => {
  it('shows the form, with the women-only confirmation worded as a self-attestation, until a registration is accepted', () => {
    render(<RegisterPage />);

    expect(screen.getByRole('heading', { name: /create an account/i })).toBeInTheDocument();
    expect(screen.getByLabelText('I confirm that I am a woman (self-attestation)')).not.toBeChecked();
    expect(screen.queryByRole('heading', { name: 'Check your email' })).not.toBeInTheDocument();
  });

  it('shows "check your email" in place of the form once a registration has been accepted, and goes nowhere', () => {
    mockRegisteredEmail = 'new.member@example.com';

    render(<RegisterPage />);

    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText('new.member@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /create an account/i })).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('carries where she was heading through to sign in', () => {
    mockRegisteredEmail = 'new.member@example.com';

    render(<RegisterPage />);

    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login?redirect=%2Fjobs');
  });

  it('goes back to the form when she starts again', () => {
    mockRegisteredEmail = 'new.member@example.com';
    render(<RegisterPage />);

    fireEvent.click(screen.getByRole('button', { name: /start again/i }));

    expect(mockResetRegistration).toHaveBeenCalledTimes(1);
  });
});
