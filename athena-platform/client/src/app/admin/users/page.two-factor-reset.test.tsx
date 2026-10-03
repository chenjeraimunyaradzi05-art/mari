import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Taking two-factor off an account for a member who has lost her phone and her
 * recovery codes. The server is narrow about it (administrators only, never her
 * own account, a reason on the record, the member told); the screen's part is to
 * offer it only where there is something to reset, to say what to check first,
 * and to collect the two things the server asks for without making it a single
 * click.
 */

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args), post: (...args: unknown[]) => mockPost(...args), patch: jest.fn() },
}));
jest.mock('@/lib/admin-analytics-api', () => ({ analyticsApi: { user: jest.fn() } }));

import AdminUsersPage from './page';

const member = (id: string, first: string, twoFactorEnabled: boolean) => ({
  id,
  email: `${first.toLowerCase()}@example.com`,
  firstName: first,
  lastName: 'Member',
  avatar: null,
  role: 'USER',
  persona: 'EARLY_CAREER',
  emailVerified: true,
  isSuspended: false,
  twoFactorEnabled,
  createdAt: '2026-09-01T00:00:00.000Z',
  lastLoginAt: null,
  _count: { posts: 0, applications: 0 },
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminUsersPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({
    data: {
      users: [member('u-with', 'Ada', true), member('u-without', 'Bea', false)],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    },
  });
  mockPost.mockResolvedValue({ data: { success: true } });
  jest.spyOn(window, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Reset 2FA', () => {
  it('is offered only for a member who has two-factor to reset', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: 'Reset two-factor for Ada Member' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset two-factor for Bea Member' })).not.toBeInTheDocument();
  });

  it('says what to check first, and sends nothing if the administrator backs out', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const prompt = jest.spyOn(window, 'prompt');
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Reset two-factor for Ada Member' }));

    const said = String(confirm.mock.calls[0][0]);
    expect(said).toMatch(/checked it is her who is asking/);
    expect(said).toMatch(/second administrator for a staff account/);
    expect(said).toMatch(/signed out everywhere and emailed/);
    expect(prompt).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('wants a reason of at least a sentence, and sends nothing without one', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(window, 'prompt').mockReturnValue('lost it');
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Reset two-factor for Ada Member' }));

    expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/in at least a sentence/));
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('sends the reason, with the confirmation that she checked, to the member’s own reset route', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(window, 'prompt').mockReturnValue('  Replied from the address on file and gave her last invoice; second admin Priya spoke to her.  ');
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Reset two-factor for Ada Member' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/admin/users/u-with/two-factor/reset', {
        reason: 'Replied from the address on file and gave her last invoice; second admin Priya spoke to her.',
        identityChecked: true,
      })
    );
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/signed out everywhere and emailed/)));
  });

  it('shows the server’s refusal as it is: not her own account, no factor to reset', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(window, 'prompt').mockReturnValue('Checked as the runbook says, with a second administrator present.');
    mockPost.mockRejectedValue({ response: { data: { message: 'You cannot reset your own two-factor sign-in. Another administrator has to do it.' } } });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Reset two-factor for Ada Member' }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/Another administrator has to do it/)));
  });

  it('is a thumb-sized button with a visible focus ring', async () => {
    renderPage();

    const button = await screen.findByRole('button', { name: 'Reset two-factor for Ada Member' });
    expect(button.className).toMatch(/min-h-11/);
    expect(button.className).toMatch(/focus-visible:ring-2/);
  });
});
