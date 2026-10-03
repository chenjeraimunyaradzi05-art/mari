import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Signing in with Google or Facebook when the account has two-factor on.
 *
 * The buttons answered that case with "Please sign in with email and password",
 * which is no way in for a member who joined with Google or Facebook and has no
 * password. The server now takes the code with the same provider credential, so
 * the button asks for it, holds the provider's proof meanwhile, and sends both
 * together. A wrong code keeps the question on screen; cancelling drops the proof;
 * any other refusal is not a question about a code and shows as it always did.
 */

const mockGoogle = jest.fn();
const mockFacebook = jest.fn();
jest.mock('@/lib/api', () => ({
  authApi: {
    google: (...args: unknown[]) => mockGoogle(...args),
    facebook: (...args: unknown[]) => mockFacebook(...args),
  },
}));

const mockStoreLogin = jest.fn();
jest.mock('@/lib/store', () => ({
  useAuthStore: (selector: (state: { login: typeof mockStoreLogin }) => unknown) => selector({ login: mockStoreLogin }),
}));

const mockToastError = jest.fn();
const mockToastInfo = jest.fn();
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign((...args: unknown[]) => mockToastInfo(...args), {
    success: jest.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
  }),
}));

import { GoogleSignInButton } from './GoogleSignInButton';
import { FacebookSignInButton } from './FacebookSignInButton';

/** What axios throws when the API answers with a refusal. */
const refusal = (status: number, message: string) =>
  Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data: { success: false, message } } });

/** The body of the latest call. The mutation hands its function the variables and then its own context. */
const lastBody = (mock: jest.Mock) => mock.mock.calls[mock.mock.calls.length - 1][0] as Record<string, unknown>;

const SIGNED_IN = { data: { data: { user: { id: 'her' }, accessToken: 'jwt' } } };

