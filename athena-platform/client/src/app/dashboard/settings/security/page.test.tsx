import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The lock card on the security page.
 *
 * "Sign out all devices" ends the sessions that exist, and anyone who knows her
 * password signs straight back in. Locking is the step beyond it, and it is not
 * undone by pressing a button: she needs the link we email her. So it asks
 * first, says what it does, and is honest afterwards about whether the email
 * went. Nothing is sent until she confirms, and a failure leaves her signed in.
 */

const mockLogout = jest.fn();
jest.mock('@/lib/hooks', () => ({
  useAuth: () => ({ logout: mockLogout }),
  useDeleteAccount: () => ({ mutate: jest.fn(), isPending: false }),
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

import SecuritySettingsPage from './page';

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
  mockGet.mockImplementation(async (url: string) => {
    if (url === '/auth/sessions') {
      return { data: { data: [{ id: 's1', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/126.0', ipAddress: '203.0.113.7', isCurrent: true }] } };
    }
    return { data: { data: { enabled: false } } };
  });
});

describe('the lock card', () => {
  it('says what locking does, and how it differs from signing out everywhere', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Lock my account' })).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/every device is signed out/i);
    expect(text).toMatch(/until you unlock it from a link we email to you/i);
    expect(text).toMatch(/anyone who knows your password can sign straight back in/i);
  });

  it('sends nothing until she confirms, and Cancel puts it back', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Lock my account' });

    fireEvent.click(screen.getByRole('button', { name: 'Lock my account' }));

    expect(screen.getByRole('group', { name: 'Confirm locking your account' })).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Confirm locking your account' })).not.toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('locks, tells her the email is on its way, and signs this browser out', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: { locked: true, unlockEmailSent: true } } });
    renderPage();
    await screen.findByRole('heading', { name: 'Lock my account' });

    fireEvent.click(screen.getByRole('button', { name: 'Lock my account' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, lock my account' }));
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/lock');
    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
    expect(mockToastSuccess.mock.calls[0][0]).toMatch(/emailed you a link to unlock it/i);
  });

  it('does not claim an email went when the server says it could not send one', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: { locked: true, unlockEmailSent: false } } });
    renderPage();
    await screen.findByRole('heading', { name: 'Lock my account' });

    fireEvent.click(screen.getByRole('button', { name: 'Lock my account' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, lock my account' }));
    });

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    const said = String(mockToastSuccess.mock.calls[0][0]);
    expect(said).toMatch(/could not send the unlock email/i);
    expect(said).toMatch(/sign-in page/i);
    expect(said).not.toMatch(/we have emailed you/i);
    // She is still locked, so she is still signed out of this browser.
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('leaves her signed in, with the server’s reason, when the lock did not happen', async () => {
    mockPost.mockRejectedValue({ response: { data: { message: 'Too many attempts from here. Please try again in an hour.' } } });
    renderPage();
    await screen.findByRole('heading', { name: 'Lock my account' });

    fireEvent.click(screen.getByRole('button', { name: 'Lock my account' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, lock my account' }));
    });

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Too many attempts from here. Please try again in an hour.'));
    expect(mockLogout).not.toHaveBeenCalled();
    // Back to the first step, nothing half-done on screen.
    expect(screen.queryByRole('group', { name: 'Confirm locking your account' })).not.toBeInTheDocument();
  });

  it.each([
    ['no answer at all', new Error('timeout of 10000ms exceeded')],
    ['a gateway that gave up', { response: { status: 504, data: { message: 'Backend unavailable' } } }],
  ])('does not claim nothing happened when there was %s, because the lock may have gone through', async (_label, failure) => {
    mockPost.mockRejectedValue(failure);
    renderPage();
    await screen.findByRole('heading', { name: 'Lock my account' });

    fireEvent.click(screen.getByRole('button', { name: 'Lock my account' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, lock my account' }));
    });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    const said = String(mockToastError.mock.calls[0][0]);
    expect(said).toMatch(/cannot tell whether your account was locked/i);
    expect(said).not.toMatch(/nothing has changed/i);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('has thumb-sized buttons', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Lock my account' });

    expect(screen.getByRole('button', { name: 'Lock my account' }).className).toMatch(/min-h-\[44px\]/);
    fireEvent.click(screen.getByRole('button', { name: 'Lock my account' }));
    expect(screen.getByRole('button', { name: 'Yes, lock my account' }).className).toMatch(/min-h-\[44px\]/);
    expect(screen.getByRole('button', { name: 'Cancel' }).className).toMatch(/min-h-\[44px\]/);
  });
});
