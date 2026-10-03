import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * "Before you can place apprentices". An organisation may open a listing and take
 * applications only while it is verified and holds an approved safety attestation.
 * The panel shows where each stands, collects the attestation from an owner or
 * admin, and will not send one until every statement is affirmed: if something is
 * not in place yet, the answer is to put it in place, not to say no.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/verification-api', () => ({ hostSafetyApi: { status: jest.fn(), submit: jest.fn() } }));

import toast from 'react-hot-toast';
import { hostSafetyApi } from '@/lib/verification-api';
import { HostSafetyPanel } from './HostSafetyPanel';

const api = hostSafetyApi as unknown as { status: jest.Mock; submit: jest.Mock };
const toastMock = toast as unknown as { success: jest.Mock; error: jest.Mock };

const QUESTIONS = [
  { id: 'whsPolicy', statement: 'We have a written work health and safety policy that covers apprentices.' },
  { id: 'supervision', statement: 'Every apprentice works under a named, experienced person.' },
];

const status = (over: Record<string, unknown> = {}, attestation: Record<string, unknown> = {}) => ({
  data: {
    data: {
      version: 1,
      questions: QUESTIONS,
      renewalWindowDays: 30,
      organization: { id: 'org-1', name: 'Brisbane Builders', isVerified: true, abn: null },
      attestation: { standing: 'NONE', canSubmit: true, renewable: false, ...attestation },
      mayAttest: true,
      canSubmit: true,
      mayPlaceApprentices: false,
      ...over,
    },
  },
});

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HostSafetyPanel organizationId="org-1" />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Before you can place apprentices', () => {
  it('says what is needed, and that no individual’s police or background check is collected', async () => {
    api.status.mockResolvedValue(status());
    renderPanel();

    expect(await screen.findByRole('heading', { name: 'Before you can place apprentices' })).toBeInTheDocument();
    expect(screen.getByText(/does not collect or hold anyone.s police or background check/)).toBeInTheDocument();
    expect(screen.getByText('Your organisation is verified.')).toBeInTheDocument();
    expect(screen.getByText('You have not sent a safety attestation yet.')).toBeInTheDocument();
  });

  it('points an unverified organisation at the badge review', async () => {
    api.status.mockResolvedValue(status({ organization: { id: 'org-1', name: 'Brisbane Builders', isVerified: false, abn: null } }));
    renderPanel();

    expect(await screen.findByText(/is not verified yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'the organisation page' })).toHaveAttribute('href', '/employer/organizations/org-1');
  });

  it('says so when both are in place', async () => {
    api.status.mockResolvedValue(status({ mayPlaceApprentices: true, canSubmit: false }, { standing: 'APPROVED', canSubmit: false, expiresAt: '2027-09-30T00:00:00.000Z' }));
    renderPanel();

    expect(await screen.findByRole('heading', { name: 'Your organisation can place apprentices through ATHENA' })).toBeInTheDocument();
    expect(screen.getByText(/Your safety attestation is approved\. It stands until/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Send/ })).not.toBeInTheDocument();
  });

  it('will not send until every statement is affirmed and the contact and ABN are given', async () => {
    api.status.mockResolvedValue(status());
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Send the safety attestation' }));
    const send = screen.getByRole('button', { name: 'Send for review' });
    expect(send).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Who an apprentice tells about a safety problem'), { target: { value: 'Sam Carter' } });
    fireEvent.change(screen.getByLabelText('Their email'), { target: { value: 'safety@builders.example' } });
    fireEvent.change(screen.getByLabelText(/Your organisation.s ABN/), { target: { value: '51 824 753 556' } });
    // One of two statements affirmed: still not enough.
    fireEvent.click(screen.getByLabelText(QUESTIONS[0].statement));
    expect(send).toBeDisabled();

    fireEvent.click(screen.getByLabelText(QUESTIONS[1].statement));
    expect(send).toBeEnabled();
  });

  it('sends exactly what was entered, and tells the owner what happens next', async () => {
    api.status.mockResolvedValue(status());
    api.submit.mockResolvedValue({ data: { message: 'Sent. A member of ATHENA staff will read it and tell you what they decide.' } });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Send the safety attestation' }));
    for (const q of QUESTIONS) fireEvent.click(screen.getByLabelText(q.statement));
    fireEvent.change(screen.getByLabelText('Who an apprentice tells about a safety problem'), { target: { value: 'Sam Carter' } });
    fireEvent.change(screen.getByLabelText('Or their phone number'), { target: { value: '07 3000 0000' } });
    fireEvent.change(screen.getByLabelText(/Your organisation.s ABN/), { target: { value: '51 824 753 556' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send for review' }));

    await waitFor(() => expect(api.submit).toHaveBeenCalledTimes(1));
    expect(api.submit).toHaveBeenCalledWith('org-1', {
      answers: { whsPolicy: true, supervision: true },
      safetyContactName: 'Sam Carter',
      safetyContactPhone: '07 3000 0000',
      abn: '51 824 753 556',
    });
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining('Sent.'), expect.anything()));
  });

  it('shows the server’s own sentence when it refuses', async () => {
    api.status.mockResolvedValue(status());
    api.submit.mockRejectedValue({ response: { data: { message: 'That ABN is not on the Australian Business Register. Check the number and try again.' } } });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Send the safety attestation' }));
    for (const q of QUESTIONS) fireEvent.click(screen.getByLabelText(q.statement));
    fireEvent.change(screen.getByLabelText('Who an apprentice tells about a safety problem'), { target: { value: 'Sam Carter' } });
    fireEvent.change(screen.getByLabelText('Their email'), { target: { value: 'safety@builders.example' } });
    fireEvent.change(screen.getByLabelText(/Your organisation.s ABN/), { target: { value: '51 824 753 556' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send for review' }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('That ABN is not on the Australian Business Register. Check the number and try again.'));
  });

  it('shows the reason a refusal gave, and lets the owner send a new one', async () => {
    api.status.mockResolvedValue(status({}, { standing: 'REJECTED', canSubmit: true, reviewNote: 'The safety contact could not be reached on the number given.' }));
    renderPanel();

    expect(await screen.findByText('The safety contact could not be reached on the number given.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send a new attestation' })).toBeInTheDocument();
  });

  it('says a waiting attestation is waiting, and offers no second one', async () => {
    api.status.mockResolvedValue(status({ canSubmit: false }, { standing: 'PENDING', canSubmit: false }));
    renderPanel();

    expect(await screen.findByText(/with ATHENA staff, who will read it/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Send/ })).not.toBeInTheDocument();
  });

  it('offers a renewal in the last month of an approval', async () => {
    api.status.mockResolvedValue(status({ mayPlaceApprentices: true }, { standing: 'APPROVED', canSubmit: true, renewable: true, expiresAt: '2026-10-20T00:00:00.000Z' }));
    renderPanel();
    expect(await screen.findByRole('button', { name: 'Send a renewal' })).toBeInTheDocument();
    expect(screen.getByText(/It ends within 30 days/)).toBeInTheDocument();
  });

  it('tells a member who is not an owner or admin who can send it, and offers no form', async () => {
    api.status.mockResolvedValue(status({ mayAttest: false, canSubmit: false }));
    renderPanel();

    expect(await screen.findByText(/Only an owner or admin of the organisation can send its safety attestation/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Send/ })).not.toBeInTheDocument();
  });

  it('shows nothing, and blocks nothing, for someone the server does not let see it', async () => {
    api.status.mockRejectedValue({ response: { status: 404 } });
    const { container } = renderPanel();

    await waitFor(() => expect(api.status).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
