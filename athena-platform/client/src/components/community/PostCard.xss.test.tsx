import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HOSTILE_TEXT, liveMarkupIn } from '@/test-support/xss';

/**
 * A post card is drawn for every viewer of the feed, from text its author typed
 * (the words, the name, the headline, a picture's description, a poll) and from
 * a link preview a stranger's web page supplied. A post is the one thing a
 * member writes that reaches people who never asked to see it, so this is the
 * place a stored script would do the most harm.
 */

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/hooks', () => ({
  useAuthStore: () => ({ user: { id: 'viewer-1' } }),
  useDeletePost: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/lib/social-hooks', () => ({
  usePinPost: () => ({ mutate: jest.fn() }),
  useReactToPost: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/lib/impressions', () => ({ useImpression: () => ({ current: null }) }));
jest.mock('@/lib/api', () => ({
  postApi: { update: jest.fn(), save: jest.fn(), unsave: jest.fn(), setCommentsOff: jest.fn() },
}));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
// The thread under a post has its own test; here it is only a placeholder.
jest.mock('./CommentSection', () => ({ __esModule: true, default: () => null }));
jest.mock('./SharePostDialog', () => ({ SharePostDialog: () => null }));
jest.mock('./PostInsightsDialog', () => ({ PostInsightsDialog: () => null }));
jest.mock('./SaveToCollection', () => ({ SaveToCollection: () => null }));
jest.mock('./ReactionsDialog', () => ({ ReactionsDialog: () => null }));
jest.mock('./WhyThis', () => ({ WhyThis: () => null }));
jest.mock('@/components/safety/ReportDialog', () => ({ ReportDialog: () => null }));

import PostCard from './PostCard';

function draw(post: Record<string, unknown>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PostCard post={post} />
    </QueryClientProvider>
  );
}

const hostilePost = {
  id: 'p-1',
  type: 'TEXT',
  content: `${HOSTILE_TEXT} #tag https://example.org/ok`,
  createdAt: '2026-10-01T03:00:00.000Z',
  author: {
    id: 'a-1',
    firstName: HOSTILE_TEXT,
    lastName: HOSTILE_TEXT,
    displayName: HOSTILE_TEXT,
    headline: HOSTILE_TEXT,
    avatar: null,
  },
  likeCount: 0,
  commentCount: 0,
  linkPreview: { url: 'javascript:alert(1)', title: HOSTILE_TEXT, description: HOSTILE_TEXT, siteName: HOSTILE_TEXT, image: null },
};

describe('a post whose every field is hostile', () => {
  it('is drawn as text, with nothing in it that can run', () => {
    const { container } = draw(hostilePost);

    expect(liveMarkupIn(container)).toEqual([]);
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    // It was drawn, as the characters the author typed.
    expect(screen.getAllByText(/<img src=x onerror=alert\(1\)>/).length).toBeGreaterThan(0);
  });

  it('does not link to a script address from the link preview', () => {
    const { container } = draw(hostilePost);

    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.filter((href) => /^\s*(javascript|data|vbscript):/i.test(href))).toEqual([]);
  });

  it('keeps the one real link in the words live', () => {
    const { container } = draw(hostilePost);

    const link = Array.from(container.querySelectorAll('a')).find((a) => a.getAttribute('href') === 'https://example.org/ok');
    expect(link).toBeDefined();
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('draws a picture\'s description as an attribute value, not as markup', () => {
    const { container } = draw({
      ...hostilePost,
      type: 'IMAGE',
      mediaUrls: ['https://cdn.example.org/a.jpg'],
      mediaAlt: ['"><img src=x onerror=alert(1)>'],
    });

    expect(liveMarkupIn(container)).toEqual([]);
    expect(container.querySelector('img[onerror]')).toBeNull();
  });
});
