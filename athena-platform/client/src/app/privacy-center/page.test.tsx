import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * The Privacy Centre is where the privacy policy and the homepage send a member
 * to use her rights, so it has to work for the member who is signed in.
 *
 * It used to read and write through a bare fetch. The API takes a member's
 * identity from a Bearer header and nothing else, and the access token is held
 * in memory and attached by the shared client, so every one of those calls
 * arrived as nobody and was answered 401: her consents loaded as defaults, her
 * request history was empty, a switch looked saved while its write was refused,
 * and export and erasure showed an error. These tests mock the shared client,
 * which is where the session is attached, and check what the page does with
 * what comes back, including when what comes back is a refusal.
 */

let mockSignedIn = true;
const mockLogout = jest.fn();
jest.mock('@/lib/store', () => ({
  useAuthStore: () => ({ isAuthenticated: mockSignedIn, logout: mockLogout }),
}));
jest.mock('@/lib/hooks', () => ({
  useAuthStore: () => ({ isAuthenticated: mockSignedIn, isLoading: false }),
}));

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockGetSettings = jest.fn();
jest.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args), post: (...args: unknown[]) => mockPost(...args) },
  dvSafeApi: { getSettings: () => mockGetSettings() },
}));

const mockDownloadBlob = jest.fn();
jest.mock('@/lib/download', () => ({ downloadBlob: (...args: unknown[]) => mockDownloadBlob(...args) }));

jest.mock('@/lib/services/compliance.service', () => ({
  __esModule: true,
  default: {
    getLegalDocuments: jest.fn(async () => []),
    getAgreementHistory: jest.fn(async () => []),
    recordAgreement: jest.fn(),
    detectUserRegion: () => 'ANZ',
  },
}));

import PrivacyCenterPage from './page';
import { resetFloatingExitClaims } from '../dashboard/safety/QuickExit';

function withQueries(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** What axios throws when the API answers with a refusal. */
const refusal = (status: number, body: Record<string, unknown>) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data: body } });

const SAVED_CONSENTS = {
  MARKETING_EMAIL: true,
  MARKETING_SMS: false,
  MARKETING_PUSH: false,
  DATA_PROCESSING: true,
  ANALYTICS: false,
  PERSONALIZATION: false,
  THIRD_PARTY_SHARING: false,
};

const HISTORY = [
  {
    id: 'dsar-1',
    type: 'EXPORT',
    status: 'COMPLETED',
    createdAt: '2026-09-20T00:00:00.000Z',
    completedAt: '2026-09-20T00:00:05.000Z',
    exportUrl: '/api/gdpr/download/tok-history',
    exportExpiresAt: '2999-01-01T00:00:00.000Z',
  },
];

/** The API as it is when everything works: her saved choices and one finished export. */
function serveEverything() {
  mockGet.mockImplementation(async (path: string) => {
    if (path === '/gdpr/consents') return { data: { success: true, data: SAVED_CONSENTS } };
    if (path === '/gdpr/dsar') return { data: { success: true, data: HISTORY } };
    throw new Error(`unexpected GET ${path}`);
  });
}

