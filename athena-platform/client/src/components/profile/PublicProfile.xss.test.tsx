import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HOSTILE_TEXT, liveMarkupIn } from '@/test-support/xss';

/**
 * A profile is the page every other member opens, and every field on it is text
 * its owner typed: name, headline, bio, job titles, school, skills and the two
 * links. None of it may be drawn as anything but text, and neither link may be
 * a script address.
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

function renderProfile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PublicProfile userId="mei" />
    </QueryClientProvider>
  );
}

const hostileProfile = {
  id: 'mei',
  firstName: HOSTILE_TEXT,
  lastName: HOSTILE_TEXT,
  displayName: HOSTILE_TEXT,
  headline: HOSTILE_TEXT,
  bio: HOSTILE_TEXT,
  city: HOSTILE_TEXT,
  state: 'QLD',
  currentJobTitle: HOSTILE_TEXT,
  currentCompany: HOSTILE_TEXT,
  createdAt: '2026-09-05T10:00:00.000Z',
  _count: { followers: 1, following: 1, posts: 0 },
  profile: { aboutMe: HOSTILE_TEXT, websiteUrl: 'javascript:alert(1)', linkedinUrl: 'JaVaScRiPt:alert(2)' },
  skills: [{ id: 's1', skill: { id: 's1', name: HOSTILE_TEXT } }],
  education: [{ id: 'e1', institution: HOSTILE_TEXT, degree: HOSTILE_TEXT, fieldOfStudy: HOSTILE_TEXT, startDate: '2020-01-01', endDate: '2023-01-01' }],
  experience: [{ id: 'x1', company: HOSTILE_TEXT, title: HOSTILE_TEXT, location: HOSTILE_TEXT, startDate: '2023-02-01', current: true, description: HOSTILE_TEXT }],
};

describe('a profile whose every field is hostile', () => {
  it('draws all of it as text', () => {
    mockProfile = hostileProfile;

    const { container } = renderProfile();

    expect(liveMarkupIn(container)).toEqual([]);
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    // It was drawn (the bio is on the page), as the characters the member typed.
    expect(screen.getAllByText(/<img src=x onerror=alert\(1\)>/).length).toBeGreaterThan(0);
  });

  it('does not draw a script address as a link', () => {
    mockProfile = hostileProfile;

    const { container } = renderProfile();

    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.filter((href) => /^\s*(javascript|data|vbscript):/i.test(href))).toEqual([]);
    expect(screen.queryByText('Website')).not.toBeInTheDocument();
    expect(screen.queryByText('LinkedIn')).not.toBeInTheDocument();
  });

  it('still draws a real website and LinkedIn address', () => {
    mockProfile = {
      ...hostileProfile,
      profile: { websiteUrl: 'https://example.org/me', linkedinUrl: 'https://www.linkedin.com/in/someone' },
    };

    renderProfile();

    expect(screen.getByText('Website').closest('a')).toHaveAttribute('href', 'https://example.org/me');
    expect(screen.getByText('LinkedIn').closest('a')).toHaveAttribute('href', 'https://www.linkedin.com/in/someone');
  });
});
