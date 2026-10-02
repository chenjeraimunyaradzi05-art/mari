import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Two-factor on the security page, from turning it on to losing the phone.
 *
 * Turning it on returns ten recovery codes, once. The page threw them away, so a
 * member who enrolled had none until she found "Issue new codes", which wants a
 * live authenticator code: lose the phone first and there was no way back. The
 * same page's "turn off" box held eight characters and a numeric keypad, so a
 * ten character recovery code, the one thing a member without her phone has,
 * could not be typed into it. And the setup showed a key and a link but nothing a
 * phone could scan.
 */

const mockLogout = jest.fn();
const mockDeleteAccount = { mutate: jest.fn(), isPending: false, error: null as unknown, reset: jest.fn() };
jest.mock('@/lib/hooks', () => ({
  useAuth: () => ({ logout: mockLogout }),
  useDeleteAccount: () => mockDeleteAccount,
}));

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: jest.fn(),
  },
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: (...args: unknown[]) => mockToastSuccess(...args), error: (...args: unknown[]) => mockToastError(...args) },
}));

const mockDownloadText = jest.fn();
jest.mock('@/lib/download', () => ({ downloadText: (...args: unknown[]) => mockDownloadText(...args) }));

import SecuritySettingsPage from './page';

const CODES = ['ABCDE-FGHJK', 'MNPQR-STUVW', 'XYZ23-45678', 'AAAAA-BBBBB', 'CCCCC-DDDDD', 'EEEEE-FFFFF', 'GGGGG-HHHHH', 'JJJJJ-KKKKK', 'LLLLL-MMMMM', 'NNNNN-PPPPP'];
const SETUP = {
  secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
  issuer: 'ATHENA',
  accountName: 'her@example.com',
  otpauthUrl: 'otpauth://totp/ATHENA:her%40example.com?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=ATHENA&algorithm=SHA1&digits=6&period=30',
};

let twoFactorEnabled = false;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SecuritySettingsPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  twoFactorEnabled = false;
  mockDeleteAccount.error = null;
  mockGet.mockImplementation(async (url: string) => {
    if (url === '/auth/sessions') return { data: { data: [] } };
    if (url === '/auth/2fa/status') return { data: { data: { enabled: twoFactorEnabled, enabledAt: twoFactorEnabled ? '2026-10-01T00:00:00Z' : null } } };
    return { data: { data: {} } };
  });
  mockPost.mockImplementation(async (url: string) => {
    if (url === '/auth/2fa/setup') return { data: { data: SETUP } };
    if (url === '/auth/2fa/enable') {
      twoFactorEnabled = true;
      return { data: { success: true, data: { enabled: true, recoveryCodes: CODES } } };
    }
    return { data: { success: true } };
  });
  Object.assign(navigator, { clipboard: { writeText: jest.fn(async () => undefined) } });
});

