import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The reviewer's screen for badge applications. Approving an identity badge
 * puts a verified tick on a profile, so it asks what was checked, and the
 * server refuses without it. For an employer or educator application the
 * screen puts what ATHENA could check in front of the reviewer; it is a
 * prompt, and the decision is still the reviewer's.
 */

const mockGet = jest.fn();
const mockPatch = jest.fn();
jest.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args), patch: (...args: unknown[]) => mockPatch(...args) },
}));
jest.mock('react-hot-toast', () => {
  const toast: any = jest.fn();
  toast.success = jest.fn();
  toast.error = jest.fn();
  return { __esModule: true, default: toast };
});

import AdminVerificationPage from './page';

const applicant = { id: 'u1', firstName: 'Ana', lastName: 'Member', displayName: 'Ana Member', email: 'ana@acme.com.au', avatar: null };
const pending = (id: string, type: string, metadata: Record<string, unknown> | null = null) => ({
  id,
  type,
  status: 'PENDING',
  metadata,
  reason: null,
  submittedAt: '2026-09-20T00:00:00.000Z',
  reviewedAt: null,
  user: applicant,
});

function serve(badges: unknown[], checks: unknown[] | Error = []) {
  mockGet.mockImplementation(async (url: string) => {
    if (url === '/verification/badges/pending') return { data: { data: badges } };
    if (/^\/verification\/badges\/[^/]+\/checks$/.test(url)) {
      if (checks instanceof Error) throw checks;
      return { data: { data: { checks } } };
    }
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminVerificationPage />
    </QueryClientProvider>
  );
}

const open = async (typeLabel: RegExp) => {
  fireEvent.click(await screen.findByRole('button', { name: typeLabel }));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPatch.mockResolvedValue({ data: { data: {} } });
});

describe('approving an identity badge', () => {
  it('cannot be done until the reviewer says what was checked', async () => {
    serve([pending('b1', 'IDENTITY', { note: 'hello' })]);
    renderPage();
    await open(/IDENTITY/);

    const approve = screen.getByRole('button', { name: 'Approve' });
    expect(approve).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'ok' } });
    expect(approve).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Licence seen on a video call; the face matches' } });
    expect(approve).toBeEnabled();

    fireEvent.click(approve);
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/verification/badges/b1', {
        status: 'APPROVED',
        reason: 'Licence seen on a video call; the face matches',
      })
    );
  });

  it('can still be turned down with no reason', async () => {
    serve([pending('b1', 'IDENTITY')]);
    renderPage();
    await open(/IDENTITY/);

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/verification/badges/b1', { status: 'REJECTED' }));
  });

  it('does not ask a reason of a badge that carries no tick', async () => {
    serve([pending('b2', 'MENTOR', { role: 'Head of Product' })]);
    renderPage();
    await open(/MENTOR/);

    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });
});

describe('what ATHENA could check for an employer application', () => {
  it('is shown beside the application, with a word for each result and a reminder that the reviewer decides', async () => {
    serve(
      [pending('b3', 'EMPLOYER', { organizationName: 'Acme', abn: '51824753556' })],
      [
        { key: 'email-domain', label: 'Her confirmed email address against the organisation\'s website', status: 'pass', detail: 'Her confirmed address is at acme.com.au, which matches the website (acme.com.au).' },
        { key: 'abn', label: 'ABN', status: 'warn', detail: '12345678901 is not a valid ABN: it fails the ABN checksum.' },
      ]
    );
    renderPage();
    await open(/EMPLOYER/);

    expect(await screen.findByText(/which matches the website/)).toBeInTheDocument();
    expect(screen.getByText('Matches.')).toBeInTheDocument();
    expect(screen.getByText('Look closer.')).toBeInTheDocument();
    expect(screen.getByText(/not a valid ABN/)).toBeInTheDocument();
    expect(screen.getByText(/prompts, not a decision/i)).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('/verification/badges/b3/checks');
  });

  it('says so when the checks could not be run, and still lets the reviewer decide', async () => {
    serve([pending('b3', 'EDUCATOR', { organizationName: 'TAFE' })], new Error('down'));
    renderPage();
    await open(/EDUCATOR/);

    expect(await screen.findByText(/checks could not be run just now/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });

  it('is not asked for a badge there is nothing to check', async () => {
    serve([pending('b4', 'CREATOR', { evidenceUrl: 'https://example.com/me' })]);
    renderPage();
    await open(/CREATOR/);

    expect(screen.queryByText(/what athena could check/i)).not.toBeInTheDocument();
    expect(mockGet).not.toHaveBeenCalledWith('/verification/badges/b4/checks');
  });
});
