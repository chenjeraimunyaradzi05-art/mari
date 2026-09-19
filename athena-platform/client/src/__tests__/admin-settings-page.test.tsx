import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminSettingsPage from '@/app/admin/settings/page';

jest.mock('@/lib/admin-ops-api', () => ({
  adminOpsApi: { summary: jest.fn(), config: jest.fn(), featureFlags: jest.fn() },
}));

import { adminOpsApi } from '@/lib/admin-ops-api';

const mocked = adminOpsApi as unknown as { summary: jest.Mock; config: jest.Mock; featureFlags: jest.Mock };

const summary = (overrides: Partial<{ enabled: boolean; startedAt: string | null }> = {}) => ({
  data: {
    maintenance: { enabled: false, message: 'Back soon', startedAt: null, endsAt: null, updatedBy: null, updatedAt: null, ...overrides },
    breaches: { awaitingNotification: 2, overdue: 1, dueWithin24Hours: 0, nextDeadlineAt: null },
    legalHolds: { active: 0 },
    authorityEscalations: { awaitingFiling: 3 },
  },
});

const config = (overrides: Record<string, unknown> = {}) => ({
  data: {
    build: { service: 'athena-server', version: null, node: 'v20.11.0', environment: 'production', buildTime: null, commitSha: null },
    maintenance: { enabled: false, message: 'Back soon', startedAt: null, endsAt: null, updatedBy: null, updatedAt: null },
    rateLimit: { enabled: true, windowMs: 900000, max: 100 },
    tokens: { accessSeconds: 3600, refreshSeconds: 2592000 },
    security: { staffTwoFactor: 'required' },
    storage: { backend: 'local', region: null, bucketConfigured: false, cdnConfigured: false },
    integrations: {
      email: true,
      stripe: false,
      ai: false,
      aiSimulationAllowed: false,
      redis: false,
      openSearch: false,
      livestreamIngest: false,
      livestreamPlayback: false,
      sentry: false,
    },
    checkedAt: '2026-09-19T00:00:00.000Z',
    ...overrides,
  },
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminSettingsPage />
    </QueryClientProvider>
  );
}

describe('Admin settings page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.summary.mockResolvedValue(summary());
    mocked.config.mockResolvedValue(config());
    mocked.featureFlags.mockResolvedValue({ data: { flags: [{ id: '1' }, { id: '2' }] } });
  });

  it('shows what the server reported and says "not recorded" where it knows nothing', async () => {
    renderPage();

    expect(await screen.findByText('Off, the platform is open')).toBeInTheDocument();
    expect(screen.getByText('1 hour')).toBeInTheDocument();
    expect(screen.getByText('30 days')).toBeInTheDocument();
    expect(screen.getByText('100 requests per 15 minutes')).toBeInTheDocument();
    expect(screen.getByText('Local disk on the API host')).toBeInTheDocument();
    expect(screen.getByText('Required before any staff power works')).toBeInTheDocument();
    expect(screen.getByText('1 overdue')).toBeInTheDocument();

    // Version and commit were not provided, so nothing is guessed.
    expect(screen.getAllByText('Not recorded').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Not configured').length).toBeGreaterThan(0);
    expect(screen.getByText('Configured')).toBeInTheDocument();

    // The old invented values are gone for good.
    expect(screen.queryByText(/CloudFront/)).not.toBeInTheDocument();
    expect(screen.queryByText(/7 days/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Last Deploy/)).not.toBeInTheDocument();
  });

  it('shows maintenance as on when it is on', async () => {
    mocked.summary.mockResolvedValue(summary({ enabled: true, startedAt: new Date(Date.now() - 60_000).toISOString() }));
    renderPage();

    expect(await screen.findByText(/^On, since/)).toBeInTheDocument();
  });

  it('says so when the API refuses', async () => {
    mocked.config.mockRejectedValue({ response: { data: { error: 'Forbidden' } } });
    renderPage();

    expect(await screen.findByText('The API did not answer')).toBeInTheDocument();
    expect(screen.getByText('Forbidden')).toBeInTheDocument();
  });
});