/** The button is disabled while the status loads, so a click before that does nothing. */
async function pressSetUp() {
  const button = await screen.findByRole('button', { name: 'Set up' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

async function enrol() {
  renderPage();
  await pressSetUp();
  await screen.findByRole('img', { name: 'QR code for your authenticator app' });
  fireEvent.change(screen.getAllByPlaceholderText('Authenticator code')[0], { target: { value: '123456' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Enable' }));
  });
}

describe('turning it on', () => {
  it('draws the key as a QR code a phone can scan, and still shows the written key and the link', async () => {
    renderPage();
    await pressSetUp();

    const qr = await screen.findByRole('img', { name: 'QR code for your authenticator app' });
    expect(qr.tagName.toLowerCase()).toBe('svg');
    expect(qr.querySelector('path')?.getAttribute('d')?.length).toBeGreaterThan(200);
    expect(screen.getByText(SETUP.secret)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open authenticator app' })).toHaveAttribute('href', SETUP.otpauthUrl);
    // And says what it does with the key.
    expect(document.body.textContent).toMatch(/sent nowhere/i);
  });

  it('shows the ten recovery codes once the code is accepted, and does not throw them away', async () => {
    await enrol();

    expect(mockPost).toHaveBeenCalledWith('/auth/2fa/enable', { code: '123456' });
    const panel = await screen.findByRole('group', { name: 'Save your recovery codes now' });
    for (const code of CODES) {
      expect(within(panel).getByText(code)).toBeInTheDocument();
    }
    expect(panel.textContent).toMatch(/cannot show them again/i);
    expect(mockToastSuccess.mock.calls.map((call) => String(call[0])).join(' ')).toMatch(/Save your recovery codes/);
  });

  it('sends her password with the code, because a session alone must not be enough to turn it on', async () => {
    renderPage();
    await pressSetUp();
    await screen.findByRole('img', { name: 'QR code for your authenticator app' });

    fireEvent.change(screen.getByPlaceholderText('Current password'), { target: { value: 'her password' } });
    fireEvent.change(screen.getAllByPlaceholderText('Authenticator code')[0], { target: { value: '123456' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enable' }));
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/2fa/enable', { code: '123456', currentPassword: 'her password' });
    await screen.findByRole('group', { name: 'Save your recovery codes now' });
  });

  it('says in the box that an account with no password leaves it empty', async () => {
    renderPage();
    await pressSetUp();
    await screen.findByRole('img', { name: 'QR code for your authenticator app' });

    expect(screen.getByPlaceholderText('Current password').getAttribute('aria-label')).toMatch(/Google or Facebook/);
  });

  it('copies them, one to a line', async () => {
    await enrol();
    const panel = await screen.findByRole('group', { name: 'Save your recovery codes now' });

    await act(async () => {
      fireEvent.click(within(panel).getByRole('button', { name: 'Copy codes' }));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(CODES.join('\n'));
  });

  it('downloads them as a file that says what they are for', async () => {
    await enrol();
    const panel = await screen.findByRole('group', { name: 'Save your recovery codes now' });

    fireEvent.click(within(panel).getByRole('button', { name: 'Download as a file' }));

    expect(mockDownloadText).toHaveBeenCalledTimes(1);
    const [filename, text] = mockDownloadText.mock.calls[0] as [string, string];
    expect(filename).toBe('athena-recovery-codes.txt');
    for (const code of CODES) expect(text).toContain(code);
    expect(text).toMatch(/signs you in once/);
    expect(text).toMatch(/other than the phone/);
  });

  it('keeps them on screen until she says she has saved them, and then they are gone', async () => {
    await enrol();
    const panel = await screen.findByRole('group', { name: 'Save your recovery codes now' });

    fireEvent.click(within(panel).getByRole('button', { name: 'I have saved them' }));

    await waitFor(() => expect(screen.queryByRole('group', { name: 'Save your recovery codes now' })).not.toBeInTheDocument());
    expect(screen.queryByText(CODES[0])).not.toBeInTheDocument();
  });

  it('has thumb-sized buttons on the panel', async () => {
    await enrol();
    const panel = await screen.findByRole('group', { name: 'Save your recovery codes now' });

    for (const name of ['Copy codes', 'Download as a file', 'I have saved them']) {
      expect(within(panel).getByRole('button', { name }).className).toMatch(/min-h-11/);
    }
  });
});

describe('turning it off', () => {
  beforeEach(() => {
    twoFactorEnabled = true;
  });

  it('takes a recovery code, all ten characters of it, because that is what she has without her phone', async () => {
    mockPost.mockResolvedValue({ data: { success: true } });
    renderPage();

    const box = await screen.findByLabelText('Authenticator code or an unused recovery code, to turn two-factor off');
    expect(box).toHaveAttribute('maxlength', '32');
    expect(box).not.toHaveAttribute('inputmode', 'numeric');
    fireEvent.change(box, { target: { value: 'ABCDE-FGHJK' } });
    expect(box).toHaveValue('ABCDE-FGHJK');

    fireEvent.change(screen.getByLabelText('Current password, to turn two-factor off'), { target: { value: 'her-password' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Disable two-factor authentication' }));
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/2fa/disable', { currentPassword: 'her-password', code: 'ABCDE-FGHJK' });
  });

  it('says in the box itself that a recovery code works', async () => {
    renderPage();

    const box = await screen.findByLabelText('Authenticator code or an unused recovery code, to turn two-factor off');
    expect(box).toHaveAttribute('placeholder', 'Authenticator or recovery code');
  });
});

describe('deleting the account from here', () => {
  it('opens the shared dialog instead of a bare confirm box, and asks nothing of the server until she has said so', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Account' }));

    const dialog = await screen.findByRole('dialog', { name: 'Delete your account' });
    expect(dialog.textContent).toMatch(/ends today and you are not charged again/);
    expect(mockDeleteAccount.mutate).not.toHaveBeenCalled();
  });
});
