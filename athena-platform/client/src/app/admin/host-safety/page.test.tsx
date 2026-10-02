import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Host safety attestations, as staff decide them. Either answer needs a sentence
 * of what the member of staff did (it is in the audit record, and for a refusal it
 * is the reason the organisation reads); refusing, and withdrawing an approval,
 * ask first. The screen says plainly when the ABN was not looked up on the
 * register, rather than letting a missing lookup read as a pass.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/verification-api', () => ({
  ...jest.requireActual('@/lib/verification-api'),
  hostSafetyApi: { queue: jest.fn(), decide: jest.fn() },
}));

import toast from 'react-hot-toast';
import { hostSafetyApi } from '@/lib/verification-api';
import AdminHostSafetyPage from './page';

const api = hostSafetyApi as unknown as { queue: jest.Mock; decide: jest.Mock };
const toastMock = toast as unknown as { success: jest.Mock; error: jest.Mock };

const row = (over: Record<string, unknown> = {}) => ({
  id: 'att-1',
  organizationId: 'org-1',
  standing: 'PENDING',
  canSubmit: false,
  renewable: false,
  attestedAt: new Date().toISOString(),
  expiresAt: null,
  safetyContactName: 'Sam Carter',
  safetyContactEmail: 'safety@builders.example',
  safetyContactPhone: null,
  abn: '51 824 753 556',
  abnCheck: { lookup: 'NOT_CONFIGURED', abn: '51824753556', checkedAt: '2026-10-01T00:00:00.000Z' },
  answers: { whsPolicy: true, workersCompensation: true, supervision: true },
  organization: { id: 'org-1', name: 'Brisbane Builders', type: 'company', city: 'Brisbane', state: 'QLD', website: null, isVerified: true, abn: null },
  attestedBy: { id: 'owner-1', firstName: 'Ola', lastName: 'M', displayName: null, email: 'ola@builders.example' },
  renewal: false,
  currentApprovalEndsAt: null,
  ...over,
});

function renderPage(waiting: unknown[] = [row()], ending: unknown[] = [], standing: unknown[] = []) {
  api.queue.mockResolvedValue({ data: { data: { waiting, ending, standing } } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminHostSafetyPage />
    </QueryClientProvider>
  );
}

const open = async () => fireEvent.click(await screen.findByRole('button', { name: /Brisbane Builders/ }));

beforeEach(() => {
  jest.clearAllMocks();
  api.decide.mockResolvedValue({ data: { data: {} } });
  window.confirm = jest.fn(() => true);
});

describe('Host safety checks', () => {
  it('says so when nothing is waiting, and when the queue cannot load', async () => {
    const { unmount } = renderPage([], []);
    expect(await screen.findByText(/Nothing is waiting/)).toBeInTheDocument();
    unmount();

    api.queue.mockRejectedValue(new Error('down'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AdminHostSafetyPage />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Could not load the queue.')).toBeInTheDocument();
  });

  it('shows what the organisation says, who sent it, the contact, and a link to the register', async () => {
    renderPage();
    await open();

    expect(screen.getByText('Ola M · ola@builders.example')).toBeInTheDocument();
    expect(screen.getByText('Sam Carter · safety@builders.example')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '51 824 753 556 on ABN Lookup' })).toHaveAttribute('href', expect.stringContaining('abn=51824753556'));
    expect(screen.getByText(/Has a written work health and safety policy/)).toBeInTheDocument();
    expect(screen.getByText(/The organisation is verified\./)).toBeInTheDocument();
  });

  it('says plainly that the ABN was not looked up, rather than letting it read as a pass', async () => {
    renderPage();
    await open();
    expect(screen.getByText(/The register lookup is not switched on, so the ABN was not looked up automatically/)).toBeInTheDocument();
  });

  it('shows what the register said when it was asked', async () => {
    renderPage([row({ abnCheck: { lookup: 'FOUND', abn: '51824753556', entityName: 'BRISBANE BUILDERS PTY LTD', abnStatus: 'Active', checkedAt: '2026-10-01T00:00:00.000Z' } })]);
    await open();
    expect(screen.getByText(/Found on the register · BRISBANE BUILDERS PTY LTD · Active/)).toBeInTheDocument();
  });

  it('says that approving does not verify an organisation that is not verified', async () => {
    renderPage([row({ organization: { id: 'org-1', name: 'Brisbane Builders', isVerified: false, abn: null } })]);
    await open();
    expect(screen.getByText(/Approving this does not make it verified/)).toBeInTheDocument();
  });

  it('marks a renewal, and says when the approval that stands ends', async () => {
    renderPage([row({ renewal: true, currentApprovalEndsAt: '2026-10-20T00:00:00.000Z' })]);
    expect(await screen.findByText('Renewal')).toBeInTheDocument();
    await open();
    expect(screen.getByText(/A renewal\. The approval that stands ends/)).toBeInTheDocument();
  });

  it('keeps both answers off until a sentence of what was done is written', async () => {
    renderPage();
    await open();

    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refuse' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/What you did/), { target: { value: 'too short' } });
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/What you did/), { target: { value: 'Rang the safety contact and checked the ABN.' } });
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });

  it('approves with the note and the term', async () => {
    renderPage();
    await open();
    fireEvent.change(screen.getByLabelText(/What you did/), { target: { value: 'Rang the safety contact and checked the ABN.' } });
    fireEvent.change(screen.getByLabelText(/Stands for/), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(api.decide).toHaveBeenCalledWith('att-1', { decision: 'APPROVE', note: 'Rang the safety contact and checked the ABN.', validForDays: 200 }));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
  });

  it('refuses only after asking, with the reason and no term', async () => {
    renderPage();
    await open();
    fireEvent.change(screen.getByLabelText(/What you did/), { target: { value: 'The safety contact could not be reached.' } });

    (window.confirm as jest.Mock).mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Refuse' }));
    expect(api.decide).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Refuse' }));
    await waitFor(() => expect(api.decide).toHaveBeenCalledWith('att-1', { decision: 'REJECT', note: 'The safety contact could not be reached.' }));
  });

  it('offers withdrawing, not approving, for an approval that stands and is about to end', async () => {
    renderPage([], [row({ standing: 'APPROVED', expiresAt: '2026-10-20T00:00:00.000Z' })]);
    expect(await screen.findByText('Ending')).toBeInTheDocument();
    await open();

    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdraw the approval' })).toBeInTheDocument();
  });

  it('shows the server’s refusal as its own sentence', async () => {
    api.decide.mockRejectedValue({ response: { data: { message: 'You belong to this organisation, so another member of staff has to decide its attestation.' } } });
    renderPage();
    await open();
    fireEvent.change(screen.getByLabelText(/What you did/), { target: { value: 'Rang the safety contact and checked the ABN.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('You belong to this organisation, so another member of staff has to decide its attestation.'));
  });
});

describe('Host safety checks that stand', () => {
  // An approval could be withdrawn only in the last month of its year, because
  // the queue showed nothing else.
  it('lists an approval that stands for months yet, which can be withdrawn but has nothing to approve', async () => {
    renderPage([], [], [row({ id: 'att-9', standing: 'APPROVED', expiresAt: '2027-06-01T00:00:00.000Z' })]);

    expect(await screen.findByText('Approved')).toBeInTheDocument();
    await open();

    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/What you did, or why not/), { target: { value: 'The safety contact says the policy does not exist.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw the approval' }));
    await waitFor(() => expect(api.decide).toHaveBeenCalledWith('att-9', { decision: 'REJECT', note: 'The safety contact says the policy does not exist.' }));
  });
});
