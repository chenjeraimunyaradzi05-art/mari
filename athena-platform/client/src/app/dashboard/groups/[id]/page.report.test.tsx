import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Reporting a group as a whole.
 *
 * A post in a group could be reported; the group itself, with a name and a
 * description that can be the whole problem, could not. The control is on the
 * group's page for any signed-in member who is not its admin, and it sends the
 * group's id, which the server routes to whoever created it.
 */

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'g1' }),
  useSearchParams: () => new URLSearchParams(),
}));

let mockRole: string | null = null;
let mockUser: { id: string } | null = { id: 'me' };

jest.mock('@/lib/hooks', () => ({
  useAuthStore: () => ({ user: mockUser }),
  useGroup: () => ({
    data: {
      id: 'g1',
      name: 'Quick money',
      description: 'DM me for a deal',
      privacy: 'public',
      memberCount: 40,
      isMember: false,
      role: mockRole,
      adminCount: 1,
    },
  }),
  useGroupPosts: () => ({ data: [], isError: false }),
  useJoinGroup: () => ({ mutate: jest.fn(), isPending: false }),
  useLeaveGroup: () => ({ mutate: jest.fn(), isPending: false }),
  useCancelMyGroupJoinRequest: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteGroupPost: () => ({ mutate: jest.fn() }),
  useMyGroupJoinRequest: () => ({ data: undefined }),
}));

jest.mock('@/lib/api', () => ({
  groupsApi: { listJoinRequests: jest.fn() },
  safetyApi: { createReport: jest.fn() },
}));

jest.mock('@/components/community/PostCard', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/community/GroupComposer', () => ({ GroupComposer: () => null }));
jest.mock('@/components/community/GroupChat', () => ({ GroupChat: () => null }));
jest.mock('@/components/community/GroupMembers', () => ({ GroupMembers: () => null }));
jest.mock('@/components/community/GroupJoinRequests', () => ({ GroupJoinRequests: () => null }));
jest.mock('@/components/community/GroupSettings', () => ({ GroupSettings: () => null }));

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GroupDetailPage from './page';
import { safetyApi } from '@/lib/api';

const createReport = safetyApi.createReport as unknown as jest.Mock;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GroupDetailPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = null;
  mockUser = { id: 'me' };
  createReport.mockResolvedValue({ data: { success: true } });
});

it('reports the group by its id, with the reason she chooses', async () => {
  renderPage();

  fireEvent.click(await screen.findByRole('button', { name: /Report group/ }));
  expect(await screen.findByText('Report this group', { selector: 'h3' })).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('Spam or misleading'));
  fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

  await waitFor(() => expect(createReport).toHaveBeenCalledTimes(1));
  expect(createReport).toHaveBeenCalledWith({ targetType: 'group', targetId: 'g1', reason: 'spam', details: undefined });
});

it('is not offered to the group\'s own admin, or to someone who is not signed in', async () => {
  mockRole = 'admin';
  const { unmount } = renderPage();
  await screen.findByText('Quick money');
  expect(screen.queryByRole('button', { name: /Report group/ })).not.toBeInTheDocument();
  unmount();

  mockRole = null;
  mockUser = null;
  renderPage();
  await screen.findByText('Quick money');
  expect(screen.queryByRole('button', { name: /Report group/ })).not.toBeInTheDocument();
});
