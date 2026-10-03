import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The box a creator ticks. Nothing is sent until she has ticked it; what is sent
 * names the version she read, so an acceptance of old text is never recorded as
 * one of the current text; a creator already on the current version is asked
 * nothing; and when the server refuses, its words are shown, not a guess.
 */

let auth: { user: { id: string } | null; isAuthenticated: boolean; isLoading: boolean } = {
  user: { id: 'me' },
  isAuthenticated: true,
  isLoading: false,
};
jest.mock('@/lib/hooks', () => ({ useAuthStore: () => auth }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/api', () => ({
  creatorApi: { getProfile: jest.fn(), enable: jest.fn(), acceptTerms: jest.fn() },
}));

import { CreatorTermsAcceptance } from './CreatorTermsAcceptance';
import { creatorApi } from '@/lib/api';
import { CREATOR_TERMS_VERSION } from '@/lib/creator-terms';

const api = creatorApi as unknown as { getProfile: jest.Mock; enable: jest.Mock; acceptTerms: jest.Mock };

function profile(data: unknown) {
  api.getProfile.mockResolvedValue({ data: { success: true, data } });
}

function renderBox() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CreatorTermsAcceptance />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  auth = { user: { id: 'me' }, isAuthenticated: true, isLoading: false };
  api.enable.mockResolvedValue({ data: { success: true } });
  api.acceptTerms.mockResolvedValue({ data: { success: true } });
});

describe('a member with no creator profile', () => {
  it('turns on creator mode only after ticking the box, sending the acceptance and the version she read', async () => {
    profile(null);
    renderBox();

    const button = await screen.findByRole('button', { name: 'Accept and turn on creator mode' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(api.enable).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(`version ${CREATOR_TERMS_VERSION}`) }));
    expect(button).toBeEnabled();
    fireEvent.click(button);

    await waitFor(() =>
      expect(api.enable).toHaveBeenCalledWith({ acceptCreatorTerms: true, termsVersion: CREATOR_TERMS_VERSION })
    );
    expect(api.acceptTerms).not.toHaveBeenCalled();
  });

  it('shows the server’s own words, and where it sends her, when it refuses', async () => {
    profile(null);
    api.enable.mockRejectedValue({
      response: {
        status: 403,
        data: { error: 'Please add your date of birth first.', code: 'DATE_OF_BIRTH_REQUIRED', setup: '/dashboard/settings/account' },
      },
    });
    renderBox();

    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Accept and turn on creator mode' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Please add your date of birth first.');
    expect(screen.getByRole('link', { name: 'Go there' })).toHaveAttribute('href', '/dashboard/settings/account');
  });
});

describe('a creator from before the addendum, or before it was last rewritten', () => {
  it('accepts the current version, and only that, after ticking the box', async () => {
    profile({ creatorTermsVersion: '2025-01-01', creatorTermsAcceptedAt: '2025-01-01T00:00:00Z' });
    renderBox();

    expect(await screen.findByText(/You accepted an earlier version/)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Accept the current version' });
    expect(button).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(button);

    await waitFor(() => expect(api.acceptTerms).toHaveBeenCalledWith(CREATOR_TERMS_VERSION));
    expect(api.enable).not.toHaveBeenCalled();
  });

  it('treats a profile that never recorded a version the same way', async () => {
    profile({ creatorTermsVersion: null, creatorTermsAcceptedAt: null });
    renderBox();

    expect(await screen.findByRole('button', { name: 'Accept the current version' })).toBeInTheDocument();
  });
});

describe('a creator on the current version', () => {
  it('is told so, with the date, and asked nothing', async () => {
    profile({ creatorTermsVersion: CREATOR_TERMS_VERSION, creatorTermsAcceptedAt: '2026-10-01T03:00:00Z' });
    renderBox();

    expect(await screen.findByText(/You accepted this version on 1 October 2026/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('everyone else', () => {
  it('asks a signed-out visitor to sign in, and reads nothing', () => {
    auth = { user: null, isAuthenticated: false, isLoading: false };
    renderBox();

    expect(screen.getByRole('link', { name: 'sign in' })).toHaveAttribute('href', '/login');
    expect(api.getProfile).not.toHaveBeenCalled();
  });

  it('says when it could not check her profile, rather than offering a box that would fail', async () => {
    api.getProfile.mockRejectedValue(new Error('offline'));
    renderBox();

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not check whether you have accepted this version yet');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
