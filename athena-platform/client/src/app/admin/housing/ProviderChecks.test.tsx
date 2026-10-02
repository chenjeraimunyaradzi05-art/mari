import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The provider checks, as staff see them. Either answer needs a sentence of what
 * they did, because the approval is what the "Checked by ATHENA staff" badge
 * rests on and the refusal is what the member reads. Refusing, which also takes
 * badges down, asks first.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/api', () => ({ housingApi: { getProviderChecks: jest.fn(), decideProviderCheck: jest.fn() } }));

import toast from 'react-hot-toast';
import { housingApi } from '@/lib/api';
import { ProviderChecks } from './ProviderChecks';

const api = housingApi as unknown as { getProviderChecks: jest.Mock; decideProviderCheck: jest.Mock };
const toastMock = toast as unknown as { success: jest.Mock; error: jest.Mock };

const row = (over: Record<string, unknown> = {}) => ({
  id: 'prov-1',
  userId: 'member-1',
  providerName: 'Quiet Streets Housing',
  relationship: 'SERVICE',
  relationshipLabel: 'I list places for a housing service or charity',
  abn: '51 824 753 556',
  statement: 'We run three units for women leaving violence in Brisbane.',
  standing: 'PENDING',
  basis: null,
  reviewedAt: null,
  expiresAt: null,
  submittedAt: new Date().toISOString(),
  renewalRequested: false,
  user: { id: 'member-1', firstName: 'Ada', lastName: 'L', displayName: null, email: 'ada@example.com', womanVerificationStatus: 'VERIFIED', createdAt: '2026-01-01T00:00:00.000Z' },
  ...over,
});

function renderList(waiting: unknown[] = [row()], ending: unknown[] = [], standing: unknown[] = []) {
  api.getProviderChecks.mockResolvedValue({ data: { data: { waiting, ending, standing } } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProviderChecks />
    </QueryClientProvider>
  );
}

const open = async () => fireEvent.click(await screen.findByRole('button', { name: /Quiet Streets Housing/ }));

beforeEach(() => {
  jest.clearAllMocks();
  api.decideProviderCheck.mockResolvedValue({ data: { data: {} } });
  window.confirm = jest.fn(() => true);
});

describe('Provider checks', () => {
  it('lists what is waiting and what is about to end, and says when nothing is', async () => {
    const { unmount } = renderList([row()], [row({ id: 'prov-2', providerName: 'Old Co', standing: 'APPROVED', expiresAt: '2026-10-20T00:00:00.000Z', reviewedAt: '2025-10-20T00:00:00.000Z' })]);
    expect(await screen.findByText('Quiet Streets Housing')).toBeInTheDocument();
    expect(screen.getByText('Old Co')).toBeInTheDocument();
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText('Ending')).toBeInTheDocument();
    unmount();

    renderList([], []);
    expect(await screen.findByText(/No provider checks are waiting/)).toBeInTheDocument();
  });

  // A check could be withdrawn only in the last month of its year, because the
  // queue showed nothing else. One that is found unsafe in month three has to be
  // findable.
  it('lists a check that stands for months yet, which can be withdrawn but has nothing to approve', async () => {
    renderList([], [], [row({ id: 'prov-9', providerName: 'Long Standing Co', standing: 'APPROVED', expiresAt: '2027-06-01T00:00:00.000Z', reviewedAt: '2026-09-01T00:00:00.000Z', basis: 'Rang two references.' })]);

    expect(await screen.findByText('Approved')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Long Standing Co/ }));

    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/What you did/), { target: { value: 'A reference says the places are not what was described.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw the check' }));
    await waitFor(() =>
      expect(api.decideProviderCheck).toHaveBeenCalledWith('member-1', { decision: 'REJECT', basis: 'A reference says the places are not what was described.' })
    );
  });

  it('still offers Approve on a check that is about to end, which is how it is renewed', async () => {
    renderList([], [row({ id: 'prov-2', standing: 'APPROVED', expiresAt: '2026-10-20T00:00:00.000Z', reviewedAt: '2025-10-20T00:00:00.000Z' })]);
    await open();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdraw the check' })).toBeInTheDocument();
  });

  it('shows what the member said, and a link to look the ABN up on the register', async () => {
    renderList();
    await open();

    expect(screen.getByText('We run three units for women leaving violence in Brisbane.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '51 824 753 556 on ABN Lookup' })).toHaveAttribute('href', expect.stringContaining('abn=51824753556'));
  });

  it('keeps both answers off until a sentence of what was done is written', async () => {
    renderList();
    await open();

    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refuse' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/What you did/), { target: { value: 'Rang two references.' } });
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });

  it('approves with the basis, the checks ticked and the term, and says what happens', async () => {
    renderList();
    await open();

    fireEvent.click(screen.getByLabelText('I looked the ABN up on the business register'));
    fireEvent.click(screen.getByLabelText('I spoke to a reference'));
    fireEvent.change(screen.getByLabelText(/What you did/), { target: { value: 'Rang two references and checked the ABN.' } });
    fireEvent.change(screen.getByLabelText(/Stands for/), { target: { value: '180' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(api.decideProviderCheck).toHaveBeenCalledTimes(1));
    expect(api.decideProviderCheck).toHaveBeenCalledWith('member-1', {
      decision: 'APPROVE',
      basis: 'Rang two references and checked the ABN.',
      validForDays: 180,
      checks: { abnChecked: true, referencesCalled: true },
    });
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining('can now show as checked')));
  });

  it('refuses with the reason only after asking, and does not send the checks or a term', async () => {
    renderList();
    await open();
    fireEvent.change(screen.getByLabelText(/What you did/), { target: { value: 'The ABN is registered to a different name.' } });

    (window.confirm as jest.Mock).mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Refuse' }));
    expect(api.decideProviderCheck).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Refuse' }));
    await waitFor(() => expect(api.decideProviderCheck).toHaveBeenCalledWith('member-1', { decision: 'REJECT', basis: 'The ABN is registered to a different name.' }));
  });

  it('calls refusing a standing check withdrawing it', async () => {
    renderList([], [row({ standing: 'APPROVED', expiresAt: '2026-10-20T00:00:00.000Z', reviewedAt: '2025-10-20T00:00:00.000Z', basis: 'Rang two references.' })]);
    await open();
    expect(screen.getByRole('button', { name: 'Withdraw the check' })).toBeInTheDocument();
    expect(screen.getByText('Rang two references.')).toBeInTheDocument();
  });

  it('shows the server’s refusal as its own sentence', async () => {
    api.decideProviderCheck.mockRejectedValue({ response: { data: { message: 'You cannot decide your own provider check. Ask another member of staff to.' } } });
    renderList();
    await open();
    fireEvent.change(screen.getByLabelText(/What you did/), { target: { value: 'Rang two references and checked the ABN.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('You cannot decide your own provider check. Ask another member of staff to.'));
  });
});
