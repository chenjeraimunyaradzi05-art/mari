import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * The one hook behind closing an account, wherever she starts it.
 *
 * Settings and the privacy settings used to call an endpoint that anonymised the
 * account row and told her "Account deleted" while her posts, messages and bank
 * connections stayed where they were; the third place filed a request and told her
 * it would be done within thirty days. The hook now sends her password and second
 * factor along with the confirmation, signs her out only when the server says the
 * erasure happened, and says what the server said.
 */

const mockDeleteAccount = jest.fn();
const mockLogout = jest.fn();
const mockToast = { success: jest.fn(), error: jest.fn() };

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args: unknown[]) => mockToast.success(...args),
    error: (...args: unknown[]) => mockToast.error(...args),
  },
}));
jest.mock('../socket', () => ({ socketClient: {} }));
jest.mock('../store', () => ({
  useAuthStore: () => ({ logout: mockLogout }),
  useUIStore: jest.fn(),
  useNotificationStore: jest.fn(),
  useMessageStore: jest.fn(),
}));
jest.mock('../api', () => ({
  api: {},
  userApi: { deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args) },
}));

import { useDeleteAccount } from '../hooks';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Leaving the page is a jsdom navigation, which it does not implement and
  // says so; the sign-out and the sentence are what these hold.
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useDeleteAccount', () => {
  it('sends what she typed for the step-up, and signs her out and says what the server said once it is done', async () => {
    mockDeleteAccount.mockResolvedValue({
      data: { success: true, message: 'Your personal data has been erased. Records we are legally required to keep are held without anything that identifies you.' },
    });
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    act(() => result.current.mutate({ currentPassword: 'her-password', code: 'ABCDE-FGHJK' }));

    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
    expect(mockDeleteAccount).toHaveBeenCalledWith({ currentPassword: 'her-password', code: 'ABCDE-FGHJK' });
    expect(mockToast.success).toHaveBeenCalledWith(expect.stringMatching(/Records we are legally required to keep/));
  });

  it('falls back to a plain sentence when the server sends none', async () => {
    mockDeleteAccount.mockResolvedValue({ data: { success: true } });
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Your account has been deleted.'));
  });

  it('does not sign her out, or tell her anything is deleted, when the server refuses', async () => {
    mockDeleteAccount.mockRejectedValue({ response: { status: 409, data: { message: 'We could not end your membership billing just now, so your account has not been deleted.' } } });
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    act(() => result.current.mutate({ currentPassword: 'her-password' }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockToast.success).not.toHaveBeenCalled();
    // The dialog shows the refusal beside the boxes, so it is not toasted as well.
    expect(mockToast.error).not.toHaveBeenCalled();
    expect(result.current.error).toMatchObject({ response: { status: 409 } });
  });
});
