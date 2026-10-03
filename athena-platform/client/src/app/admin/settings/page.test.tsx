import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The payments switch on the admin settings page.
 *
 * The incident runbook sends whoever is on call to stop new payments, and the
 * only stop used to be taking the whole product offline. This card pauses and
 * resumes new payments with no deploy. Each direction takes two steps, because
 * each is a decision about every member's money, and the confirmation says what
 * it will do.
 */

jest.mock('@/lib/admin-ops-api', () => ({
  adminOpsApi: {
    summary: jest.fn(),
    config: jest.fn(),
    featureFlags: jest.fn(),
    paymentsPause: jest.fn(),
    setPaymentsPause: jest.fn(),
  },
}));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

import AdminSettingsPage from './page';
import { adminOpsApi } from '@/lib/admin-ops-api';
import toast from 'react-hot-toast';

const api = adminOpsApi as unknown as Record<'summary' | 'config' | 'featureFlags' | 'paymentsPause' | 'setPaymentsPause', jest.Mock>;

const summary = {
  maintenance: { enabled: false, message: '', startedAt: null, endsAt: null, updatedBy: null, updatedAt: null },
  breaches: { awaitingNotification: 0, overdue: 0, dueWithin24Hours: 0, nextDeadlineAt: null },
  legalHolds: { active: 0 },
  authorityEscalations: { awaitingFiling: 0 },
};
const config = {
  build: { service: 'api', version: '1.0.0', node: 'v22', environment: 'production', buildTime: null, commitSha: null },
  maintenance: summary.maintenance,
  rateLimit: { enabled: true, windowMs: 900000, max: 1500 },
  tokens: { accessSeconds: 900, refreshSeconds: 604800 },
  security: { staffTwoFactor: 'required' },
  storage: { backend: 's3', region: 'ap-southeast-2', bucketConfigured: true, cdnConfigured: false },
  integrations: { email: true, stripe: true, ai: true, aiSimulationAllowed: false, redis: true, openSearch: false, livestreamIngest: false, livestreamPlayback: false, sentry: true },
  checkedAt: '2026-10-01T00:00:00.000Z',
};

const open = { paused: false, message: 'Payments are paused while we finish checking that they work properly.', startedAt: null, updatedAt: null };
const paused = { ...open, paused: true, message: 'We are checking payments.', startedAt: '2026-10-01T00:00:00.000Z' };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminSettingsPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  api.summary.mockResolvedValue({ data: summary });
  api.config.mockResolvedValue({ data: config });
  api.featureFlags.mockResolvedValue({ data: { flags: [] } });
  api.paymentsPause.mockResolvedValue({ data: open });
});

describe('the payments switch', () => {
  it('says payments are open, and offers to pause them', async () => {
    renderPage();

    expect(await screen.findByText('Open, members can pay')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause payments' })).toBeEnabled();
  });

  it('asks before it pauses, says what that does, and sends nothing until it is confirmed', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Pause payments' }));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(/stops every new charge, hold, payout and transfer within a few seconds/);
    expect(dialog).toHaveTextContent(/Refunds, handing a hold back to a buyer/);
    expect(api.setPaymentsPause).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(api.setPaymentsPause).not.toHaveBeenCalled();
  });

  it('pauses with the words the admin wrote, once confirmed, and says so', async () => {
    api.setPaymentsPause.mockResolvedValue({ data: paused });
    renderPage();

    fireEvent.change(await screen.findByLabelText(/What members see while payments are paused/), { target: { value: '  We are checking payments.  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pause payments' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, pause payments' }));

    await waitFor(() => expect(api.setPaymentsPause).toHaveBeenCalledWith({ enabled: true, message: 'We are checking payments.' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Payments are paused.'));
    // The page now shows the state it was told, with the words members see.
    expect(await screen.findByText(/^Paused/)).toBeInTheDocument();
    expect(screen.getByText('We are checking payments.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open payments again' })).toBeInTheDocument();
  });

  it('sends no message at all when the box is left blank, so the server uses its standard wording', async () => {
    api.setPaymentsPause.mockResolvedValue({ data: paused });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Pause payments' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, pause payments' }));

    await waitFor(() => expect(api.setPaymentsPause).toHaveBeenCalledWith({ enabled: true }));
  });

  it('shows a paused state, what members see, and asks before it opens payments again', async () => {
    api.paymentsPause.mockResolvedValue({ data: paused });
    api.setPaymentsPause.mockResolvedValue({ data: open });
    renderPage();

    expect(await screen.findByText(/^Paused/)).toBeInTheDocument();
    expect(screen.getByText('We are checking payments.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open payments again' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/opens payments again within a few seconds/);
    expect(api.setPaymentsPause).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, open payments' }));
    await waitFor(() => expect(api.setPaymentsPause).toHaveBeenCalledWith({ enabled: false }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Payments are open again.'));
  });

  it('says the switch did not change anything when the save fails', async () => {
    api.setPaymentsPause.mockRejectedValue({ response: { data: { message: 'Only a platform admin can do that.' } } });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Pause payments' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, pause payments' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Only a platform admin can do that.'));
    expect(screen.getByText('Open, members can pay')).toBeInTheDocument();
  });

  it('shows no switch it cannot work when the state cannot be read', async () => {
    api.paymentsPause.mockRejectedValue(new Error('offline'));
    renderPage();

    expect(await screen.findByText('Payments')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Not recorded').length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: 'Pause payments' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open payments again' })).not.toBeInTheDocument();
  });
});
