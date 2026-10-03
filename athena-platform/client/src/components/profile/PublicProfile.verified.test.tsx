import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The identity blurb in Settings promises "a verified tick on your profile",
 * and the public profile never drew one: the API did not send the column and
 * the page had nowhere to put it. The tick is drawn from the server's
 * `isVerified` and from nothing else, and only when it is exactly true.
 */

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

let mockProfile: Record<string, unknown> = {};
jest.mock('@/lib/hooks', () => ({
  useAuth: () => ({ user: { id: 'viewer-1' }, isAuthenticated: true }),
  useProfile: () => ({ data: mockProfile, isLoading: false, error: null }),
  useFollow: () => ({ mutate: jest.fn() }),
  useUnfollow: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/lib/api', () => ({
  creatorApi: { getPublicProfile: jest.fn(async () => ({ data: { data: null } })) },
  postApi: { getUserPosts: jest.fn(async () => ({ data: { data: [] } })) },
  safetyApi: { blockUser: jest.fn() },
}));
jest.mock('@/lib/api-extensions', () => ({
  videoApi: { getUserVideos: jest.fn(async () => ({ data: { data: [] } })) },
}));
jest.mock('@/components/safety/ReportDialog', () => ({ ReportDialog: () => null }));
jest.mock('@/components/profile/StoryHighlights', () => ({ StoryHighlights: () => null }));
jest.mock('@/components/community/RepostEmbed', () => ({ originalAuthorName: () => '' }));
jest.mock('@/components/creator/SendGiftSheet', () => ({ SendGiftSheet: () => null }));
jest.mock('@/components/video/ManageReelSheet', () => ({ ManageReelSheet: () => null, REEL_STATUS_LABEL: {} }));

import { PublicProfile } from './PublicProfile';

const baseProfile = {
  id: 'mei',
  firstName: 'Mei',
  lastName: 'Chen',
  displayName: 'Mei C.',
  headline: 'Product lead',
  createdAt: '2026-09-05T10:00:00.000Z',
  _count: { followers: 12, following: 3, posts: 0 },
};

function renderProfile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PublicProfile userId="mei" />
    </QueryClientProvider>
  );
}

describe('the Verified mark on a public profile', () => {
  it('is drawn beside the name when the server says the identity was verified', () => {
    mockProfile = { ...baseProfile, isVerified: true };

    renderProfile();

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Mei C.');
    expect(heading).toHaveTextContent('Identity verified');
  });

  it.each([
    ['false', false],
    ['absent', undefined],
    ['the string "true", which the server never sends', 'true'],
  ])('is not drawn when the field is %s', (_label, isVerified) => {
    mockProfile = { ...baseProfile, ...(isVerified === undefined ? {} : { isVerified }) };

    renderProfile();

    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('Identity verified');
    expect(screen.queryByTitle('Identity verified')).not.toBeInTheDocument();
  });
});
