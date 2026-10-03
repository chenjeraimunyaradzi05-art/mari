import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * What the badges say about themselves. Each is labelled for what stands
 * behind it: an approved identity, employer, educator or creator badge reads
 * Verified, and the mentor badge, which is a person reading what a mentor sent
 * and has no check behind it, reads Reviewed. The creator badge is for 10,000
 * followers and 90 days, counted by the server, so the card says how far she
 * is and does not offer an application that can only be refused.
 */

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

const mockGet = jest.fn();
jest.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args), post: jest.fn() },
}));

import VerificationSettingsPage from './page';

const badge = (type: string, status: string, extra: Record<string, unknown> = {}) => ({
  id: `${type}-1`,
  type,
  status,
  metadata: null,
  reason: null,
  submittedAt: '2026-09-01T00:00:00.000Z',
  reviewedAt: '2026-09-02T00:00:00.000Z',
  ...extra,
});

function serve(badges: unknown[], creator: Record<string, unknown> | null) {
  mockGet.mockImplementation(async (url: string) => {
    if (url === '/verification/badges') return { data: { data: badges } };
    if (url === '/verification/eligibility') return { data: { data: { creator } } };
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VerificationSettingsPage />
    </QueryClientProvider>
  );
}

const sectionFor = (title: string) => screen.getByRole('heading', { level: 2, name: new RegExp(`^${title}`) }).closest('section')!;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('the verification settings page', () => {
  it('calls an approved mentor badge Reviewed, and an approved identity badge Verified', async () => {
    serve([badge('MENTOR', 'APPROVED'), badge('IDENTITY', 'APPROVED')], null);

    renderPage();

    const mentor = await screen.findByRole('heading', { level: 2, name: /^Mentor/ });
    expect(within(mentor.closest('section')!).getByText('Reviewed')).toBeInTheDocument();
    expect(within(mentor.closest('section')!).queryByText('Verified')).not.toBeInTheDocument();
    expect(within(sectionFor('Identity')).getByText('Verified')).toBeInTheDocument();
  });

  it('says the mentor badge is a review and not a background check', async () => {
    serve([], null);

    renderPage();

    const mentor = await screen.findByRole('heading', { level: 2, name: /^Mentor/ });
    expect(within(mentor.closest('section')!).getByText(/not a background or police check/i)).toBeInTheDocument();
  });

  it('shows how far she is from the creator badge and holds the button back', async () => {
    serve([], { eligible: false, followers: 120, minFollowers: 10000, accountAgeDays: 12, minAccountAgeDays: 90 });

    renderPage();

    const progress = await screen.findByTestId('creator-progress');
    expect(progress).toHaveTextContent('You have 120 of 10,000 followers, and your account is 12 of 90 days old.');
    expect(within(sectionFor('Creator')).getByRole('button', { name: 'Apply' })).toBeDisabled();
  });

  it('offers the creator application once both are met', async () => {
    serve([], { eligible: true, followers: 12000, minFollowers: 10000, accountAgeDays: 200, minAccountAgeDays: 90 });

    renderPage();

    expect(await screen.findByTestId('creator-progress')).toHaveTextContent('You meet both');
    expect(within(sectionFor('Creator')).getByRole('button', { name: 'Apply' })).toBeEnabled();
  });

  it('leaves the other badges open to apply for whatever her follower count', async () => {
    serve([], { eligible: false, followers: 0, minFollowers: 10000, accountAgeDays: 1, minAccountAgeDays: 90 });

    renderPage();

    await screen.findByTestId('creator-progress');
    expect(within(sectionFor('Mentor')).getByRole('button', { name: 'Apply' })).toBeEnabled();
    expect(within(sectionFor('Employer')).getByRole('button', { name: 'Apply' })).toBeEnabled();
  });
});
