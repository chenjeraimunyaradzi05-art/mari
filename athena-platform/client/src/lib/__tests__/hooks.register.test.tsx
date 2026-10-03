import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * Registration opens no session. The server answers every address the same way,
 * `{ success, data: { verificationRequired: true } }`, with no account and no
 * token in it. The hook used to read an access token out of that reply anyway,
 * call login() with undefined, mark her signed in and toast "Welcome to
 * ATHENA!", so a new member was bounced between the dashboard and the sign-in
 * page and never told to check her email. These tests pin the other behaviour:
 * nothing signs her in, and what the page gets is the address to ask her to
 * check.
 */

const mockLogin = jest.fn();
const mockRegister = jest.fn();
const mockToast = { success: jest.fn(), error: jest.fn() };

// Each member reads the mock when called, not when the module is loaded, which
// is before this file has got as far as declaring it.
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args: unknown[]) => mockToast.success(...args),
    error: (...args: unknown[]) => mockToast.error(...args),
  },
}));
jest.mock('../socket', () => ({ socketClient: {} }));
jest.mock('../store', () => ({
  useAuthStore: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: mockLogin,
    logout: jest.fn(),
  }),
  useUIStore: jest.fn(),
  useNotificationStore: jest.fn(),
  useMessageStore: jest.fn(),
}));
jest.mock('../api', () => ({
  api: {},
  authApi: { register: (...args: unknown[]) => mockRegister(...args) },
}));

import { useAuth } from '../hooks';

const form = {
  email: 'new.member@example.com',
  password: 'A-long-passphrase-1!',
  firstName: 'New',
  lastName: 'Member',
  womanSelfAttested: true,
  dateOfBirth: '1990-04-01',
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAuth registration', () => {
  it('does not sign anybody in when the server says an email is on its way', async () => {
    mockRegister.mockResolvedValue({
      data: { success: true, message: 'Registration received.', data: { verificationRequired: true } },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.registeredEmail).toBeNull();

    act(() => result.current.register(form));

    await waitFor(() => expect(result.current.registeredEmail).toBe('new.member@example.com'));
    expect(mockLogin).not.toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
    // No welcome to an account that does not exist yet.
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it('shows the server\'s reason and asks for nothing when a registration is refused', async () => {
    mockRegister.mockRejectedValue({ response: { data: { message: 'You must confirm you are a woman to join ATHENA' } } });
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.register({ ...form, womanSelfAttested: false }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('You must confirm you are a woman to join ATHENA'));
    expect(result.current.registeredEmail).toBeNull();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('goes back to the form when she starts again', async () => {
    mockRegister.mockResolvedValue({ data: { success: true, data: { verificationRequired: true } } });
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.register(form));
    await waitFor(() => expect(result.current.registeredEmail).not.toBeNull());

    act(() => result.current.resetRegistration());

    await waitFor(() => expect(result.current.registeredEmail).toBeNull());
  });
});