beforeEach(() => {
  mockSignedIn = true;
  mockGet.mockReset();
  mockPost.mockReset();
  mockGetSettings.mockReset();
  mockLogout.mockReset();
  mockDownloadBlob.mockReset();
  act(() => resetFloatingExitClaims());
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('reading what is saved', () => {
  it('reads her consents and her request history through the signed-in client', async () => {
    serveEverything();

    render(withQueries(<PrivacyCenterPage />));

    expect(await screen.findByRole('checkbox', { name: 'Marketing Emails' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Marketing SMS' })).not.toBeChecked();
    expect(mockGet).toHaveBeenCalledWith('/gdpr/consents');
    expect(mockGet).toHaveBeenCalledWith('/gdpr/dsar');
    // The history names the request in plain words, and the file is offered.
    expect(screen.getByText('Copy of your data')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });

  it('does not offer switches it could not read, and says so, instead of showing defaults as her choices', async () => {
    mockGet.mockRejectedValue(refusal(401, { message: 'No token provided' }));

    render(withQueries(<PrivacyCenterPage />));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your saved privacy choices/i);
    expect(screen.getByRole('checkbox', { name: 'Marketing Emails' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Analytics & Improvement' })).toBeDisabled();
  });

  it('offers to try again, and the switches come back once her choices have been read', async () => {
    mockGet.mockRejectedValueOnce(refusal(503, { message: 'Unavailable' })).mockRejectedValueOnce(refusal(503, { message: 'Unavailable' }));
    render(withQueries(<PrivacyCenterPage />));
    await screen.findByRole('alert');

    serveEverything();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Marketing Emails' })).toBeEnabled());
    expect(screen.getByRole('checkbox', { name: 'Marketing Emails' })).toBeChecked();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('asks nothing of the API for a visitor who is not signed in, and says what signing in is for', async () => {
    mockSignedIn = false;

    render(withQueries(<PrivacyCenterPage />));

    expect(await screen.findByText(/sign in to see and change your choices/i)).toBeInTheDocument();
    expect(mockGet).not.toHaveBeenCalledWith('/gdpr/consents');
    expect(mockGet).not.toHaveBeenCalledWith('/gdpr/dsar');
    expect(screen.getByRole('checkbox', { name: 'Marketing Emails' })).toBeDisabled();
  });
});

describe('the legal documents she is said to have acknowledged', () => {
  const TERMS = { id: 'doc-1', documentType: 'TERMS', title: 'Terms of Service', version: '2026-09', effectiveDate: '2026-09-01', url: '/terms', required: true, regions: ['ANZ'] };

  const withDocuments = () => {
    const compliance = jest.requireMock('@/lib/services/compliance.service').default as { getLegalDocuments: jest.Mock };
    compliance.getLegalDocuments.mockResolvedValue([TERMS]);
  };

  it('says a required document was previously acknowledged only where her saved consent was really read', async () => {
    withDocuments();
    serveEverything();

    render(withQueries(<PrivacyCenterPage />));

    expect(await screen.findByText('Previously acknowledged')).toBeInTheDocument();
  });

  it('does not say so on the strength of a switch it could not read, which starts out on', async () => {
    withDocuments();
    mockGet.mockRejectedValue(refusal(503, { message: 'Unavailable' }));

    render(withQueries(<PrivacyCenterPage />));

    expect(await screen.findByText('Pending acknowledgement')).toBeInTheDocument();
    expect(screen.queryByText('Previously acknowledged')).not.toBeInTheDocument();
  });
});

describe('changing a choice', () => {
  it('saves it through the signed-in client and leaves the switch where she put it', async () => {
    serveEverything();
    mockPost.mockResolvedValue({ data: { success: true, data: {} } });
    render(withQueries(<PrivacyCenterPage />));
    const sms = await screen.findByRole('checkbox', { name: 'Marketing SMS' });

    fireEvent.click(sms);

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/gdpr/consents/MARKETING_SMS', { granted: true }));
    expect(sms).toBeChecked();
    expect(screen.queryByText(/we could not save/i)).not.toBeInTheDocument();
  });

  it('puts the switch back and tells her, in the server’s words, when the choice is refused', async () => {
    serveEverything();
    mockPost.mockRejectedValue(refusal(409, { success: false, error: 'Personalized Experience is restricted under your Article 18 request. Lift the restriction first.' }));
    render(withQueries(<PrivacyCenterPage />));
    const personalised = await screen.findByRole('checkbox', { name: 'Personalized Experience' });
    expect(personalised).not.toBeChecked();

    fireEvent.click(personalised);

    expect(await screen.findByRole('alert')).toHaveTextContent(/restricted under your Article 18 request/i);
    // Not a switch that looks saved while its write was refused.
    expect(personalised).not.toBeChecked();
  });

  it('puts it back with a plain sentence when the server could not be reached at all', async () => {
    serveEverything();
    mockPost.mockRejectedValue(new Error('Network Error'));
    render(withQueries(<PrivacyCenterPage />));
    const email = await screen.findByRole('checkbox', { name: 'Marketing Emails' });
    expect(email).toBeChecked();

    fireEvent.click(email);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save that choice, so it has been put back/i);
    expect(email).toBeChecked();
  });

  it('does not let the required one be switched off', async () => {
    serveEverything();
    render(withQueries(<PrivacyCenterPage />));

    const required = await screen.findByRole('checkbox', { name: 'Essential Data Processing' });

    expect(required).toBeDisabled();
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe('a copy of her data', () => {
  it('shows the link that comes back, and fetches the file with her session instead of following the link', async () => {
    serveEverything();
    mockPost.mockResolvedValue({
      data: { success: true, data: { requestId: 'dsar-2', status: 'COMPLETED', downloadUrl: '/api/gdpr/download/tok-fresh', expiresAt: '2999-01-01T00:00:00.000Z' } },
    });
    const file = new Blob(['{}'], { type: 'application/json' });
    render(withQueries(<PrivacyCenterPage />));
    await screen.findByRole('checkbox', { name: 'Marketing Emails' });

    fireEvent.click(screen.getByRole('button', { name: /download my data get a copy/i }));

    expect(await screen.findByText('Your export is ready.')).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/gdpr/dsar/export');

    mockGet.mockImplementation(async (path: string) => {
      if (path === '/gdpr/download/tok-fresh') return { data: file };
      if (path === '/gdpr/consents') return { data: { success: true, data: SAVED_CONSENTS } };
      return { data: { success: true, data: HISTORY } };
    });
    fireEvent.click(screen.getByRole('button', { name: 'Download my data' }));

    // The route wants the session header, which a clicked link cannot carry,
    // so the page asks for the bytes itself and hands them over as a file.
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/gdpr/download/tok-fresh', { responseType: 'blob' }));
    await waitFor(() => expect(mockDownloadBlob).toHaveBeenCalledWith(expect.stringMatching(/^athena-my-data-\d{4}-\d{2}-\d{2}\.json$/), file));
  });

  it('fetches a finished export from the history the same way', async () => {
    serveEverything();
    const file = new Blob(['{}'], { type: 'application/json' });
    render(withQueries(<PrivacyCenterPage />));
    const download = await screen.findByRole('button', { name: 'Download' });

    mockGet.mockResolvedValueOnce({ data: file });
    fireEvent.click(download);

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/gdpr/download/tok-history', { responseType: 'blob' }));
    await waitFor(() => expect(mockDownloadBlob).toHaveBeenCalled());
  });

  it('says a link has expired rather than offering one that no longer works', async () => {
    mockGet.mockImplementation(async (path: string) => {
      if (path === '/gdpr/consents') return { data: { success: true, data: SAVED_CONSENTS } };
      return { data: { success: true, data: [{ ...HISTORY[0], exportExpiresAt: '2020-01-01T00:00:00.000Z' }] } };
    });

    render(withQueries(<PrivacyCenterPage />));

    expect(await screen.findByText('Link expired')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
  });

  it('tells her when the link she follows has expired since the page loaded', async () => {
    serveEverything();
    render(withQueries(<PrivacyCenterPage />));
    const download = await screen.findByRole('button', { name: 'Download' });

    mockGet.mockRejectedValueOnce(refusal(410, { success: false, error: 'Download link has expired' }));
    fireEvent.click(download);

    expect(await screen.findByRole('alert')).toHaveTextContent(/expired/i);
    expect(mockDownloadBlob).not.toHaveBeenCalled();
  });

  it('refuses to fetch a link that is not one of ours', async () => {
    serveEverything();
    mockPost.mockResolvedValue({ data: { success: true, data: { downloadUrl: 'https://elsewhere.example/steal', expiresAt: '2999-01-01T00:00:00.000Z' } } });
    render(withQueries(<PrivacyCenterPage />));
    await screen.findByRole('checkbox', { name: 'Marketing Emails' });
    fireEvent.click(screen.getByRole('button', { name: /download my data get a copy/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Download my data' }));

    expect(await screen.findByText(/not one we recognise/i)).toBeInTheDocument();
    expect(mockGet).not.toHaveBeenCalledWith(expect.stringContaining('elsewhere'), expect.anything());
    expect(mockDownloadBlob).not.toHaveBeenCalled();
  });

  it('shows the server’s reason when the copy cannot be prepared', async () => {
    serveEverything();
    mockPost.mockRejectedValue(refusal(429, { success: false, message: 'Too many requests. Please try again later.' }));
    render(withQueries(<PrivacyCenterPage />));
    await screen.findByRole('checkbox', { name: 'Marketing Emails' });

    fireEvent.click(screen.getByRole('button', { name: /download my data get a copy/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests');
    expect(screen.queryByText('Your export is ready.')).not.toBeInTheDocument();
  });
});

describe('erasing her account', () => {
  function openDeletion() {
    fireEvent.click(screen.getByRole('button', { name: /delete my account erase/i }));
    const input = screen.getByPlaceholderText('DELETE_MY_ACCOUNT');
    return { input, confirm: screen.getByRole('button', { name: 'Delete Account' }) };
  }

  it('will not send anything until she has typed the confirmation', async () => {
    serveEverything();
    render(withQueries(<PrivacyCenterPage />));
    await screen.findByRole('checkbox', { name: 'Marketing Emails' });

    const { input, confirm } = openDeletion();
    expect(confirm).toBeDisabled();
    fireEvent.change(input, { target: { value: 'delete my account' } });
    expect(confirm).toBeDisabled();

    expect(mockPost).not.toHaveBeenCalled();
  });

  it('sends the confirmation string, shows the server’s own account of what happened, and signs her out', async () => {
    serveEverything();
    mockPost.mockResolvedValue({ data: { success: true, message: 'Your personal data has been erased. Records we are legally required to keep are held without anything that identifies you.' } });
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    render(withQueries(<PrivacyCenterPage />));
    await screen.findByRole('checkbox', { name: 'Marketing Emails' });
    const { input, confirm } = openDeletion();

    fireEvent.change(input, { target: { value: 'DELETE_MY_ACCOUNT' } });
    fireEvent.click(confirm);

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/gdpr/dsar/delete', { confirmation: 'DELETE_MY_ACCOUNT' }));
    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('held without anything that identifies you'));
  });

  it('keeps her signed in and says why when erasure is refused', async () => {
    serveEverything();
    mockPost.mockRejectedValue(refusal(409, { success: false, error: 'There is an open dispute on your account, so it cannot be erased yet.' }));
    render(withQueries(<PrivacyCenterPage />));
    await screen.findByRole('checkbox', { name: 'Marketing Emails' });
    const { input, confirm } = openDeletion();

    fireEvent.change(input, { target: { value: 'DELETE_MY_ACCOUNT' } });
    fireEvent.click(confirm);

    expect(await screen.findByText(/open dispute on your account/i)).toBeInTheDocument();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('says the server could not be reached when there was no answer at all', async () => {
    serveEverything();
    mockPost.mockRejectedValue(new Error('Network Error'));
    render(withQueries(<PrivacyCenterPage />));
    await screen.findByRole('checkbox', { name: 'Marketing Emails' });
    const { input, confirm } = openDeletion();

    fireEvent.change(input, { target: { value: 'DELETE_MY_ACCOUNT' } });
    fireEvent.click(confirm);

    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument();
    expect(mockLogout).not.toHaveBeenCalled();
  });
});

describe('erasing her account asks again who is asking', () => {
  // Erasure cannot be undone, and it is how someone who had got into the
  // account would destroy the trail of it. The server asks for her password and,
  // when two-factor is on, a live code; this page used to send neither, so a
  // member with a password could not use it at all once the server asked.
  function openDeletion() {
    fireEvent.click(screen.getByRole('button', { name: /delete my account erase/i }));
    return {
      password: screen.getByLabelText('Your password'),
      code: screen.getByLabelText(/Authenticator code or recovery code/),
      phrase: screen.getByPlaceholderText('DELETE_MY_ACCOUNT'),
      confirm: screen.getByRole('button', { name: 'Delete Account' }),
    };
  }

  it('sends her password and her code with the confirmation, and nothing she left empty', async () => {
    serveEverything();
    mockPost.mockResolvedValue({ data: { success: true, message: 'Your account and personal data have been deleted.' } });
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    render(withQueries(<PrivacyCenterPage />));
    await screen.findByRole('checkbox', { name: 'Marketing Emails' });
    const { password, code, phrase, confirm } = openDeletion();

    fireEvent.change(password, { target: { value: 'her-password' } });
    fireEvent.change(code, { target: { value: ' ABCDE-FGHJK ' } });
    fireEvent.change(phrase, { target: { value: 'DELETE_MY_ACCOUNT' } });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/gdpr/dsar/delete', {
        confirmation: 'DELETE_MY_ACCOUNT',
        currentPassword: 'her-password',
        code: 'ABCDE-FGHJK',
      })
    );
  });

  it('takes a recovery code in the code box: up to 32 characters, and not a numeric field', async () => {
    serveEverything();
    render(withQueries(<PrivacyCenterPage />));
    await screen.findByRole('checkbox', { name: 'Marketing Emails' });

    const { code } = openDeletion();

    expect(code).toHaveAttribute('maxlength', '32');
    expect(code).not.toHaveAttribute('inputmode', 'numeric');
  });

  it('shows a refused password as the server says it, keeps her signed in, and does not erase', async () => {
    serveEverything();
    mockPost.mockRejectedValue(refusal(401, { success: false, message: 'Current password is incorrect' }));
    render(withQueries(<PrivacyCenterPage />));
    await screen.findByRole('checkbox', { name: 'Marketing Emails' });
    const { password, phrase, confirm } = openDeletion();

    fireEvent.change(password, { target: { value: 'not-hers' } });
    fireEvent.change(phrase, { target: { value: 'DELETE_MY_ACCOUNT' } });
    fireEvent.click(confirm);

    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('says that a membership ends and that nothing is deleted if it cannot be ended', async () => {
    serveEverything();
    render(withQueries(<PrivacyCenterPage />));
    await screen.findByRole('checkbox', { name: 'Marketing Emails' });

    openDeletion();

    const text = document.body.textContent ?? '';
    expect(text).toMatch(/membership, it ends today and you are not charged again/i);
    expect(text).toMatch(/if we cannot end it, nothing is deleted/i);
  });
});

describe('the way off this page and the way to her safety settings', () => {
  it('carries a quick exit', async () => {
    serveEverything();

    render(withQueries(<PrivacyCenterPage />));

    expect(await screen.findByRole('button', { name: /quick exit/i })).toBeInTheDocument();
  });

  it('carries Emergency help beside the quick exit, one button and not two', async () => {
    serveEverything();

    render(withQueries(<PrivacyCenterPage />));

    expect(await screen.findByRole('button', { name: /emergency help/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /emergency help/i })).toHaveLength(1);
  });

  it('links to blocks and reports, Safe Mode and the crisis lines, and gives 000', async () => {
    serveEverything();
    render(withQueries(<PrivacyCenterPage />));
    await screen.findByRole('checkbox', { name: 'Marketing Emails' });

    const shortcuts = within(screen.getByRole('navigation', { name: /safety shortcuts/i }));

    expect(shortcuts.getByRole('link', { name: /blocked members and your reports/i })).toHaveAttribute('href', '/safety-center');
    expect(shortcuts.getByRole('link', { name: 'Safe Mode' })).toHaveAttribute('href', '/dashboard/safety');
    expect(shortcuts.getByRole('link', { name: /crisis lines and support/i })).toHaveAttribute('href', '/help/safety-center');
    expect(shortcuts.getByRole('link', { name: '000' })).toHaveAttribute('href', 'tel:000');
  });

  it('keeps the crisis lines for a visitor who is not signed in, and leaves out what needs an account', async () => {
    mockSignedIn = false;
    render(withQueries(<PrivacyCenterPage />));

    const shortcuts = within(await screen.findByRole('navigation', { name: /safety shortcuts/i }));

    expect(shortcuts.getByRole('link', { name: /crisis lines and support/i })).toBeInTheDocument();
    expect(shortcuts.queryByRole('link', { name: 'Safe Mode' })).not.toBeInTheDocument();
  });
});