function withQueries(children: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('the Google button', () => {
  let deliverCredential: (credential: string) => void;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'google-client';
    (window as unknown as { google: unknown }).google = {
      accounts: {
        id: {
          initialize: jest.fn((config: { callback: (response: { credential?: string }) => void }) => {
            deliverCredential = (credential) => config.callback({ credential });
          }),
          renderButton: jest.fn(),
        },
      },
    };
  });

  afterEach(() => {
    delete (window as unknown as { google?: unknown }).google;
  });

  async function arrive(onError = jest.fn(), onSuccess = jest.fn()) {
    render(withQueries(<GoogleSignInButton mode="login" onError={onError} onSuccess={onSuccess} />));
    // The script loads on a promise; let it settle inside act.
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(deliverCredential).toBeDefined());
    return { onError, onSuccess };
  }

  it('asks for the code when the server says the account has two-factor, and sends it with the same credential', async () => {
    mockGoogle.mockRejectedValueOnce(refusal(401, 'Two-factor code required'));
    mockGoogle.mockResolvedValueOnce(SIGNED_IN);
    const { onSuccess, onError } = await arrive();

    await act(async () => deliverCredential('google-proof'));

    // No error toast: this is a question, not a failure.
    expect(await screen.findByLabelText('Your two-factor code')).toBeInTheDocument();
    expect(mockToastError).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(mockGoogle).toHaveBeenCalledTimes(1);
    expect(mockGoogle.mock.calls[0][0]).not.toHaveProperty('twoFactorCode');

    fireEvent.change(screen.getByLabelText('Your two-factor code'), { target: { value: '123456' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });

    expect(lastBody(mockGoogle)).toMatchObject({ credential: 'google-proof', twoFactorCode: '123456', mode: 'login' });
    expect(mockStoreLogin).toHaveBeenCalledWith({ id: 'her' }, 'jwt', '');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('takes a recovery code in the same box, as typed', async () => {
    mockGoogle.mockRejectedValueOnce(refusal(401, 'Two-factor code required'));
    mockGoogle.mockResolvedValueOnce(SIGNED_IN);
    await arrive();
    await act(async () => deliverCredential('google-proof'));

    const box = await screen.findByLabelText('Your two-factor code');
    expect(box).toHaveAttribute('maxlength', '32');
    fireEvent.change(box, { target: { value: 'ABCDE-FGHJK' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });

    expect(lastBody(mockGoogle)).toMatchObject({ twoFactorCode: 'ABCDE-FGHJK' });
  });

  it('keeps the question on screen, with the server’s sentence, when the code is wrong', async () => {
    mockGoogle.mockRejectedValueOnce(refusal(401, 'Two-factor code required'));
    mockGoogle.mockRejectedValueOnce(refusal(401, 'Invalid two-factor code'));
    const { onSuccess } = await arrive();
    await act(async () => deliverCredential('google-proof'));

    fireEvent.change(await screen.findByLabelText('Your two-factor code'), { target: { value: '000000' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid two-factor code');
    expect(screen.getByLabelText('Your two-factor code')).toBeInTheDocument();
    expect(mockStoreLogin).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('asks nothing of a six character minimum less than six, and sends nothing until it has one', async () => {
    mockGoogle.mockRejectedValueOnce(refusal(401, 'Two-factor code required'));
    await arrive();
    await act(async () => deliverCredential('google-proof'));

    fireEvent.change(await screen.findByLabelText('Your two-factor code'), { target: { value: '123' } });

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(mockGoogle).toHaveBeenCalledTimes(1);
  });

  it('drops the credential when she cancels, and says nothing went wrong', async () => {
    mockGoogle.mockRejectedValueOnce(refusal(401, 'Two-factor code required'));
    const { onError } = await arrive();
    await act(async () => deliverCredential('google-proof'));

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Your two-factor code')).not.toBeInTheDocument();
    expect(mockGoogle).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('shows any other refusal the way it always did, with no question about a code', async () => {
    mockGoogle.mockRejectedValueOnce(refusal(403, 'This account has been suspended. If you believe this is a mistake, you can appeal from the sign-in page.'));
    const { onError } = await arrive();

    await act(async () => deliverCredential('google-proof'));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringMatching(/suspended/)));
    expect(mockToastError).toHaveBeenCalled();
    expect(screen.queryByLabelText('Your two-factor code')).not.toBeInTheDocument();
  });

  it('does not take a refusal that merely mentions two-factor on another status for a question', async () => {
    mockGoogle.mockRejectedValueOnce(refusal(403, 'Two-factor authentication is required for staff accounts'));
    const { onError } = await arrive();

    await act(async () => deliverCredential('google-proof'));

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(screen.queryByLabelText('Your two-factor code')).not.toBeInTheDocument();
  });
});

describe('the Facebook button', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_FACEBOOK_APP_ID = 'fb-app';
    (window as unknown as { FB: unknown }).FB = {
      init: jest.fn(),
      getLoginStatus: jest.fn(),
      logout: jest.fn(),
      login: jest.fn((callback: (response: unknown) => void) => callback({ status: 'connected', authResponse: { accessToken: 'fb-proof' } })),
    };
  });

  afterEach(() => {
    delete (window as unknown as { FB?: unknown }).FB;
  });

  async function pressIt(onError = jest.fn(), onSuccess = jest.fn()) {
    render(withQueries(<FacebookSignInButton mode="login" onError={onError} onSuccess={onSuccess} />));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Continue with Facebook/i }));
    });
    return { onError, onSuccess };
  }

  it('asks for the code, then signs in with the same token and the code', async () => {
    mockFacebook.mockRejectedValueOnce(refusal(401, 'Two-factor code required'));
    mockFacebook.mockResolvedValueOnce(SIGNED_IN);
    const { onSuccess, onError } = await pressIt();

    expect(await screen.findByLabelText('Your two-factor code')).toBeInTheDocument();
    expect(onError).not.toHaveBeenCalled();
    expect(mockFacebook.mock.calls[0][0]).not.toHaveProperty('twoFactorCode');

    fireEvent.change(screen.getByLabelText('Your two-factor code'), { target: { value: '654321' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });

    expect(lastBody(mockFacebook)).toMatchObject({ accessToken: 'fb-proof', twoFactorCode: '654321' });
    expect(mockStoreLogin).toHaveBeenCalledWith({ id: 'her' }, 'jwt', '');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('keeps the question up for a wrong code, and puts the button back on Cancel', async () => {
    mockFacebook.mockRejectedValueOnce(refusal(401, 'Two-factor code required'));
    mockFacebook.mockRejectedValueOnce(refusal(401, 'Invalid two-factor code'));
    await pressIt();

    fireEvent.change(await screen.findByLabelText('Your two-factor code'), { target: { value: '000000' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid two-factor code');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /Continue with Facebook/i })).toBeInTheDocument();
    expect(mockStoreLogin).not.toHaveBeenCalled();
  });
});
