import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * A visitor with no account is shown a member's card, not her record (the API
 * answers GET /users/:id with name, picture, headline and counts and
 * `signInRequired: true`). The page has to say so in words that are true: the
 * line that says "approves who follows them" is for a member who is signed in
 * and not yet a follower, and a visitor reading it would be told something
 * about the member that is not the reason she is looking at a card.
 */

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

let mockProfile: Record<string, unknown> = {};
let mockSignedIn = false;
jest.mock('@/lib/hooks', () => ({
  useAuth: () => ({ user: mockSignedIn ? { id: 'viewer-1' } : null, isAuthenticated: mockSignedIn }),
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

const card = {
  id: 'mei',
  firstName: 'Mei',
  displayName: 'Mei C.',
  headline: 'Product lead',
  createdAt: '2026-09-05T10:00:00.000Z',
  _count: { followers: 12, following: 3, posts: 0 },
  isLimited: true,
};

function renderProfile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PublicProfile userId="mei" />
    </QueryClientProvider>
  );
}

describe('a card shown to a visitor with no account', () => {
  beforeEach(() => {
    mockSignedIn = false;
  });

  it('says that the rest is behind sign-in, and offers to sign in or join', () => {
    mockProfile = { ...card, signInRequired: true };

    renderProfile();

    expect(screen.getByRole('heading', { name: 'Sign in to see more of Mei C.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?redirect=%2Fprofile%2Fmei');
    expect(screen.getByRole('link', { name: 'Join ATHENA' })).toHaveAttribute('href', '/register');
  });

  it('does not say she approves who follows her: that is not why this is a card', () => {
    mockProfile = { ...card, signInRequired: true };

    renderProfile();

    expect(screen.queryByText(/approves who follows/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/request to follow/i)).not.toBeInTheDocument();
  });

  it('does not say that posts are shared with followers, or that signing in would show posts, for a public profile with none', () => {
    mockProfile = { ...card, signInRequired: true, approvesFollowers: false };

    renderProfile();

    expect(screen.getByText('Mei C. has not posted yet.')).toBeInTheDocument();
    expect(screen.queryByText('Posts are shared with followers.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Sign in to see their posts/)).not.toBeInTheDocument();
  });

  it('promises only what signing in does for a profile that is open to all members', () => {
    mockProfile = { ...card, signInRequired: true, approvesFollowers: false };

    renderProfile();

    expect(screen.getByText('The rest of a profile is shown to members who are signed in. Sign in or join to see it.')).toBeInTheDocument();
  });

  it('says that following is the way in for a connections-only profile, and that posts are for followers', () => {
    mockProfile = { ...card, signInRequired: true, approvesFollowers: true };

    renderProfile();

    expect(screen.getByText('Mei C. shares more with the people who follow them. Sign in to ask to follow.')).toBeInTheDocument();
    expect(screen.getByText('Posts are shared with followers.')).toBeInTheDocument();
  });

  it('draws no work, education, skills or links, because none was sent', () => {
    mockProfile = { ...card, signInRequired: true };

    renderProfile();

    for (const heading of ['Experience', 'Education', 'Skills', 'Links']) {
      expect(screen.queryByRole('heading', { name: heading })).not.toBeInTheDocument();
    }
  });
});

describe('a connections-only card shown to a signed-in member', () => {
  it('still asks her to request to follow, with no prompt to sign in', () => {
    mockSignedIn = true;
    mockProfile = { ...card, approvesFollowers: true };

    renderProfile();

    expect(screen.getByText('Mei C. approves who follows them')).toBeInTheDocument();
    expect(screen.queryByText(/Sign in to see more/)).not.toBeInTheDocument();
    expect(screen.getByText('Posts are shared with followers.')).toBeInTheDocument();
  });
});
