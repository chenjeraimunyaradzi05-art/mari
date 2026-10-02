import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HOSTILE_TEXT, liveMarkupIn } from '@/test-support/xss';

/**
 * A comment is written by someone other than the author of the post it sits
 * under, so it is read by a woman who did not choose to receive it. The words
 * and the commenter's name are drawn as text, replies included.
 */

jest.mock('@/lib/hooks', () => ({
  usePost: () => ({
    isLoading: false,
    data: {
      id: 'p-1',
      authorId: 'a-1',
      comments: [
        {
          id: 'c-1',
          content: `${HOSTILE_TEXT} https://example.org/ok`,
          createdAt: '2026-10-01T03:00:00.000Z',
          author: { id: 'u-1', firstName: HOSTILE_TEXT, lastName: HOSTILE_TEXT, displayName: HOSTILE_TEXT, avatar: null },
          replies: [
            {
              id: 'c-2',
              content: HOSTILE_TEXT,
              parentId: 'c-1',
              createdAt: '2026-10-01T03:01:00.000Z',
              author: { id: 'u-2', firstName: 'Ana', lastName: 'R', displayName: HOSTILE_TEXT, avatar: null },
            },
          ],
        },
      ],
    },
  }),
  useCommentOnPost: () => ({ mutate: jest.fn(), isPending: false }),
  useAuthStore: () => ({ user: { id: 'viewer-1', firstName: 'Viewer', avatar: null } }),
}));
jest.mock('@/lib/social-hooks', () => ({ useToggleCommentLike: () => ({ mutate: jest.fn() }) }));
jest.mock('@/lib/api', () => ({ postApi: { editComment: jest.fn(), deleteComment: jest.fn(), pinComment: jest.fn() } }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/components/safety/ReportDialog', () => ({ ReportDialog: () => null }));

import CommentSection from './CommentSection';

describe('a thread of hostile comments', () => {
  it('draws every comment, reply and commenter name as text', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <CommentSection postId="p-1" />
      </QueryClientProvider>
    );

    expect(liveMarkupIn(container)).toEqual([]);
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getAllByText(/<img src=x onerror=alert\(1\)>/).length).toBeGreaterThan(1);
  });
});
